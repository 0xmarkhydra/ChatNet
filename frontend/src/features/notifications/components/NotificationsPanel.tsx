import { useUiTranslation } from '@/shared/i18n/locale'
import { Bell, Check, MessageCircle, UserPlus, X } from 'lucide-react'
import type { FriendConnection } from '../../contacts'

type Props = {
  requests: FriendConnection[]
  unreadTotal: number
  pushEnabled: boolean
  onAccept: (request: FriendConnection) => void
  onOpenContacts: () => void
  onOpenChat: () => void
  onEnableNotifications: () => void
  onClose: () => void
}

export default function NotificationsPanel({
  requests,
  unreadTotal,
  pushEnabled,
  onAccept,
  onOpenContacts,
  onOpenChat,
  onEnableNotifications,
  onClose,
}: Props) {
  const trUi = useUiTranslation()

  return (
    <div className="app-notifications-overlay" role="dialog" aria-modal="true" aria-label={trUi("common.notifications")}>
      <button type="button" className="app-notifications-backdrop" aria-label={trUi("common.closeNotice")} onClick={onClose} />
      <section className="app-notifications-panel">
        <header className="app-notifications-header">
          <div>
            <span className="app-eyebrow">{trUi('notifications.socialUpdates')}</span>
            <h2>{trUi("common.notifications")}</h2>
            <p>{trUi('notifications.latestUpdates')}</p>
          </div>
          <button type="button" className="app-close-button" aria-label={trUi("common.closeNotice")} onClick={onClose}><X size={18} /></button>
        </header>

        {!pushEnabled && (
          <button type="button" className="app-notification-banner" onClick={onEnableNotifications}>
            <Bell size={20} aria-hidden="true" />
            <span><strong>{trUi("common.enableNotice")}</strong><small>{trUi('notifications.pushHint')}</small></span>
            <span className="app-notification-banner-action">{trUi("common.on")}</span>
          </button>
        )}

        <div className="app-notification-list">
          {requests.filter(request => request.direction === 'incoming').map(request => (
            <article className="app-notification-item" key={request.id}>
              <span className="app-notification-icon is-purple"><UserPlus size={18} /></span>
              <div>
                <strong>{request.displayName || request.username}</strong>
                <p>{trUi('notifications.friendSubtitle')}</p>
                <button type="button" className="app-notification-action" onClick={() => onAccept(request)}><Check size={14} />{trUi("common.accept")}</button>
              </div>
            </article>
          ))}
          {unreadTotal > 0 && (
            <button type="button" className="app-notification-item is-button" onClick={onOpenChat}>
              <span className="app-notification-icon is-blue"><MessageCircle size={18} /></span>
              <div><strong>{trUi('notifications.newMessages')}</strong><p>{trUi('notifications.unreadTotal', { count: unreadTotal > 99 ? '99+' : unreadTotal })}</p><small>{trUi('notifications.openInbox')}</small></div>
            </button>
          )}
          {requests.filter(request => request.direction === 'incoming').length === 0 && unreadTotal === 0 && pushEnabled && (
            <div className="app-notification-empty">
              <span><Bell size={22} /></span>
              <strong>{trUi('notifications.allSeen')}</strong>
              <p>{trUi('notifications.newActivityHint')}</p>
            </div>
          )}
        </div>

        <button type="button" className="app-notifications-footer" onClick={onOpenContacts}>
          {trUi('notifications.contactsRequests')} <span aria-hidden="true">→</span>
        </button>
      </section>
    </div>
  )
}