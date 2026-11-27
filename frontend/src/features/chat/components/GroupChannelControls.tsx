import { useUiTranslation } from '@/shared/i18n/locale'
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
  const trUi = useUiTranslation()

  const { groupNotifications, channelMuted, busy, error, groupMuted, renameGroup, renameChannel,
    editChannelTopic, toggleGroupNotifications, toggleChannelNotifications, deleteChannel, leaveGroup } =
    useGroupChannelControls({ groupId, groupName, channel, userId, canEdit, canLeave, request, notify,
      onGroupRenamed, onChannelsChanged, onChannelDeleted, onLeftGroup,
      scope, onGroupNotificationChanged, hideGroupNotification })

  return <>
    {error && <p role="alert" className="group-channel-controls-error">{error}</p>}
    {scope !== 'channel' && (scope === 'group' || channel.id === 0) && <>
      {canEdit && <ConversationOptionRow disabled={busy} onClick={renameGroup} icon={<Pencil size={18} aria-hidden="true"/>}>{trUi("chat.renameGroup")}</ConversationOptionRow>}
      {!hideGroupNotification && <ConversationOptionRow disabled={busy || groupNotifications === null} aria-pressed={groupMuted} onClick={toggleGroupNotifications} icon={groupMuted ? <Bell size={18}/> : <BellOff size={18}/>}>{groupMuted ? trUi("chat.groupNoticeOn") : trUi("chat.groupNoticeOff")}</ConversationOptionRow>}
    </>}
    {scope !== 'group' && <ConversationOptionRow disabled={busy || channelMuted === null} aria-pressed={channelMuted === true} onClick={toggleChannelNotifications} icon={channelMuted ? <Bell size={18}/> : <BellOff size={18}/>}>{channelMuted ? 'Bật thông báo kênh' : 'Tắt thông báo kênh'}</ConversationOptionRow>}
    {scope !== 'group' && canEdit && channel.id !== 0 && <ConversationOptionRow disabled={busy} onClick={renameChannel} icon={<Pencil size={18} aria-hidden="true"/>}>{trUi("chat.renameChannel")}</ConversationOptionRow>}
    {scope !== 'group' && canEdit && channel.id !== 0 && <ConversationOptionRow disabled={busy} onClick={editChannelTopic} icon={<FileText size={18} aria-hidden="true"/>}>Sửa chủ đề kênh</ConversationOptionRow>}
    {scope !== 'group' && canEdit && channel.id !== 0 && <ConversationOptionRow className="conversation-options-danger" disabled={busy} onClick={deleteChannel} icon={<Trash2 size={18} aria-hidden="true"/>}>Xóa kênh</ConversationOptionRow>}
    {scope !== 'channel' && (scope === 'group' || channel.id === 0) && <ConversationOptionRow className="conversation-options-danger" disabled={busy || !canLeave}
      title={!canLeave ? trUi("common.ui.transferBeforeLeave") : undefined} onClick={leaveGroup} icon={<LogOut size={18} aria-hidden="true"/>}>{canLeave ? trUi("chat.leaveGroup") : 'Rời nhóm (chuyển quyền chủ nhóm trước)'}</ConversationOptionRow>}
  </>
}