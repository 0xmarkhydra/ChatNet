import { useEffect, useState, useSyncExternalStore } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Bell, BellRing, Search, SlidersHorizontal, X } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/shared/ui/dialog'
import { usePostSearch } from '../feed'
import type { ApiRequest } from '../../shared/types/api'
import { listRecentProducts, searchCommunities, searchPeople } from './api/search'
import { useRemoteList } from './hooks/useRemoteList'
import {
  FILTER_GROUPS, SEARCH_TYPES, activeFilters, effectiveFilters, filterCommunities, filterPeople, filterPosts, filterProducts,
  parseFilters, parsePrice, parseType, type FilterId, type SearchType,
} from './lib/searchFilters'
import {
  addOpened, addRecent, getHistory, removeOtherScopes, isSaved, markSeen, removeRecent, subscribeHistory, toggleSaved, updateHistory, type OpenedResult,
} from './lib/searchHistory'
import SearchFilterPanel from './components/SearchFilterPanel'
import SearchForm from './components/SearchForm'
import SearchHome from './components/SearchHome'
import SearchResults from './components/SearchResults'
import './SearchResultsPage.css'

export type SearchResultsPageProps = {
  request: ApiRequest
  sessionId: string
  onOpenProfile: (username: string) => void
  onOpenPost: (postId: number) => void
}

const PLACEHOLDER: Record<SearchType, string> = {
  all: 'Tìm người, bài viết, cộng đồng và sản phẩm…',
  people: 'Tìm theo tên hoặc @username…',
  posts: 'Tìm nội dung bài viết…',
  communities: 'Tìm cộng đồng công khai…',
  products: 'Tìm sản phẩm trên Marketplace…',
}
const FILTER_KEYS = [...Object.keys(FILTER_GROUPS), 'range', 'min', 'max']

export default function SearchResultsPage({ request, sessionId, onOpenProfile, onOpenPost }: SearchResultsPageProps) {
  const [params, setParams] = useSearchParams()
  const query = params.get('q')?.trim().slice(0, 120) ?? ''
  const type = parseType(params.get('type'))
  const values = effectiveFilters(type, parseFilters(params))
  const minPrice = type === 'products' ? params.get('min') ?? '' : ''
  const maxPrice = type === 'products' ? params.get('max') ?? '' : ''
  const history = useSyncExternalStore(subscribeHistory, () => getHistory(sessionId))
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [openedAt] = useState(() => Date.now())
  const isHome = !query && !params.has('type')

  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 901px)')
    const close = () => { if (desktop.matches) setFiltersOpen(false) }
    desktop.addEventListener('change', close)
    return () => desktop.removeEventListener('change', close)
  }, [])

  useEffect(() => { removeOtherScopes(sessionId) }, [sessionId])

  useEffect(() => {
    if (query) updateHistory(sessionId, current => addRecent(current, query))
  }, [query, sessionId])

  const wants = (key: Exclude<SearchType, 'all'>) => Boolean(query) && (type === 'all' || type === key)
  const postScope = type === 'posts' && values.in !== 'all' ? values.in as 'saved' | 'following' : 'all'
  const posts = usePostSearch({ query, scope: postScope, enabled: wants('posts'), sessionId, request })
  const people = useRemoteList(wants('people') ? JSON.stringify([sessionId, 'people', query]) : '',
    signal => searchPeople(request, query, signal), 'Không thể tìm người dùng. Hãy thử lại.')
  const communities = useRemoteList(wants('communities') ? JSON.stringify([sessionId, 'communities', query]) : '',
    signal => searchCommunities(request, query, signal), 'Không thể tìm cộng đồng. Hãy thử lại.')
  const products = useRemoteList(wants('products') ? JSON.stringify([sessionId, 'products']) : '',
    signal => listRecentProducts(request, signal), 'Không thể tải sản phẩm. Hãy thử lại.')

  const chips = activeFilters(type, values)
  const priceActive = parsePrice(minPrice) !== null || parsePrice(maxPrice) !== null
  const activeCount = chips.length + Number(priceActive)
  const saved = Boolean(query) && isSaved(history, query)

  const change = (edit: (next: URLSearchParams) => void, replace = false) => {
    const next = new URLSearchParams(params)
    edit(next)
    setParams(next, { replace })
  }
  const setFilter = (id: FilterId, value: string) => change(next => {
    if (id === 'time') next.delete('range')
    if (FILTER_GROUPS[id].options[0].value === value) next.delete(id)
    else next.set(id, value)
  })
  const setType = (next: SearchType) => change(draft => {
    if (next === 'all') draft.delete('type')
    else draft.set('type', next)
    if (next === 'all' && !draft.get('q')) draft.set('type', 'all')
  })
  const resetFilters = () => change(next => FILTER_KEYS.forEach(key => next.delete(key)))
  const submit = (value: string) => change(next => next.set('q', value))
  const startSearch = (value: string, extra: Record<string, string> = {}) => {
    const next = new URLSearchParams(extra)
    if (value) next.set('q', value)
    setParams(next)
  }
  const openSaved = (value: string) => {
    updateHistory(sessionId, current => markSeen(current, value, Date.now()))
    startSearch(value)
  }
  const recordOpened = (item: OpenedResult) => updateHistory(sessionId, current => addOpened(current, item))
  const openOpened = (item: OpenedResult) => {
    recordOpened(item)
    if (item.kind === 'person') onOpenProfile(item.username)
    else if (item.kind === 'post') onOpenPost(item.id)
    else startSearch(item.title, { type: 'communities' })
  }

  if (isHome) {
    return (
      <section className="srch-page" aria-label="Tìm kiếm">
        <SearchHome history={history} request={request} sessionId={sessionId}
          onSearch={startSearch} onOpenSaved={openSaved} onOpenOpened={openOpened}
          onRemoveRecent={value => updateHistory(sessionId, current => removeRecent(current, value))}
          onClearRecent={() => updateHistory(sessionId, current => ({ ...current, recent: [] }))}
          onToggleSaved={value => updateHistory(sessionId, current => toggleSaved(current, value, Date.now()))} />
      </section>
    )
  }

  const panelProps = {
    type, values, minPrice, maxPrice, onType: setType, onFilter: setFilter, onReset: resetFilters,
    onPrice: (key: 'min' | 'max', value: string) => change(next => {
      if (value === '') next.delete(key)
      else next.set(key, value)
    }, true),
  }
  const saveButton = query && (
    <button type="button" className={saved ? 'srch-btn soft' : 'srch-btn ghost'} aria-pressed={saved}
      onClick={() => updateHistory(sessionId, current => toggleSaved(current, query, Date.now()))}>
      {saved ? <BellRing size={16} aria-hidden="true" /> : <Bell size={16} aria-hidden="true" />}
      {saved ? 'Đã lưu tìm kiếm' : 'Lưu tìm kiếm'}
    </button>
  )

  return (
    <section className="srch-page" aria-label="Kết quả tìm kiếm">
      <div className="srch-layout">
        <aside className="srch-panel" aria-label="Tìm kiếm và bộ lọc">
          <h1>Kết quả tìm kiếm</h1>
          <SearchForm key={'desktop' + query + type} initialQuery={query} placeholder={PLACEHOLDER[type]} onSubmit={submit} />
          <SearchFilterPanel {...panelProps} />
        </aside>

        <div className="srch-main">
          <div className="srch-mobile-bar">
            <h1 className="sr-only">Kết quả tìm kiếm</h1>
            <div className="srch-mobile-row">
              <SearchForm key={'mobile' + query + type} initialQuery={query} placeholder={PLACEHOLDER[type]} onSubmit={submit} />
              <button type="button" className="srch-filter-btn" onClick={() => setFiltersOpen(true)} aria-label={'Bộ lọc' + (activeCount ? ', ' + activeCount + ' đang bật' : '')}>
                <SlidersHorizontal size={18} aria-hidden="true" />
                {activeCount > 0 && <span className="srch-count">{activeCount}</span>}
              </button>
            </div>
            <div className="srch-chips" role="group" aria-label="Loại kết quả">
              {SEARCH_TYPES.map(item => (
                <button key={item.key} type="button" aria-pressed={type === item.key}
                  className={type === item.key ? 'srch-chip selected' : 'srch-chip'} onClick={() => setType(item.key)}>{item.label}</button>
              ))}
            </div>
          </div>

          {query && (
            <header className="srch-main-head">
              <h2>Kết quả cho “{query}”</h2>
              {saveButton}
            </header>
          )}

          {activeCount > 0 && (
            <div className="srch-active" aria-label="Bộ lọc đang bật">
              <span className="srch-active-label">Đang lọc</span>
              {chips.map(chip => (
                <button key={chip.id} type="button" className="srch-active-chip" aria-label={'Bỏ lọc ' + chip.label} onClick={() => setFilter(chip.id, FILTER_GROUPS[chip.id].options[0].value)}>
                  {chip.label}<X size={14} aria-hidden="true" />
                </button>
              ))}
              {priceActive && (
                <button type="button" className="srch-active-chip" aria-label="Bỏ lọc khoảng giá" onClick={() => change(next => { next.delete('min'); next.delete('max') })}>
                  Khoảng giá<X size={14} aria-hidden="true" />
                </button>
              )}
              <button type="button" className="srch-link" onClick={resetFilters}>Xóa tất cả</button>
            </div>
          )}

          {query ? (
            <SearchResults type={type} query={query} request={request} sessionId={sessionId} activeFilterCount={activeCount}
              people={{ ...people, items: filterPeople(people.items, values) }}
              communities={{ ...communities, items: filterCommunities(communities.items, values) }}
              products={{ ...products, items: filterProducts(products.items, query, values, parsePrice(minPrice), parsePrice(maxPrice)) }}
              posts={{
                items: filterPosts(posts.posts, values, openedAt), loading: posts.loading, error: posts.error, retry: posts.retry,
                hasMore: posts.hasMore, loadingMore: posts.loadingMore, loadMore: () => void posts.loadMore(),
              }}
              onType={setType} onResetFilters={resetFilters} onOpenProfile={onOpenProfile} onOpenPost={onOpenPost} onOpened={recordOpened} />
          ) : (
            <div className="srch-card srch-prompt">
              <span className="srch-empty-icon" aria-hidden="true"><Search size={24} /></span>
              <h2>Nhập từ khóa để tìm trong {SEARCH_TYPES.find(item => item.key === type)?.label.toLocaleLowerCase('vi-VN')}</h2>
              <p>Bộ lọc bạn chọn sẽ được giữ khi tìm kiếm.</p>
            </div>
          )}
        </div>
      </div>

      <Dialog open={filtersOpen} onOpenChange={setFiltersOpen}>
        <DialogContent className="srch-sheet">
          <DialogTitle>Bộ lọc</DialogTitle>
          <DialogDescription className="sr-only">Thu hẹp kết quả tìm kiếm theo loại và tiêu chí.</DialogDescription>
          <SearchFilterPanel {...panelProps} showTypes={false} />
          <button type="button" className="srch-btn wide" onClick={() => setFiltersOpen(false)}>
            {activeCount ? 'Áp dụng ' + activeCount + ' bộ lọc' : 'Xem kết quả'}
          </button>
        </DialogContent>
      </Dialog>
    </section>
  )
}
