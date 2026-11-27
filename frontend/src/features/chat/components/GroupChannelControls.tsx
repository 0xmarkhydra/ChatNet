import { Bell, BellOff, FileText, LogOut, Pencil, Trash2 } from 'lucide-react'
import { ConversationOptionRow } from './ConversationManagementSection'
import { useGroupChannelControls, type GroupChannelControlsProps } from '../hooks/useGroupChannelControls'

export default function GroupChannelControls(props: GroupChannelControlsProps) {
  return <GroupChannelControlsView key={JSON.stringify([props.groupId, props.channel.id, props.scope ?? 'all'])} {...props} />
}

function GroupChannelControlsView({
  groupId, groupName, channel, userId, canEdit, canLeave, request, notify,
  onGroupRenamed, onChannelsChanged, onChannelDeleted, onLeftGroup,
  scope = 'all', onGroupNotificationChanged, hideGroupNotification = false,
}: GroupChannelControlsProps) {
  const { groupNotifications, channelMuted, busy, error, groupMuted, renameGroup, renameChannel,
    editChannelTopic, toggleGroupNotifications, toggleChannelNotifications, deleteChannel, leaveGroup } =
    useGroupChannelControls({ groupId, groupName, channel, userId, canEdit, canLeave, request, notify,
      onGroupRenamed, onChannelsChanged, onChannelDeleted, onLeftGroup,
      scope, onGroupNotificationChanged, hideGroupNotification })

  return <>
    {error && <p role="alert" className="group-channel-controls-error">{error}</p>}
    {scope !== 'channel' && (scope === 'group' || channel.id === 0) && <>
      {canEdit && <ConversationOptionRow disabled={busy} onClick={renameGroup} icon={<Pencil size={18} aria-hidden="true"/>}>Đổi tên nhóm</ConversationOptionRow>}
      {!hideGroupNotification && <ConversationOptionRow disabled={busy || groupNotifications === null} aria-pressed={groupMuted} onClick={toggleGroupNotifications} icon={groupMuted ? <Bell size={18}/> : <BellOff size={18}/>}>{groupMuted ? 'Bật thông báo nhóm' : 'Tắt thông báo nhóm'}</ConversationOptionRow>}
    </>}
    {scope !== 'group' && <ConversationOptionRow disabled={busy || channelMuted === null} aria-pressed={channelMuted === true} onClick={toggleChannelNotifications} icon={channelMuted ? <Bell size={18}/> : <BellOff size={18}/>}>{channelMuted ? 'Bật thông báo kênh' : 'Tắt thông báo kênh'}</ConversationOptionRow>}
    {scope !== 'group' && canEdit && channel.id !== 0 && <ConversationOptionRow disabled={busy} onClick={renameChannel} icon={<Pencil size={18} aria-hidden="true"/>}>Đổi tên kênh</ConversationOptionRow>}
    {scope !== 'group' && canEdit && channel.id !== 0 && <ConversationOptionRow disabled={busy} onClick={editChannelTopic} icon={<FileText size={18} aria-hidden="true"/>}>Sửa chủ đề kênh</ConversationOptionRow>}
    {scope !== 'group' && canEdit && channel.id !== 0 && <ConversationOptionRow className="conversation-options-danger" disabled={busy} onClick={deleteChannel} icon={<Trash2 size={18} aria-hidden="true"/>}>Xóa kênh</ConversationOptionRow>}
    {scope !== 'channel' && (scope === 'group' || channel.id === 0) && <ConversationOptionRow className="conversation-options-danger" disabled={busy || !canLeave}
      title={!canLeave ? 'Chủ nhóm cần chuyển quyền sở hữu trước khi rời.' : undefined} onClick={leaveGroup} icon={<LogOut size={18} aria-hidden="true"/>}>{canLeave ? 'Rời nhóm' : 'Rời nhóm (chuyển quyền chủ nhóm trước)'}</ConversationOptionRow>}
  </>
}