import { useEffect, useMemo, useRef, useState } from 'react'
import { CalendarDays, ChevronDown, FileArchive, FileCode2, FileText, Search, UserRound, X } from 'lucide-react'
import type { GroupMember, Message } from './types'
import UserAvatar from '../../shared/ui/UserAvatar'
import { userLabel } from '../../shared/lib/userLabel'
import './message-search-panel.css'

type Props = {
  conversationId: number
  request: (path: string, init?: RequestInit) => Promise<Response>
  onJump: (message: Message) => Promise<void>
  onClose: () => void
}

type SharedPage = { items: Message[]; nextBefore?: number }
const PAGE_SIZE = 40
const PREVIEW_COUNT = 4

function dateLabel(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

function fileSize(value: number) {
  if (!Number.isFinite(value) || value <= 0) return ''
  return value >= 1048576 ? (value / 1048576).toFixed(2) + ' MB' : Math.max(1, Math.round(value / 1024)) + ' KB'
}

function highlight(value: string, keyword: string) {
  const query = keyword.trim()
  if (!query) return value
  const index = value.toLocaleLowerCase('vi-VN').indexOf(query.toLocaleLowerCase('vi-VN'))
  if (index < 0) return value
  return <>{value.slice(0, index)}<mark>{value.slice(index, index + query.length)}</mark>{value.slice(index + query.length)}</>
}

function searchFileName(message: Message, keyword: string) {
  return (message.attachments || []).some((attachment) =>
    (attachment.kind === 'file' || attachment.kind === 'audio') &&
    (!keyword || attachment.name.toLocaleLowerCase('vi-VN').includes(keyword.toLocaleLowerCase('vi-VN'))))
}

function matchesFilters(message: Message, sender: string, from: string, to: string) {
  if (sender && message.sender.toLocaleLowerCase('vi-VN') !== sender.toLocaleLowerCase('vi-VN')) return false
  const day = new Date(message.createdAt)
  if (Number.isNaN(day.getTime())) return false
  const localDay = day.getFullYear() + '-' + String(day.getMonth() + 1).padStart(2, '0') + '-' + String(day.getDate()).padStart(2, '0')
  return (!from || localDay >= from) && (!to || localDay <= to)
}

export default function MessageSearchPanel({ conversationId, request, onJump, onClose }: Props) {
  const requestRef = useRef(request)
  requestRef.current = request
  const [keyword, setKeyword] = useState('')
  const [sender, setSender] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [filterOpen, setFilterOpen] = useState<'sender' | 'date' | null>(null)
  const [members, setMembers] = useState<GroupMember[]>([])
  const [results, setResults] = useState<Message[]>([])
  const [fileMessages, setFileMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingFiles, setLoadingFiles] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const [filesError, setFilesError] = useState('')
  const [hasMore, setHasMore] = useState(false)
  const [nextFilesBefore, setNextFilesBefore] = useState<number | undefined>()
  const [messageLimit, setMessageLimit] = useState(PREVIEW_COUNT)
  const [fileLimit, setFileLimit] = useState(PREVIEW_COUNT)
  const [jumpingId, setJumpingId] = useState<number | null>(null)
  const sequence = useRef(0)
  const fileSequence = useRef(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const queryRef = useRef('')
  const hasFilters = Boolean(keyword.trim() || sender.trim() || from || to)
  const invalidDates = Boolean(from && to && from > to)

  useEffect(() => { inputRef.current?.focus() }, [])
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (filterOpen) setFilterOpen(null)
        else onClose()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [filterOpen, onClose])

  useEffect(() => {
    let alive = true
    setMembers([])
    void requestRef.current('/api/conversations/' + conversationId + '/members')
      .then(async (response) => response.ok ? await response.json() as GroupMember[] : [])
      .then((items) => { if (alive && Array.isArray(items)) setMembers(items) })
      .catch(() => { /* Some direct conversations do not expose a members list. */ })
    return () => { alive = false }
  }, [conversationId])

  useEffect(() => {
    const id = ++sequence.current
    setResults([])
    setHasMore(false)
    setMessageLimit(PREVIEW_COUNT)
    setError('')
    if (!hasFilters || invalidDates) { setLoading(false); return }
    setLoading(true)
    const timer = window.setTimeout(async () => {
      try {
        const params = new URLSearchParams({ limit: String(PAGE_SIZE) })
        if (keyword.trim()) params.set('search', keyword.trim())
        if (sender.trim()) params.set('sender', sender.trim().replace(/^@/, ''))
        if (from) params.set('from', from)
        if (to) params.set('to', to)
        params.set('tzOffset', String(new Date().getTimezoneOffset()))
        const query = params.toString()
        const response = await requestRef.current('/api/conversations/' + conversationId + '/messages?' + query)
        if (!response.ok) throw new Error('Không thể tìm tin nhắn. Vui lòng thử lại.')
        const items = await response.json() as Message[]
        if (sequence.current !== id) return
        queryRef.current = query
        setResults(items)
        setHasMore(items.length === PAGE_SIZE)
      } catch (cause) {
        if (sequence.current === id) setError(cause instanceof Error ? cause.message : 'Lỗi tìm kiếm')
      } finally {
        if (sequence.current === id) setLoading(false)
      }
    }, 300)
    return () => { window.clearTimeout(timer); ++sequence.current }
  }, [conversationId, keyword, sender, from, to, hasFilters, invalidDates])

  // The message search API filters text only; shared files supply filename matches.
  useEffect(() => {
    const id = ++fileSequence.current
    setFileMessages([])
    setNextFilesBefore(undefined)
    setFileLimit(PREVIEW_COUNT)
    setFilesError('')
    if (!hasFilters || invalidDates) { setLoadingFiles(false); return }
    setLoadingFiles(true)
    const timer = window.setTimeout(async () => {
      try {
        const response = await requestRef.current('/api/conversations/' + conversationId + '/shared?kind=files&limit=48')
        if (!response.ok) throw new Error('Không tải được danh sách file')
        const page = await response.json() as SharedPage
        if (fileSequence.current !== id) return
        setFileMessages(Array.isArray(page.items) ? page.items : [])
        setNextFilesBefore(page.nextBefore)
      } catch (cause) {
        if (fileSequence.current === id) setFilesError(cause instanceof Error ? cause.message : 'Không tải được danh sách file')
      } finally {
        if (fileSequence.current === id) setLoadingFiles(false)
      }
    }, 300)
    return () => { window.clearTimeout(timer); ++fileSequence.current }
  }, [conversationId, keyword, sender, from, to, hasFilters, invalidDates])

  const fileHits = useMemo(() => fileMessages.filter((message) =>
    !message.deleted && matchesFilters(message, sender, from, to) && searchFileName(message, keyword.trim())
  ), [fileMessages, sender, from, to, keyword])

  const messageHits = useMemo(() => {
    const byId = new Map<number, Message>()
    for (const message of results) if (!message.deleted) byId.set(message.id, message)
    for (const message of fileHits) if (!byId.has(message.id)) byId.set(message.id, message)
    return [...byId.values()].sort((a, b) => b.id - a.id)
  }, [results, fileHits])

  const files = useMemo(() => fileHits.flatMap((message) =>
    (message.attachments || []).filter((attachment) =>
      (attachment.kind === 'file' || attachment.kind === 'audio') &&
      (!keyword.trim() || attachment.name.toLocaleLowerCase('vi-VN').includes(keyword.trim().toLocaleLowerCase('vi-VN')))
    ).map((attachment) => ({ message, attachment }))
  ), [fileHits, keyword])

  const people = useMemo(() => {
    const map = new Map<string, { username: string; name: string }>()
    for (const member of members) map.set(member.username, { username: member.username, name: userLabel(member.displayName, member.username) })
    for (const message of [...results, ...fileMessages]) {
      if (!map.has(message.sender)) map.set(message.sender, { username: message.sender, name: userLabel(message.senderDisplayName, message.sender) })
    }
    return [...map.values()]
  }, [members, results, fileMessages])

  async function jumpTo(message: Message) {
    setJumpingId(message.id)
    try { await onJump(message); onClose() }
    catch { setError('Không mở được tin nhắn này.'); setJumpingId(null) }
  }

  async function loadMoreMessages() {
    if (!hasMore || loadingMore || !results.length) return
    const cursor = Math.min(...results.map((message) => message.id))
    setLoadingMore(true)
    try {
      const response = await requestRef.current('/api/conversations/' + conversationId + '/messages?' + queryRef.current + '&before=' + cursor)
      if (!response.ok) throw new Error('Không thể tải thêm kết quả')
      const more = await response.json() as Message[]
      setResults((current) => {
        const ids = new Set(current.map((message) => message.id))
        return [...current, ...more.filter((message) => !ids.has(message.id))]
      })
      setHasMore(more.length === PAGE_SIZE)
      setMessageLimit((value) => value + 10)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Lỗi tải kết quả') }
    finally { setLoadingMore(false) }
  }

  async function loadMoreFiles() {
    if (!nextFilesBefore || loadingMore) return
    setLoadingMore(true)
    try {
      const response = await requestRef.current('/api/conversations/' + conversationId + '/shared?kind=files&limit=48&before=' + nextFilesBefore)
      if (!response.ok) throw new Error('Không thể tải thêm file')
      const page = await response.json() as SharedPage
      setFileMessages((current) => [...current, ...(Array.isArray(page.items) ? page.items : [])])
      setNextFilesBefore(page.nextBefore)
      setFileLimit((value) => value + 10)
    } catch (cause) { setFilesError(cause instanceof Error ? cause.message : 'Lỗi tải file') }
    finally { setLoadingMore(false) }
  }

  const showResults = hasFilters && !invalidDates

  return (
    <section className="message-search-panel" role="dialog" aria-modal="true" aria-label="Tìm kiếm trong trò chuyện">
      <header className="message-search-panel-head">
        <strong>Tìm kiếm trong trò chuyện</strong>
        <button type="button" onClick={onClose} aria-label="Đóng tìm kiếm"><X size={22} /></button>
      </header>
      <div className="message-search-panel-controls">
        <div className="message-search-input">
          <Search size={21} aria-hidden="true" />
          <input ref={inputRef} value={keyword} placeholder="Tìm kiếm tin nhắn, file..." aria-label="Từ khóa tin nhắn"
            onChange={(event) => setKeyword(event.target.value)} />
          {keyword && <button className="message-search-clear" type="button" aria-label="Xóa từ khóa tìm kiếm" title="Xóa từ khóa" onClick={() => { setKeyword(''); inputRef.current?.focus() }}><X size={17} aria-hidden="true" /></button>}
        </div>
        <div className="message-search-filters">
          <span>Lọc theo:</span>
          <div className={sender ? 'message-search-filter-anchor selected' : 'message-search-filter-anchor'}>
            <button type="button" className="message-search-chip"
              aria-expanded={filterOpen === 'sender'} aria-controls="message-search-senders"
              onClick={() => setFilterOpen((current) => current === 'sender' ? null : 'sender')}>
              <UserRound size={17} aria-hidden="true" /><span>{sender ? (people.find((item) => item.username === sender)?.name || sender) : 'Người gửi'}</span><ChevronDown size={16} />
            </button>
            {sender && <button type="button" className="message-search-filter-remove" aria-label="Xóa lọc người gửi"
              title="Xóa lọc người gửi" onClick={() => { setSender(''); setFilterOpen(null) }}><X size={15} aria-hidden="true" /></button>}
            {filterOpen === 'sender' && <div className="message-search-popover" id="message-search-senders">
              <p>Chọn người gửi</p>
              <button type="button" className={!sender ? 'active' : ''} onClick={() => { setSender(''); setFilterOpen(null) }}>Tất cả người gửi</button>
              {people.map((person) => <button type="button" key={person.username} className={sender === person.username ? 'active' : ''}
                onClick={() => { setSender(person.username); setFilterOpen(null) }}>
                <UserAvatar className="message-search-sender-avatar" name={person.name} username={person.username} />
                <span>{person.name}</span>
              </button>)}
              <input type="search" aria-label="Nhập tên tài khoản người gửi" placeholder="@Tên tài khoản"
                value={sender} onChange={(event) => setSender(event.target.value.replace(/^@/, ''))} />
            </div>}
          </div>
          <div className={from || to ? 'message-search-filter-anchor selected' : 'message-search-filter-anchor'}>
            <button type="button" className="message-search-chip"
              aria-expanded={filterOpen === 'date'} aria-controls="message-search-dates"
              onClick={() => setFilterOpen((current) => current === 'date' ? null : 'date')}>
              <CalendarDays size={17} aria-hidden="true" /><span>Ngày gửi</span><ChevronDown size={16} />
            </button>
            {(from || to) && <button type="button" className="message-search-filter-remove" aria-label="Xóa lọc ngày gửi"
              title="Xóa lọc ngày gửi" onClick={() => { setFrom(''); setTo(''); setFilterOpen(null) }}><X size={15} aria-hidden="true" /></button>}
            {filterOpen === 'date' && <div className="message-search-popover message-search-date-popover" id="message-search-dates">
              <p>Khoảng thời gian</p>
              <label>Từ ngày<input type="date" value={from} max={to || undefined} onChange={(event) => setFrom(event.target.value)} /></label>
              <label>Đến ngày<input type="date" min={from || undefined} value={to} onChange={(event) => setTo(event.target.value)} /></label>
              <div className="message-search-date-actions">
                <button type="button" onClick={() => { setFrom(''); setTo('') }}>Xóa ngày</button>
                <button type="button" onClick={() => setFilterOpen(null)}>Xong</button>
              </div>
            </div>}
          </div>
        </div>
      </div>

      <div className="message-search-panel-results" aria-live="polite">
        {invalidDates && <p className="message-search-state error">Ngày kết thúc phải sau ngày bắt đầu.</p>}
        {!hasFilters && <p className="message-search-state">Nhập từ khóa hoặc chọn bộ lọc để tìm tin nhắn và file.</p>}
        {showResults && <>
          <section className="message-search-section">
            <h3>Tin nhắn</h3>

            {error && <p className="message-search-state error">{error}</p>}
            {!loading && !loadingFiles && !error && messageHits.length === 0 && <p className="message-search-state">Không tìm thấy tin nhắn phù hợp.</p>}
            {messageHits.slice(0, messageLimit).map((message) => {
              const name = userLabel(message.senderDisplayName, message.sender)
              const preview = message.text || (message.attachments || []).map((file) => file.name).join(', ') || 'Tệp đính kèm'
              return <button key={message.id} type="button" className="message-search-result" disabled={jumpingId !== null}
                onClick={() => void jumpTo(message)}>
                <UserAvatar className="message-search-result-avatar" name={name} username={message.sender} />
                <span className="message-search-result-content">
                  <span className="message-search-result-top"><span>{name}</span><time dateTime={message.createdAt}>{dateLabel(message.createdAt)}</time></span>
                  <span className="message-search-result-text">{highlight(preview, keyword)}</span>
                </span>
              </button>
            })}
            {(messageHits.length > messageLimit || hasMore) && <button className="message-search-load-more" type="button" disabled={loadingMore}
              onClick={() => { if (messageLimit < messageHits.length) setMessageLimit((value) => value + 10); else void loadMoreMessages() }}>
              Xem thêm
            </button>}
          </section>

          <section className="message-search-section message-search-file-section">
            <h3>File</h3>

            {filesError && <p className="message-search-state error">{filesError}</p>}
            {!loadingFiles && !filesError && files.length === 0 && <p className="message-search-state">Không có file phù hợp.</p>}
            {files.slice(0, fileLimit).map(({ message, attachment }, index) => {
              const ext = attachment.name.split('.').pop()?.toLowerCase() || ''
              const Icon = ['zip', 'rar', '7z'].includes(ext) ? FileArchive : ['java', 'js', 'ts', 'py'].includes(ext) ? FileCode2 : FileText
              return <button key={message.id + '-' + (attachment.id || attachment.storageRef || index)} type="button"
                className="message-search-file" disabled={jumpingId !== null} onClick={() => void jumpTo(message)}>
                <span className={'message-search-file-icon ext-' + ext}><Icon size={23} /><small>{ext.slice(0, 4).toUpperCase()}</small></span>
                <span className="message-search-file-content">
                  <span className="message-search-file-name">{highlight(attachment.name, keyword)}</span>
                  <span className="message-search-file-meta"><span>{fileSize(attachment.sizeBytes)}{attachment.sizeBytes ? ' - ' : ''}{userLabel(message.senderDisplayName, message.sender)}</span><time dateTime={message.createdAt}>{dateLabel(message.createdAt)}</time></span>
                </span>
              </button>
            })}
            {(files.length > fileLimit || Boolean(nextFilesBefore)) && <button className="message-search-load-more" type="button" disabled={loadingMore}
              onClick={() => { if (fileLimit < files.length) setFileLimit((value) => value + 10); else void loadMoreFiles() }}>
              Xem thêm
            </button>}
          </section>
        </>}
      </div>
    </section>
  )
}
