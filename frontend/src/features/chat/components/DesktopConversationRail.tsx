import type { ReactNode, MouseEvent, PointerEvent } from 'react'
import { Pin } from 'lucide-react'
import ConversationRailStatus from './ConversationRailStatus'
import ConversationRailMenu from './ConversationRailMenu'
import { Search, RefreshCw, Check } from 'lucide-react'
import type { Conversation } from '../types'
import ConversationAvatar from './ConversationAvatar'
import { formatTime } from '../../../shared/utils/format'
import '../styles/desktop-conversation-rail.css'
import '../styles/conversation-rail-top.css'

type Props = {
  conversations: Conversation[]
  selectedId: number | null
  expanded: boolean
  /** Keep search and preview DOM stable while the desktop splitter slides. */
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
  categories: { id: number; name: string; color: string }[]
  visibleConversationIds: readonly number[]
  onEntryContextMenu: (conversation: Conversation, event: MouseEvent<HTMLButtonElement>) => void
  onEntryPointerDown: (conversation: Conversation, event: PointerEvent<HTMLButtonElement>) => void
  onEntryPointerMove: (event: PointerEvent<HTMLButtonElement>) => void
  onEntryPointerEnd: () => void
}

/** One rail for all conversations. Expanding adds detail on the right without moving avatars. */
export default function DesktopConversationRail({
  conversations, selectedId, expanded, keepDetailsMounted = false, onSelect, onCreate, onSearchCompact, onCollapse,
  hasMore, loadingMore, onLoadMore, loadError, onRetry, searchValue, onSearchChange, categoryControls, categories, visibleConversationIds,
  onEntryContextMenu, onEntryPointerDown, onEntryPointerMove, onEntryPointerEnd,
}: Props) {
  const showDetails = expanded || keepDetailsMounted
  const visibleIds = new Set(visibleConversationIds)
  const items = showDetails ? conversations.filter(conversation => visibleIds.has(conversation.id)) : conversations
  return <nav className={`desktop-conversation-rail${expanded ? ' is-expanded' : ''}${keepDetailsMounted ? ' is-revealing' : ''}`}
    aria-label="Thanh avatar và hội thoại" data-expanded={expanded}>
    <div className="desktop-conversation-rail-top">
      <div className="desktop-conversation-rail-top-actions">
        <ConversationRailMenu categoryControls={categoryControls} expanded={expanded}
          onCreate={onCreate} onExpand={onSearchCompact} onCollapse={onCollapse} />
        <div className="desktop-conversation-rail-search-area">
          <div className="desktop-conversation-rail-search-line">
            <label className="desktop-conversation-rail-search-field">
              <Search size={16} aria-hidden="true" />
              <input aria-label="Tìm trong danh sách hội thoại" type="search"
                value={searchValue} onChange={event => onSearchChange(event.target.value)}
                placeholder="Tìm hội thoại..." />
            </label>
          </div>
        </div>
      </div>
    </div>
    <div className="desktop-conversation-rail-divider" aria-hidden="true" />
    <div className="desktop-conversation-rail-scroller" onScroll={event => {
      const { scrollTop, scrollHeight, clientHeight } = event.currentTarget
      if (hasMore && !loadingMore && scrollHeight - scrollTop - clientHeight < 100) void onLoadMore()
    }}>
      {items.map(conversation => (
        <div key={conversation.id} className="desktop-conversation-rail-row">
        <button type="button" className={selectedId === conversation.id
          ? 'desktop-conversation-rail-entry selected' : 'desktop-conversation-rail-entry'}
          aria-current={selectedId === conversation.id ? 'page' : undefined}
          aria-label={`Mở ${conversation.type === 'group' ? 'nhóm' : 'tin nhắn'} ${conversation.name}${conversation.unreadCount > 0 ? `, ${conversation.unreadCount} chưa đọc` : ''}`}
          title={conversation.name} onClick={() => onSelect(conversation)}
          onPointerDown={event => onEntryPointerDown(conversation, event)}
          onPointerMove={onEntryPointerMove}
          onPointerUp={onEntryPointerEnd} onPointerCancel={onEntryPointerEnd} onPointerLeave={onEntryPointerEnd}
          onContextMenu={event => onEntryContextMenu(conversation, event)}>
          <span className="desktop-conversation-rail-marker" aria-hidden="true" />
          <ConversationAvatar conversation={conversation} className="desktop-conversation-rail-avatar" />
          {selectedId === conversation.id && <span className="desktop-conversation-rail-selected-check" aria-hidden="true"><Check size={10} strokeWidth={3} /></span>}
          {!expanded && (conversation.muted || categories.some(category => category.id === conversation.categoryId)) && (
            <span className="conversation-rail-compact-status" aria-hidden="true">
              <ConversationRailStatus category={categories.find(category => category.id === conversation.categoryId)} muted={conversation.muted} />
            </span>
          )}
          <span className="desktop-conversation-rail-meta" aria-hidden={!showDetails}>
            <span className="desktop-conversation-rail-meta-top">
              <span className="conversation-rail-title-group">
                <strong>{conversation.pinnedAt && <Pin className="conversation-rail-pin" size={12} aria-label="Đã ghim" />} {conversation.name}</strong>
                <ConversationRailStatus category={categories.find(category => category.id === conversation.categoryId)} muted={conversation.muted} />
              </span>
              <time>{formatTime(conversation.lastMessageAt)}</time>
            </span>
            <span className="desktop-conversation-rail-meta-bottom">
              <small>{conversation.lastMessage || (conversation.type === 'group' ? `${conversation.memberCount} thành viên` : 'Bắt đầu trò chuyện')}</small>
            </span>
          </span>
          {conversation.unreadCount > 0 && <span className="desktop-conversation-rail-unread" aria-hidden="true">
            {conversation.unreadCount > 99 ? '99+' : conversation.unreadCount}
          </span>}
        </button>
        </div>
      ))}
      {loadError && expanded && <p className="desktop-conversation-rail-empty" role="alert">{loadError}</p>}
      {loadError && <button type="button" className="desktop-conversation-rail-load" title="Không tải được hội thoại. Thử lại" aria-label="Thử tải lại các cuộc hội thoại" onClick={() => void onRetry()}><RefreshCw size={18} aria-hidden="true" /></button>}
      {items.length === 0 && expanded && !loadError && <p className="desktop-conversation-rail-empty">Không có hội thoại phù hợp.</p>}
      {hasMore && <button type="button" className="desktop-conversation-rail-load"
        aria-label="Tải thêm hội thoại" title="Tải thêm hội thoại" disabled={loadingMore}
        onClick={() => void onLoadMore()}><RefreshCw size={18} aria-hidden="true" /></button>}
    </div>
  </nav>
}
