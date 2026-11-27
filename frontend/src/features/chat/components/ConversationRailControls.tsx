import { useUiTranslation } from '@/shared/i18n/locale'
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
  const trUi = useUiTranslation()

  const { hostRef, activeRef, pillRef } = useSlidingPill<HTMLDivElement>(filter)
  if (mode === 'category') return <ConversationCategories model={categories} />
  return (
    <div className="conversation-rail-controls" aria-label={trUi("common.ui.conversationFilter")}>
      <div ref={hostRef} className="conversation-rail-filter-options sliding-pill-host" role="group" aria-label={trUi("chat.filterConversation")}>
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
      {search.loading && <span className="conversation-rail-search-status" role="status"><RefreshCw size={13} />{trUi("chat.searching")}</span>}
      {search.error && <span className="conversation-rail-search-status" role="alert">
        {search.error} <button type="button" onClick={search.retry}>{trUi("common.retry")}</button>
      </span>}
    </div>
  )
}