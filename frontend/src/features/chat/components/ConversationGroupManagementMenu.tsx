import { useUiTranslation } from '@/shared/i18n/locale'
import { Bell, BellOff, Plus, Users } from 'lucide-react'
import type { Conversation } from '../types'
import type { GroupChannel } from '../utils/groupChannels'
import type { GroupManagementSection } from './GroupSettingsPanel'
import GroupChannelControls from './GroupChannelControls'
import GroupChannelCreateForm from './GroupChannelCreateForm'
import ConversationManagementSection, { ConversationOptionRow } from './ConversationManagementSection'

type Props = {
  conversation: Conversation
  channel: GroupChannel
  selectedChannelId: number
  userId: number
  creatingChannel: boolean
  setCreatingChannel: (open: boolean) => void
  canCreateChannel: boolean
  channelCreateBusy: boolean
  onCreateChannel: (name: string, description: string) => Promise<boolean>
  notificationBusy: boolean
  onToggleNotifications: () => void
  onGroupManagement: (section: GroupManagementSection) => void
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
  canCreateChannel, channelCreateBusy, onCreateChannel, notificationBusy, onToggleNotifications,
  onGroupManagement, canEditGroupPhotos, canLeaveGroup, request,
  notify, onGroupRenamed, onChannelsChanged, onChannelDeleted, onLeftGroup,
}: Props) {
  const trUi = useUiTranslation()

  const isChannel = selectedChannelId !== 0
  return (
    <>

<ConversationManagementSection title={isChannel ? trUi("common.ui.manageChannels") : trUi("chat.manageGroup")}>
            {!isChannel && <>
              <ConversationOptionRow icon={<Users size={18}/>} onClick={() => onGroupManagement('members')}>{trUi("chat.membersManagement")}</ConversationOptionRow>
              {canCreateChannel && (creatingChannel
                ? <GroupChannelCreateForm busy={channelCreateBusy} onCreate={onCreateChannel}
                    onCancel={() => setCreatingChannel(false)} />
                : <ConversationOptionRow icon={<Plus size={18}/>} onClick={() => setCreatingChannel(true)}>{trUi("chat.createChannel")}</ConversationOptionRow>)}
              <ConversationOptionRow disabled={notificationBusy} onClick={onToggleNotifications} icon={conversation.muted ? <Bell size={18}/> : <BellOff size={18}/>}>
                {conversation.muted ? trUi("chat.groupNoticeOn") : trUi("chat.groupNoticeOff")}
              </ConversationOptionRow>
            </>}
            <GroupChannelControls groupId={conversation.id}
              groupName={conversation.name} channel={channel} userId={userId}
              canEdit={canEditGroupPhotos} canLeave={canLeaveGroup}
              scope={isChannel ? 'channel' : 'group'} hideGroupNotification
              request={request} notify={notify} onGroupRenamed={onGroupRenamed}
              onChannelsChanged={onChannelsChanged} onChannelDeleted={onChannelDeleted}
              onLeftGroup={onLeftGroup} />
        </ConversationManagementSection>
    </>
  )
}