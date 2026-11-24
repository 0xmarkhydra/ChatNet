import { Bell, BellOff, ChevronRight, FileText, LogOut, Pencil, Trash2 } from 'lucide-react'
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
      {canEdit && <button type="button" disabled={busy} onClick={renameGroup}>
        <Pencil size={19} aria-hidden="true" /><span>Đổi tên nhóm</span><ChevronRight size={16} aria-hidden="true" />
      </button>}
      {!hideGroupNotification && <button type="button" disabled={busy || groupNotifications === null} aria-pressed={groupMuted} onClick={toggleGroupNotifications}>
        {groupMuted ? <Bell size={19} aria-hidden="true" /> : <BellOff size={19} aria-hidden="true" />}
        <span>{groupMuted ? 'Bật thông báo nhóm' : 'Tắt thông báo nhóm'}</span><ChevronRight size={16} aria-hidden="true" />
      </button>}
    </>}
    {scope !== 'group' && <button type="button" disabled={busy || channelMuted === null} aria-pressed={channelMuted === true} onClick={toggleChannelNotifications}>
      {channelMuted ? <Bell size={19} aria-hidden="true" /> : <BellOff size={19} aria-hidden="true" />}
      <span>{channelMuted ? 'Bật thông báo kênh' : 'Tắt thông báo kênh'}</span><ChevronRight size={16} aria-hidden="true" />
    </button>}
    {scope !== 'group' && canEdit && channel.id !== 0 && <button type="button" disabled={busy} onClick={renameChannel}>
      <Pencil size={19} aria-hidden="true" /><span>Đổi tên kênh</span><ChevronRight size={16} aria-hidden="true" />
    </button>}
    {scope !== 'group' && canEdit && channel.id !== 0 && <button type="button" disabled={busy} onClick={editChannelTopic}>
      <FileText size={19} aria-hidden="true" /><span>Sửa chủ đề kênh</span><ChevronRight size={16} aria-hidden="true" />
    </button>}
    {scope !== 'group' && canEdit && channel.id !== 0 && <button type="button" className="conversation-options-danger" disabled={busy} onClick={deleteChannel}>
      <Trash2 size={19} aria-hidden="true" /><span>Xóa kênh</span><ChevronRight size={16} aria-hidden="true" />
    </button>}
    {scope !== 'channel' && (scope === 'group' || channel.id === 0) && <button type="button" className="conversation-options-danger" disabled={busy || !canLeave}
      title={!canLeave ? 'Chủ nhóm cần chuyển quyền sở hữu trước khi rời.' : undefined} onClick={leaveGroup}>
      <LogOut size={19} aria-hidden="true" /><span>{canLeave ? 'Rời nhóm' : 'Rời nhóm (chuyển quyền chủ nhóm trước)'}</span>
      <ChevronRight size={16} aria-hidden="true" />
    </button>}
  </>
}