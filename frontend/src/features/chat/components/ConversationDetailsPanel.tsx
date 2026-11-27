import { useUiTranslation } from '@/shared/i18n/locale'
import { useState } from 'react'
import { Ban, Bell, BellOff, ShieldCheck, Trash2, Users, X } from 'lucide-react'
import type { Conversation } from '../types'
import type { GroupChannel } from '../utils/groupChannels'
import ChatWallpaperPicker from './ChatWallpaperPicker'
import ConversationExtraTools from './ConversationExtraTools'
import type { GroupActivity } from '../types/groupActivities'
import type { GroupManagementSection } from './GroupSettingsPanel'
import type { GroupPhotoTarget } from '../utils/groupPhotoTarget'
import GroupAvatarEditor from './GroupAvatarEditor'
import ConversationSharedPreview from './ConversationSharedPreview'
import ConversationDetailsIdentity from './ConversationDetailsIdentity'
import ConversationGroupManagementMenu from './ConversationGroupManagementMenu'
import ConversationManagementSection, { ConversationOptionRow } from './ConversationManagementSection'

type Props = {
  conversation: Conversation
  busy: boolean
  notificationBusy: boolean
  onToggleNotifications: () => void
  onClose: () => void
  onProfile: () => void
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
  canCreateChannel: boolean
  channelCreateBusy: boolean
  onCreateChannel: (name: string, description: string) => Promise<boolean>
  canEditGroupPhotos: boolean
  photoBusy: boolean
  onSavePhoto: (target: GroupPhotoTarget, file: File | null) => Promise<boolean>
  onBlock: () => void
  onUnblock: () => void
  onClearHistory: () => void
  activities?: GroupActivity[]
  onActivity?: (id: number) => void
  onRefresh?: () => Promise<void>
  onContactSaved?: (id: number, metadata: import('../../contacts/utils/contactMetadata').PersonalContactMetadata) => void
}

export default function ConversationDetailsPanel(props: Props) {
  const { conversation, selectedChannelId } = props
  const scope = conversation.type === 'group' ? selectedChannelId : 0
  return <ConversationDetailsPanelScope key={JSON.stringify([conversation.id, scope])} {...props} />
}

function ConversationDetailsPanelScope({

  conversation, busy, notificationBusy, onToggleNotifications, onClose, onProfile, onShared, request,
  selectedChannelId, channel, userId, canLeaveGroup, notify, onGroupRenamed,
  onChannelsChanged, onChannelDeleted, onLeftGroup, onGroupManagement,
  canCreateChannel, channelCreateBusy, onCreateChannel,
  canEditGroupPhotos, photoBusy, onSavePhoto, onBlock, onUnblock, onClearHistory, activities, onActivity, onRefresh, onContactSaved,
}: Props) {
  const trUi = useUiTranslation()

  const isGroup = conversation.type === 'group'
  const isChannel = isGroup && selectedChannelId !== 0
  const [creatingChannel, setCreatingChannel] = useState(false)
  const [photoTarget, setPhotoTarget] = useState<GroupPhotoTarget | null>(null)

  const directProfile = <ConversationOptionRow icon={<Users size={18}/>} onClick={onProfile}>Hồ sơ</ConversationOptionRow>
  const notificationLabel = conversation.muted ? 'Bật thông báo hội thoại' : 'Tắt thông báo hội thoại'
  const directNotifications = <ConversationOptionRow disabled={notificationBusy} aria-pressed={Boolean(conversation.muted)} icon={conversation.muted ? <Bell size={18}/> : <BellOff size={18}/>} onClick={onToggleNotifications}>{notificationLabel}</ConversationOptionRow>
  const blockLabel = conversation.blockedByMe ? 'Bỏ chặn người dùng' : 'Chặn tin nhắn và cuộc gọi'
  const directBlock = conversation.otherUserId && !conversation.blockedByOther ? (
    <ConversationOptionRow icon={<Ban size={18}/>} className="conversation-options-danger" disabled={busy} onClick={conversation.blockedByMe ? onUnblock : onBlock}>{blockLabel}</ConversationOptionRow>
  ) : null

  return (
    <aside className="conversation-info-panel social-chat-details" id="conversation-details-panel" aria-label={trUi("chat.conversationInfo")}>
      <div className="conversation-details-heading">
        <h2>{isChannel ? trUi("chat.channelInfo") : trUi("chat.conversationInfo")}</h2>
        <button type="button" className="sidebar-panel-close" onClick={onClose}
          aria-label={trUi("chat.closeConversationInfo")} title={trUi("common.close")}>
          <X size={19} aria-hidden="true" />
        </button>
      </div>

      <ConversationDetailsIdentity conversation={conversation} channel={channel} selectedChannelId={selectedChannelId}
        canEditGroupPhotos={canEditGroupPhotos} photoBusy={photoBusy} onEditPhoto={setPhotoTarget} />

      <ConversationSharedPreview conversationId={conversation.id}
        channelId={isGroup ? selectedChannelId : 0}
        request={request} onOpen={onShared} />

      <nav className="conversation-info-panel-links social-chat-details-links" aria-label={trUi("chat.conversationOptions")}>
        <ConversationManagementSection title={trUi("chat.chatSettings")}>
          <ChatWallpaperPicker conversation={conversation} request={request} onRefresh={onRefresh} notify={notify} />
        </ConversationManagementSection>
        {!isGroup && <ConversationManagementSection title={trUi("chat.manageConversation")}>
          {directProfile}
          <ConversationExtraTools conversation={conversation} request={request} notify={notify} onRefresh={onRefresh} onContactSaved={onContactSaved} />
          {directNotifications}
        </ConversationManagementSection>}

        {isGroup && !isChannel && <ConversationManagementSection title={trUi("chat.groupActivities")}><ConversationExtraTools conversation={conversation} request={request} notify={notify} activities={activities} onActivity={onActivity} /></ConversationManagementSection>}
        {isGroup && <ConversationGroupManagementMenu conversation={conversation} channel={channel}
          selectedChannelId={selectedChannelId} userId={userId} creatingChannel={creatingChannel} setCreatingChannel={setCreatingChannel}
          canCreateChannel={canCreateChannel} channelCreateBusy={channelCreateBusy}
          onCreateChannel={onCreateChannel} notificationBusy={notificationBusy} onToggleNotifications={onToggleNotifications}
          onGroupManagement={onGroupManagement}
          canEditGroupPhotos={canEditGroupPhotos} canLeaveGroup={canLeaveGroup} request={request} notify={notify}
          onGroupRenamed={onGroupRenamed} onChannelsChanged={onChannelsChanged}
          onChannelDeleted={onChannelDeleted} onLeftGroup={onLeftGroup} />}

        {!isChannel && <ConversationManagementSection title={trUi("chat.privacyHistory")}>
          {!isGroup && directBlock}
          <ConversationOptionRow icon={<Trash2 size={18}/>} className="conversation-options-danger" disabled={busy} onClick={onClearHistory}>{trUi("chat.clearHistory")}</ConversationOptionRow>
        </ConversationManagementSection>}
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