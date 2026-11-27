import { useState, useSyncExternalStore } from 'react'
import { Ban, Bell, BellOff, ChevronRight, Search, ShieldCheck, Trash2, Users, X } from 'lucide-react'
import type { Conversation } from '../types'
import type { GroupChannel } from '../utils/groupChannels'
import type { GroupActivityKind } from '../types/groupActivities'
import type { GroupManagementSection } from './GroupSettingsPanel'
import type { GroupPhotoTarget } from '../utils/groupPhotoTarget'
import GroupAvatarEditor from './GroupAvatarEditor'
import ConversationSharedPreview from './ConversationSharedPreview'
import ConversationDetailsIdentity from './ConversationDetailsIdentity'
import ConversationGroupManagementMenu from './ConversationGroupManagementMenu'
import ConversationManagementSection from './ConversationManagementSection'

const PHONE_QUERY = '(max-width: 760px)'

function subscribePhoneLayout(onChange: () => void) {
  const media = window.matchMedia?.(PHONE_QUERY)
  media?.addEventListener('change', onChange)
  return () => media?.removeEventListener('change', onChange)
}

function phoneLayoutSnapshot() {
  return window.matchMedia?.(PHONE_QUERY).matches ?? false
}

type Props = {
  conversation: Conversation
  busy: boolean
  notificationBusy: boolean
  onToggleNotifications: () => void
  onClose: () => void
  onProfile: () => void
  onSearch: () => void
  onShared: (tab?: 'media' | 'files' | 'links') => void
  request: (path: string, init?: RequestInit) => Promise<Response>
  selectedChannelId: number
  channel: GroupChannel
  userId: number
  canLeaveGroup: boolean
  notify: (message: string, kind?: 'success' | 'error' | 'warning') => void
  onGroupRenamed: (name: string) => void
  onChannelsChanged: () => Promise<void>
  onChannelDeleted: () => Promise<void>
  onLeftGroup: () => void
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

export default function ConversationDetailsPanel(props: Props) {
  const { conversation, selectedChannelId } = props
  const scope = conversation.type === 'group' ? selectedChannelId : 0
  return <ConversationDetailsPanelScope key={JSON.stringify([conversation.id, scope])} {...props} />
}

function ConversationDetailsPanelScope({

  conversation, busy, notificationBusy, onToggleNotifications, onClose, onProfile, onSearch, onShared, request,
  selectedChannelId, channel, userId, canLeaveGroup, notify, onGroupRenamed,
  onChannelsChanged, onChannelDeleted, onLeftGroup, onGroupManagement,
  canManageGroup, onCreateGroupActivity, canCreateChannel, channelCreateBusy, onCreateChannel,
  canEditGroupPhotos, photoBusy, onSavePhoto, onBlock, onUnblock, onClearHistory,
}: Props) {
  const isGroup = conversation.type === 'group'
  const isChannel = isGroup && selectedChannelId !== 0
  const phoneLayout = useSyncExternalStore(subscribePhoneLayout, phoneLayoutSnapshot, () => false)
  const compactDirect = !isGroup && phoneLayout
  const [creatingChannel, setCreatingChannel] = useState(false)
  const [photoTarget, setPhotoTarget] = useState<GroupPhotoTarget | null>(null)

  const directProfile = (
    <button type="button" onClick={onProfile}>
      <Users size={compactDirect ? 18 : 19} aria-hidden="true" />
      {compactDirect ? 'Hồ sơ' : <><span>Hồ sơ</span><ChevronRight size={16} aria-hidden="true" /></>}
    </button>
  )
  const notificationLabel = conversation.muted ? 'Bật thông báo hội thoại' : 'Tắt thông báo hội thoại'
  const directNotifications = (
    <button type="button" disabled={notificationBusy}
      aria-pressed={Boolean(conversation.muted)} onClick={onToggleNotifications}>
      {conversation.muted ? <Bell size={compactDirect ? 18 : 19} aria-hidden="true" /> : <BellOff size={compactDirect ? 18 : 19} aria-hidden="true" />}
      {compactDirect ? notificationLabel : <><span>{notificationLabel}</span><ChevronRight size={16} aria-hidden="true" /></>}
    </button>
  )
  const blockLabel = conversation.blockedByMe ? 'Bỏ chặn người dùng' : 'Chặn tin nhắn và cuộc gọi'
  const directBlock = conversation.otherUserId && !conversation.blockedByOther ? (
    <button type="button" className="conversation-options-danger" disabled={busy}
      onClick={conversation.blockedByMe ? onUnblock : onBlock}>
      <Ban size={compactDirect ? 18 : 19} aria-hidden="true" />
      {compactDirect ? blockLabel : <><span>{blockLabel}</span><ChevronRight size={16} aria-hidden="true" /></>}
    </button>
  ) : null

  return (
    <aside className="conversation-info-panel social-chat-details" id="conversation-details-panel" aria-label="Thông tin hội thoại">
      <div className="conversation-details-heading">
        <h2>{isChannel ? 'Thông tin kênh' : 'Thông tin hội thoại'}</h2>
        <button type="button" className="sidebar-panel-close" onClick={onClose}
          aria-label="Đóng thông tin hội thoại" title="Đóng">
          <X size={19} aria-hidden="true" />
        </button>
      </div>

      <ConversationDetailsIdentity conversation={conversation} channel={channel} selectedChannelId={selectedChannelId}
        canEditGroupPhotos={canEditGroupPhotos} photoBusy={photoBusy} onEditPhoto={setPhotoTarget} compactDirect={compactDirect} />

      <ConversationSharedPreview conversationId={conversation.id}
        channelId={isGroup ? selectedChannelId : 0}
        request={request} onOpen={onShared} />

      <nav className="conversation-info-panel-links social-chat-details-links" aria-label="Tùy chọn hội thoại">
        {!isGroup && !compactDirect && directProfile}
        <button type="button" onClick={onSearch}>
          <Search size={19} aria-hidden="true" />
          <span>Tìm tin nhắn</span><ChevronRight size={16} aria-hidden="true" />
        </button>
        {!isGroup && !compactDirect && directNotifications}
        {compactDirect && <ConversationManagementSection title="Quản lý hội thoại">
          {directProfile}
          {directNotifications}
          {directBlock}
        </ConversationManagementSection>}

        {isGroup && <ConversationGroupManagementMenu conversation={conversation} channel={channel}
          selectedChannelId={selectedChannelId} userId={userId} creatingChannel={creatingChannel} setCreatingChannel={setCreatingChannel}
          canManageGroup={canManageGroup} canCreateChannel={canCreateChannel} channelCreateBusy={channelCreateBusy}
          onCreateChannel={onCreateChannel} notificationBusy={notificationBusy} onToggleNotifications={onToggleNotifications}
          onGroupManagement={onGroupManagement} onCreateGroupActivity={onCreateGroupActivity}
          canEditGroupPhotos={canEditGroupPhotos} canLeaveGroup={canLeaveGroup} request={request} notify={notify}
          onGroupRenamed={onGroupRenamed} onChannelsChanged={onChannelsChanged}
          onChannelDeleted={onChannelDeleted} onLeftGroup={onLeftGroup} />}

        {!isGroup && !compactDirect && directBlock}
        {!isChannel && <button type="button" className="conversation-options-danger" disabled={busy} onClick={onClearHistory}>
          <Trash2 size={19} aria-hidden="true" /><span>Xóa lịch sử trò chuyện</span>
          <ChevronRight size={16} aria-hidden="true" />
        </button>}
      </nav>
      {photoTarget && <GroupAvatarEditor target={photoTarget}
        busy={photoBusy} onSave={onSavePhoto} onClose={() => setPhotoTarget(null)} />}
      <p className="conversation-info-panel-privacy social-chat-details-privacy">
        <ShieldCheck size={19} aria-hidden="true" />
        Nội dung được hiển thị theo quyền truy cập hội thoại của bạn.
      </p>
    </aside>
  )
}