import { Fragment, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { Phone, Plus, RefreshCw, Search, Users, Video, X } from 'lucide-react'
import type { FriendConnection, FriendSearchResult } from '../types'
import type { Conversation } from '../../chat/types'
import ContactCallConversationSection from './ContactCallConversationSection'
import UserAvatar from '../../../shared/ui/UserAvatar'
import ContactInvitations from './ContactInvitations'
import ContactFriendProfile from './ContactFriendProfile'
import useSlidingPill from '../../../shared/ui/useSlidingPill'
import { useContactDirectory, type DirectoryFilter } from '../hooks/useContactDirectory'

export type FriendsScreen = 'directory' | 'invitations'
type Props = {
  screen: FriendsScreen
  onScreenChange: (screen: FriendsScreen) => void
  friendQuery: string
  setFriendQuery: (value: string) => void
  friendSearching: boolean
  friendSearchError: boolean
  setFriendSearchRetry: Dispatch<SetStateAction<number>>
  contactSearchResults: FriendSearchResult[]
  friendRelationship: (id: number) => 'accepted' | 'incoming' | 'outgoing' | 'none'
  friendBusyIds: Set<number>
  actOnFriend: (friend: FriendSearchResult | FriendConnection) => Promise<void>
  setFriendMenuId: Dispatch<SetStateAction<number | null>>
  friendMenuId: number | null
  blockContact: (friend: FriendSearchResult | FriendConnection) => Promise<void>
  unblockContact: (id: number) => Promise<void>
  onOpenBlockedChat: (id: number) => void
  reportContact: (friend: FriendSearchResult | FriendConnection) => Promise<void>
  friendRequests: FriendConnection[]
  declineFriendRequest: (friend: FriendConnection) => Promise<void>
  friends: FriendConnection[]
  friendsLoading: boolean
  friendsError: string
  onRetryFriends: () => void
  contactMetadata: Record<number, { nickname: string; note: string; favorite: boolean }>
  openDirectByUsername: (username: string, mediaType?: 'audio' | 'video') => Promise<void>
  setFriendPreview: (friend: FriendSearchResult | null) => void
  changePersonalContact: (friend: FriendConnection, field: 'nickname' | 'note' | 'favorite') => Promise<void>
  removeAcceptedFriend: (friend: FriendConnection) => Promise<void>
  connectionUrl: string
  onScanQr: () => void
  embeddedInCalls?: boolean
  callConversations?: Conversation[]
  onOpenCallChat?: (id: number) => void
}

const personName = (friend: FriendSearchResult) => friend.displayName || friend.username
const actionText = (relationship: ReturnType<Props['friendRelationship']>) => ({
  accepted: 'Nhắn tin', incoming: 'Chấp nhận', outgoing: 'Hủy lời mời', none: 'Kết bạn',
}[relationship])

export default function ContactsView({
  screen, onScreenChange, friendQuery, setFriendQuery, friendSearching, friendSearchError,
  setFriendSearchRetry, contactSearchResults, friendRelationship, friendBusyIds, actOnFriend,
  setFriendMenuId, friendMenuId, blockContact, unblockContact, onOpenBlockedChat, reportContact, friendRequests, declineFriendRequest,
  friends, friendsLoading, friendsError, onRetryFriends, contactMetadata, openDirectByUsername, setFriendPreview, changePersonalContact,
  removeAcceptedFriend, connectionUrl, onScanQr, embeddedInCalls = false,
  callConversations = [], onOpenCallChat,
}: Props) {
  const [directoryFilter, setDirectoryFilter] = useState<DirectoryFilter>('alphabetical')
  const { hostRef: filterHostRef, pillRef: filterPillRef, activeRef: filterActiveRef } = useSlidingPill<HTMLDivElement>(directoryFilter)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [expandedFriendId, setExpandedFriendId] = useState<number | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const searching = !embeddedInCalls && Boolean(friendQuery.trim())

  const { visibleFriends, callSections } = useContactDirectory({ friends, contactMetadata, embeddedInCalls, friendQuery, directoryFilter, callConversations })
  const selectedFriend = visibleFriends.find(friend => friend.id === selectedId) ?? visibleFriends[0] ?? null
  const blockedStatus = (friend: FriendSearchResult) => friends.find(item => item.id === friend.id)
  const isBlocked = (friend: FriendSearchResult) => {
    const item = blockedStatus(friend)
    return Boolean(item?.blockedByMe || item?.blockedByOther)
  }
  const openChat = (friend: FriendSearchResult) => {
    if (isBlocked(friend)) onOpenBlockedChat(friend.id)
    else void openDirectByUsername(friend.username)
  }
  const relationshipFor = (friend: FriendSearchResult) => friendRelationship(friend.id)
  const act = (friend: FriendSearchResult | FriendConnection) => {
    if (friendRelationship(friend.id) === 'accepted') openChat(friend)
    else void actOnFriend(friend)
  }
  const startCall = (friend: FriendSearchResult) => {
    if (!isBlocked(friend)) void openDirectByUsername(friend.username, 'audio')
  }
  const enterInvitations = () => {
    setFriendQuery('')
    onScreenChange('invitations')
  }
  const openSearch = () => {
    setFriendQuery('')
    onScreenChange('directory')
    window.requestAnimationFrame(() => {
      (searchRef.current ?? document.querySelector<HTMLInputElement>('.call-center-directory-search input'))?.focus()
    })
  }

  const avatar = (friend: FriendSearchResult, additional = '') => (
    <UserAvatar username={friend.username} name={personName(friend)}
      className={'avatar fd-avatar ' + additional} online={friend.online} />
  )
  const profileDetails = (friend: FriendConnection) => (
    <ContactFriendProfile friend={friend} contactMetadata={contactMetadata} friendBusyIds={friendBusyIds}
      friendMenuId={friendMenuId} setFriendMenuId={setFriendMenuId} setFriendPreview={setFriendPreview}
      changePersonalContact={changePersonalContact} removeAcceptedFriend={removeAcceptedFriend}
      blockContact={blockContact} unblockContact={unblockContact} reportContact={reportContact}
      openChat={openChat} startCall={startCall} isBlocked={isBlocked} />
  )

  return <div className={'friends-design-v2' + (embeddedInCalls ? ' is-call-directory' : '')} aria-label={screen === 'directory' ? 'Danh bạ' : 'Lời mời kết bạn'}>
    {screen === 'directory' ? <>
      {!embeddedInCalls && <section className="fd-searchbar">
        <label><Search size={22} aria-hidden="true"/>
          <input ref={searchRef} type="search" value={friendQuery} onChange={event => setFriendQuery(event.target.value)}
            placeholder="Tìm theo tên, số điện thoại hoặc ID SocCo..." aria-label="Tìm trong danh bạ" />
          {friendQuery && <button type="button" aria-label="Xóa tìm kiếm" onClick={() => {setFriendQuery('');searchRef.current?.focus()}}><X size={17}/></button>}
        </label>
        <button type="button" className="fd-primary fd-add-new" onClick={enterInvitations}><Plus size={18}/>Kết bạn mới</button>
      </section>}
      <div className={'fd-directory-layout' + (embeddedInCalls ? ' fd-list-only' : '')}>
        <section className="fd-card fd-list-card">
          {searching ? <>
            <div className="fd-list-header"><div><h2>Kết quả tìm kiếm</h2><p>Tìm người dùng theo tên, username hoặc email</p></div>
              <button type="button" className="fd-text-button" onClick={() => setFriendQuery('')}>Xóa tìm kiếm</button></div>

            {friendSearchError && !friendSearching && <p className="fd-empty" role="alert">Không thể tìm người dùng.
              <button type="button" className="fd-text-button" onClick={() => setFriendSearchRetry(value => value + 1)}>Thử lại</button></p>}
            {!friendSearching && !friendSearchError && contactSearchResults.length === 0 && <p className="fd-empty">Không tìm thấy người dùng phù hợp.</p>}
            <div className="fd-person-list">{contactSearchResults.map(friend => <div className="fd-person-row" key={friend.id}>
              <button type="button" className="fd-person-identity" onClick={() => setFriendPreview(friend)}>{avatar(friend)}
                <span><strong>{personName(friend)}</strong><small>@{friend.username}</small></span></button>
              <button type="button" className="fd-secondary fd-search-action" disabled={friendBusyIds.has(friend.id)} onClick={() => act(friend)}>{actionText(relationshipFor(friend))}</button>
            </div>)}</div>
          </> : <>
            <div className="fd-list-header"><h2>{embeddedInCalls ? 'Bạn bè' : 'Tất cả bạn bè'}</h2>
              <div className="fd-list-actions">
                <span>{friends.length.toLocaleString('vi-VN')} người</span>
                <button type="button" aria-label="Tải lại danh sách bạn bè" title="Tải lại danh sách bạn bè"
                  disabled={friendsLoading} onClick={onRetryFriends}><RefreshCw size={17} aria-hidden="true"/></button>
              </div>
            </div>
            <div ref={filterHostRef} className="fd-filters sliding-pill-host" role="group" aria-label="Lọc danh bạ">
              <span ref={filterPillRef} className="sliding-pill contacts-filter-active-pill" aria-hidden="true" />
              {([['alphabetical','A – Z'],['online','Đang online'],['favorites','Yêu thích']] as const).map(([filter,label]) =>
                <button ref={directoryFilter === filter ? filterActiveRef : undefined} type="button" key={filter} className={directoryFilter === filter ? 'active' : ''}
                  aria-pressed={directoryFilter === filter} onClick={() => setDirectoryFilter(filter)}>{label}</button>)}
            </div>
            {friendsError && <div className="fd-sync-feedback" role="alert">
              <span>{friendsError}</span>
              <button type="button" className="fd-secondary" disabled={friendsLoading} onClick={onRetryFriends}>Thử lại</button>
            </div>}
            <div className="fd-person-list" aria-label="Danh sách bạn bè" aria-busy={friendsLoading}>
              {visibleFriends.map(friend => <Fragment key={friend.id}><div className={'fd-person-row' + (!embeddedInCalls && selectedFriend?.id === friend.id ? ' selected' : '') + (!embeddedInCalls && expandedFriendId === friend.id ? ' expanded' : '')}>
                <button type="button" className="fd-person-identity" aria-pressed={embeddedInCalls ? undefined : selectedFriend?.id === friend.id}
                  aria-expanded={embeddedInCalls ? undefined : expandedFriendId === friend.id}
                  onClick={() => {
                    if (embeddedInCalls) { openChat(friend); return }
                    setSelectedId(friend.id)
                    setExpandedFriendId(value => value === friend.id ? null : friend.id)
                  }}>{avatar(friend)}<span>
                    <strong>{contactMetadata[friend.id]?.nickname || personName(friend)}</strong>
                    <small>{friend.online ? 'Đang hoạt động' : 'Ngoại tuyến'}
                      {contactMetadata[friend.id]?.favorite ? ' · Yêu thích' : ''}
                      {friend.blockedByOther ? ' · Bạn đã bị chặn' : friend.blockedByMe ? ' · Đã chặn' : ''}</small>
                  </span></button>
                {embeddedInCalls && <>
                  <button type="button" className="fd-icon-btn" aria-label={'Gọi thoại cho ' + personName(friend)}
                    disabled={isBlocked(friend)} onClick={() => startCall(friend)}><Phone size={20}/></button>
                  <button type="button" className="fd-icon-btn" aria-label={'Gọi video cho ' + personName(friend)}
                    disabled={isBlocked(friend)} onClick={() => void openDirectByUsername(friend.username, 'video')}><Video size={20}/></button>
                </>}
              </div>
              {!embeddedInCalls && expandedFriendId === friend.id && <section className="fd-inline-profile" aria-label={'Thông tin của ' + personName(friend)}>
                {profileDetails(friend)}
              </section>}
              </Fragment>)}
              {visibleFriends.length === 0 && !friendsError && (!embeddedInCalls || (callSections.groups.length === 0 && callSections.otherContacts.length === 0)) && <p className="fd-empty" role={friendsLoading ? 'status' : undefined}>
                {friendsLoading ? 'Đang tải danh sách bạn bè...' : friends.length ? 'Không có bạn bè phù hợp.' : embeddedInCalls ? 'Bạn chưa có bạn bè trong danh bạ.' : 'Bạn chưa có bạn bè. Nhấn Kết bạn mới để kết nối.'}
              </p>}
              {embeddedInCalls && <ContactCallConversationSection items={callSections.groups} label="Nhóm" onOpenCallChat={onOpenCallChat} />}
              {embeddedInCalls && <ContactCallConversationSection items={callSections.otherContacts} label="Liên hệ khác" onOpenCallChat={onOpenCallChat} />}
            </div>
          </>}
        </section>
        {!embeddedInCalls && <section className="fd-card fd-profile-panel" aria-label="Thông tin bạn bè">
          {selectedFriend && !searching ? profileDetails(selectedFriend) : <div className="fd-empty fd-profile-placeholder"><Users size={38}/>
            <h2>{searching ? 'Kết nối bạn bè' : 'Chưa chọn bạn bè'}</h2><p>{searching ? 'Chọn một kết quả tìm kiếm để xem hồ sơ.' : 'Kết bạn mới để xem thông tin ở đây.'}</p></div>}
        </section>}
      </div>
    </> : <ContactInvitations friendRequests={friendRequests} friendBusyIds={friendBusyIds} actOnFriend={actOnFriend} declineFriendRequest={declineFriendRequest} connectionUrl={connectionUrl} onScanQr={onScanQr} onBack={() => { onScreenChange('directory'); setFriendQuery('') }} onSearch={openSearch} />}
  </div>
}