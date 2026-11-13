import { useEffect, useState } from 'react'
import { Ban, Bell, BellOff, ChevronRight, Camera, MoreHorizontal, Plus, Search, ShieldCheck, Trash2, Users, X } from 'lucide-react'
import type { GroupActivityKind } from './GroupActivities'
import type { Conversation } from '../types'
import type { GroupChannel } from '../utils/groupChannels'
import type { GroupManagementSection } from './GroupSettingsPanel'
import UserAvatar from '../../../shared/ui/UserAvatar'
import ConversationAvatar from './ConversationAvatar'
import GroupAvatarEditor, { type GroupPhotoTarget } from './GroupAvatarEditor'
import ConversationSharedPreview from './ConversationSharedPreview'
import GroupChannelControls from './GroupChannelControls'
import GroupChannelCreateForm from './GroupChannelCreateForm'

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

export default function ConversationDetailsPanel({
  conversation, busy, notificationBusy, onToggleNotifications, onClose, onProfile, onSearch, onShared, request,
  selectedChannelId, channel, userId, canLeaveGroup, notify, onGroupRenamed,
  onChannelsChanged, onChannelDeleted, onLeftGroup, onGroupManagement,
  canManageGroup, onCreateGroupActivity, canCreateChannel, channelCreateBusy, onCreateChannel,
  canEditGroupPhotos, photoBusy, onSavePhoto, onBlock, onUnblock, onClearHistory,
}: Props) {
  const isGroup = conversation.type === 'group'
  const isChannel = isGroup && selectedChannelId !== 0
  const displayName = isChannel ? channel.name : conversation.name
  const displayAvatar = isChannel ? channel.avatarUrl : conversation.avatarUrl
  const blocked = !isGroup && Boolean(conversation.blockedByMe || conversation.blockedByOther)
  const [photoTarget, setPhotoTarget] = useState<GroupPhotoTarget | null>(null)
  const [creatingChannel, setCreatingChannel] = useState(false)
  useEffect(() => {
    setPhotoTarget(null)
    setCreatingChannel(false)
  }, [conversation.id])

  return (
    <aside className="conversation-info-panel social-chat-details" id="conversation-details-panel" aria-label="Thông tin hội thoại">
      <div className="conversation-details-heading">
        <h2>{isChannel ? 'Thông tin kênh' : 'Thông tin hội thoại'}</h2>
        <button type="button" className="sidebar-panel-close" onClick={onClose}
          aria-label="Đóng thông tin hội thoại" title="Đóng">
          <X size={19} aria-hidden="true" />
        </button>
      </div>

      <div className="conversation-info-panel-identity social-chat-details-identity">
        {isGroup ? (
          <div className="group-photo-avatar-wrap">
            {isChannel
              ? <UserAvatar name={displayName} className="conversation-info-panel-avatar social-chat-details-avatar" group imageUrl={displayAvatar} />
              : <ConversationAvatar conversation={conversation} className="conversation-info-panel-avatar social-chat-details-avatar" />}
            {canEditGroupPhotos && <button type="button" className="group-photo-trigger" disabled={photoBusy}
              aria-label={isChannel ? 'Đổi ảnh kênh' : 'Đổi ảnh nhóm'} title={isChannel ? 'Đổi ảnh kênh' : 'Đổi ảnh nhóm'}
              onClick={() => setPhotoTarget({ name: displayName, avatarUrl: displayAvatar,
                kind: isChannel ? 'channel' : 'group', channelId: isChannel ? selectedChannelId : undefined })}>
              <Camera size={17} aria-hidden="true" />
            </button>}
          </div>
        ) : (
          <UserAvatar username={conversation.otherUsername} name={conversation.name}
            className="conversation-info-panel-avatar social-chat-details-avatar"
            online={conversation.online} />
        )}
        <strong title={displayName}>{displayName}</strong>
        <span>{blocked ? (conversation.blockedByOther ? 'Bạn đã bị chặn' : 'Bạn đã chặn người này')
          : isChannel ? `Kênh của nhóm ${conversation.name}` : isGroup ? `${conversation.memberCount} thành viên`
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
        {!isGroup && <button type="button" disabled={notificationBusy}
          aria-pressed={Boolean(conversation.muted)}
          onClick={onToggleNotifications}>
          {conversation.muted ? <Bell size={19} aria-hidden="true" /> : <BellOff size={19} aria-hidden="true" />}
          <span>{conversation.muted ? 'Bật thông báo hội thoại' : 'Tắt thông báo hội thoại'}</span>
          <ChevronRight size={16} aria-hidden="true" />
        </button>}

        {isGroup && <div className="conversation-info-group-menu" aria-label={isChannel ? 'Quản lý kênh' : 'Quản lý nhóm'}>
          <strong className="conversation-info-group-menu-heading">{isChannel ? 'Quản lý kênh' : 'Quản lý nhóm'}</strong>
            {!isChannel && <>
              <button type="button" onClick={() => onGroupManagement('members')}><Users size={18} />Thành viên</button>
              <button type="button" onClick={() => onGroupManagement('details')}><MoreHorizontal size={18} />Thông tin cộng đồng</button>
              {canManageGroup && <>
                <button type="button" onClick={() => onGroupManagement('permissions')}><ShieldCheck size={18} />Quyền quản trị</button>
                <button type="button" onClick={() => onGroupManagement('requests')}><Users size={18} />Yêu cầu tham gia</button>
                <button type="button" onClick={() => onGroupManagement('activity')}><MoreHorizontal size={18} />Nhật ký hoạt động</button>
              </>}
              <button type="button" onClick={() => onGroupManagement('rules')}><ShieldCheck size={18} />Nội quy nhóm</button>
              <button type="button" onClick={() => onCreateGroupActivity('poll')}><MoreHorizontal size={18} />Bình chọn</button>
              <button type="button" onClick={() => onCreateGroupActivity('note')}><MoreHorizontal size={18} />Ghi chú</button>
              <button type="button" onClick={() => onCreateGroupActivity('reminder')}><MoreHorizontal size={18} />Nhắc hẹn</button>
              {canCreateChannel && (creatingChannel
                ? <GroupChannelCreateForm busy={channelCreateBusy} onCreate={onCreateChannel}
                    onCancel={() => setCreatingChannel(false)} />
                : <button type="button" onClick={() => setCreatingChannel(true)}><Plus size={18} />Tạo kênh</button>)}
              <button type="button" disabled={notificationBusy} onClick={onToggleNotifications}>
                {conversation.muted ? <Bell size={18} /> : <BellOff size={18} />}
                {conversation.muted ? 'Bật thông báo nhóm' : 'Tắt thông báo nhóm'}
              </button>
            </>}
            <GroupChannelControls key={channel.id} groupId={conversation.id}
              groupName={conversation.name} channel={channel} userId={userId}
              canEdit={canEditGroupPhotos} canLeave={canLeaveGroup}
              scope={isChannel ? 'channel' : 'group'} hideGroupNotification
              request={request} notify={notify} onGroupRenamed={onGroupRenamed}
              onChannelsChanged={onChannelsChanged} onChannelDeleted={onChannelDeleted}
              onLeftGroup={onLeftGroup} />
        </div>}
        {!isGroup && conversation.otherUserId && !conversation.blockedByOther && (
          <button type="button" className="conversation-options-danger" disabled={busy}
            onClick={conversation.blockedByMe ? onUnblock : onBlock}>
            <Ban size={19} aria-hidden="true" />
            <span>{conversation.blockedByMe ? 'Bỏ chặn người dùng' : 'Chặn tin nhắn và cuộc gọi'}</span>
            <ChevronRight size={16} aria-hidden="true" />
          </button>
        )}
        {!isChannel && <button type="button" className="conversation-options-danger" disabled={busy} onClick={onClearHistory}>
          <Trash2 size={19} aria-hidden="true" /><span>Xóa lịch sử trò chuyện</span>
          <ChevronRight size={16} aria-hidden="true" />
        </button>}
      </nav>
      {photoTarget && <GroupAvatarEditor key={`${conversation.id}:${selectedChannelId}`} target={photoTarget}
        busy={photoBusy} onSave={onSavePhoto} onClose={() => setPhotoTarget(null)} />}
      <p className="conversation-info-panel-privacy social-chat-details-privacy">
        <ShieldCheck size={19} aria-hidden="true" />
        Nội dung được hiển thị theo quyền truy cập hội thoại của bạn.
      </p>
    </aside>
  )
}