import { useScopedState } from '../../../shared/hooks/useScopedState'
import {
  Ban, CalendarClock, ChevronDown, ChevronRight, ClipboardList, Clock3,
  FileText, Camera, Info, MoreHorizontal, Plus, ScrollText, Search,
  ShieldCheck, Trash2, Users, X,
} from 'lucide-react'
import type { GroupActivityKind } from './GroupActivities'
import type { Conversation } from '../types'
import type { GroupManagementSection } from './GroupSettingsPanel'
import UserAvatar from '../../../shared/ui/UserAvatar'
import GroupChannelCreateForm from './GroupChannelCreateForm'
import GroupAvatarEditor, { type GroupPhotoTarget } from './GroupAvatarEditor'
import ConversationSharedPreview from './ConversationSharedPreview'

type Props = {
  conversation: Conversation
  busy: boolean
  onClose: () => void
  onProfile: () => void
  onSearch: () => void
  onShared: (tab?: 'media' | 'files' | 'links') => void
  request: (path: string, init?: RequestInit) => Promise<Response>
  selectedChannelId: number
  onGroupManagement: (section: GroupManagementSection) => void
  canManageGroup: boolean
  onCreateGroupActivity: (kind: GroupActivityKind) => void
  canCreateChannel: boolean
  channelCreateBusy: boolean
  onCreateChannel: (name: string, description: string) => Promise<boolean>
  canEditGroupPhotos: boolean
  photoBusy: boolean
  onSavePhoto: (target: GroupPhotoTarget, file: File | null) => Promise<boolean>
  onBlock: () => void
  onUnblock: () => void
  onClearHistory: () => void
}

const groupManagementLinks = [
  { section: 'members', label: 'Thành viên', Icon: Users, manager: false },
  { section: 'details', label: 'Thông tin cộng đồng', Icon: Info, manager: false },
  { section: 'permissions', label: 'Quyền quản trị', Icon: ShieldCheck, manager: true },
  { section: 'requests', label: 'Yêu cầu tham gia', Icon: Clock3, manager: true },
  { section: 'rules', label: 'Nội quy nhóm', Icon: ScrollText, manager: false },
  { section: 'activity', label: 'Nhật ký hoạt động', Icon: FileText, manager: true },
] as const

export default function ConversationDetailsPanel({
  conversation, busy, onClose, onProfile, onSearch, onShared, request,
  selectedChannelId, onGroupManagement, canManageGroup, onCreateGroupActivity,
  canCreateChannel, channelCreateBusy, onCreateChannel,
  canEditGroupPhotos, photoBusy, onSavePhoto, onBlock, onUnblock, onClearHistory,
}: Props) {
  const isGroup = conversation.type === 'group'
  const blocked = !isGroup && Boolean(conversation.blockedByMe || conversation.blockedByOther)
  // Each conversation visit starts with a closed menu/editor. Scoped setters
  // also ignore late callbacks from the previously selected conversation.
  const [groupOptionsOpen, setGroupOptionsOpen] = useScopedState(conversation.id, false)
  const [creatingChannel, setCreatingChannel] = useScopedState(conversation.id, false)
  const [photoTarget, setPhotoTarget] = useScopedState<GroupPhotoTarget | null>(conversation.id, null)

  return (
    <aside className="conversation-info-panel social-chat-details" id="conversation-details-panel" aria-label="Thông tin hội thoại">
      <div className="conversation-details-heading">
        <h2>Thông tin hội thoại</h2>
        <button type="button" className="sidebar-panel-close" onClick={onClose}
          aria-label="Đóng thông tin hội thoại" title="Đóng">
          <X size={19} aria-hidden="true" />
        </button>
      </div>

      <div className="conversation-info-panel-identity social-chat-details-identity">
        {isGroup ? (
          <div className="group-photo-avatar-wrap">
            <UserAvatar name={conversation.name}
              className="conversation-info-panel-avatar social-chat-details-avatar"
              group imageUrl={conversation.avatarUrl} />
            {canEditGroupPhotos && <button type="button" className="group-photo-trigger" disabled={photoBusy}
              aria-label="Đổi ảnh nhóm" title="Đổi ảnh nhóm"
              onClick={() => setPhotoTarget({ name: conversation.name, avatarUrl: conversation.avatarUrl })}>
              <Camera size={17} aria-hidden="true" />
            </button>}
          </div>
        ) : (
          <UserAvatar username={conversation.otherUsername} name={conversation.name}
            className="conversation-info-panel-avatar social-chat-details-avatar"
            online={conversation.online} />
        )}
        <strong title={conversation.name}>{conversation.name}</strong>
        <span>{blocked ? (conversation.blockedByOther ? 'Bạn đã bị chặn' : 'Bạn đã chặn người này')
          : isGroup ? `${conversation.memberCount} thành viên`
          : conversation.online ? '● Đang hoạt động' : 'Chat riêng'}</span>
      </div>

      <ConversationSharedPreview key={`${conversation.id}:${isGroup ? selectedChannelId : 0}`} conversationId={conversation.id}
        channelId={isGroup ? selectedChannelId : 0}
        request={request} onOpen={onShared} />

      <nav className="conversation-info-panel-links social-chat-details-links" aria-label="Tùy chọn hội thoại">
        {!isGroup && (
          <button type="button" onClick={onProfile}>
            <Users size={19} aria-hidden="true" />
            <span>Hồ sơ</span><ChevronRight size={16} aria-hidden="true" />
          </button>
        )}
        <button type="button" onClick={onSearch}>
          <Search size={19} aria-hidden="true" />
          <span>Tìm tin nhắn</span><ChevronRight size={16} aria-hidden="true" />
        </button>

        {isGroup && groupManagementLinks.filter(item => !item.manager || canManageGroup)
          .map(({ section, label, Icon }) => (
            <button type="button" key={section} onClick={() => onGroupManagement(section)}>
              <Icon size={19} aria-hidden="true" />
              <span>{label}</span><ChevronRight size={16} aria-hidden="true" />
            </button>
          ))}

        {isGroup && (
          <div className="conversation-group-options">
            <button type="button" className="conversation-group-options-trigger"
              aria-expanded={groupOptionsOpen}
              aria-controls={`conversation-group-options-${conversation.id}`}
              onClick={() => { setGroupOptionsOpen(open => !open); setCreatingChannel(false) }}>
              <MoreHorizontal size={19} aria-hidden="true" />
              <span>Tùy chọn nhóm</span>
              {groupOptionsOpen ? <ChevronDown size={16} aria-hidden="true" /> : <ChevronRight size={16} aria-hidden="true" />}
            </button>
            {groupOptionsOpen && (
              <div className="conversation-group-options-list"
                id={`conversation-group-options-${conversation.id}`}
                role="group" aria-label="Công cụ nhóm">
                {([
                  { kind: 'poll', label: 'Bình chọn', Icon: ClipboardList },
                  { kind: 'note', label: 'Ghi chú', Icon: FileText },
                  { kind: 'reminder', label: 'Nhắc hẹn', Icon: CalendarClock },
                ] as const).map(({ kind, label, Icon }) => (
                  <button type="button" key={kind} onClick={() => {
                    setGroupOptionsOpen(false)
                    onCreateGroupActivity(kind)
                  }}>
                    <Icon size={18} aria-hidden="true" /><span>{label}</span>
                  </button>
                ))}
                {canCreateChannel && !creatingChannel && (
                  <button type="button" disabled={channelCreateBusy} onClick={() => setCreatingChannel(true)}>
                    <Plus size={18} aria-hidden="true" /><span>Tạo kênh hội thoại</span>
                  </button>
                )}
                {canCreateChannel && creatingChannel && (
                  <GroupChannelCreateForm busy={channelCreateBusy}
                    onCreate={onCreateChannel} onCancel={() => setCreatingChannel(false)} />
                )}
              </div>
            )}
          </div>
        )}

        {!isGroup && conversation.otherUserId && !conversation.blockedByOther && (
          <button type="button" className="conversation-options-danger" disabled={busy}
            onClick={conversation.blockedByMe ? onUnblock : onBlock}>
            <Ban size={19} aria-hidden="true" />
            <span>{conversation.blockedByMe ? 'Bỏ chặn người dùng' : 'Chặn tin nhắn và cuộc gọi'}</span>
            <ChevronRight size={16} aria-hidden="true" />
          </button>
        )}
        <button type="button" className="conversation-options-danger" disabled={busy} onClick={onClearHistory}>
          <Trash2 size={19} aria-hidden="true" /><span>Xóa lịch sử trò chuyện</span>
          <ChevronRight size={16} aria-hidden="true" />
        </button>
      </nav>
      {photoTarget && <GroupAvatarEditor key={conversation.id} target={photoTarget}
        busy={photoBusy} onSave={onSavePhoto} onClose={() => setPhotoTarget(null)} />}
      <p className="conversation-info-panel-privacy social-chat-details-privacy">
        <ShieldCheck size={19} aria-hidden="true" />
        Nội dung được hiển thị theo quyền truy cập hội thoại của bạn.
      </p>
    </aside>
  )
}