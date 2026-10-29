import type { Dispatch, SetStateAction } from 'react'
import { MoreHorizontal } from 'lucide-react'
import type { Tab } from '../../app/types'
import type { NewChatMode } from '../chat/types'
import type { FriendConnection, FriendSearchResult } from './types'
import UserAvatar from '../../shared/ui/UserAvatar'
import { SocoEmptyState, SocoTextAction } from '../../shared/ui/SocoUI'

type Props = {
  friendQuery: string
  setFriendQuery: (query: string) => void
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
  reportContact: (friend: FriendSearchResult | FriendConnection) => Promise<void>
  setTab: (tab: Tab) => void
  setNewChatMode: (mode: NewChatMode) => void
  setChatCreateError: (error: string) => void
  friendRequests: FriendConnection[]
  declineFriendRequest: (friend: FriendConnection) => Promise<void>
  friends: FriendConnection[]
  contactMetadata: Record<number, { nickname: string; note: string; favorite: boolean }>
  openDirectByUsername: (username: string) => Promise<void>
  setFriendPreview: (friend: FriendSearchResult | null) => void
  changePersonalContact: (friend: FriendConnection, field: 'nickname' | 'note' | 'favorite') => Promise<void>
  removeAcceptedFriend: (friend: FriendConnection) => Promise<void>
  friendResults: FriendSearchResult[]
}

export default function ContactsView({
  friendQuery,
  setFriendQuery,
  friendSearching,
  friendSearchError,
  setFriendSearchRetry,
  contactSearchResults,
  friendRelationship,
  friendBusyIds,
  actOnFriend,
  setFriendMenuId,
  friendMenuId,
  blockContact,
  reportContact,
  setTab,
  setNewChatMode,
  setChatCreateError,
  friendRequests,
  declineFriendRequest,
  friends,
  contactMetadata,
  openDirectByUsername,
  setFriendPreview,
  changePersonalContact,
  removeAcceptedFriend,
  friendResults,
}: Props) {
  return (
    <div className="simple-view contacts-view">
      {friendQuery.trim() ? (
        <section className="contacts-suggestions contacts-search-section" aria-label="Kết quả tìm kiếm bạn bè">
          <div className="contacts-heading contacts-search-heading">
            <span>Kết quả tìm kiếm</span>
            <button type="button" onClick={() => setFriendQuery('')}>Xóa tìm kiếm</button>
          </div>
          {friendSearching && <div className="friend-search-state" role="status">Đang tìm người dùng...</div>}
          {friendSearchError && !friendSearching && (
            <div className="friend-search-state" role="alert">
              Không thể tìm kiếm lúc này. <button type="button" onClick={() => setFriendSearchRetry((n) => n + 1)}>Thử lại</button>
            </div>
          )}
          {!friendSearching && !friendSearchError && contactSearchResults.length === 0 && (
            <div className="friend-search-state">Không tìm thấy kết quả. Thử tên, @username hoặc email chính xác.</div>
          )}
          {contactSearchResults.map((friend) => {
            const relationship = friendRelationship(friend.id)
            const actionLabel = relationship === 'accepted' ? 'Nhắn tin'
              : relationship === 'incoming' ? 'Chấp nhận'
                : relationship === 'outgoing' ? 'Hủy lời mời' : 'Kết bạn'
            return (
              <div className="friend-result contact-result contact-search-row" key={friend.id}>
                <UserAvatar name={friend.displayName || friend.username} className="friend-avatar" online={friend.online} />
                <div className="friend-result-copy">
                  <strong>{friend.displayName || friend.username}</strong>
                  <span>@{friend.username}{relationship === 'accepted' ? ' · Bạn bè' : relationship === 'incoming' ? ' · Đã nhận lời mời' : relationship === 'outgoing' ? ' · Đã gửi lời mời' : ''}</span>
                </div>
                <button
                  type="button"
                  className="contact-search-action"
                  disabled={friendBusyIds.has(friend.id)}
                  onClick={() => void actOnFriend(friend)}
                >{actionLabel}</button>
                <div className="friend-contact-controls" onBlur={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget)) setFriendMenuId(null)
                }}>
                  <button type="button" className="friend-contact-more"
                    aria-label={`Tùy chọn của ${friend.displayName || friend.username}`}
                    aria-expanded={friendMenuId === friend.id} aria-haspopup="menu"
                    onClick={() => setFriendMenuId((old) => old === friend.id ? null : friend.id)}>
                    <MoreHorizontal size={19} aria-hidden="true" />
                  </button>
                  {friendMenuId === friend.id && (
                    <div className="friend-contact-popover" role="menu">
                      <button type="button" role="menuitem" className="friend-contact-danger"
                        disabled={friendBusyIds.has(friend.id)}
                        onClick={() => void blockContact(friend)}>Chặn người dùng</button>
                      <button type="button" role="menuitem"
                        onClick={() => void reportContact(friend)}>Báo cáo người dùng</button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </section>
      ) : (
        <>
      <div className="contact-shortcuts">
        <button type="button" onClick={() => { setTab('chat'); setNewChatMode('friends') }}>
          <span className="shortcut-icon">＋</span><div><strong>Lời mời kết bạn</strong><small>Tìm và kết nối người mới</small></div><b>›</b>
        </button>
        <button type="button" onClick={() => { setFriendQuery(''); setChatCreateError(''); setTab('chat'); setNewChatMode('group') }}>
          <span className="shortcut-icon">👥</span><div><strong>Nhóm và cộng đồng</strong><small>Tạo cuộc trò chuyện nhóm</small></div><b>›</b>
        </button>
      </div>

      {friendRequests.some((item) => item.direction === 'incoming') && (
        <section className="contacts-suggestions">
          <div className="contacts-heading">
            Lời mời kết bạn ({friendRequests.filter((item) => item.direction === 'incoming').length})
          </div>
          {friendRequests.filter((item) => item.direction === 'incoming').map((friend) => (
            <div className="friend-result contact-result friend-request-row" key={friend.id}>
              <UserAvatar name={friend.username} className="friend-avatar" online={friend.online} />
              <div className="friend-result-copy">
                <strong>@{friend.username}</strong>
                <span>Muốn kết bạn với bạn</span>
              </div>
              <div className="friend-request-actions">
                <button type="button" onClick={() => void actOnFriend(friend)} disabled={friendBusyIds.has(friend.id)}>Chấp nhận</button>
                <button type="button" className="secondary" onClick={() => void declineFriendRequest(friend)} disabled={friendBusyIds.has(friend.id)}>Từ chối</button>
              </div>
            </div>
          ))}
        </section>
      )}

      <section className="contacts-suggestions">
        <div className="contacts-heading">Bạn bè ({friends.length})</div>
        {friends.length === 0 && (
          <SocoEmptyState kind="friends" title="Chưa có bạn bè"
            description="Gửi lời mời để bắt đầu những cuộc trò chuyện mới."
            action={<SocoTextAction onClick={() => { setTab('chat'); setNewChatMode('friends') }}>Tìm bạn bè</SocoTextAction>}
          />
        )}
        {[...friends].sort((a, b) => Number(Boolean(contactMetadata[b.id]?.favorite)) - Number(Boolean(contactMetadata[a.id]?.favorite))).map((friend) => (
          <div
            className="friend-result contact-result friend-contact-row"
            key={friend.id}
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget)) setFriendMenuId(null)
            }}
            onKeyDown={(event) => {
              if (event.key === 'Escape') setFriendMenuId(null)
            }}
          >
            <button
              type="button"
              className="friend-contact-primary"
              onClick={() => void openDirectByUsername(friend.username)}
            >
              <UserAvatar name={friend.displayName || friend.username} className="friend-avatar" online={friend.online} />
              <span className="friend-result-copy">
                <strong>{contactMetadata[friend.id]?.favorite ? '⭐ ' : ''}{contactMetadata[friend.id]?.nickname || friend.displayName || friend.username}</strong>
                <span>@{friend.username} · {friend.online ? 'Đang hoạt động' : 'Ngoại tuyến'}</span>
                {contactMetadata[friend.id]?.note && <small className="friend-private-note">{contactMetadata[friend.id].note}</small>}
              </span>
            </button>
            <div className="friend-contact-controls">
              <button
                type="button"
                className="friend-contact-more"
                aria-label={`Tùy chọn của ${friend.displayName || friend.username}`}
                aria-expanded={friendMenuId === friend.id}
                aria-haspopup="menu"
                onClick={() => setFriendMenuId((current) => current === friend.id ? null : friend.id)}
              >
                <MoreHorizontal size={20} aria-hidden="true" />
              </button>
              {friendMenuId === friend.id && (
                <div className="friend-contact-popover" role="menu">
                  <button type="button" role="menuitem" onClick={() => { setFriendPreview(friend); setFriendMenuId(null) }}>Xem hồ sơ</button>
                  <button type="button" role="menuitem" onClick={() => { setFriendMenuId(null); void openDirectByUsername(friend.username) }}>Nhắn tin</button>
                  <button type="button" role="menuitem" onClick={() => void changePersonalContact(friend, 'nickname')}>Đặt biệt danh</button>
                  <button type="button" role="menuitem" onClick={() => void changePersonalContact(friend, 'note')}>Ghi chú riêng</button>
                  <button type="button" role="menuitem" onClick={() => void changePersonalContact(friend, 'favorite')}>{contactMetadata[friend.id]?.favorite ? 'Bỏ bạn thân' : 'Đánh dấu bạn thân'}</button>
                  <button type="button" role="menuitem" className="friend-contact-danger" disabled={friendBusyIds.has(friend.id)} onClick={() => void removeAcceptedFriend(friend)}>Hủy kết bạn</button>
                  <button type="button" role="menuitem" className="friend-contact-danger" disabled={friendBusyIds.has(friend.id)} onClick={() => void blockContact(friend)}>Chặn người dùng</button>
                  <button type="button" role="menuitem" onClick={() => void reportContact(friend)}>Báo cáo người dùng</button>
                </div>
              )}
            </div>
          </div>
        ))}
      </section>

      {friendRequests.some((item) => item.direction === 'outgoing') && (
        <section className="contacts-suggestions">
          <div className="contacts-heading">Lời mời đã gửi</div>
          {friendRequests.filter((item) => item.direction === 'outgoing').map((friend) => (
            <button
              type="button"
              className="friend-result contact-result"
              key={friend.id}
              onClick={() => void actOnFriend(friend)}
              disabled={friendBusyIds.has(friend.id)}
            >
              <UserAvatar name={friend.username} className="friend-avatar" online={friend.online} />
              <div className="friend-result-copy">
                <strong>@{friend.username}</strong>
                <span>Đang chờ phản hồi</span>
              </div>
              <div className="friend-result-action"><small>Hủy lời mời</small><span>×</span></div>
            </button>
          ))}
        </section>
      )}

      <section className="contacts-suggestions">
        <div className="contacts-heading">Người bạn có thể biết</div>
        {friendSearching && <div className="friend-search-state">Đang tải gợi ý...</div>}
        {!friendSearching && friendResults.filter((friend) => friendRelationship(friend.id) === 'none').length === 0 && (
          <div className="friend-search-state">Chưa có gợi ý mới phù hợp.</div>
        )}
        {friendResults.filter((friend) => friendRelationship(friend.id) === 'none').map((friend) => (
          <button
            type="button"
            className="friend-result contact-result"
            key={friend.id}
            onClick={() => void actOnFriend(friend)}
            disabled={friendBusyIds.has(friend.id)}
          >
            <UserAvatar name={friend.username} className="friend-avatar" online={friend.online} />
            <div className="friend-result-copy">
              <strong>@{friend.username}</strong>
              <span>{friend.reason || (friend.online ? 'Đang hoạt động' : 'Ngoại tuyến')}</span>
            </div>
            <div className="friend-result-action"><small>Kết bạn</small><span>＋</span></div>
          </button>
        ))}
      </section>
        </>
      )}
    </div>
  )
}
