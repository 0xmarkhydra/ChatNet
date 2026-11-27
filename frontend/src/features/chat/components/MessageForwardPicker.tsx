import { useUiTranslation } from '@/shared/i18n/locale'
import { createPortal } from 'react-dom'
import { ArrowRight, Search, X } from 'lucide-react'
import type { MessageForwardPickerProps } from '../types/messageForwardPicker'
import { attachmentLabel } from '../../../shared/utils/format'
import { useMessageForwardPicker } from '../hooks/useMessageForwardPicker'
import './message-forward-picker.css'

export default function MessageForwardPicker(props: MessageForwardPickerProps) {
  const trUi = useUiTranslation()

  const { message, onClose } = props
  const { query, setQuery, busy, error, inputRef, options, submit } = useMessageForwardPicker(props)
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
          <div><h2 id="chat-forward-title">{trUi("chat.forwardMessage")}</h2><p>Chọn cuộc trò chuyện nhận</p></div>
          <button type="button" title={trUi("common.close")} aria-label={trUi("common.ui.closeForward")} disabled={busy} onClick={onClose}><X size={20} /></button>
        </header>
        <div className="chat-forward-preview">{message.text || attachmentLabel(message.attachments)}</div>
        <label className="chat-forward-search">
          <Search size={18} aria-hidden="true" />
          <input ref={inputRef} value={query} onChange={event => setQuery(event.target.value)}
            placeholder={trUi("common.ui.findIndividualGroup")} aria-label={trUi("common.ui.findForwardConversation")} />
        </label>
        <div className="chat-forward-list">
          {options.map(destination => (
            <button type="button" key={destination.id} className="chat-forward-recipient"
              disabled={busy} onClick={() => void submit(destination)}>
              <span className="chat-forward-recipient-avatar" aria-hidden="true">{destination.type === 'group' ? '👥' : '👤'}</span>
              <span className="chat-forward-recipient-name">{destination.name}<small>{destination.type === 'group' ? trUi("chat.group") : trUi("profile.personal")}</small></span>
              <ArrowRight size={18} aria-hidden="true" />
            </button>
          ))}
          {options.length === 0 && <p className="chat-forward-empty">{trUi("chat.noConversation")}</p>}
        </div>
        {busy && <p className="chat-forward-status" role="status">Đang chuyển tiếp…</p>}
        {error && <p className="chat-forward-error" role="alert">{error}</p>}
      </section>
    </div>, document.body,
  )
}