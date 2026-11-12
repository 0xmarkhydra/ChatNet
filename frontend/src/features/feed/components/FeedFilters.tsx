import type { Dispatch, SetStateAction } from 'react'
import { RefreshCw } from 'lucide-react'

type FeedFilter = 'all' | 'following' | 'latest' | 'saved'

export type FeedFiltersProps = {
  isProfileDesktop: boolean
  filter: FeedFilter
  onHostMount: (node: HTMLDivElement | null) => void
  onActiveMount: (node: HTMLButtonElement | null) => void
  onPillMount: (node: HTMLSpanElement | null) => void
  setFilter: Dispatch<SetStateAction<FeedFilter>>
  onCloseCommunities: () => void
  onRefresh: () => void
  onLoadSaved: () => void
}

export default function FeedFilters({
  isProfileDesktop, filter, onHostMount, onActiveMount, onPillMount, setFilter, onCloseCommunities, onRefresh, onLoadSaved,
}: FeedFiltersProps) {
  function chooseFilter(next: FeedFilter) {
    onCloseCommunities()
    setFilter(next)
  }

  return isProfileDesktop ? (
    <div className="social-feed-filter-bar" role="group" aria-label="Lọc bảng tin">
      <div className="social-feed-filter-options">
        <button type="button" aria-pressed={filter === 'all'} onClick={() => chooseFilter('all')}>
          Dành cho bạn
        </button>
        <button type="button" aria-pressed={filter === 'following'} onClick={() => chooseFilter('following')}>
          Đang theo dõi
        </button>
        <button type="button" aria-pressed={filter === 'latest'} onClick={() => chooseFilter('latest')}>
          Mới nhất
        </button>
        {filter === 'saved' && <button type="button" aria-pressed={true}>Đã lưu</button>}
      </div>
      <button className="social-feed-refresh" type="button" onClick={onRefresh}>
        <RefreshCw size={15} aria-hidden="true" />
        {filter === 'saved' ? 'Bài đã lưu' : 'Bài viết mới'}
      </button>
    </div>
  ) : (
    <div className="soco-feed-section-label soco-feed-posts-label">
      <strong>{filter === 'saved' ? 'Bài viết đã lưu' : 'Bài viết mới'}</strong>
      <div ref={onHostMount} className="feed-filter-tabs sliding-pill-host" role="group" aria-label="Lọc bảng tin">
        <span ref={onPillMount} className="sliding-pill feed-filter-active-pill" aria-hidden="true" />
        <button ref={filter === 'all' ? onActiveMount : undefined} type="button"
          aria-pressed={filter === 'all'} onClick={() => chooseFilter('all')}>
          Mới nhất
        </button>
        <button ref={filter === 'saved' ? onActiveMount : undefined} type="button"
          aria-pressed={filter === 'saved'} onClick={() => { chooseFilter('saved'); onLoadSaved() }}>
          Đã lưu
        </button>
      </div>
    </div>
  )
}
