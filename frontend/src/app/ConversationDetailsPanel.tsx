import { useEffect, useState } from 'react'
import { Ban, Bell, CalendarClock, ChevronDown, ChevronRight, ClipboardList, FileText, Images, Languages, Link2, MoreHorizontal, Hash, Search, ShieldCheck, Trash2, Users, X } from 'lucide-react'
import type { GroupActivityKind } from '../features/chat/GroupActivities'
import type { Conversation } from '../features/chat/types'
import { CallHeaderActions } from '../features/calls/CallManager'
import UserAvatar from '../shared/ui/UserAvatar'
import type { GroupChannel } from '../features/chat/groupChannels'

type Props = {
  conversation: Conversation
  busy: boolean
  onClose: () => void
  onProfile: () => void
  onSearch: () => void
  onShared: () => void
  onTranslate: () => void
  onNotifications: () => void
  onCreateGroupActivity: (kind: GroupActivityKind) => void
  channels: GroupChannel[]
  selectedChannelId: number
  onSelectChannel: (id: number) => void
  onBlock: () => void
  onUnblock: () => void
  onClearHistory: () => void
}

export default function ConversationDetailsPanel({
  conversation, busy, onClose, onProfile, onSearch, onShared, onTranslate,
  onNotifications, onCreateGroupActivity, channels, selectedChannelId, onSelectChannel, onBlock, onUnblock, onClearHistory,
}: Props) {
  const isGroup = conversation.type === 'group'
  const blocked = !isGroup && Boolean(conversation.blockedByMe || conversation.blockedByOther)
  const [groupOptionsOpen, setGroupOptionsOpen] = useState(false)
  useEffect(() => { setGroupOptionsOpen(false) }, [conversation.id])
  const options = [
    { label: 'Thông báo', Icon: Bell, action: onNotifications },
    { label: 'Dịch AI', Icon: Languages, action: onTranslate },
    { label: 'Ảnh & video', Icon: Images, action: onShared },
    { label: 'Tệp tin', Icon: FileText, action: onShared },
    { label: 'Liên kết', Icon: Link2, action: onShared },
    { label: 'Tìm tin nhắn', Icon: Search, action: onSearch },
  ]
  return (
    <aside className="conversation-info-panel social-chat-details" id="conversation-details-panel" aria-label="Thông tin hội thoại">
      <div className="conversation-details-heading">
        <h2>Thông tin hội thoại</h2>
        <button type="button" className="sidebar-panel-close" onClick={onClose} aria-label="Đóng thông tin hội thoại" title="Đóng">
          <X size={19} aria-hidden="true" />
        </button>
      </div>
      <div className="conversation-info-panel-identity social-chat-details-identity">
        <UserAvatar username={conversation.otherUsername} name={conversation.name}
          className="conversation-info-panel-avatar social-chat-details-avatar" group={isGroup}
          online={!isGroup && conversation.online} />
        <strong title={conversation.name}>{conversation.name}</strong>
        <span>{blocked ? (conversation.blockedByOther ? 'Bạn đã bị chặn' : 'Bạn đã chặn người này') : isGroup ? `${conversation.memberCount} thành viên` : conversation.online ? '● Đang hoạt động' : 'Chat riêng'}</span>
      </div>
      <div className="conversation-info-panel-actions social-chat-details-actions">
        <CallHeaderActions conversationId={conversation.id} disabled={blocked} />
        <button type="button" onClick={onProfile}>
          <Users size={20} aria-hidden="true" />
          <span>{isGroup ? 'Quản lý nhóm' : 'Hồ sơ'}</span>
        </button>
      </div>
      <nav className="conversation-info-panel-links social-chat-details-links" aria-label="Tùy chọn hội thoại">
        {options.map(({ label, Icon, action }) => (
          <button type="button" key={label} onClick={action}>
            <Icon size={19} aria-hidden="true" />
            <span>{label}</span>
            <ChevronRight size={16} aria-hidden="true" />
          </button>
        ))}
        {isGroup && (
          <div className="conversation-group-options">
            <div className="conversation-channel-list" aria-label="Danh sách kênh hội thoại">
              <strong className="conversation-channel-list-header">Kênh hội thoại</strong>
              {channels.map(channel => (
                <button key={channel.id} type="button" aria-current={channel.id === selectedChannelId}
                  onClick={() => onSelectChannel(channel.id)}>
                  <Hash size={17} aria-hidden="true" />
                  <span>{channel.name}</span>
                  {channel.id === selectedChannelId && <span aria-hidden="true">✓</span>}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="conversation-group-options-trigger"
              aria-expanded={groupOptionsOpen}
              aria-controls={`conversation-group-options-${conversation.id}`}
              onClick={() => setGroupOptionsOpen(open => !open)}
            >
              <MoreHorizontal size={19} aria-hidden="true" />
              <span>Tùy chọn nhóm</span>
              {groupOptionsOpen ? <ChevronDown size={16} aria-hidden="true" /> : <ChevronRight size={16} aria-hidden="true" />}
            </button>
            {groupOptionsOpen && (
              <div className="conversation-group-options-list" id={`conversation-group-options-${conversation.id}`} role="group" aria-label="Công cụ nhóm">
                {([
                  { kind: 'poll', label: 'Bình chọn', Icon: ClipboardList },
                  { kind: 'note', label: 'Ghi chú', Icon: FileText },
                  { kind: 'reminder', label: 'Nhắc hẹn', Icon: CalendarClock },
                ] as const).map(({ kind, label, Icon }) => (
                  <button
                    key={kind}
                    type="button"
                    onClick={() => {
                      setGroupOptionsOpen(false)
                      onCreateGroupActivity(kind)
                    }}
                  >
                    <Icon size={18} aria-hidden="true" />
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        {!isGroup && conversation.otherUserId && !conversation.blockedByOther && (
          <button type="button" className="conversation-options-danger" disabled={busy} onClick={conversation.blockedByMe ? onUnblock : onBlock}>
            <Ban size={19} aria-hidden="true" />
            <span>{conversation.blockedByMe ? 'Bỏ chặn người dùng' : 'Chặn tin nhắn và cuộc gọi'}</span>
            <ChevronRight size={16} aria-hidden="true" />
          </button>
        )}
        <button type="button" className="conversation-options-danger" disabled={busy} onClick={onClearHistory}>
          <Trash2 size={19} aria-hidden="true" />
          <span>Xóa lịch sử trò chuyện</span>
          <ChevronRight size={16} aria-hidden="true" />
        </button>
      </nav>
      <p className="conversation-info-panel-privacy social-chat-details-privacy"><ShieldCheck size={19} aria-hidden="true" /> Nội dung được hiển thị theo quyền truy cập hội thoại của bạn.</p>
    </aside>
  )
}