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
    <div className="social-feed-filter-bar flex min-h-[50px] items-center justify-between gap-2 rounded-2xl border border-[#e8ecf5] bg-white px-[9px] py-[6px] shadow-[0_3px_16px_rgba(30,51,96,0.035)]" role="group" aria-label="Lọc bảng tin">
      <div className="social-feed-filter-options flex min-w-0 items-center gap-[9px] overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [&_button]:min-h-[35px] [&_button]:shrink-0 [&_button]:cursor-pointer [&_button]:rounded-[11px] [&_button]:border-0 [&_button]:bg-transparent [&_button]:px-[14px] [&_button]:text-ui-caption! [&_button]:font-semibold [&_button]:text-[#71809d] [&_button[aria-pressed=true]]:bg-[#eff3ff] [&_button[aria-pressed=true]]:font-bold [&_button[aria-pressed=true]]:text-[#2563eb]">
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
      <button className="social-feed-refresh inline-flex min-h-[31px] shrink-0 cursor-pointer items-center justify-center gap-1.5 border-0 bg-transparent px-[9px] text-ui-caption! text-[#6582bd]" type="button" onClick={onRefresh}>
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