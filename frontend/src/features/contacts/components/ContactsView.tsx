import { useUiTranslation } from '@/shared/i18n/locale'
import { Fragment, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { createPortal } from 'react-dom'
import { Phone, Plus, RefreshCw, Search, Users, Video, X } from 'lucide-react'
import type { FriendConnection, FriendSearchResult } from '../types'
import type { Conversation } from '../../chat'
import ContactCallConversationSection from './ContactCallConversationSection'
import UserAvatar from '../../../shared/ui/UserAvatar'
import ContactInvitations from './ContactInvitations'
import ContactsOverview from './ContactsOverview'
import ContactSearchResults from './ContactSearchResults'
import ContactFriendProfile from './ContactFriendProfile'
import useSlidingPill from '../../../shared/ui/useSlidingPill'
import { useContactDirectory, type DirectoryFilter } from '../hooks/useContactDirectory'

export type FriendsScreen = 'overview' | 'directory' | 'invitations'
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
  suggestions: FriendSearchResult[]
  suggestionsLoading: boolean
  suggestionsError: boolean
  onRetrySuggestions: () => void
  onSettings: () => void
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
const EMPTY_CALL_CONVERSATIONS: Conversation[] = []

export default function ContactsView({
  screen, onScreenChange, friendQuery, setFriendQuery, friendSearching, friendSearchError,
  setFriendSearchRetry, contactSearchResults, friendRelationship, friendBusyIds, actOnFriend,
  setFriendMenuId, friendMenuId, blockContact, unblockContact, onOpenBlockedChat, reportContact, friendRequests, declineFriendRequest,
  friends, friendsLoading, friendsError, onRetryFriends, contactMetadata, openDirectByUsername, setFriendPreview, changePersonalContact,
  removeAcceptedFriend, connectionUrl, onScanQr, suggestions, suggestionsLoading, suggestionsError, onRetrySuggestions, onSettings, embeddedInCalls = false,
  callConversations = EMPTY_CALL_CONVERSATIONS, onOpenCallChat,
}: Props) {
  const trUi = useUiTranslation()

  const [directoryFilter, setDirectoryFilter] = useState<DirectoryFilter>('alphabetical')
  const { hostRef: filterHostRef, pillRef: filterPillRef, activeRef: filterActiveRef } = useSlidingPill<HTMLDivElement>(directoryFilter)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [expandedFriendId, setExpandedFriendId] = useState<number | null>(null)
  const [isMobileLayout, setIsMobileLayout] = useState(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 760px)').matches)
  const searchRef = useRef<HTMLInputElement>(null)
  const modalCloseRef = useRef<HTMLButtonElement>(null)
  const modalRef = useRef<HTMLDivElement>(null)
  const selectedTriggerRef = useRef<HTMLButtonElement | null>(null)
  const searching = !embeddedInCalls && Boolean(friendQuery.trim())

  const { visibleFriends, callSections } = useContactDirectory({ friends, contactMetadata, embeddedInCalls, friendQuery, directoryFilter, callConversations })
  const selectedFriend = visibleFriends.find(friend => friend.id === selectedId) ?? visibleFriends[0] ?? null
  const modalFriend = visibleFriends.find(friend => friend.id === expandedFriendId) ?? null
  const modalOpen = isMobileLayout && !embeddedInCalls && screen === 'directory' && Boolean(modalFriend)

  useEffect(() => {
    const media = window.matchMedia('(max-width: 760px)')
    const onChange = () => {
      setIsMobileLayout(media.matches)
      setExpandedFriendId(null)
    }
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    if (!modalOpen) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    modalCloseRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        setExpandedFriendId(null)
        selectedTriggerRef.current?.focus()
      }
      if (event.key === 'Tab') {
        const buttons = modalRef.current?.querySelectorAll<HTMLButtonElement>('button:not([disabled])')
        if (!buttons?.length) return
        const first = buttons[0]
        const last = buttons[buttons.length - 1]
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault()
          last.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [modalOpen])

  const closeFriendModal = () => {
    setExpandedFriendId(null)
    selectedTriggerRef.current?.focus()
  }
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
  const profileDetails = (friend: FriendConnection, iconOnly = false) => (
    <ContactFriendProfile iconOnly={iconOnly} friend={friend} contactMetadata={contactMetadata} friendBusyIds={friendBusyIds}
      friendMenuId={friendMenuId} setFriendMenuId={setFriendMenuId} setFriendPreview={setFriendPreview}
      changePersonalContact={changePersonalContact} removeAcceptedFriend={removeAcceptedFriend}
      blockContact={blockContact} unblockContact={unblockContact} reportContact={reportContact}
      openChat={openChat} startCall={startCall} isBlocked={isBlocked} />
  )

  if (screen === 'overview' && !embeddedInCalls) return <ContactsOverview
    friends={friends} friendRequests={friendRequests} suggestions={suggestions}
    suggestionsLoading={suggestionsLoading} suggestionsError={suggestionsError}
    friendsLoading={friendsLoading} friendsError={friendsError}
    onRetryFriends={onRetryFriends} onRetrySuggestions={onRetrySuggestions}
    friendBusyIds={friendBusyIds} actOnFriend={actOnFriend} declineFriendRequest={declineFriendRequest}
    onDirectory={() => onScreenChange('directory')} onInvitations={() => onScreenChange('invitations')}
    onOpenProfile={setFriendPreview}
    onSettings={onSettings} connectionUrl={connectionUrl} onScanQr={onScanQr} />

  return <div className={'friends-design-v2' + (embeddedInCalls ? ' is-call-directory' : '')} aria-label={screen === 'directory' ? trUi("contacts.directory") : trUi("contacts.friendRequests")}>
    {screen === 'directory' ? <>
      <div className={'fd-directory-layout' + (embeddedInCalls ? ' fd-list-only' : '')}>
        <div className="fd-directory-main">
      {!embeddedInCalls && <section className="fd-searchbar">
        <label><Search size={22} aria-hidden="true"/>
          <input ref={searchRef} type="search" value={friendQuery} onChange={event => setFriendQuery(event.target.value)}
            placeholder={trUi("common.ui.searchNamePhoneId")} aria-label={trUi("contacts.searchContacts")} />
          {friendQuery && <button type="button" aria-label={trUi("common.clearSearch")} onClick={() => {setFriendQuery('');searchRef.current?.focus()}}><X size={17}/></button>}
        </label>
        <button type="button" className="fd-primary fd-add-new" onClick={enterInvitations} title={trUi("contacts.newFriends")}><Plus size={18}/>{trUi("contacts.newFriends")}</button>
      </section>}
        <section className="fd-card fd-list-card">
          {searching ? <>
            <div className="fd-list-header"><div><h2>{trUi("common.searchResults")}</h2><p>Tìm người dùng theo tên, username hoặc email</p></div>
              <button type="button" className="fd-text-button" onClick={() => setFriendQuery('')}>{trUi("common.clearSearch")}</button></div>

            <ContactSearchResults results={contactSearchResults}
              loading={friendSearching} error={friendSearchError} busyIds={friendBusyIds}
              relationshipFor={friendRelationship} onAction={act} onProfile={setFriendPreview}
              onRetry={() => setFriendSearchRetry(value => value + 1)} />
          </> : <>
            <div className="fd-list-header"><h2>{embeddedInCalls ? trUi("contacts.friends") : 'Tất cả bạn bè'}</h2>
              <div className="fd-list-actions">
                <span>{trUi("common.countPeople", { count: friends.length })}</span>
                <button type="button" aria-label={trUi("contacts.reloadFriends")} title={trUi("contacts.reloadFriends")}
                  disabled={friendsLoading} onClick={onRetryFriends}><RefreshCw size={17} aria-hidden="true"/></button>
              </div>
            </div>
            <div ref={filterHostRef} className="fd-filters sliding-pill-host" role="group" aria-label={trUi("common.ui.filterContacts")}>
              <span ref={filterPillRef} className="sliding-pill contacts-filter-active-pill" aria-hidden="true" />
              {([['alphabetical','A – Z'],['online','Đang online'],['favorites','Yêu thích']] as const).map(([filter,label]) =>
                <button ref={directoryFilter === filter ? filterActiveRef : undefined} type="button" key={filter} className={directoryFilter === filter ? 'active' : ''}
                  aria-pressed={directoryFilter === filter} onClick={() => setDirectoryFilter(filter)}>{label}</button>)}
            </div>
            {friendsError && <div className="fd-sync-feedback" role="alert">
              <span>{friendsError}</span>
              <button type="button" className="fd-secondary" disabled={friendsLoading} onClick={onRetryFriends}>{trUi("common.retry")}</button>
            </div>}
            <div className="fd-person-list" aria-label={trUi("contacts.friendList")} aria-busy={friendsLoading}>
              {visibleFriends.map(friend => <Fragment key={friend.id}><div className={'fd-person-row' + (!embeddedInCalls && selectedFriend?.id === friend.id ? ' selected' : '') + (!embeddedInCalls && expandedFriendId === friend.id ? ' expanded' : '')}>
                <button type="button" className="fd-person-identity" aria-pressed={embeddedInCalls ? undefined : selectedFriend?.id === friend.id}
                  aria-expanded={embeddedInCalls ? undefined : expandedFriendId === friend.id}
                  onClick={(event) => {
                    if (embeddedInCalls) { openChat(friend); return }
                    setSelectedId(friend.id)
                    if (isMobileLayout) selectedTriggerRef.current = event.currentTarget
                    setExpandedFriendId(value => value === friend.id ? null : friend.id)
                  }}>{avatar(friend)}<span>
                    <strong>{contactMetadata[friend.id]?.nickname || personName(friend)}</strong>
                    <small>{friend.online ? trUi("profile.active") : trUi("common.offline")}
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
              {!embeddedInCalls && !isMobileLayout && expandedFriendId === friend.id && <section className="fd-inline-profile" aria-label={'Thông tin của ' + personName(friend)}>
                {profileDetails(friend)}
              </section>}
              </Fragment>)}
              {visibleFriends.length === 0 && !friendsError && (!embeddedInCalls || (callSections.groups.length === 0 && callSections.otherContacts.length === 0)) && <p className="fd-empty" role={friendsLoading ? 'status' : undefined}>
                {friendsLoading ? 'Đang tải danh sách bạn bè...' : friends.length ? trUi("chat.noFriends") : embeddedInCalls ? 'Bạn chưa có bạn bè trong danh bạ.' : 'Bạn chưa có bạn bè. Nhấn Kết bạn mới để kết nối.'}
              </p>}
              {embeddedInCalls && <ContactCallConversationSection items={callSections.groups} label={trUi("chat.group")} onOpenCallChat={onOpenCallChat} />}
              {embeddedInCalls && <ContactCallConversationSection items={callSections.otherContacts} label={trUi("contacts.otherContacts")} onOpenCallChat={onOpenCallChat} />}
            </div>
          </>}
        </section>
        </div>
        {!embeddedInCalls && <section className="fd-card fd-profile-panel" aria-label={trUi("contacts.friendInfo")}>
          {selectedFriend && !searching ? profileDetails(selectedFriend) : <div className="fd-empty fd-profile-placeholder"><Users size={38}/>
            <h2>{searching ? 'Kết nối bạn bè' : 'Chưa chọn bạn bè'}</h2><p>{searching ? 'Chọn một kết quả tìm kiếm để xem hồ sơ.' : 'Kết bạn mới để xem thông tin ở đây.'}</p></div>}
        </section>}
      </div>
    </> : <ContactInvitations friendRequests={friendRequests} friendBusyIds={friendBusyIds} actOnFriend={actOnFriend} declineFriendRequest={declineFriendRequest} connectionUrl={connectionUrl} onScanQr={onScanQr} onBack={() => { onScreenChange('directory'); setFriendQuery('') }} onSearch={openSearch} />}
    {modalOpen && modalFriend && createPortal(
      <div className="friends-design-v2 fd-friend-modal-layer">
        <button className="fd-friend-modal-backdrop" type="button" aria-label={trUi("contacts.closeFriendInfo")} onClick={closeFriendModal} tabIndex={-1} />
        <div ref={modalRef} className="fd-friend-modal-dialog fd-card" role="dialog" aria-modal="true" aria-labelledby="fd-friend-modal-title">
          <div className="fd-friend-modal-heading">
            <h2 id="fd-friend-modal-title">{trUi("contacts.friendInfo")}</h2>
            <button ref={modalCloseRef} type="button" aria-label={trUi("contacts.closeFriendInfo")} onClick={closeFriendModal}><X size={19}/></button>
          </div>
          {profileDetails(modalFriend, true)}
        </div>
      </div>, document.body,
    )}
  </div>
}