import { useUiTranslation } from '@/shared/i18n/locale'
import type { Dispatch, SetStateAction } from 'react'
import { Heart, MessageCircle, MoreHorizontal, Phone, UserRound, Users } from 'lucide-react'
import type { FriendConnection, FriendSearchResult } from '../types'
import UserAvatar from '../../../shared/ui/UserAvatar'

type Props = {
  friend: FriendConnection
  contactMetadata: Record<number, { nickname: string; note: string; favorite: boolean }>
  friendBusyIds: Set<number>
  friendMenuId: number | null
  setFriendMenuId: Dispatch<SetStateAction<number | null>>
  setFriendPreview: (friend: FriendSearchResult | null) => void
  changePersonalContact: (friend: FriendConnection, field: 'nickname' | 'note' | 'favorite') => Promise<void>
  removeAcceptedFriend: (friend: FriendConnection) => Promise<void>
  blockContact: (friend: FriendSearchResult | FriendConnection) => Promise<void>
  unblockContact: (id: number) => Promise<void>
  reportContact: (friend: FriendSearchResult | FriendConnection) => Promise<void>
  openChat: (friend: FriendSearchResult) => void
  startCall: (friend: FriendSearchResult) => void
  isBlocked: (friend: FriendSearchResult) => boolean
  iconOnly?: boolean
}

const personName = (friend: FriendSearchResult) => friend.displayName || friend.username

export default function ContactFriendProfile({ friend, contactMetadata, friendBusyIds, setFriendPreview, changePersonalContact, removeAcceptedFriend, blockContact, unblockContact, reportContact, openChat, startCall, isBlocked, iconOnly = false }: Props) {
  const trUi = useUiTranslation()

  const avatar = (contact: FriendSearchResult, additional = '') => (
    <UserAvatar username={contact.username} name={personName(contact)} className={'avatar fd-avatar ' + additional} online={contact.online} />
  )
  return <>
    <div className="fd-profile-cover" aria-hidden="true"/>
    <div className="fd-profile-core" aria-label={trUi('contacts.profileNamed', { name: personName(friend) })}>
      {avatar(friend, 'fd-profile-avatar')}
      <h2>{contactMetadata[friend.id]?.nickname || personName(friend)}</h2>
      <p className={friend.online && !isBlocked(friend) ? 'fd-online' : ''} aria-live="polite">{friend.blockedByOther ? trUi("chat.blockedBy") : friend.blockedByMe ? trUi("chat.blockedUser") : friend.online ? trUi("profile.active") : trUi("common.offline")}
        {typeof friend.mutualGroups === 'number' && friend.mutualGroups > 0 ? ' · ' + trUi('contacts.mutualCount', { count: friend.mutualGroups }) : ''}
      </p>
    </div>
    <div className="fd-profile-actions">
      <button type="button" className="fd-primary" aria-label={isBlocked(friend) ? trUi('contacts.viewConversationNamed', { name: personName(friend) }) : trUi('common.ui.messageWith', { v1: personName(friend) })} title={isBlocked(friend) ? trUi("chat.seeConversation") : trUi("chat.message")} onClick={() => openChat(friend)}><MessageCircle size={20}/>{!iconOnly && (isBlocked(friend) ? trUi("chat.seeConversation") : trUi("chat.message"))}</button>
      <button type="button" className="fd-secondary" aria-label={trUi('contacts.voiceCallNamed', { name: personName(friend) })} title={trUi("calls.voiceCall")} disabled={isBlocked(friend)} onClick={() => startCall(friend)}><Phone size={20}/>{!iconOnly && trUi("calls.voiceCall")}</button>
    </div>
    <div className="fd-profile-info">
      <h3>{trUi("contacts.friendInfo")}</h3>
      <p><UserRound size={19}/>@{friend.username}</p>
      {typeof friend.mutualGroups === 'number' && <p><Users size={19}/>{trUi('contacts.mutualCount', { count: friend.mutualGroups })}</p>}
      {contactMetadata[friend.id]?.note && <p><Heart size={19}/>{contactMetadata[friend.id].note}</p>}
      <button type="button" onClick={() => setFriendPreview(friend)}><UserRound size={19}/>{trUi("profile.viewProfile")}</button>
    </div>
    <div className="fd-profile-options"><h3><MoreHorizontal size={20}/>{trUi('contacts.options')}</h3>
      <div>
        <button type="button" disabled={friendBusyIds.has(friend.id)} onClick={() => void changePersonalContact(friend, 'nickname')}>{trUi('contacts.nickname')}</button><span>·</span>
        <button type="button" disabled={friendBusyIds.has(friend.id)} aria-pressed={Boolean(contactMetadata[friend.id]?.favorite)} onClick={() => void changePersonalContact(friend, 'favorite')}>
          {contactMetadata[friend.id]?.favorite ? trUi('contacts.removeFavorite') : trUi('contacts.pin')}
        </button><span>·</span>
        {!friend.blockedByOther && <>
          <button type="button" disabled={friendBusyIds.has(friend.id)}
            onClick={() => void (friend.blockedByMe ? unblockContact(friend.id) : blockContact(friend))}>
            {friend.blockedByMe ? trUi("contacts.unblock") : trUi("contacts.block")}
          </button><span>·</span>
        </>}
        <button type="button" disabled={friendBusyIds.has(friend.id)} onClick={() => void reportContact(friend)}>{trUi("common.report")}</button><span>·</span>
        <button type="button" disabled={friendBusyIds.has(friend.id)} onClick={() => void removeAcceptedFriend(friend)}>{trUi("contacts.unfriend")}</button>
      </div>
    </div>
  </>

}