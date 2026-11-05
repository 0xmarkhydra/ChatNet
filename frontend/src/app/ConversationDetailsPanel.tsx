import { Bell, ChevronRight, FileText, Images, Languages, Link2, Search, ShieldCheck, Users } from 'lucide-react'
import type { Conversation } from '../features/chat/types'
import { CallHeaderActions } from '../features/calls/CallManager'
import UserAvatar from '../shared/ui/UserAvatar'

type Props = {
  conversation: Conversation
  onProfile: () => void
  onSearch: () => void
  onShared: () => void
  onTranslate: () => void
  onNotifications: () => void
}

export default function ConversationDetailsPanel({
  conversation, onProfile, onSearch, onShared, onTranslate, onNotifications,
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
    <aside className="penpot-chat-details" aria-label="Thông tin hội thoại">
      <h2>Thông tin hội thoại</h2>
      <div className="penpot-chat-details-identity">
        <UserAvatar
          username={conversation.otherUsername}
          name={conversation.name}
          className="penpot-chat-details-avatar"
          group={isGroup}
          online={!isGroup && conversation.online}
        />
        <strong title={conversation.name}>{conversation.name}</strong>
        <span>{isGroup ? `${conversation.memberCount} thành viên` : conversation.online ? '● Đang hoạt động' : 'Chat riêng'}</span>
      </div>
      <div className="penpot-chat-details-actions">
        <CallHeaderActions conversationId={conversation.id} />
        <button type="button" onClick={onProfile}>
          <Users size={20} aria-hidden="true" />
          <span>{isGroup ? 'Quản lý nhóm' : 'Hồ sơ'}</span>
        </button>
      </div>
      <nav className="penpot-chat-details-links" aria-label="Tùy chọn hội thoại">
        {options.map(({ label, Icon, action }) => (
          <button type="button" key={label} onClick={action}>
            <Icon size={19} aria-hidden="true" />
            <span>{label}</span>
            <ChevronRight size={16} aria-hidden="true" />
          </button>
        ))}
      </nav>
      <p className="penpot-chat-details-privacy"><ShieldCheck size={19} aria-hidden="true" /> Nội dung được hiển thị theo quyền truy cập hội thoại của bạn.</p>
    </aside>
  )
}
