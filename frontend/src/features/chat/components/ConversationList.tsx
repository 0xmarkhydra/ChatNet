import { Plus, Search, Pin, RefreshCw, X } from "lucide-react";
import UiIcon from "../../../shared/ui/UiIcon";
import UserAvatar from "../../../shared/ui/UserAvatar";
import ConversationAvatar from "./ConversationAvatar";
import { userLabel } from "../../../shared/utils/userLabel";
import ConversationCategories, { CategoryBadge } from "./ConversationCategories";
import { SocoEmptyState, SocoTextAction } from "../../../shared/ui/SocoUI";
import { formatTime } from "../../../shared/utils/format";
import type { ChatSectionProps } from "./ChatSection";

type Props = Pick<ChatSectionProps, "activeConversationId" | "actOnFriend" | "beginConversationLongPress" | "cancelConversationLongPress" | "chatCreateError" | "chatListConversations" | "chatListFilter" | "chatListQuery" | "conversationCategories" | "conversationListSearch" | "conversationLoadingMore" | "copyInviteLink" | "createDirect" | "directUsername" | "friendBusyIds" | "friendQuery" | "friendRelationship" | "friendResults" | "friends" | "friendSearchError" | "friendSearching" | "hasMoreConversations" | "loadMoreConversations" | "moveConversationLongPress" | "newChatMode" | "openConnectSurface" | "quickSearchControl" | "searchInConversationList" | "session" | "setActiveConversationId" | "setChatCreateError" | "setChatListFilter" | "setChatListQuery" | "setChatSearchJump" | "setConversationActionId" | "setConversationMenuPosition" | "setConversations" | "setDirectUsername" | "setFriendQuery" | "setFriendResults" | "setFriendSearchRetry" | "setNewChatMode" | "setQrOpen" | "setQuickSearchOpen" | "setTranslationMenuOpen" | "setTranslationOriginals" | "setTranslations" | "shareMyProfile" | "sortedChatListConversations" | "suppressConversationClick" | "t" | "visibleConversations" | "chatFiltersPill">;

export default function ConversationList({ activeConversationId, actOnFriend, beginConversationLongPress, cancelConversationLongPress, chatCreateError, chatListConversations, chatListFilter, chatListQuery, conversationCategories, conversationListSearch, conversationLoadingMore, copyInviteLink, createDirect, directUsername, friendBusyIds, friendQuery, friendRelationship, friendResults, friends, friendSearchError, friendSearching, hasMoreConversations, loadMoreConversations, moveConversationLongPress, newChatMode, openConnectSurface, quickSearchControl, searchInConversationList, session, setActiveConversationId, setChatCreateError, setChatListFilter, setChatListQuery, setChatSearchJump, setConversationActionId, setConversationMenuPosition, setConversations, setDirectUsername, setFriendQuery, setFriendResults, setFriendSearchRetry, setNewChatMode, setQrOpen, setQuickSearchOpen, setTranslationMenuOpen, setTranslationOriginals, setTranslations, shareMyProfile, sortedChatListConversations, suppressConversationClick, t, visibleConversations, chatFiltersPill }: Props) {
  const { hostRef: chatFiltersPillSetHost, activeRef: chatFiltersPillSetActive, pillRef: chatFiltersPillSetPill } = chatFiltersPill;
  return (
    <aside className="conversation-sidebar social-chat-list" aria-label="Danh sách cuộc trò chuyện">
              <div className="social-chat-list-header">
                <div className="social-chat-list-title">
                  <h2>Cuộc trò chuyện</h2>
                  <button type="button" className="social-chat-new" aria-label="Tạo cuộc trò chuyện mới"
                    title="Tạo cuộc trò chuyện" onClick={() => { setChatCreateError(''); setNewChatMode('direct') }}>
                    <Plus size={20} aria-hidden="true" />
                  </button>
                </div>
                {searchInConversationList ? quickSearchControl : (
                  <label className="social-chat-list-search">
                    <Search size={19} aria-hidden="true" />
                    <input type="search" value={chatListQuery} onChange={(event) => setChatListQuery(event.target.value)}
                      maxLength={120} placeholder="Tìm cuộc trò chuyện hoặc tin nhắn..."
                      aria-label="Tìm kiếm toàn bộ cuộc trò chuyện" />
                  </label>
                )}
                <div ref={chatFiltersPillSetHost} className="social-chat-list-filters sliding-pill-host" role="group" aria-label="Lọc cuộc trò chuyện">
                  <span ref={chatFiltersPillSetPill} className="sliding-pill social-chat-active-pill" aria-hidden="true" />
                  {([{ key: 'all', label: 'Tất cả' }, { key: 'unread', label: 'Chưa đọc' }, { key: 'groups', label: 'Nhóm' }] as const).map((filter) => (
                    <button ref={chatListFilter === filter.key ? chatFiltersPillSetActive : undefined} key={filter.key} type="button" aria-pressed={chatListFilter === filter.key}
                      className={chatListFilter === filter.key ? 'is-active' : ''}
                      onClick={() => setChatListFilter(filter.key)}>{filter.label}</button>
                  ))}
                </div>
              </div>
              {newChatMode === 'friends' && (
                <div className="connect-modal-layer">
                  <button
                    type="button"
                    className="connect-modal-scrim"
                    aria-label="Đóng tìm và kết nối"
                    onClick={() => { setNewChatMode('none'); setFriendQuery(''); setFriendResults([]) }}
                  />
                  <section
                    className="friend-search-panel connect-modal"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="connect-modal-title"
                  >
                    <div className="connect-modal-handle" aria-hidden="true" />
                    <div className="connect-ios-header">
                      <div>
                        <strong id="connect-modal-title">Kết nối</strong>
                        <small>Tìm bạn bè trên SocCO</small>
                      </div>
                      <button
                        type="button"
                        className="friend-search-close"
                        onClick={() => { setNewChatMode('none'); setFriendQuery(''); setFriendResults([]) }}
                        aria-label="Đóng tìm và kết nối"
                      >×</button>
                    </div>

                    <label className="friend-search-input-wrap connect-search-input">
                      <UiIcon name="search" size={19} />
                      <input
                        value={friendQuery}
                        onChange={(event) => setFriendQuery(event.target.value)}
                        placeholder="Tên, @username hoặc email"
                        aria-label="Tìm bạn bằng tên, username hoặc email"
                        autoCapitalize="none"
                        autoComplete="off"
                        spellCheck={false}
                        maxLength={254}
                      />
                      {friendQuery && (
                        <button type="button" aria-label="Xóa tìm kiếm" onClick={() => setFriendQuery('')}>×</button>
                      )}
                    </label>

                    <div className="connect-identity-card">
                      <UserAvatar username={session.user.username} name={userLabel(session.user.displayName, session.user.username)} className="connect-identity-avatar" online />
                      <div className="connect-identity-copy">
                        <strong>{session.user.displayName || session.user.username}</strong>
                        <span>@{session.user.username}</span>
                      </div>
                      <div className="connect-identity-actions" aria-label="Chia sẻ hồ sơ">
                        <button type="button" onClick={() => setQrOpen('mine')} aria-label="QR của tôi" title="QR của tôi"><UiIcon name="qr" size={20} /></button>
                        <button type="button" onClick={() => void shareMyProfile()} aria-label="Chia sẻ hồ sơ của tôi" title="Chia sẻ">↗</button>
                        <button type="button" onClick={() => void copyInviteLink()} aria-label="Sao chép link hồ sơ" title="Sao chép link">⧉</button>
                      </div>
                    </div>

                    <div className="friend-search-results connect-results">

                      {!friendSearching && !friendQuery.trim() && friendResults.length > 0 && (
                        <div className="friend-suggestion-label">Người bạn có thể biết</div>
                      )}
                      {friendSearchError && !friendSearching && (
                        <div className="friend-search-state" role="alert">Không tải được kết quả. <button type="button" onClick={() => setFriendSearchRetry((n) => n + 1)}>Thử lại</button></div>
                      )}
                      {!friendSearching && !friendSearchError && friendQuery.trim() && friendResults.length === 0 && (
                        <div className="friend-search-state">
                          <strong>Không tìm thấy người phù hợp</strong>
                          <span>Thử tên khác, @username hoặc email chính xác.</span>
                        </div>
                      )}
                      {friendResults.map((friend) => {
                        const relationship = friendRelationship(friend.id)
                        const actionLabel =
                          relationship === 'accepted'
                            ? 'Nhắn tin'
                            : relationship === 'incoming'
                              ? 'Chấp nhận'
                              : relationship === 'outgoing'
                                ? 'Hủy lời mời'
                                : 'Kết bạn'
                        return (
                          <button
                            type="button"
                            className="friend-result connect-result"
                            key={friend.id}
                            onClick={() => void actOnFriend(friend)}
                            disabled={friendBusyIds.has(friend.id)}
                          >
                            <UserAvatar username={friend.username} name={userLabel(friend.displayName, friend.username)} className="friend-avatar" online={friend.online} />
                            <div className="friend-result-copy">
                              <strong>{friend.displayName || friend.username}</strong>
                              <span>
                                @{friend.username}
                                {friend.reason ? ` · ${friend.reason}` : friend.online ? ' · Đang hoạt động' : ''}
                              </span>
                            </div>
                            <div className={`friend-result-action relationship-${relationship}`}>
                              <small>{actionLabel}</small><span>{relationship === 'none' ? '＋' : '›'}</span>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </section>
                </div>
              )}

              {newChatMode === 'direct' && (
                <form className="new-chat-panel" onSubmit={createDirect}>
                  <div className="panel-line"><strong>Tạo chat riêng</strong><button type="button" onClick={() => setNewChatMode('none')}>×</button></div>
                  <input value={directUsername} onChange={(event) => setDirectUsername(event.target.value)} placeholder="Username người muốn chat" maxLength={64} autoFocus />
                  <button>Tạo cuộc trò chuyện</button>
                </form>
              )}

              {chatCreateError && newChatMode !== 'group' && <div className="inline-error">{chatCreateError}</div>}

              <ConversationCategories key={session.sessionId} model={conversationCategories} />
              <div className="conversation-list zalo-conversation-list" aria-busy={conversationListSearch.active && conversationListSearch.loading}>

                {!conversationListSearch.active && conversationCategories.selected !== null && conversationCategories.listError && <div role="alert" className="category-error">
                  {conversationCategories.listError}<button type="button" onClick={() => void conversationCategories.load(false,true)}>Thử lại</button>
                </div>}

                {conversationListSearch.active && conversationListSearch.error && (
                  <p className="conversation-search-status" role="alert">
                    {conversationListSearch.error}
                    <button type="button" onClick={conversationListSearch.retry}>Thử lại</button>
                  </p>
                )}
                {chatListConversations.length === 0 &&
                  !conversationListSearch.loading && !conversationListSearch.error &&
                  (conversationListSearch.active || (!conversationCategories.loading && !conversationCategories.listError)) && (
                  <div className="conversation-list-empty">
                    <SocoEmptyState
                      kind="chat"
                      title={conversationListSearch.active ? 'Không tìm thấy cuộc trò chuyện'
                        : visibleConversations.length ? 'Không có hội thoại phù hợp' : 'Chưa có cuộc trò chuyện'}
                      description={conversationListSearch.active || visibleConversations.length
                        ? 'Thử thay đổi từ khóa hoặc chọn bộ lọc khác.'
                        : 'Tìm bạn bè để bắt đầu kết nối và trò chuyện.'}
                      action={conversationListSearch.active || visibleConversations.length
                        ? <SocoTextAction onClick={() => { setChatListQuery(''); setChatListFilter('all') }}>Xóa bộ lọc</SocoTextAction>
                        : <SocoTextAction onClick={() => openConnectSurface()}>Tìm bạn bè</SocoTextAction>}
                    />
                  </div>
                )}

                {sortedChatListConversations.map((conversation) => (
                  <div key={conversation.id} className="conversation-pin-entry"
                    onPointerDown={(event) => {
                      if (event.pointerType !== 'mouse') beginConversationLongPress(conversation.id, event.clientX, event.clientY)
                    }}
                    onPointerMove={(event) => moveConversationLongPress(event.clientX, event.clientY)}
                    onPointerUp={cancelConversationLongPress}
                    onPointerCancel={cancelConversationLongPress}
                    onPointerLeave={cancelConversationLongPress}
                    onContextMenu={(event) => {
                      event.preventDefault()
                      cancelConversationLongPress()
                      const touchMenu = 'pointerType' in event.nativeEvent && event.nativeEvent.pointerType !== 'mouse'
                      if (touchMenu) suppressConversationClick.current = conversation.id
                      setConversationMenuPosition(touchMenu ? null : { x: event.clientX, y: event.clientY })
                      setConversationActionId(conversation.id)
                    }}>
                    <button type="button"
                      className={`conversation-item ${activeConversationId === conversation.id ? 'active' : ''} ${conversation.pinnedAt ? 'is-pinned' : ''}`}
                      onClick={() => {
                        if (suppressConversationClick.current === conversation.id) {
                          suppressConversationClick.current = null
                          return
                        }
                        if (conversationListSearch.active) {
                          setConversations((current) => current.some((item) => item.id === conversation.id)
                            ? current : [...current, conversation]);
                        }
                        setChatSearchJump(null)
                        setQuickSearchOpen(false)
                        setActiveConversationId(conversation.id)
                        setTranslations({})
                        setTranslationOriginals({})
                        setTranslationMenuOpen(false)
                      }}
                    >
                      <ConversationAvatar conversation={conversation} className="conversation-avatar" />
                      <div className="conversation-copy">
                        <div>
                          <span className="conversation-title">
                            {conversation.pinnedAt && <Pin size={13} aria-label="Đã ghim" className="conversation-pin-indicator" />}
                            <strong>{conversation.name}</strong>
                            <CategoryBadge iconOnly category={conversationCategories.categories.find(c => c.id === conversation.categoryId)} />
                          </span>
                          <time>{formatTime(conversation.lastMessageAt) || (conversation.online ? 'online' : '')}</time>
                        </div>
                        <div>
                          <span>{conversation.lastMessage || (conversation.type === 'group' ? `${conversation.memberCount} thành viên` : 'Bắt đầu trò chuyện')}</span>
                          {conversation.unreadCount > 0 && <b>{conversation.unreadCount > 99 ? '99+' : conversation.unreadCount}</b>}
                        </div>
                      </div>
                    </button>
                  </div>
                ))}
                {(conversationListSearch.active ? conversationListSearch.hasMore
                  : conversationCategories.selected === null ? hasMoreConversations : conversationCategories.hasMore) && (
                  <button type="button" className="soco-load-more soco-conversation-load-more"
                    onClick={() => void (conversationListSearch.active ? conversationListSearch.loadMore()
                      : conversationCategories.selected === null ? loadMoreConversations() : conversationCategories.load(true))}
                    disabled={conversationListSearch.active ? conversationListSearch.loadingMore || Boolean(conversationListSearch.error)
                      : conversationLoadingMore || conversationCategories.loading}
                    aria-busy={conversationListSearch.active ? conversationListSearch.loadingMore : conversationLoadingMore || conversationCategories.loading}>
                    <RefreshCw size={15} aria-hidden="true" />
                    Tải thêm hội thoại
                  </button>
                )}
              </div>
            </aside>
  );
}