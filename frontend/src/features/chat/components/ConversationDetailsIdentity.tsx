import { useUiTranslation } from '@/shared/i18n/locale'
import { Camera } from 'lucide-react'
import type { Conversation } from '../types'
import type { GroupChannel } from '../utils/groupChannels'
import type { GroupPhotoTarget } from '../utils/groupPhotoTarget'
import UserAvatar from '../../../shared/ui/UserAvatar'
import ConversationAvatar from './ConversationAvatar'

type Props = {
  conversation: Conversation
  channel: GroupChannel
  selectedChannelId: number
  canEditGroupPhotos: boolean
  photoBusy: boolean
  onEditPhoto: (target: GroupPhotoTarget) => void
}

export default function ConversationDetailsIdentity({
  conversation, channel, selectedChannelId, canEditGroupPhotos, photoBusy, onEditPhoto,
}: Props) {
  const trUi = useUiTranslation()

  const isGroup = conversation.type === 'group'
  const isChannel = isGroup && selectedChannelId !== 0
  const displayName = isChannel ? channel.name : conversation.name
  const displayAvatar = isChannel ? channel.avatarUrl : conversation.avatarUrl
  const blocked = !isGroup && Boolean(conversation.blockedByMe || conversation.blockedByOther)

  return (
<div className="conversation-info-panel-identity social-chat-details-identity">
          <div className="group-photo-avatar-wrap">
            {isChannel
              ? <UserAvatar name={displayName} className="conversation-info-panel-avatar social-chat-details-avatar" group imageUrl={displayAvatar} />
              : <ConversationAvatar conversation={conversation} className="conversation-info-panel-avatar social-chat-details-avatar" />}

            {isGroup && canEditGroupPhotos && <button type="button" className="group-photo-trigger" disabled={photoBusy}
              aria-label={isChannel ? trUi("chat.changeChannelPhoto") : trUi("chat.changeGroupPhoto")} title={isChannel ? trUi("chat.changeChannelPhoto") : trUi("chat.changeGroupPhoto")}
              onClick={() => onEditPhoto({ name: displayName, avatarUrl: displayAvatar,
                kind: isChannel ? 'channel' : 'group', channelId: isChannel ? selectedChannelId : undefined })}>
              <Camera size={17} aria-hidden="true" />
            </button>}
          </div>
        <strong title={displayName}>{displayName}</strong>
        <span>{blocked ? (conversation.blockedByOther ? trUi("chat.blockedBy") : trUi("chat.blockedUser"))
          : isChannel ? `Kênh của nhóm ${conversation.name}` : isGroup ? `${conversation.memberCount} thành viên`
          : conversation.online ? '● Đang hoạt động' : trUi("app.privateChat")}</span>
      </div>
  )
}