import { useUiTranslation } from '@/shared/i18n/locale'
import { conversationPreview } from '../utils/conversationPreview'
import type { ReactNode, MouseEvent, PointerEvent } from 'react'
import { Ellipsis, Pin } from 'lucide-react'
import ConversationRailStatus from './ConversationRailStatus'
import ConversationRailMenu from './ConversationRailMenu'
import { Search, RefreshCw, Check } from 'lucide-react'
import ConversationAvatar from './ConversationAvatar'
import { formatTime } from '../../../shared/utils/format'
import type { Conversation } from '../types'
import '../styles/conversation-avatar-rail.css'
import '../styles/conversation-rail-top.css'

export type ConversationRailProps = {
  conversations: Conversation[]
  selectedId: number | null
  expanded: boolean
  /** Keep the rail search/rows stable while the shared splitter moves. */
  keepDetailsMounted?: boolean
  onSelect: (conversation: Conversation) => void
  onCreate: () => void
  onSearchCompact: () => void
  onCollapse: () => void
  hasMore: boolean
  loadingMore: boolean
  onLoadMore: () => Promise<void>
  loadError: string
  onRetry: () => Promise<void>
  searchValue: string
  onSearchChange: (next: string) => void
  categoryControls: ReactNode
  filter: "all" | "unread" | "groups"
  onFilterChange: (filter: "all" | "unread" | "groups") => void
  categories: { id: number; name: string; color: string }[]
  visibleConversationIds: readonly number[]
  onEntryContextMenu: (conversation: Conversation, event: MouseEvent<HTMLButtonElement>) => void
  onEntryPointerDown: (conversation: Conversation, event: PointerEvent<HTMLButtonElement>) => void
  onEntryPointerMove: (event: PointerEvent<HTMLButtonElement>) => void
  onEntryPointerEnd: () => void
}

/** Shared desktop and mobile rail; retain platform-specific layout classes and mounting behavior. */
export default function ConversationAvatarRail({
  conversations, selectedId, expanded, keepDetailsMounted = false, onSelect, onCreate, onSearchCompact, onCollapse,
  hasMore, loadingMore, onLoadMore, loadError, onRetry, searchValue, onSearchChange, categoryControls, filter, onFilterChange, categories, visibleConversationIds,
  onEntryContextMenu, onEntryPointerDown, onEntryPointerMove, onEntryPointerEnd, desktop = false,
}: ConversationRailProps & { desktop?: boolean }) {
  const trUi = useUiTranslation()

  const prefix = desktop ? 'desktop-conversation-rail' : 'conversation-avatar-rail'
  const showDetails = expanded || keepDetailsMounted
  const visibleIds = new Set(visibleConversationIds)
  const items = showDetails ? conversations.filter(conversation => visibleIds.has(conversation.id)) : conversations
  return (
    <nav className={`${prefix}${expanded ? ' is-expanded' : ''}${keepDetailsMounted ? ' is-revealing' : ''}`}
      aria-label={desktop ? trUi("common.ui.avatarRail") : trUi("chat.conversation")} data-expanded={expanded}>
      <div className={`${prefix}-top`}>
      <div className={`${prefix}-top-actions`}>
        <ConversationRailMenu categoryControls={categoryControls} filter={filter} onFilterChange={onFilterChange} expanded={expanded}
          onCreate={onCreate} onExpand={onSearchCompact} onCollapse={onCollapse} />
        {(desktop || showDetails) && <div className={`${prefix}-search-area`}>
          <div className={`${prefix}-search-line`}>
            <label className={`${prefix}-search-field`}>
              <Search size={16} aria-hidden="true" />
              <input aria-label={trUi("common.ui.findInChats")} type="search"
                value={searchValue} onChange={event => onSearchChange(event.target.value)}
                placeholder={trUi("chat.searchConversations")} />
            </label>
          </div>
        </div>}
      </div>
    </div>
    <div className={`${prefix}-divider`} aria-hidden="true" />
      <div className={desktop ? "desktop-conversation-rail-scroller" : "conversation-avatar-rail-scroll"} onScroll={event => {
      const { scrollTop, scrollHeight, clientHeight } = event.currentTarget
      if (hasMore && !loadingMore && scrollHeight - scrollTop - clientHeight < 100) void onLoadMore()
    }}>
        {items.map(conversation => {
          const category = categories.find(item => item.id === conversation.categoryId)
          const entryClass = desktop ? 'desktop-conversation-rail-entry' : 'conversation-avatar-rail-item'
          const entry = <button type="button" key={conversation.id}
            className={`${entryClass}${selectedId === conversation.id ? ' selected' : ''}`}
            aria-label={trUi("common.ui.openNamed", { v1: String(conversation.type === 'group' ? 'nhóm' : desktop ? 'tin nhắn' : 'cuộc trò chuyện'), v2: String(conversation.name), v3: String(conversation.unreadCount ? `, ${conversation.unreadCount}${desktop ? ' chưa đọc' : ' tin chưa đọc'}` : '') })}
            aria-current={selectedId === conversation.id ? 'page' : undefined}
            title={conversation.name} onClick={() => onSelect(conversation)}
            onPointerDown={event => onEntryPointerDown(conversation, event)}
            onPointerMove={onEntryPointerMove}
            onPointerUp={onEntryPointerEnd} onPointerCancel={onEntryPointerEnd} onPointerLeave={onEntryPointerEnd}
            onContextMenu={event => onEntryContextMenu(conversation, event)}>
            <span className={desktop ? "desktop-conversation-rail-marker" : "conversation-avatar-rail-indicator"} aria-hidden="true" />
            <ConversationAvatar conversation={conversation} className={desktop ? "desktop-conversation-rail-avatar" : "conversation-avatar conversation-avatar-rail-photo"} />
            {selectedId === conversation.id && <span className={`${prefix}-selected-check`} aria-hidden="true"><Check size={10} strokeWidth={3} /></span>}
            {!expanded && (conversation.muted || category) && (
              <span className="conversation-rail-compact-status" aria-hidden="true">
                <ConversationRailStatus category={category} muted={conversation.muted} />
              </span>
            )}
            <span className={`${prefix}-meta`} aria-hidden={!showDetails}>
              <span className={`${prefix}-meta-top`}>
                <span className="conversation-rail-title-group">
                  <strong>{conversation.pinnedAt && <Pin className="conversation-rail-pin" size={12} aria-label={trUi("common.pinned")} />} {conversation.name}</strong>
                  <ConversationRailStatus category={category} muted={conversation.muted} />
                </span>
                {desktop ? <span className="desktop-conversation-rail-time-space" aria-hidden="true" /> : <time>{formatTime(conversation.lastMessageAt)}</time>}
              </span>
              <span className={`${prefix}-meta-bottom`}>
                <small>{conversationPreview(conversation.lastMessage) || (conversation.type === 'group' ? `${conversation.memberCount} thành viên` : trUi("chat.startChat"))}</small>
              </span>
            </span>
            {(conversation.unreadCount > 0 || conversation.manualUnread) && (
              <span className={desktop ? "desktop-conversation-rail-unread" : "conversation-avatar-rail-count"} aria-hidden="true">
                {conversation.unreadCount > 99 ? '99+' : conversation.unreadCount || '•'}
              </span>
            )}
          </button>
          return desktop ? (
            <div key={conversation.id} className="desktop-conversation-rail-row">
              {entry}
              <div className="desktop-conversation-rail-time-actions">
                <time>{formatTime(conversation.lastMessageAt)}</time>
                <button type="button" className="desktop-conversation-rail-more-action"
                  aria-label={trUi("common.ui.conversationOptionsName", { v1: String(conversation.name) })} aria-haspopup="dialog"
                  title={trUi("chat.chatOptions")}
                  onClick={event => onEntryContextMenu(conversation, event)}>
                  <Ellipsis size={18} aria-hidden="true"/>
                </button>
              </div>
            </div>
          ) : entry
        })}
        {loadError && expanded && <p className={`${prefix}-empty`} role="alert">{loadError}</p>}
        {loadError && <button type="button" className={desktop ? "desktop-conversation-rail-load" : "conversation-avatar-rail-more"} title={trUi("chat.loadChatFailed")} aria-label={trUi("chat.retryConversations")} onClick={() => void onRetry()}><RefreshCw size={desktop ? 18 : 17} aria-hidden="true" /></button>}
        {items.length === 0 && expanded && !loadError && <p className={`${prefix}-empty`}>{trUi("chat.noMatchingConversations")}</p>}
        {hasMore && (
          <button type="button" className={desktop ? "desktop-conversation-rail-load" : "conversation-avatar-rail-more"}
            title={desktop ? trUi("chat.moreConversations") : trUi("chat.loadMore")} aria-label={desktop ? trUi("chat.moreConversations") : trUi("chat.loadMore")}
            disabled={loadingMore} onClick={() => void onLoadMore()}>
            <RefreshCw size={desktop ? 18 : 17} aria-hidden="true" className={!desktop && loadingMore ? 'rail-spinning' : ''} />
          </button>
        )}
      </div>
    </nav>
  )
}