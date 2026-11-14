import { RefreshCw } from 'lucide-react'
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
  if (mode === 'category') return <ConversationCategories model={categories} />
  return (
    <div className="conversation-rail-controls" aria-label="Bộ lọc cuộc trò chuyện">
      <div className="conversation-rail-filter-options" role="group" aria-label="Lọc cuộc trò chuyện">
        {([
          { key: 'all', label: 'Tất cả' },
          { key: 'unread', label: 'Chưa đọc' },
          { key: 'groups', label: 'Nhóm' },
        ] as const).map(option => (
          <button type="button" key={option.key}
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
