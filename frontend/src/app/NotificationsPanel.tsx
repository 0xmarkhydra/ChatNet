import { Bell, Check, MessageCircle, UserPlus, X } from 'lucide-react'
import type { FriendConnection } from '../features/contacts/types'

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
  return (
    <div className="notification-center-overlay" role="dialog" aria-modal="true" aria-label="Thông báo">
      <button type="button" className="notification-center-backdrop" aria-label="Đóng thông báo" onClick={onClose} />
      <section className="notification-center-panel">
        <header className="notification-center-header">
          <div>
            <span className="section-eyebrow">SOCIAL UPDATES</span>
            <h2>Thông báo</h2>
            <p>Cập nhật mới nhất từ bạn bè và các cuộc trò chuyện.</p>
          </div>
          <button type="button" className="modal-close-button" aria-label="Đóng thông báo" onClick={onClose}><X size={18} /></button>
        </header>

        {!pushEnabled && (
          <button type="button" className="notification-center-banner" onClick={onEnableNotifications}>
            <Bell size={20} aria-hidden="true" />
            <span><strong>Bật thông báo</strong><small>Nhận cập nhật ngay cả khi bạn đang ở màn hình khác.</small></span>
            <span className="notification-center-banner-action">Bật</span>
          </button>
        )}

        <div className="notification-center-list">
          {requests.filter(request => request.direction === 'incoming').map(request => (
            <article className="notification-center-item" key={request.id}>
              <span className="notification-center-icon is-purple"><UserPlus size={18} /></span>
              <div>
                <strong>{request.displayName || request.username}</strong>
                <p>đã gửi lời mời kết bạn cho bạn.</p>
                <button type="button" className="notification-center-action" onClick={() => onAccept(request)}><Check size={14} /> Chấp nhận</button>
              </div>
            </article>
          ))}
          {unreadTotal > 0 && (
            <button type="button" className="notification-center-item is-button" onClick={onOpenChat}>
              <span className="notification-center-icon is-blue"><MessageCircle size={18} /></span>
              <div><strong>Tin nhắn mới</strong><p>Bạn có {unreadTotal > 99 ? '99+' : unreadTotal} tin nhắn chưa đọc.</p><small>Mở hộp thư để xem ngay</small></div>
            </button>
          )}
          {requests.filter(request => request.direction === 'incoming').length === 0 && unreadTotal === 0 && pushEnabled && (
            <div className="notification-center-empty">
              <span><Bell size={22} /></span>
              <strong>Bạn đã xem hết thông báo</strong>
              <p>Khi có hoạt động mới, chúng sẽ xuất hiện ở đây.</p>
            </div>
          )}
        </div>

        <button type="button" className="notification-center-footer" onClick={onOpenContacts}>
          Xem danh bạ và lời mời <span aria-hidden="true">→</span>
        </button>
      </section>
    </div>
  )
}