import { Bell, BellOff, MoreHorizontal, Plus, ShieldCheck, Users } from 'lucide-react'
import type { Conversation } from '../types'
import type { GroupChannel } from '../utils/groupChannels'
import type { GroupActivityKind } from '../types/groupActivities'
import type { GroupManagementSection } from './GroupSettingsPanel'
import GroupChannelControls from './GroupChannelControls'
import GroupChannelCreateForm from './GroupChannelCreateForm'

type Props = {
  conversation: Conversation
  channel: GroupChannel
  selectedChannelId: number
  userId: number
  creatingChannel: boolean
  setCreatingChannel: (open: boolean) => void
  canManageGroup: boolean
  canCreateChannel: boolean
  channelCreateBusy: boolean
  onCreateChannel: (name: string, description: string) => Promise<boolean>
  notificationBusy: boolean
  onToggleNotifications: () => void
  onGroupManagement: (section: GroupManagementSection) => void
  onCreateGroupActivity: (kind: GroupActivityKind) => void
  canEditGroupPhotos: boolean
  canLeaveGroup: boolean
  request: (path: string, init?: RequestInit) => Promise<Response>
  notify: (message: string, kind?: 'success' | 'error' | 'warning') => void
  onGroupRenamed: (name: string) => void
  onChannelsChanged: () => Promise<void>
  onChannelDeleted: () => Promise<void>
  onLeftGroup: () => void
}

export default function ConversationGroupManagementMenu({
  conversation, channel, selectedChannelId, userId, creatingChannel, setCreatingChannel,
  canManageGroup, canCreateChannel, channelCreateBusy, onCreateChannel, notificationBusy, onToggleNotifications,
  onGroupManagement, onCreateGroupActivity, canEditGroupPhotos, canLeaveGroup, request,
  notify, onGroupRenamed, onChannelsChanged, onChannelDeleted, onLeftGroup,
}: Props) {
  const isChannel = selectedChannelId !== 0
  return (
<div className="conversation-info-group-menu" aria-label={isChannel ? 'Quản lý kênh' : 'Quản lý nhóm'}>
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
            <GroupChannelControls groupId={conversation.id}
              groupName={conversation.name} channel={channel} userId={userId}
              canEdit={canEditGroupPhotos} canLeave={canLeaveGroup}
              scope={isChannel ? 'channel' : 'group'} hideGroupNotification
              request={request} notify={notify} onGroupRenamed={onGroupRenamed}
              onChannelsChanged={onChannelsChanged} onChannelDeleted={onChannelDeleted}
              onLeftGroup={onLeftGroup} />
        </div>
  )
}
