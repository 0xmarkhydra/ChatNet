import { useEffect, useState, type Dispatch, type SetStateAction } from 'react'
import { createPortal } from 'react-dom'
import {
  ArrowDownAZ, AtSign, ChevronRight, Heart, MessageCircle, MoreHorizontal,
  Phone, Search, UserPlus, UsersRound, X,
} from 'lucide-react'
import type { Tab } from '../../app/types'
import type { NewChatMode } from '../chat/types'
import type { FriendConnection, FriendSearchResult } from './types'
import UserAvatar from '../../shared/ui/UserAvatar'
import { SocoEmptyState, SocoTextAction } from '../../shared/ui/SocoUI'

type Contact = FriendConnection | FriendSearchResult

type Props = {
  friendQuery: string
  setFriendQuery: (query: string) => void
  friendSearching: boolean
  friendSearchError: boolean
  setFriendSearchRetry: Dispatch<SetStateAction<number>>
  contactSearchResults: FriendSearchResult[]
  friendRelationship: (id: number) => 'accepted' | 'incoming' | 'outgoing' | 'none'
  friendBusyIds: Set<number>
  actOnFriend: (friend: Contact) => Promise<void>
  setFriendMenuId: Dispatch<SetStateAction<number | null>>
  friendMenuId: number | null
  blockContact: (friend: Contact) => Promise<void>
  reportContact: (friend: Contact) => Promise<void>
  setTab: (tab: Tab) => void
  setNewChatMode: (mode: NewChatMode) => void
  setChatCreateError: (error: string) => void
  friendRequests: FriendConnection[]
  declineFriendRequest: (friend: FriendConnection) => Promise<void>
  friends: FriendConnection[]
  contactMetadata: Record<number, { nickname: string; note: string; favorite: boolean }>
  openDirectByUsername: (username: string) => Promise<void>
  onVoiceCall: (username: string) => Promise<void>
  setFriendPreview: (friend: FriendSearchResult | null) => void
  changePersonalContact: (friend: FriendConnection, field: 'nickname' | 'note' | 'favorite') => Promise<void>
  removeAcceptedFriend: (friend: FriendConnection) => Promise<void>
  friendResults: FriendSearchResult[]
}

export default function ContactsView({
  friendQuery, setFriendQuery, friendSearching, friendSearchError,
  setFriendSearchRetry, contactSearchResults, friendRelationship,
  friendBusyIds, actOnFriend, setFriendMenuId, friendMenuId,
  blockContact, reportContact, setTab, setNewChatMode, setChatCreateError,
  friendRequests, declineFriendRequest, friends, contactMetadata,
  openDirectByUsername, onVoiceCall, setFriendPreview,
  changePersonalContact, removeAcceptedFriend, friendResults,
}: Props) {
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [filter, setFilter] = useState<'all' | 'online' | 'favorite'>('all')
  const [sortAscending, setSortAscending] = useState(true)
  const [menuLayout, setMenuLayout] = useState({ top: 0, left: 0, maxHeight: 350 })

  const nameOf = (friend: Contact) =>
    contactMetadata[friend.id]?.nickname || friend.displayName || friend.username
  const orderedFriends = [...friends].sort((a, b) => {
    const byName = nameOf(a).localeCompare(nameOf(b), 'vi')
    return sortAscending ? byName : -byName
  })
  const visibleFriends = orderedFriends.filter((friend) =>
    filter === 'online' ? friend.online : filter === 'favorite' ? contactMetadata[friend.id]?.favorite : true,
  )
  const selected = friends.find((friend) => friend.id === selectedId)
    || visibleFriends[0] || friends[0] || null
  const incomingRequests = friendRequests.filter((friend) => friend.direction === 'incoming')
  const outgoingRequests = friendRequests.filter((friend) => friend.direction === 'outgoing')
  const suggestions = friendResults.filter((friend) => friendRelationship(friend.id) === 'none')
  const menuFriend: Contact | undefined = [...friends, ...friendRequests, ...contactSearchResults]
    .find((friend) => friend.id === friendMenuId)
  const menuAccepted = menuFriend && friends.find((friend) => friend.id === menuFriend.id)

  useEffect(() => {
    if (friendMenuId === null) return
    const closeOnOutside = (event: PointerEvent) => {
      if (event.target instanceof Element
        && (event.target.closest('.penpot-contact-popup') || event.target.closest('[data-contact-menu-trigger]'))) return
      setFriendMenuId(null)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setFriendMenuId(null)
    }
    const closeOnScroll = () => setFriendMenuId(null)
    document.addEventListener('pointerdown', closeOnOutside)
    document.addEventListener('keydown', closeOnEscape)
    window.addEventListener('scroll', closeOnScroll, true)
    window.addEventListener('resize', closeOnScroll)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutside)
      document.removeEventListener('keydown', closeOnEscape)
      window.removeEventListener('scroll', closeOnScroll, true)
      window.removeEventListener('resize', closeOnScroll)
    }
  }, [friendMenuId, setFriendMenuId])

  function toggleMenu(id: number, button: HTMLButtonElement) {
    if (friendMenuId === id) { setFriendMenuId(null); return }
    const rect = button.getBoundingClientRect()
    const availableBelow = window.innerHeight - rect.bottom - 12
    const availableAbove = rect.top - 12
    const openUp = availableBelow < 310 && availableAbove > availableBelow
    const height = Math.max(100, Math.min(350, openUp ? availableAbove : availableBelow))
    setMenuLayout({
      top: openUp ? Math.max(8, rect.top - Math.min(height, 350) - 5) : rect.bottom + 5,
      left: Math.max(8, Math.min(rect.right - 220, window.innerWidth - 228)),
      maxHeight: height,
    })
    setFriendMenuId(id)
  }

  function openAddFriends() {
    setFriendMenuId(null)
    setChatCreateError('')
    setTab('chat')
    setNewChatMode('friends')
  }

  function doMenuAction(action: () => void | Promise<void>) {
    setFriendMenuId(null)
    void action()
  }

  const renderPerson = (friend: FriendSearchResult, context: 'search' | 'incoming' | 'outgoing' | 'suggestion') => {
    const relationship = friendRelationship(friend.id)
    const label = relationship === 'accepted' ? 'Nhắn tin'
      : relationship === 'incoming' ? 'Chấp nhận'
        : relationship === 'outgoing' ? 'Hủy lời mời' : 'Kết bạn'
    return (
      <div className="penpot-contact-person" key={friend.id}>
        <button className="penpot-contact-person-identity" type="button" onClick={() => {
          if (relationship === 'accepted') setSelectedId(friend.id)
          else setFriendPreview(friend)
        }}>
          <UserAvatar username={friend.username} name={friend.displayName || friend.username} className="penpot-contact-avatar" online={friend.online} />
          <span className="penpot-contact-person-copy">
            <strong>{nameOf(friend)}</strong>
            <small>{context === 'incoming' ? 'Đã gửi lời mời kết bạn'
              : context === 'outgoing' ? 'Đang chờ phản hồi'
                : friend.reason || `@${friend.username}`}</small>
          </span>
        </button>
        <button type="button" className="penpot-contact-mini-action"
          disabled={friendBusyIds.has(friend.id)}
          onClick={() => void actOnFriend(friend)}>{label}</button>
        {context === 'incoming' && (
          <button type="button" className="penpot-contact-icon-button" aria-label={`Từ chối lời mời từ ${nameOf(friend)}`}
            disabled={friendBusyIds.has(friend.id)}
            onClick={() => void declineFriendRequest(friend as FriendConnection)}><X size={18} /></button>
        )}
        {context === 'search' && (
          <button type="button" className="penpot-contact-icon-button" data-contact-menu-trigger
            aria-label={`Tùy chọn của ${nameOf(friend)}`}
            aria-expanded={friendMenuId === friend.id} aria-haspopup="menu"
            onClick={(event) => toggleMenu(friend.id, event.currentTarget)}>
            <MoreHorizontal size={19} />
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="simple-view contacts-view penpot-contacts">
      <section className="penpot-contacts-find" aria-label="Tìm kiếm bạn bè">
        <label className="penpot-contacts-find-input">
          <Search size={22} aria-hidden="true" />
          <input type="search" value={friendQuery} onChange={(event) => setFriendQuery(event.target.value)}
            placeholder="Tìm theo tên, số điện thoại hoặc ID SocCo..."
            aria-label="Tìm kiếm bạn bè theo tên hoặc tài khoản" />
          {friendQuery && <button type="button" aria-label="Xóa tìm kiếm" onClick={() => setFriendQuery('')}><X size={18} /></button>}
        </label>
        <button type="button" className="penpot-contacts-add" onClick={openAddFriends}>
          <UserPlus size={20} aria-hidden="true" /> Kết bạn mới
        </button>
      </section>

      <div className="penpot-contacts-grid">
        <section className="penpot-contacts-directory" aria-label="Danh sách bạn bè">
          <div className="penpot-contacts-list-header">
            <h2>{friendQuery.trim() ? 'Kết quả tìm kiếm' : 'Tất cả bạn bè'}</h2>
            <span>{friendQuery.trim() ? `${contactSearchResults.length} kết quả` : `${friends.length} người`}</span>
          </div>
          {!friendQuery.trim() && (
            <div className="penpot-contacts-filters" role="group" aria-label="Bộ lọc bạn bè">
              <button type="button" className={filter === 'all' ? 'is-active' : ''}
                aria-pressed={filter === 'all'} onClick={() => {
                  setFilter('all')
                  setSortAscending((previous) => filter === 'all' ? !previous : true)
                }}><ArrowDownAZ size={16} /> {sortAscending ? 'A – Z' : 'Z – A'}</button>
              <button type="button" className={filter === 'online' ? 'is-active' : ''}
                aria-pressed={filter === 'online'} onClick={() => setFilter(filter === 'online' ? 'all' : 'online')}>
                <span className="penpot-online-indicator" /> Đang online
              </button>
              <button type="button" className={filter === 'favorite' ? 'is-active' : ''}
                aria-pressed={filter === 'favorite'} onClick={() => setFilter(filter === 'favorite' ? 'all' : 'favorite')}>
                <Heart size={15} /> Yêu thích
              </button>
            </div>
          )}

          <div className="penpot-contacts-scroll">
            {friendQuery.trim() ? (
              <div className="penpot-contacts-group" aria-label="Kết quả tìm kiếm">
                {friendSearching && <div className="friend-search-state" role="status">Đang tìm người dùng...</div>}
                {friendSearchError && !friendSearching && <div className="friend-search-state" role="alert">
                  Không thể tìm kiếm lúc này. <button type="button" onClick={() => setFriendSearchRetry((n) => n + 1)}>Thử lại</button>
                </div>}
                {!friendSearching && !friendSearchError && contactSearchResults.length === 0 && (
                  <div className="friend-search-state">Không tìm thấy người dùng phù hợp. Hãy thử tên, @username hoặc email.</div>
                )}
                {contactSearchResults.map((friend) => renderPerson(friend, 'search'))}
              </div>
            ) : (
              <>
                {incomingRequests.length > 0 && (
                  <div className="penpot-contacts-group">
                    <h3>Lời mời kết bạn <span>{incomingRequests.length}</span></h3>
                    {incomingRequests.map((friend) => renderPerson(friend, 'incoming'))}
                  </div>
                )}
                <div className="penpot-contacts-group" aria-label="Bạn bè">
                  {visibleFriends.length === 0 && (
                    friends.length === 0 ? (
                      <SocoEmptyState kind="friends" title="Chưa có bạn bè"
                        description="Gửi lời mời để bắt đầu những cuộc trò chuyện mới."
                        action={<SocoTextAction onClick={openAddFriends}>Tìm bạn bè</SocoTextAction>} />
                    ) : <div className="friend-search-state">Không có bạn bè phù hợp với bộ lọc này.</div>
                  )}
                  {visibleFriends.map((friend) => (
                    <div key={friend.id} className={`penpot-contact-row ${selected?.id === friend.id ? 'is-selected' : ''}`}>
                      <button type="button" className="penpot-contact-row-identity"
                        aria-pressed={selected?.id === friend.id}
                        onClick={() => { setSelectedId(friend.id); setFriendMenuId(null) }}>
                        <UserAvatar username={friend.username} name={friend.displayName || friend.username}
                          className="penpot-contact-avatar" online={friend.online} />
                        <span className="penpot-contact-row-copy">
                          <strong>{nameOf(friend)} {contactMetadata[friend.id]?.favorite && <Heart className="penpot-contact-favorite" size={14} fill="currentColor" aria-label="Yêu thích" />}</strong>
                          <small>{friend.online ? 'Đang hoạt động' : 'Ngoại tuyến'}
                            {contactMetadata[friend.id]?.note ? ` · ${contactMetadata[friend.id].note}` : ''}</small>
                        </span>
                      </button>
                      <div className="penpot-contact-row-actions">
                        <button type="button" title="Nhắn tin" aria-label={`Nhắn tin với ${nameOf(friend)}`}
                          onClick={() => void openDirectByUsername(friend.username)}><MessageCircle size={19} /></button>
                        <button type="button" title="Gọi thoại" aria-label={`Gọi thoại cho ${nameOf(friend)}`}
                          onClick={() => void onVoiceCall(friend.username)}><Phone size={19} /></button>
                        <button type="button" className="penpot-contact-row-more" data-contact-menu-trigger
                          aria-label={`Tùy chọn của ${nameOf(friend)}`}
                          aria-expanded={friendMenuId === friend.id} aria-haspopup="menu"
                          onClick={(event) => toggleMenu(friend.id, event.currentTarget)}><MoreHorizontal size={19} /></button>
                      </div>
                    </div>
                  ))}
                </div>
                {outgoingRequests.length > 0 && (
                  <div className="penpot-contacts-group">
                    <h3>Lời mời đã gửi <span>{outgoingRequests.length}</span></h3>
                    {outgoingRequests.map((friend) => renderPerson(friend, 'outgoing'))}
                  </div>
                )}
                {suggestions.length > 0 && (
                  <div className="penpot-contacts-group">
                    <h3>Người bạn có thể biết</h3>
                    {suggestions.map((friend) => renderPerson(friend, 'suggestion'))}
                  </div>
                )}
              </>
            )}
          </div>
        </section>

        <aside className="penpot-contacts-profile" aria-label="Thông tin bạn bè">
          {selected ? (
            <>
              <div className="penpot-contact-cover" aria-hidden="true" />
              <div className="penpot-contact-profile-avatar-wrap">
                <UserAvatar username={selected.username} name={selected.displayName || selected.username}
                  className="penpot-contact-profile-avatar" online={selected.online} />
              </div>
              <div className="penpot-contact-profile-identity">
                <h2>{nameOf(selected)}</h2>
                <p><span className={selected.online ? 'penpot-profile-status-dot' : 'penpot-profile-status-dot is-offline'} />
                  {selected.online ? 'Đang hoạt động' : 'Ngoại tuyến'}</p>
              </div>
              <div className="penpot-contact-profile-actions">
                <button className="penpot-contact-message" type="button" onClick={() => void openDirectByUsername(selected.username)}>
                  <MessageCircle size={19} /> Nhắn tin
                </button>
                <button className="penpot-contact-voice" type="button" onClick={() => void onVoiceCall(selected.username)}>
                  <Phone size={19} /> Gọi thoại
                </button>
              </div>
              <div className="penpot-contact-profile-details">
                <h3>Thông tin bạn bè</h3>
                <div className="penpot-contact-info-row"><AtSign size={20} /><span>@{selected.username}</span></div>
                {selected.mutualGroups !== undefined && selected.mutualGroups > 0 && (
                  <div className="penpot-contact-info-row"><UsersRound size={20} />
                    <span>{selected.mutualGroups} nhóm chung</span></div>
                )}
                {contactMetadata[selected.id]?.note && (
                  <div className="penpot-contact-info-row"><Heart size={20} /><span>{contactMetadata[selected.id].note}</span></div>
                )}
                <button type="button" className="penpot-contact-info-link" onClick={() => setFriendPreview(selected)}>
                  <UsersRound size={20} /><span>Xem trang cá nhân</span><ChevronRight size={17} />
                </button>
              </div>
              <div className="penpot-contact-profile-more">
                <button type="button" data-contact-menu-trigger aria-expanded={friendMenuId === selected.id}
                  aria-haspopup="menu" onClick={(event) => toggleMenu(selected.id, event.currentTarget)}>
                  <MoreHorizontal size={20} /> Tùy chọn <ChevronRight size={17} />
                </button>
                <small>Yêu thích · Chặn · Báo cáo · Hủy kết bạn</small>
              </div>
            </>
          ) : (
            <div className="penpot-contacts-profile-empty">
              <UsersRound size={46} strokeWidth={1.5} />
              <h3>Chọn một người bạn</h3>
              <p>Thông tin và các thao tác liên hệ sẽ hiển thị tại đây.</p>
              <button type="button" onClick={openAddFriends}><UserPlus size={18} /> Kết bạn mới</button>
            </div>
          )}
        </aside>
      </div>

      {friendMenuId !== null && menuFriend && createPortal(
        <div className="penpot-contact-popup" role="menu" aria-label={`Tùy chọn của ${nameOf(menuFriend)}`}
          style={{ top: menuLayout.top, left: menuLayout.left, maxHeight: menuLayout.maxHeight }}>
          {menuAccepted && (
            <>
              <button type="button" role="menuitem" onClick={() => doMenuAction(() => setFriendPreview(menuAccepted))}>Xem hồ sơ</button>
              <button type="button" role="menuitem" onClick={() => doMenuAction(() => openDirectByUsername(menuAccepted.username))}>Nhắn tin</button>
              <button type="button" role="menuitem" onClick={() => doMenuAction(() => changePersonalContact(menuAccepted, 'nickname'))}>Đặt biệt danh</button>
              <button type="button" role="menuitem" onClick={() => doMenuAction(() => changePersonalContact(menuAccepted, 'note'))}>Ghi chú riêng</button>
              <button type="button" role="menuitem" onClick={() => doMenuAction(() => changePersonalContact(menuAccepted, 'favorite'))}>
                {contactMetadata[menuAccepted.id]?.favorite ? 'Bỏ yêu thích' : 'Đánh dấu yêu thích'}
              </button>
              <button type="button" role="menuitem" className="is-danger" disabled={friendBusyIds.has(menuAccepted.id)}
                onClick={() => doMenuAction(() => removeAcceptedFriend(menuAccepted))}>Hủy kết bạn</button>
            </>
          )}
          <button type="button" role="menuitem" className="is-danger" disabled={friendBusyIds.has(menuFriend.id)}
            onClick={() => doMenuAction(() => blockContact(menuFriend))}>Chặn người dùng</button>
          <button type="button" role="menuitem" onClick={() => doMenuAction(() => reportContact(menuFriend))}>Báo cáo người dùng</button>
        </div>, document.body,
      )}
    </div>
  )
}
