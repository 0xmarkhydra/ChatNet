import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowRight, Search, X } from 'lucide-react'
import type { Conversation, Message } from '../types'
import type { MediaAttachment } from '../../../shared/utils/media'
import { attachmentRequestBody } from '../../../shared/utils/media'
import { API } from '../../../shared/lib/config'
import { attachmentLabel } from '../../../shared/utils/format'
import './message-forward-picker.css'

type Props = {
  message: Message
  conversations: Conversation[]
  request: (path: string, init?: RequestInit) => Promise<Response>
  uploadFiles: (files: File[], scope: 'chat' | 'feed' | 'story' | 'profile') => Promise<MediaAttachment[]>
  onClose: () => void
  onFeedback: (message: string, kind?: 'success' | 'error' | 'warning' | 'info') => void
}

export default function MessageForwardPicker({ message, conversations, request, uploadFiles, onClose, onFeedback }: Props) {
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const previousFocus = useRef<HTMLElement | null>(null)
  const options = conversations.filter(item => !item.blockedByMe && !item.blockedByOther &&
    item.name.toLocaleLowerCase('vi').includes(query.trim().toLocaleLowerCase('vi')))

  useEffect(() => {
    previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    inputRef.current?.focus()
    return () => previousFocus.current?.focus()
  }, [])

  async function submit(destination: Conversation) {
    if (busy || message.deleted) return
    setBusy(true)
    setError('')
    try {
      // Re-upload as the forwarding user. Reusing another person's storageRef is
      // rejected by the chat attachment ownership check.
      const files = await Promise.all((message.attachments || []).map(async item => {
        if (!item.url) throw new Error('Không thể tải tệp đính kèm để chuyển tiếp.')
        const url = new URL(item.url, window.location.origin)
        const apiOrigin = new URL(API, window.location.origin)
        const response = url.origin === apiOrigin.origin && url.pathname.startsWith('/api/')
          ? await request(url.pathname + url.search, { cache: 'no-store' })
          : await fetch(url.toString(), { cache: 'no-store' })
        if (!response.ok) throw new Error('Không thể tải tệp đính kèm để chuyển tiếp.')
        return new File([await response.blob()], item.name, { type: item.contentType })
      }))
      const attachments = files.length ? await uploadFiles(files, 'chat') : []
      if (attachments.length !== files.length) throw new Error('Không tải lên đủ tệp đính kèm.')
      const response = await request(`/api/conversations/${destination.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: crypto.randomUUID(),
          text: message.text,
          forwarded: true,
          attachments: attachments.map(attachmentRequestBody),
        }),
      })
      if (!response.ok) {
        const detail = await response.json().catch(() => null) as { error?: string } | null
        throw new Error(detail?.error || 'Không thể chuyển tiếp. Hãy kiểm tra quyền gửi ở cuộc trò chuyện đích.')
      }
      onFeedback(`Đã chuyển tiếp đến ${destination.name}.`, 'success')
      onClose()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không thể chuyển tiếp tin nhắn.')
    } finally {
      setBusy(false)
    }
  }

  return createPortal(
    <div className="chat-forward-backdrop" onMouseDown={event => {
      if (!busy && event.currentTarget === event.target) onClose()
    }}>
      <section className="chat-forward-dialog" role="dialog" aria-modal="true" aria-labelledby="chat-forward-title"
        onKeyDown={event => {
          if (event.key === 'Escape' && !busy) onClose()
          if (event.key !== 'Tab') return
          const controls = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement | HTMLInputElement>(
            'button:not(:disabled), input:not(:disabled)',
          ))
          if (!controls.length) return
          if (event.shiftKey && document.activeElement === controls[0]) {
            event.preventDefault()
            controls[controls.length - 1].focus()
          } else if (!event.shiftKey && document.activeElement === controls[controls.length - 1]) {
            event.preventDefault()
            controls[0].focus()
          }
        }}>
        <header className="chat-forward-header">
          <div><h2 id="chat-forward-title">Chuyển tiếp tin nhắn</h2><p>Chọn cuộc trò chuyện nhận</p></div>
          <button type="button" title="Đóng" aria-label="Đóng chuyển tiếp" disabled={busy} onClick={onClose}><X size={20} /></button>
        </header>
        <div className="chat-forward-preview">{message.text || attachmentLabel(message.attachments)}</div>
        <label className="chat-forward-search">
          <Search size={18} aria-hidden="true" />
          <input ref={inputRef} value={query} onChange={event => setQuery(event.target.value)}
            placeholder="Tìm cá nhân hoặc nhóm" aria-label="Tìm hội thoại chuyển tiếp" />
        </label>
        <div className="chat-forward-list">
          {options.map(destination => (
            <button type="button" key={destination.id} className="chat-forward-recipient"
              disabled={busy} onClick={() => void submit(destination)}>
              <span className="chat-forward-recipient-avatar" aria-hidden="true">{destination.type === 'group' ? '👥' : '👤'}</span>
              <span className="chat-forward-recipient-name">{destination.name}<small>{destination.type === 'group' ? 'Nhóm' : 'Cá nhân'}</small></span>
              <ArrowRight size={18} aria-hidden="true" />
            </button>
          ))}
          {options.length === 0 && <p className="chat-forward-empty">Không có cuộc trò chuyện phù hợp.</p>}
        </div>
        {busy && <p className="chat-forward-status" role="status">Đang chuyển tiếp…</p>}
        {error && <p className="chat-forward-error" role="alert">{error}</p>}
      </section>
    </div>, document.body,
  )
}
