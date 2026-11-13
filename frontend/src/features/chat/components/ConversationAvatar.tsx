import UserAvatar from '../../../shared/ui/UserAvatar'
import type { Conversation } from '../types'
import '../styles/conversation-avatar.css'

type Props = {
  conversation: Conversation
  className: string
}

export default function ConversationAvatar({ conversation, className }: Props) {
  const isGroup = conversation.type === 'group'
  const members = isGroup && !conversation.avatarUrl
    ? (conversation.avatarMembers || []).filter(Boolean).slice(0, 3)
    : []

  if (members.length > 0) {
    return (
      <div
        className={`${className} conversation-avatar-cluster members-${members.length}`}
        role="img"
        aria-label={`Ảnh đại diện nhóm ${conversation.name}`}
        title={conversation.name}
      >
        {members.map((username) => (
          <UserAvatar
            key={username}
            className="conversation-avatar-member"
            name={username}
            username={username}
          />
        ))}
      </div>
    )
  }

  return (
    <UserAvatar
      className={className}
      name={conversation.name}
      username={conversation.otherUsername}
      group={isGroup}
      imageUrl={isGroup ? conversation.avatarUrl : undefined}
      online={!isGroup && conversation.online}
    />
  )
}
