import { useUiTranslation } from '@/shared/i18n/locale'
import { ConversationAvatar, type Conversation } from '../../chat'
import { CallHeaderActions } from '../../calls'

type Props = {
  items: Conversation[]
  label: string
  onOpenCallChat?: (id: number) => void
}

export default function ContactCallConversationSection({ items, label, onOpenCallChat }: Props) {
  const trUi = useUiTranslation()

  return items.length > 0 && (
    <section className="fd-call-extra-section" aria-label={label}>
      <h3 className="fd-call-section-heading">{label}<small>{items.length}</small></h3>
      {items.map(conversation => <div key={conversation.id} className="fd-person-row fd-call-conversation-row">
        <button type="button" className="fd-person-identity" onClick={() => onOpenCallChat?.(conversation.id)}
          aria-label={'Mở cuộc trò chuyện với ' + conversation.name}>
          <ConversationAvatar conversation={conversation} className="avatar fd-avatar" />
          <span><strong>{conversation.name}</strong><small>{conversation.type === 'group'
            ? conversation.memberCount + ' thành viên' : conversation.online ? trUi("profile.active") : 'Cuộc trò chuyện cá nhân'}</small></span>
        </button>
        <CallHeaderActions conversationId={conversation.id} disabled={Boolean(conversation.blockedByMe || conversation.blockedByOther)}/>
      </div>)}
    </section>
  )
}
