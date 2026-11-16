import { RefreshCw } from 'lucide-react'
import useSlidingPill from '../../../shared/ui/useSlidingPill'
import ConversationCategories from './ConversationCategories'
import type { ChatSectionProps } from './ChatSectionProps'
import '../styles/conversation-rail-controls.css'

type Props = {
  filter: ChatSectionProps['chatListFilter']
  onFilterChange: ChatSectionProps['setChatListFilter']
  categories: ChatSectionProps['conversationCategories']
  search: ChatSectionProps['conversationListSearch']
  mode?: 'filters' | 'category'
}

/** Reuse the original conversation filters and category manager in the folding rail. */
export default function ConversationRailControls({ filter, onFilterChange, categories, search, mode = 'filters' }: Props) {
  const { hostRef, activeRef, pillRef } = useSlidingPill<HTMLDivElement>(filter)
  if (mode === 'category') return <ConversationCategories model={categories} />
  return (
    <div className="conversation-rail-controls" aria-label="Bộ lọc cuộc trò chuyện">
      <div ref={hostRef} className="conversation-rail-filter-options sliding-pill-host" role="group" aria-label="Lọc cuộc trò chuyện">
        <span ref={pillRef} className="sliding-pill conversation-rail-active-pill" aria-hidden="true" />
        {([
          { key: 'all', label: 'Tất cả' },
          { key: 'unread', label: 'Chưa đọc' },
          { key: 'groups', label: 'Nhóm' },
        ] as const).map(option => (
          <button type="button" key={option.key} ref={filter === option.key ? activeRef : undefined}
            aria-pressed={filter === option.key}
            className={filter === option.key ? 'selected' : ''}
            onClick={() => onFilterChange(option.key)}>
            {option.label}
          </button>
        ))}
      </div>
      {search.loading && <span className="conversation-rail-search-status" role="status"><RefreshCw size={13} /> Đang tìm…</span>}
      {search.error && <span className="conversation-rail-search-status" role="alert">
        {search.error} <button type="button" onClick={search.retry}>Thử lại</button>
      </span>}
    </div>
  )
}