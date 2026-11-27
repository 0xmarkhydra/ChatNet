import { useUiTranslation } from '@/shared/i18n/locale'
import { conversationPreview } from '../utils/conversationPreview'
import { Plus, Search, Pin, RefreshCw, X } from "lucide-react";
import UiIcon from "../../../shared/ui/UiIcon";
import UserAvatar from "../../../shared/ui/UserAvatar";
import ConversationAvatar from "./ConversationAvatar";
import { userLabel } from "../../../shared/utils/userLabel";
import ConversationCategories, { CategoryBadge } from "./ConversationCategories";
import { SocoEmptyState, SocoTextAction } from "../../../shared/ui/SocoUI";
import { formatTime } from "../../../shared/utils/format";
import type { ChatSectionProps } from "./ChatSectionProps";
import type useSlidingPill from "../../../shared/ui/useSlidingPill";
import type { useMessageLongPress } from "../hooks/useMessageLongPress";

type Props = Pick<ChatSectionProps, "activeConversationId" | "actOnFriend" | "chatCreateError" | "chatListConversations" | "chatListFilter" | "chatListQuery" | "conversationCategories" | "conversationListSearch" | "conversationLoadingMore" | "copyInviteLink" | "createDirect" | "directUsername" | "friendBusyIds" | "friendQuery" | "friendRelationship" | "friendResults" | "friends" | "friendSearchError" | "friendSearching" | "hasMoreConversations" | "loadMoreConversations" | "newChatMode" | "openConnectSurface" | "quickSearchControl" | "searchInConversationList" | "session" | "setActiveConversationId" | "setChatCreateError" | "setChatListFilter" | "setChatListQuery" | "setChatSearchJump" | "setConversationActionId" | "setConversationMenuPosition" | "setConversations" | "setDirectUsername" | "setFriendQuery" | "setFriendResults" | "setFriendSearchRetry" | "setNewChatMode" | "setQrOpen" | "setQuickSearchOpen" | "setTranslationMenuOpen" | "setTranslationOriginals" | "setTranslations" | "shareMyProfile" | "sortedChatListConversations" | "t" | "visibleConversations"> & { chatFiltersPill: ReturnType<typeof useSlidingPill<HTMLDivElement>> } & Pick<ReturnType<typeof useMessageLongPress>, "beginConversationLongPress" | "cancelConversationLongPress" | "moveConversationLongPress" | "suppressConversationClick">;

export default function ConversationList({ activeConversationId, actOnFriend, beginConversationLongPress, cancelConversationLongPress, chatCreateError, chatListConversations, chatListFilter, chatListQuery, conversationCategories, conversationListSearch, conversationLoadingMore, copyInviteLink, createDirect, directUsername, friendBusyIds, friendQuery, friendRelationship, friendResults, friends, friendSearchError, friendSearching, hasMoreConversations, loadMoreConversations, moveConversationLongPress, newChatMode, openConnectSurface, quickSearchControl, searchInConversationList, session, setActiveConversationId, setChatCreateError, setChatListFilter, setChatListQuery, setChatSearchJump, setConversationActionId, setConversationMenuPosition, setConversations, setDirectUsername, setFriendQuery, setFriendResults, setFriendSearchRetry, setNewChatMode, setQrOpen, setQuickSearchOpen, setTranslationMenuOpen, setTranslationOriginals, setTranslations, shareMyProfile, sortedChatListConversations, suppressConversationClick, t, visibleConversations, chatFiltersPill }: Props) {
  const trUi = useUiTranslation()

  const { hostRef: chatFiltersPillSetHost, activeRef: chatFiltersPillSetActive, pillRef: chatFiltersPillSetPill } = chatFiltersPill;
  return (
    <aside className="conversation-sidebar social-chat-list" aria-label={trUi("chat.chatList")}>
              <div className="social-chat-list-header">
                <div className="social-chat-list-title">
                  <h2>{trUi("chat.conversation")}</h2>
                  <button type="button" className="social-chat-new" aria-label={trUi("chat.newConversationFull")}
                    title={trUi("chat.newConversation")} onClick={() => { setChatCreateError(''); setNewChatMode('direct') }}>
                    <Plus size={20} aria-hidden="true" />
                  </button>
                </div>
                {searchInConversationList ? quickSearchControl : (
                  <label className="social-chat-list-search">
                    <Search size={19} aria-hidden="true" />
                    <input type="search" value={chatListQuery} onChange={(event) => setChatListQuery(event.target.value)}
                      maxLength={120} placeholder={trUi("chat.searchConversationsFull")}
                      aria-label={trUi("chat.searchAllChats")} />
                  </label>
                )}
                <div ref={chatFiltersPillSetHost} className="social-chat-list-filters sliding-pill-host" role="group" aria-label={trUi("chat.filterConversation")}>
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
                    aria-label={trUi("chat.closeFindConnect")}
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
                        <strong id="connect-modal-title">{trUi("contacts.connect")}</strong>
                        <small>{trUi("contacts.findOnSocco")}</small>
                      </div>
                      <button
                        type="button"
                        className="friend-search-close"
                        onClick={() => { setNewChatMode('none'); setFriendQuery(''); setFriendResults([]) }}
                        aria-label={trUi("chat.closeFindConnect")}
                      >×</button>
                    </div>

                    <label className="friend-search-input-wrap connect-search-input">
                      <UiIcon name="search" size={19} />
                      <input
                        value={friendQuery}
                        onChange={(event) => setFriendQuery(event.target.value)}
                        placeholder={trUi("contacts.nameEmail")}
                        aria-label={trUi("contacts.findName")}
                        autoCapitalize="none"
                        autoComplete="off"
                        spellCheck={false}
                        maxLength={254}
                      />
                      {friendQuery && (
                        <button type="button" aria-label={trUi("common.clearSearch")} onClick={() => setFriendQuery('')}>×</button>
                      )}
                    </label>

                    <div className="connect-identity-card">
                      <UserAvatar username={session.user.username} name={userLabel(session.user.displayName, session.user.username)} className="connect-identity-avatar" online />
                      <div className="connect-identity-copy">
                        <strong>{session.user.displayName || session.user.username}</strong>
                        <span>@{session.user.username}</span>
                      </div>
                      <div className="connect-identity-actions" aria-label={trUi("profile.shareProfile")}>
                        <button type="button" onClick={() => setQrOpen('mine')} aria-label={trUi("profile.myQr")} title={trUi("profile.myQr")}><UiIcon name="qr" size={20} /></button>
                        <button type="button" onClick={() => void shareMyProfile()} aria-label={trUi("profile.shareMyProfile")} title={trUi("common.share")}>↗</button>
                        <button type="button" onClick={() => void copyInviteLink()} aria-label={trUi("profile.copyProfileLink")} title={trUi("profile.copyLink")}>⧉</button>
                      </div>
                    </div>

                    <div className="friend-search-results connect-results">

                      {!friendSearching && !friendQuery.trim() && friendResults.length > 0 && (
                        <div className="friend-suggestion-label">{trUi("contacts.peopleYouMayKnow")}</div>
                      )}
                      {friendSearchError && !friendSearching && (
                        <div className="friend-search-state" role="alert">{trUi("common.retryLoad") + ' '}<button type="button" onClick={() => setFriendSearchRetry((n) => n + 1)}>{trUi("common.retry")}</button></div>
                      )}
                      {!friendSearching && !friendSearchError && friendQuery.trim() && friendResults.length === 0 && (
                        <div className="friend-search-state">
                          <strong>{trUi("contacts.noPeople")}</strong>
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
                  <div className="panel-line"><strong>{trUi("chat.createPrivate")}</strong><button type="button" onClick={() => setNewChatMode('none')}>×</button></div>
                  <input value={directUsername} onChange={(event) => setDirectUsername(event.target.value)} placeholder={trUi("common.ui.directUsername")} maxLength={64} autoFocus />
                  <button>{trUi("chat.newConversation")}</button>
                </form>
              )}

              {chatCreateError && newChatMode !== 'group' && <div className="inline-error">{chatCreateError}</div>}

              <ConversationCategories key={session.sessionId} model={conversationCategories} />
              <div className="conversation-list zalo-conversation-list" aria-busy={conversationListSearch.active && conversationListSearch.loading}>

                {!conversationListSearch.active && conversationCategories.selected !== null && conversationCategories.listError && <div role="alert" className="category-error">
                  {conversationCategories.listError}<button type="button" onClick={() => void conversationCategories.load(false,true)}>{trUi("common.retry")}</button>
                </div>}

                {conversationListSearch.active && conversationListSearch.error && (
                  <p className="conversation-search-status" role="alert">
                    {conversationListSearch.error}
                    <button type="button" onClick={conversationListSearch.retry}>{trUi("common.retry")}</button>
                  </p>
                )}
                {chatListConversations.length === 0 &&
                  !conversationListSearch.loading && !conversationListSearch.error &&
                  (conversationListSearch.active || (!conversationCategories.loading && !conversationCategories.listError)) && (
                  <div className="conversation-list-empty">
                    <SocoEmptyState
                      kind="chat"
                      title={conversationListSearch.active ? trUi("common.ui.noChatTitle")
                        : visibleConversations.length ? trUi("common.ui.noChatMatching") : trUi("common.ui.noChatYet")}
                      description={conversationListSearch.active || visibleConversations.length
                        ? trUi("common.ui.tryDifferentFilter")
                        : trUi("common.ui.findFriendsStartChat")}
                      action={conversationListSearch.active || visibleConversations.length
                        ? <SocoTextAction onClick={() => { setChatListQuery(''); setChatListFilter('all') }}>{trUi("common.clearFilter")}</SocoTextAction>
                        : <SocoTextAction onClick={() => openConnectSurface()}>{trUi("contacts.findFriendsAlt")}</SocoTextAction>}
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
                            {conversation.pinnedAt && <Pin size={13} aria-label={trUi("common.pinned")} className="conversation-pin-indicator" />}
                            <strong>{conversation.name}</strong>
                            <CategoryBadge iconOnly category={conversationCategories.categories.find(c => c.id === conversation.categoryId)} />
                          </span>
                          <time>{formatTime(conversation.lastMessageAt) || (conversation.online ? 'online' : '')}</time>
                        </div>
                        <div>
                          <span>{conversationPreview(conversation.lastMessage) || (conversation.type === 'group' ? `${conversation.memberCount} thành viên` : trUi("chat.startChat"))}</span>
                          {(conversation.unreadCount > 0 || conversation.manualUnread) && <b>{conversation.unreadCount > 99 ? '99+' : conversation.unreadCount || '•'}</b>}
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
                    <RefreshCw size={15} aria-hidden="true" />{trUi("chat.moreConversations")}</button>
                )}
              </div>
            </aside>
  );
}