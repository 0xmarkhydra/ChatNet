import { useEffect, useRef, useState } from 'react'
import type { Message } from './types'
import './message-search-panel.css'

type Props = {
  conversationId: number
  request: (path: string, init?: RequestInit) => Promise<Response>
  onJump: (message: Message) => Promise<void>
  onClose: () => void
}

const PAGE_SIZE = 40

export default function MessageSearchPanel({ conversationId, request, onJump, onClose }: Props) {
  const requestRef = useRef(request)
  requestRef.current = request
  const [keyword, setKeyword] = useState('')
  const [sender, setSender] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [results, setResults] = useState<Message[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const [hasMore, setHasMore] = useState(false)
  const [jumpingId, setJumpingId] = useState<number | null>(null)
  const sequence = useRef(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const queryRef = useRef('')
  const hasFilters = Boolean(keyword.trim() || sender.trim() || from || to)
  const invalidDates = Boolean(from && to && from > to)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    const id = ++sequence.current
    setResults([])
    setHasMore(false)
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
        const response = await requestRef.current(`/api/conversations/${conversationId}/messages?${query}`)
        if (!response.ok) throw new Error('Không thể tìm tin nhắn. Vui lòng thử lại.')
        const items = (await response.json()) as Message[]
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

  async function loadMore() {
    if (!hasMore || loadingMore || !results.length) return
    const cursor = results[results.length - 1].id
    setLoadingMore(true)
    try {
      const response = await request(`/api/conversations/${conversationId}/messages?${queryRef.current}&before=${cursor}`)
      if (!response.ok) throw new Error('Không thể tải thêm kết quả')
      const more = (await response.json()) as Message[]
      setResults((current) => {
        const ids = new Set(current.map((m) => m.id))
        return [...current, ...more.filter((m) => !ids.has(m.id))]
      })
      setHasMore(more.length === PAGE_SIZE)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Lỗi tải kết quả')
    } finally {
      setLoadingMore(false)
    }
  }

  return (
    <section className="message-search-panel" role="dialog" aria-modal="true" aria-label="Tìm trong hội thoại">
      <header className="message-search-panel-head">
        <strong>Tìm tin nhắn</strong>
        <button type="button" onClick={onClose} aria-label="Đóng tìm kiếm">✕</button>
      </header>
      <div className="message-search-panel-fields">
        <input ref={inputRef} type="search" placeholder="Nhập từ khóa..." aria-label="Từ khóa tin nhắn" value={keyword} onChange={(event) => setKeyword(event.target.value)} />
        <input type="search" placeholder="@username người gửi" aria-label="Lọc theo người gửi" value={sender} onChange={(event) => setSender(event.target.value)} />
        <div className="message-search-panel-dates">
          <label>Từ ngày<input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label>
          <label>Đến ngày<input type="date" min={from || undefined} value={to} onChange={(event) => setTo(event.target.value)} /></label>
        </div>
      </div>
      <div className="message-search-panel-results" aria-live="polite">
        {invalidDates ? <p className="message-search-empty">Ngày kết thúc phải sau ngày bắt đầu.</p> :
         !hasFilters ? <p className="message-search-empty">Nhập từ khóa hoặc chọn bộ lọc để tìm.</p> :
         loading ? <p className="message-search-empty">Đang tìm kiếm...</p> :
         error ? <p className="message-search-error">{error}</p> :
         results.length === 0 ? <p className="message-search-empty">Không tìm thấy tin nhắn phù hợp.</p> :
         results.map((message) => (
          <button key={message.id} className="message-search-result" type="button"
            disabled={jumpingId !== null}
            onClick={async () => {
              setJumpingId(message.id)
              try { await onJump(message); onClose() }
              catch { setError('Không mở được tin nhắn này.'); setJumpingId(null) }
            }}>
            <span className="message-search-result-top"><strong>{message.senderDisplayName || message.sender}</strong><small>{new Date(message.createdAt).toLocaleString('vi-VN')}</small></span>
            <span className="message-search-result-text">{message.deleted ? 'Tin nhắn đã thu hồi' : message.text || '[Tệp đính kèm]'}</span>
          </button>
         ))}
        {hasMore && !loading && <button className="message-search-load-more" type="button" onClick={() => void loadMore()} disabled={loadingMore}>{loadingMore ? 'Đang tải...' : 'Xem thêm kết quả'}</button>}
      </div>
    </section>
  )
}