import { useUiTranslation } from '@/shared/i18n/locale'
import { FileText, MessageCircle, Search, Users, X } from 'lucide-react'
import type { ChatQuickContact, ChatQuickHit, ChatQuickResults } from '../hooks/useChatQuickSearch'
import '../styles/chat-quick-search.css'

type Props = {
  results: ChatQuickResults
  loading: boolean
  error: string
  onRetry: () => void
  onClose: () => void
  onContact: (contact: ChatQuickContact) => void
  onHit: (hit: ChatQuickHit) => void
}

export default function ChatQuickSearch({
  results, loading, error, onRetry, onClose, onContact, onHit,
}: Props) {
  const trUi = useUiTranslation()

  const sections = [
    { label: 'Liên hệ', Icon: Users, items: results.contacts },
    { label: 'Tin nhắn', Icon: MessageCircle, items: results.messages },
    { label: 'File', Icon: FileText, items: results.files },
  ] as const
  const count = results.contacts.length + results.messages.length + results.files.length

  return (
    <div id="chat-quick-search-results" className="chat-quick-search" role="region" aria-label={trUi("chat.chatSearchResults")}>
      <div className="chat-quick-search-heading">
        <span><Search size={16} aria-hidden="true" />{trUi("common.searchResults")}</span>
        <button type="button" aria-label={trUi("chat.closeResults")} onClick={onClose}><X size={17} /></button>
      </div>
      <div className="chat-quick-search-scroll" aria-live="polite">
        {!loading && error ? <p className="chat-quick-search-status" role="alert">{error} <button type="button" onClick={onRetry}>{trUi("common.retry")}</button></p> :
          !loading && count === 0 ? <p className="chat-quick-search-status">{trUi("common.noMatchingResults")}</p> : null}
        {!loading && !error && sections.map(({ label, Icon, items }) => (
          <section key={label} className="chat-quick-search-section" aria-label={label}>
            <div className="chat-quick-search-label">
              <Icon size={16} aria-hidden="true" />
              <strong>{label}</strong>
              <small>{items.length}</small>
            </div>
            {items.length === 0 ? <p className="chat-quick-search-empty">{trUi("common.noResults")}</p> :
              label === 'Liên hệ'
                ? (items as ChatQuickContact[]).map(contact => (
                  <button className="chat-quick-search-item" type="button"
                    key={contact.conversation ? 'group-' + contact.id : 'contact-' + contact.id}
                    onClick={() => onContact(contact)}>
                    <span className="chat-quick-search-symbol"><Users size={17} aria-hidden="true" /></span>
                    <span className="chat-quick-search-copy">
                      <strong>{contact.name}</strong>
                      <small>{contact.conversation ? trUi("chat.groupChat") : '@' + contact.username}</small>
                    </span>
                  </button>
                ))
                : (items as ChatQuickHit[]).map(hit => (
                  <button className="chat-quick-search-item" type="button"
                    key={label + '-' + hit.id + '-' + (hit.attachmentId ?? '')}
                    onClick={() => onHit(hit)}>
                    <span className="chat-quick-search-symbol">
                      {label === 'File' ? <FileText size={17} aria-hidden="true" /> : <MessageCircle size={17} aria-hidden="true" />}
                    </span>
                    <span className="chat-quick-search-copy">
                      <strong>{label === 'File' ? hit.fileName : hit.text}</strong>
                      <small>{hit.conversation.name} · {hit.sender}</small>
                    </span>
                  </button>
                ))
            }
          </section>
        ))}
      </div>
    </div>
  )
}
