import type { ReactNode, MouseEvent, PointerEvent } from 'react'
import { createPortal } from 'react-dom'
import { useRailSearchPopover } from '../hooks/useRailSearchPopover'
import { Pin } from 'lucide-react'
import ConversationRailStatus from './ConversationRailStatus'
import { Plus, Search, RefreshCw, Check, ChevronRight } from 'lucide-react'
import ConversationAvatar from './ConversationAvatar'
import { formatTime } from '../../../shared/utils/format'
import type { Conversation } from '../types'
import '../styles/conversation-avatar-rail.css'
import '../styles/conversation-rail-top.css'

type Props = {
  conversations: Conversation[]
  selectedId: number | null
  expanded: boolean
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
  searchControl?: ReactNode
  onSearchChange: (next: string) => void
  controls: ReactNode
  categoryControls: ReactNode
  categories: { id: number; name: string; color: string }[]
  visibleConversationIds: readonly number[]
  onEntryContextMenu: (conversation: Conversation, event: MouseEvent<HTMLButtonElement>) => void
  onEntryPointerDown: (conversation: Conversation, event: PointerEvent<HTMLButtonElement>) => void
  onEntryPointerMove: (event: PointerEvent<HTMLButtonElement>) => void
  onEntryPointerEnd: () => void
}

/** Mobile uses the same conversation avatar DOM in both sizes; only details reveal. */
export default function ConversationAvatarRail({
  conversations, selectedId, expanded, onSelect, onCreate, onSearchCompact, onCollapse,
  hasMore, loadingMore, onLoadMore, loadError, onRetry, searchValue, searchControl, onSearchChange, controls, categoryControls, categories, visibleConversationIds,
  onEntryContextMenu, onEntryPointerDown, onEntryPointerMove, onEntryPointerEnd,
}: Props) {
  const { open, setOpen, searchRef, filterRef, style } = useRailSearchPopover(expanded)
  const visibleIds = new Set(visibleConversationIds)
  const items = expanded ? conversations.filter(conversation => visibleIds.has(conversation.id)) : conversations
  return (
    <nav className={`conversation-avatar-rail${expanded ? ' is-expanded' : ''}`}
      aria-label="Cuộc trò chuyện" data-expanded={expanded}>
      <div className="conversation-avatar-rail-top">
      <div className="conversation-avatar-rail-top-actions">
        <button type="button" className="conversation-avatar-rail-expand-toggle"
          aria-label={expanded ? 'Thu gọn cột avatar' : 'Mở rộng cột avatar'}
          title={expanded ? 'Thu gọn cột avatar' : 'Mở rộng cột avatar'}
          aria-expanded={expanded}
          onClick={expanded ? onCollapse : onSearchCompact}>
          <ChevronRight size={19} aria-hidden="true" />
        </button>
        {expanded && <div ref={searchRef} className="conversation-avatar-rail-search-area"
          onFocusCapture={() => setOpen(true)}>
          <div className="conversation-avatar-rail-search-line">
        {searchControl
          ? <div className="conversation-avatar-rail-external-search">{searchControl}</div>
          : <label className="conversation-avatar-rail-search-field">
              <Search size={16} aria-hidden="true" />
              <input aria-label="Tìm trong danh sách hội thoại" type="search"
                value={searchValue} onChange={event => onSearchChange(event.target.value)}
                onClick={() => setOpen(true)}
                placeholder="Tìm hội thoại..." />
            </label>}
          </div>
        </div>}
        {expanded && <div className="conversation-avatar-rail-top-category">{categoryControls}</div>}
        {expanded && <button type="button" className="conversation-avatar-rail-create"
          onClick={onCreate}
          aria-label="Tạo cuộc trò chuyện mới" title="Tạo cuộc trò chuyện mới">
          <Plus size={18} aria-hidden="true" />
        </button>}
      </div>
    </div>
    {open && style && createPortal(
      <div ref={filterRef} className="conversation-rail-floating-filters" style={style}>{controls}</div>,
      document.body)}
    <div className="conversation-avatar-rail-divider" aria-hidden="true" />
      <div className="conversation-avatar-rail-scroll" onScroll={event => {
      const { scrollTop, scrollHeight, clientHeight } = event.currentTarget
      if (hasMore && !loadingMore && scrollHeight - scrollTop - clientHeight < 100) void onLoadMore()
    }}>
        {items.map(conversation => (
          <button type="button" key={conversation.id}
            className={selectedId === conversation.id ? 'conversation-avatar-rail-item selected' : 'conversation-avatar-rail-item'}
            aria-label={`Mở ${conversation.type === 'group' ? 'nhóm' : 'cuộc trò chuyện'} ${conversation.name}${conversation.unreadCount ? `, ${conversation.unreadCount} tin chưa đọc` : ''}`}
            aria-current={selectedId === conversation.id ? 'page' : undefined}
            title={conversation.name} onClick={() => onSelect(conversation)}
            onPointerDown={event => onEntryPointerDown(conversation, event)}
            onPointerMove={onEntryPointerMove}
            onPointerUp={onEntryPointerEnd} onPointerCancel={onEntryPointerEnd} onPointerLeave={onEntryPointerEnd}
            onContextMenu={event => onEntryContextMenu(conversation, event)}>
            <span className="conversation-avatar-rail-indicator" aria-hidden="true" />
            <ConversationAvatar conversation={conversation} className="conversation-avatar conversation-avatar-rail-photo" />
            {selectedId === conversation.id && <span className="conversation-avatar-rail-selected-check" aria-hidden="true"><Check size={10} strokeWidth={3} /></span>}
            {!expanded && (conversation.muted || categories.some(category => category.id === conversation.categoryId)) && (
              <span className="conversation-rail-compact-status" aria-hidden="true">
                <ConversationRailStatus category={categories.find(category => category.id === conversation.categoryId)} muted={conversation.muted} />
              </span>
            )}
            <span className="conversation-avatar-rail-meta" aria-hidden={!expanded}>
              <span className="conversation-avatar-rail-meta-top">
                <span className="conversation-rail-title-group">
                  <strong>{conversation.pinnedAt && <Pin className="conversation-rail-pin" size={12} aria-label="Đã ghim" />} {conversation.name}</strong>
                  <ConversationRailStatus category={categories.find(category => category.id === conversation.categoryId)} muted={conversation.muted} />
                </span>
                <time>{formatTime(conversation.lastMessageAt)}</time>
              </span>
              <span className="conversation-avatar-rail-meta-bottom">
                <small>{conversation.lastMessage || (conversation.type === 'group' ? `${conversation.memberCount} thành viên` : 'Bắt đầu trò chuyện')}</small>
              </span>
            </span>
            {conversation.unreadCount > 0 && (
              <span className="conversation-avatar-rail-count" aria-hidden="true">
                {conversation.unreadCount > 99 ? '99+' : conversation.unreadCount}
              </span>
            )}
          </button>
        ))}
        {loadError && expanded && <p className="conversation-avatar-rail-empty" role="alert">{loadError}</p>}
        {loadError && <button type="button" className="conversation-avatar-rail-more" title="Không tải được hội thoại. Thử lại" aria-label="Thử tải lại các cuộc hội thoại" onClick={() => void onRetry()}><RefreshCw size={17} aria-hidden="true" /></button>}
        {items.length === 0 && expanded && !loadError && <p className="conversation-avatar-rail-empty">Không có hội thoại phù hợp.</p>}
        {hasMore && (
          <button type="button" className="conversation-avatar-rail-more"
            title="Tải thêm cuộc trò chuyện" aria-label="Tải thêm cuộc trò chuyện"
            disabled={loadingMore} onClick={() => void onLoadMore()}>
            <RefreshCw size={17} aria-hidden="true" className={loadingMore ? 'rail-spinning' : ''} />
          </button>
        )}
      </div>
    </nav>
  )
}
