import { useEffect, useState, useSyncExternalStore } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Bell, BellRing, ChevronLeft, Search, SlidersHorizontal, X } from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/ui/button'
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
import { card, emptyIcon, link, plainButton } from './components/ui'

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
const page = 'min-h-full w-full min-w-0 overflow-x-clip bg-background text-foreground'
const activeChip = 'inline-flex min-h-8 cursor-pointer items-center gap-ui-1 rounded-full border-0 bg-secondary py-0 pr-ui-2 pl-ui-3 text-[length:var(--soco-type-label)]! font-semibold! text-primary max-lg:min-h-11'
const FILTER_KEYS = [...Object.keys(FILTER_GROUPS), 'range', 'min', 'max']

export default function SearchResultsPage({ request, sessionId, onOpenProfile, onOpenPost }: SearchResultsPageProps) {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
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
    const desktop = window.matchMedia('(min-width: 1024px)')
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
  // Leave the app only when there is no earlier in-app entry to return to.
  const goBack = () => {
    if (window.history.state?.idx > 0) navigate(-1)
    else navigate('/discover', { replace: true })
  }
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
      <section className={page} aria-label="Tìm kiếm">
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
    <Button size="sm" variant={saved ? 'secondary' : 'outline'} className={cn('max-lg:h-11', saved && 'text-primary')} aria-pressed={saved}
      onClick={() => updateHistory(sessionId, current => toggleSaved(current, query, Date.now()))}>
      {saved ? <BellRing size={16} aria-hidden="true" /> : <Bell size={16} aria-hidden="true" />}
      {saved ? 'Đã lưu tìm kiếm' : 'Lưu tìm kiếm'}
    </Button>
  )

  return (
    <section className={page} aria-label="Kết quả tìm kiếm">
      <div className="grid min-h-full grid-cols-[340px_minmax(0,1fr)] max-xl:grid-cols-[300px_minmax(0,1fr)] max-lg:block">
        <aside className="flex min-w-0 flex-col gap-ui-3 border-r border-border bg-card p-ui-4 max-lg:hidden" aria-label="Tìm kiếm và bộ lọc">
          <h1 className="sr-only">Kết quả tìm kiếm</h1>
          <SearchForm key={'desktop' + query + type} initialQuery={query} placeholder={PLACEHOLDER[type]} onSubmit={submit} />
          <SearchFilterPanel {...panelProps} />
        </aside>

        <div className="mx-auto flex w-full max-w-180 min-w-0 flex-col gap-ui-3 px-ui-4 pt-ui-5 pb-ui-8 max-lg:max-w-none max-lg:gap-ui-2 max-lg:px-ui-3 max-lg:pt-0 max-lg:pb-ui-6">
          <div className="sticky top-0 z-2 -mx-ui-3 hidden grid-cols-[minmax(0,1fr)] gap-ui-2 border-b border-border bg-card px-ui-3 py-ui-2 max-lg:grid">
            <div className="flex items-center gap-ui-2">
              <button type="button" aria-label="Quay lại" className={cn(plainButton, 'inline-grid size-11 shrink-0 place-items-center rounded-full hover:bg-muted')}
                onClick={goBack}><ChevronLeft size={22} aria-hidden="true" /></button>
              <SearchForm key={'mobile' + query + type} className="flex-1" initialQuery={query} placeholder={PLACEHOLDER[type]} onSubmit={submit} />
              <button type="button" className={cn(plainButton, 'relative inline-grid size-11 shrink-0 place-items-center rounded-full bg-muted')} onClick={() => setFiltersOpen(true)} aria-label={'Bộ lọc' + (activeCount ? ', ' + activeCount + ' đang bật' : '')}>
                <SlidersHorizontal size={18} aria-hidden="true" />
                {activeCount > 0 && <span className="absolute top-0.5 right-0.5 h-4.5 min-w-4.5 rounded-full bg-primary px-ui-1 text-center text-[length:var(--soco-type-caption)] leading-4.5 font-bold text-primary-foreground">{activeCount}</span>}
              </button>
            </div>
            <div className="-mx-ui-3 flex gap-ui-2 overflow-x-auto px-ui-3 [scrollbar-width:none]" role="group" aria-label="Loại kết quả">
              {SEARCH_TYPES.map(item => (
                <button key={item.key} type="button" aria-pressed={type === item.key}
                  className={cn(plainButton, 'min-h-11 shrink-0 rounded-full bg-muted px-ui-4 text-[length:var(--soco-type-label)]! font-semibold!', type === item.key && 'bg-secondary text-primary')} onClick={() => setType(item.key)}>{item.label}</button>
              ))}
            </div>
          </div>

          {query && (
            <header className="flex flex-wrap items-center justify-between gap-ui-3 max-lg:pt-ui-2">
              <h2 className="m-0 min-w-0 text-[length:var(--soco-type-page)] font-bold [overflow-wrap:anywhere] text-foreground max-lg:text-[length:var(--soco-type-section)]">Kết quả cho “{query}”</h2>
              {saveButton}
            </header>
          )}

          {activeCount > 0 && (
            <div className="flex flex-wrap items-center gap-ui-2" aria-label="Bộ lọc đang bật">
              <span className="text-[length:var(--soco-type-label)] font-semibold text-muted-foreground">Đang lọc</span>
              {chips.map(chip => (
                <button key={chip.id} type="button" className={activeChip} aria-label={'Bỏ lọc ' + chip.label} onClick={() => setFilter(chip.id, FILTER_GROUPS[chip.id].options[0].value)}>
                  {chip.label}<X size={14} aria-hidden="true" />
                </button>
              ))}
              {priceActive && (
                <button type="button" className={activeChip} aria-label="Bỏ lọc khoảng giá" onClick={() => change(next => { next.delete('min'); next.delete('max') })}>
                  Khoảng giá<X size={14} aria-hidden="true" />
                </button>
              )}
              <button type="button" className={link} onClick={resetFilters}>Xóa tất cả</button>
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
            <div className={cn(card, 'grid justify-items-center gap-ui-2 px-ui-5 py-ui-8 text-center')}>
              <span className={emptyIcon} aria-hidden="true"><Search size={24} /></span>
              <h2 className="m-0 text-[length:var(--soco-type-section)] font-bold text-foreground">Nhập từ khóa để tìm trong {SEARCH_TYPES.find(item => item.key === type)?.label.toLocaleLowerCase('vi-VN')}</h2>
              <p className="m-0 text-[length:var(--soco-type-body)] text-muted-foreground">Bộ lọc bạn chọn sẽ được giữ khi tìm kiếm.</p>
            </div>
          )}
        </div>
      </div>

      <Dialog open={filtersOpen} onOpenChange={setFiltersOpen}>
        <DialogContent className="top-auto bottom-0 left-0 w-full max-w-none max-h-[85dvh] translate-x-0 translate-y-0 gap-ui-3 rounded-b-none p-ui-4 pb-[calc(var(--soco-space-4)+env(safe-area-inset-bottom))]">
          <DialogTitle>Bộ lọc</DialogTitle>
          <DialogDescription className="sr-only">Thu hẹp kết quả tìm kiếm theo loại và tiêu chí.</DialogDescription>
          <SearchFilterPanel {...panelProps} showTypes={false} />
          <Button className="h-11 w-full" onClick={() => setFiltersOpen(false)}>
            {activeCount ? 'Áp dụng ' + activeCount + ' bộ lọc' : 'Xem kết quả'}
          </Button>
        </DialogContent>
      </Dialog>
    </section>
  )
}
