import type { Conversation } from '../../chat/types'
import UserAvatar from '../../../shared/ui/UserAvatar'
import { CallHeaderActions } from '../../calls/components/CallManager'

type Props = {
  items: Conversation[]
  label: string
  onOpenCallChat?: (id: number) => void
}

export default function ContactCallConversationSection({ items, label, onOpenCallChat }: Props) {
  return items.length > 0 && (
    <section className="fd-call-extra-section" aria-label={label}>
      <h3 className="fd-call-section-heading">{label}<small>{items.length}</small></h3>
      {items.map(conversation => <div key={conversation.id} className="fd-person-row fd-call-conversation-row">
        <button type="button" className="fd-person-identity" onClick={() => onOpenCallChat?.(conversation.id)}
          aria-label={'Mở cuộc trò chuyện với ' + conversation.name}>
          <UserAvatar name={conversation.name} username={conversation.otherUsername} group={conversation.type === 'group'}
            className="avatar fd-avatar" online={conversation.type === 'direct' && conversation.online}/>
          <span><strong>{conversation.name}</strong><small>{conversation.type === 'group'
            ? conversation.memberCount + ' thành viên' : conversation.online ? 'Đang hoạt động' : 'Cuộc trò chuyện cá nhân'}</small></span>
        </button>
        <CallHeaderActions conversationId={conversation.id} disabled={Boolean(conversation.blockedByMe || conversation.blockedByOther)}/>
      </div>)}
    </section>
  )
}
