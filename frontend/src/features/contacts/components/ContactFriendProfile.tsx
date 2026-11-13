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
  const avatar = (contact: FriendSearchResult, additional = '') => (
    <UserAvatar username={contact.username} name={personName(contact)} className={'avatar fd-avatar ' + additional} online={contact.online} />
  )
  return <>
    <div className="fd-profile-cover" aria-hidden="true"/>
    <div className="fd-profile-core">
      {avatar(friend, 'fd-profile-avatar')}
      <h2>{contactMetadata[friend.id]?.nickname || personName(friend)}</h2>
      <p className={friend.online && !isBlocked(friend) ? 'fd-online' : ''}>{friend.blockedByOther ? 'Bạn đã bị chặn' : friend.blockedByMe ? 'Bạn đã chặn người này' : friend.online ? 'Đang hoạt động' : 'Ngoại tuyến'}
        {typeof friend.mutualGroups === 'number' && friend.mutualGroups > 0 ? ' · ' + friend.mutualGroups + ' nhóm chung' : ''}
      </p>
    </div>
    <div className="fd-profile-actions">
      <button type="button" className="fd-primary" aria-label={isBlocked(friend) ? 'Xem hội thoại' : 'Nhắn tin'} title={isBlocked(friend) ? 'Xem hội thoại' : 'Nhắn tin'} onClick={() => openChat(friend)}><MessageCircle size={20}/>{!iconOnly && (isBlocked(friend) ? 'Xem hội thoại' : 'Nhắn tin')}</button>
      <button type="button" className="fd-secondary" aria-label="Gọi thoại" title="Gọi thoại" disabled={isBlocked(friend)} onClick={() => startCall(friend)}><Phone size={20}/>{!iconOnly && 'Gọi thoại'}</button>
    </div>
    <div className="fd-profile-info">
      <h3>Thông tin bạn bè</h3>
      <p><UserRound size={19}/>@{friend.username}</p>
      {typeof friend.mutualGroups === 'number' && <p><Users size={19}/>{friend.mutualGroups} nhóm chung</p>}
      {contactMetadata[friend.id]?.note && <p><Heart size={19}/>{contactMetadata[friend.id].note}</p>}
      <button type="button" onClick={() => setFriendPreview(friend)}><UserRound size={19}/>Xem trang cá nhân</button>
    </div>
    <div className="fd-profile-options"><h3><MoreHorizontal size={20}/>Tùy chọn</h3>
      <div>
        <button type="button" onClick={() => void changePersonalContact(friend, 'nickname')}>Đặt biệt danh</button><span>·</span>
        <button type="button" onClick={() => void changePersonalContact(friend, 'favorite')}>
          {contactMetadata[friend.id]?.favorite ? 'Bỏ yêu thích' : 'Ghim'}
        </button><span>·</span>
        {!friend.blockedByOther && <>
          <button type="button" disabled={friendBusyIds.has(friend.id)}
            onClick={() => void (friend.blockedByMe ? unblockContact(friend.id) : blockContact(friend))}>
            {friend.blockedByMe ? 'Bỏ chặn' : 'Chặn'}
          </button><span>·</span>
        </>}
        <button type="button" onClick={() => void reportContact(friend)}>Báo cáo</button><span>·</span>
        <button type="button" disabled={friendBusyIds.has(friend.id)} onClick={() => void removeAcceptedFriend(friend)}>Hủy kết bạn</button>
      </div>
    </div>
  </>

}
