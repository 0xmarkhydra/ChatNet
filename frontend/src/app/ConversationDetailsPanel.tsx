import { Ban, Bell, ChevronRight, FileText, Images, Languages, Link2, MoreHorizontal, Search, ShieldCheck, Trash2, Users, X } from 'lucide-react'
import type { Conversation } from '../features/chat/types'
import { CallHeaderActions } from '../features/calls/CallManager'
import UserAvatar from '../shared/ui/UserAvatar'

type Props = {
  conversation: Conversation
  busy: boolean
  onClose: () => void
  onProfile: () => void
  onSearch: () => void
  onShared: () => void
  onTranslate: () => void
  onNotifications: () => void
  onGroupOptions: () => void
  onBlock: () => void
  onClearHistory: () => void
}

export default function ConversationDetailsPanel({
  conversation, busy, onClose, onProfile, onSearch, onShared, onTranslate,
  onNotifications, onGroupOptions, onBlock, onClearHistory,
}: Props) {
  const isGroup = conversation.type === 'group'
  const options = [
    { label: 'Thông báo', Icon: Bell, action: onNotifications },
    { label: 'Dịch AI', Icon: Languages, action: onTranslate },
    { label: 'Ảnh & video', Icon: Images, action: onShared },
    { label: 'Tệp tin', Icon: FileText, action: onShared },
    { label: 'Liên kết', Icon: Link2, action: onShared },
    { label: 'Tìm tin nhắn', Icon: Search, action: onSearch },
  ]
  return (
    <aside className="social-chat-details" id="conversation-details-panel" aria-label="Thông tin hội thoại">
      <div className="conversation-details-heading">
        <h2>Thông tin hội thoại</h2>
        <button type="button" onClick={onClose} aria-label="Đóng thông tin hội thoại" title="Đóng">
          <X size={19} aria-hidden="true" />
        </button>
      </div>
      <div className="social-chat-details-identity">
        <UserAvatar username={conversation.otherUsername} name={conversation.name}
          className="social-chat-details-avatar" group={isGroup}
          online={!isGroup && conversation.online} />
        <strong title={conversation.name}>{conversation.name}</strong>
        <span>{isGroup ? `${conversation.memberCount} thành viên` : conversation.online ? '● Đang hoạt động' : 'Chat riêng'}</span>
      </div>
      <div className="social-chat-details-actions">
        <CallHeaderActions conversationId={conversation.id} />
        <button type="button" onClick={onProfile}>
          <Users size={20} aria-hidden="true" />
          <span>{isGroup ? 'Quản lý nhóm' : 'Hồ sơ'}</span>
        </button>
      </div>
      <nav className="social-chat-details-links" aria-label="Tùy chọn hội thoại">
        {options.map(({ label, Icon, action }) => (
          <button type="button" key={label} onClick={action}>
            <Icon size={19} aria-hidden="true" />
            <span>{label}</span>
            <ChevronRight size={16} aria-hidden="true" />
          </button>
        ))}
        {isGroup && (
          <button type="button" onClick={onGroupOptions}>
            <MoreHorizontal size={19} aria-hidden="true" />
            <span>Tùy chọn nhóm</span>
            <ChevronRight size={16} aria-hidden="true" />
          </button>
        )}
        {!isGroup && conversation.otherUserId && (
          <button type="button" className="conversation-options-danger" disabled={busy} onClick={onBlock}>
            <Ban size={19} aria-hidden="true" />
            <span>Chặn tin nhắn và cuộc gọi</span>
            <ChevronRight size={16} aria-hidden="true" />
          </button>
        )}
        <button type="button" className="conversation-options-danger" disabled={busy} onClick={onClearHistory}>
          <Trash2 size={19} aria-hidden="true" />
          <span>Xóa lịch sử trò chuyện</span>
          <ChevronRight size={16} aria-hidden="true" />
        </button>
      </nav>
      <p className="social-chat-details-privacy"><ShieldCheck size={19} aria-hidden="true" /> Nội dung được hiển thị theo quyền truy cập hội thoại của bạn.</p>
    </aside>
  )
}