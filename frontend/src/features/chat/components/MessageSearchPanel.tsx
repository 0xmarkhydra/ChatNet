import { useUiTranslation } from '@/shared/i18n/locale'
import { useEffect, useRef, useState } from 'react'
import { CalendarDays, ChevronDown, FileArchive, FileCode2, FileText, Search, UserRound, X } from 'lucide-react'
import type { Message } from '../types'
import UserAvatar from '../../../shared/ui/UserAvatar'
import { userLabel } from '../../../shared/utils/userLabel'
import '../styles/message-search-panel.css'

import { useMessageSearchData } from '../hooks/useMessageSearchData'

type Props = {
  conversationId: number
  channelId?: number
  request: (path: string, init?: RequestInit) => Promise<Response>
  onJump: (message: Message) => Promise<void>
  onClose: () => void
}

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


export default function MessageSearchPanel({ conversationId, channelId = 0, request, onJump, onClose }: Props) {
  const trUi = useUiTranslation()

  const { keyword,setKeyword,sender,setSender,from,setFrom,to,setTo,loading,loadingFiles,loadingMore,error,filesError,hasMore,nextFilesBefore,messageLimit,setMessageLimit,fileLimit,setFileLimit,jumpingId,hasFilters,invalidDates,messageHits,files,people,jumpTo,loadMoreMessages,loadMoreFiles } = useMessageSearchData({ conversationId, channelId, request, onJump, onClose })
  const [filterOpen, setFilterOpen] = useState<'sender' | 'date' | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
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

  const showResults = hasFilters && !invalidDates

  return (
    <section className="message-search-panel" role="dialog" aria-modal="true" aria-label={trUi("chat.searchInChat")}>
      <header className="message-search-panel-head">
        <strong>{trUi("chat.searchInChat")}</strong>
        <button type="button" onClick={onClose} aria-label={trUi("common.closeSearch")}><X size={22} /></button>
      </header>
      <div className="message-search-panel-controls">
        <div className="message-search-input">
          <Search size={21} aria-hidden="true" />
          <input ref={inputRef} value={keyword} placeholder={trUi("common.ui.searchMessagesFiles")} aria-label={trUi("common.ui.messageKeyword")}
            onChange={(event) => setKeyword(event.target.value)} />
          {keyword && <button className="message-search-clear" type="button" aria-label={trUi("common.ui.clearSearchKeyword")} title={trUi("common.ui.clearKeyword")} onClick={() => { setKeyword(''); inputRef.current?.focus() }}><X size={17} aria-hidden="true" /></button>}
        </div>
        <div className="message-search-filters">
          <span>Lọc theo:</span>
          <div className={sender ? 'message-search-filter-anchor selected' : 'message-search-filter-anchor'}>
            <button type="button" className="message-search-chip"
              aria-expanded={filterOpen === 'sender'} aria-controls="message-search-senders"
              onClick={() => setFilterOpen((current) => current === 'sender' ? null : 'sender')}>
              <UserRound size={17} aria-hidden="true" /><span>{sender ? (people.find((item) => item.username === sender)?.name || sender) : 'Người gửi'}</span><ChevronDown size={16} />
            </button>
            {sender && <button type="button" className="message-search-filter-remove" aria-label={trUi("chat.clearSenderFilter")}
              title={trUi("chat.clearSenderFilter")} onClick={() => { setSender(''); setFilterOpen(null) }}><X size={15} aria-hidden="true" /></button>}
            {filterOpen === 'sender' && <div className="message-search-popover" id="message-search-senders">
              <p>Chọn người gửi</p>
              <button type="button" className={!sender ? 'active' : ''} onClick={() => { setSender(''); setFilterOpen(null) }}>Tất cả người gửi</button>
              {people.map((person) => <button type="button" key={person.username} className={sender === person.username ? 'active' : ''}
                onClick={() => { setSender(person.username); setFilterOpen(null) }}>
                <UserAvatar className="message-search-sender-avatar" name={person.name} username={person.username} />
                <span>{person.name}</span>
              </button>)}
              <input type="search" aria-label={trUi("common.ui.senderUsername")} placeholder={trUi("common.ui.usernameAt")}
                value={sender} onChange={(event) => setSender(event.target.value.replace(/^@/, ''))} />
            </div>}
          </div>
          <div className={from || to ? 'message-search-filter-anchor selected' : 'message-search-filter-anchor'}>
            <button type="button" className="message-search-chip"
              aria-expanded={filterOpen === 'date'} aria-controls="message-search-dates"
              onClick={() => setFilterOpen((current) => current === 'date' ? null : 'date')}>
              <CalendarDays size={17} aria-hidden="true" /><span>Ngày gửi</span><ChevronDown size={16} />
            </button>
            {(from || to) && <button type="button" className="message-search-filter-remove" aria-label={trUi("chat.clearDateFilter")}
              title={trUi("chat.clearDateFilter")} onClick={() => { setFrom(''); setTo(''); setFilterOpen(null) }}><X size={15} aria-hidden="true" /></button>}
            {filterOpen === 'date' && <div className="message-search-popover message-search-date-popover" id="message-search-dates">
              <p>Khoảng thời gian</p>
              <label>Từ ngày<input type="date" value={from} max={to || undefined} onChange={(event) => setFrom(event.target.value)} /></label>
              <label>Đến ngày<input type="date" min={from || undefined} value={to} onChange={(event) => setTo(event.target.value)} /></label>
              <div className="message-search-date-actions">
                <button type="button" onClick={() => { setFrom(''); setTo('') }}>Xóa ngày</button>
                <button type="button" onClick={() => setFilterOpen(null)}>{trUi("common.done")}</button>
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
            <h3>{trUi("chat.messages")}</h3>

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
              onClick={() => { if (messageLimit < messageHits.length) setMessageLimit((value) => value + 10); else void loadMoreMessages() }}>{trUi("common.seeMore")}</button>}
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
              onClick={() => { if (fileLimit < files.length) setFileLimit((value) => value + 10); else void loadMoreFiles() }}>{trUi("common.seeMore")}</button>}
          </section>
        </>}
      </div>
    </section>
  )
}