import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Search, ArrowRight, UsersRound, FileText, Package, SlidersHorizontal, RotateCcw, ChevronDown, Eye, Sparkles } from 'lucide-react'
import type { ApiRequest } from '../../shared/types/api'
import type { Post } from '../feed'
import { useSearchResults, type SearchResults } from './hooks/useSearchResults'
import './SearchResultsPage.css'

type Category = 'all' | 'people' | 'posts' | 'communities' | 'products'
type Sort = 'relevant' | 'newest'
type Range = 'any' | '30d'
type Person = { id: number; username: string; displayName: string; online: boolean }
type Community = { id: number; name: string; description: string; topic: string; visibility: 'public' | 'private'; memberCount: number }
type Product = { id: number; title: string; description: string; priceAmount: number; priceUnit: string; status: 'draft' | 'published' | 'archived' }
type SearchState<T extends { id: number }> = SearchResults<T>

const categories: { key: Category; label: string }[] = [
  { key: 'all', label: 'Tất cả' }, { key: 'people', label: 'Mọi người' },
  { key: 'posts', label: 'Bài viết' }, { key: 'communities', label: 'Cộng đồng' },
  { key: 'products', label: 'Sản phẩm' },
]
const samplePeople = [
  { name: 'David Chen', description: 'Lập trình viên · 3 bạn chung', avatar: 'DC' },
  { name: 'Sakura', description: 'Yêu công nghệ · 4 bạn chung', avatar: 'SA' },
]
const sampleCommunities = [{ name: 'AI Builders Vietnam', description: '1,8K thành viên · Cộng đồng công khai' }]
const samplePosts = [{ author: 'Minh Anh', content: 'Hướng dẫn dùng AI trong công việc hằng ngày…' }]

function parseCategory(value: string | null): Category {
  return categories.some(item => item.key === value) ? value as Category : 'all'
}
function parseSort(value: string | null): Sort { return value === 'newest' ? 'newest' : 'relevant' }
function parseRange(value: string | null): Range { return value === '30d' ? '30d' : 'any' }

function SearchFeedback<T extends { id: number }>({ state, empty }: { state: SearchState<T>; empty: string }) {
  return <>
    {state.loading && <p className="s08-inline-status" role="status">Đang tìm kiếm…</p>}
    {state.error && <div className="s08-inline-status" role="alert">{state.error} <button type="button" onClick={state.retry}>Thử lại</button></div>}
    {!state.loading && !state.error && state.items.length === 0 && <p className="s08-inline-status">{empty}</p>}
  </>
}

function SearchMore<T extends { id: number }>({ state }: { state: SearchState<T> }) {
  return state.hasMore && !state.error ? <button type="button" className="s08-more" onClick={() => void state.loadMore()} disabled={state.loadingMore}>
    {state.loadingMore ? 'Đang tải…' : 'Tải thêm'}
  </button> : null
}

export type SearchResultsPageProps = {
  request: ApiRequest
  sessionId: string
  onOpenProfile: (username: string) => void
  onOpenPost: (postId: number) => void
}

export default function SearchResultsPage({ request, sessionId, onOpenProfile, onOpenPost }: SearchResultsPageProps) {
  const [params, setParams] = useSearchParams()
  const query = params.get('q')?.trim().slice(0, 120) ?? ''
  const category = parseCategory(params.get('type'))
  const sort = parseSort(params.get('sort'))
  const range = parseRange(params.get('range'))
  const preview = params.get('preview') === '1'
  const [draftState, setDraftState] = useState({ query, draft: query })
  const draft = draftState.query === query ? draftState.draft : query
  const setDraft = (value: string) => setDraftState({ query, draft: value })
  const [filterOpen, setFilterOpen] = useState(false)
  const [selectedKinds, setSelectedKinds] = useState({ posts: true, people: true, communities: true, products: true })
  const [openedAt] = useState(() => Date.now())
  const since = range === '30d' ? new Date(openedAt - 30 * 24 * 60 * 60 * 1000).toISOString() : undefined
  const sortBy = sort === 'newest' ? 'newest' : 'relevance'
  const enabled = Boolean(query) && !preview
  const searches = {
    people: useSearchResults<Person>({ endpoint: '/api/users/search', query, sort: sortBy, since, enabled: enabled && (category === 'all' || category === 'people') && selectedKinds.people, sessionId, request }),
    posts: useSearchResults<Post>({ endpoint: '/api/posts', query, sort: sortBy, since, enabled: enabled && (category === 'all' || category === 'posts') && selectedKinds.posts, sessionId, request }),
    communities: useSearchResults<Community>({ endpoint: '/api/groups/public', query, sort: sortBy, since, enabled: enabled && (category === 'all' || category === 'communities') && selectedKinds.communities, sessionId, request }),
    products: useSearchResults<Product>({ endpoint: '/api/marketplace/products', query, sort: sortBy, since, enabled: enabled && (category === 'all' || category === 'products') && selectedKinds.products, sessionId, request }),
  }

  const setQuery = (value: string) => {
    const next = new URLSearchParams(params)
    if (value.trim()) next.set('q', value.trim().slice(0, 120))
    else next.delete('q')
    setParams(next)
  }
  const updateParam = (key: string, value: string, defaultValue: string) => {
    const next = new URLSearchParams(params)
    if (value === defaultValue) next.delete(key)
    else next.set(key, value)
    setParams(next)
  }
  const reset = () => {
    const next = new URLSearchParams()
    if (query) next.set('q', query)
    if (preview) next.set('preview', '1')
    setParams(next)
    setSelectedKinds({ posts: true, people: true, communities: true, products: true })
  }
  const submit = (event: FormEvent) => { event.preventDefault(); setQuery(draft) }
  const show = (key: Exclude<Category, 'all'>) => (category === 'all' || category === key) && selectedKinds[key]
  const sample = preview && Boolean(query)
  const activeFilterCount = Object.values(selectedKinds).filter(value => !value).length + Number(range !== 'any') + Number(sort !== 'relevant')

  return (
    <section className="s08-search-page" aria-label="Kết quả tìm kiếm">
      <form className="s08-search-form" onSubmit={submit} role="search">
        <Search size={22} aria-hidden="true" />
        <input aria-label="Tìm kiếm trên SocCo" value={draft} onChange={event => setDraft(event.target.value)}
          maxLength={120} placeholder="Tìm người, bài viết, cộng đồng và sản phẩm…" />
        <button className="s08-search-submit" type="submit"><Search size={18} aria-hidden="true" /> Tìm kiếm</button>
      </form>

      <div className="s08-search-controls">
        <nav className="s08-search-tabs" aria-label="Loại kết quả tìm kiếm">
          {categories.map(item => (
            <button key={item.key} type="button" className={category === item.key ? 'selected' : ''}
              aria-current={category === item.key ? 'page' : undefined}
              onClick={() => updateParam('type', item.key, 'all')}>{item.label}</button>
          ))}
        </nav>
        <div className="s08-search-control-actions">
          <button type="button" className="s08-filter-toggle" onClick={() => setFilterOpen(value => !value)}
            aria-expanded={filterOpen} aria-controls="s08-filters"><SlidersHorizontal size={18} />
            Bộ lọc {activeFilterCount ? '(' + activeFilterCount + ')' : ''}</button>
          <label className="s08-search-sort"><SlidersHorizontal size={18} aria-hidden="true" />
            <span className="sr-only">Sắp xếp kết quả</span>
            <select aria-label="Sắp xếp kết quả" value={sort} onChange={event => updateParam('sort', event.target.value, 'relevant')}>
              <option value="relevant">Liên quan</option><option value="newest">Mới nhất</option>
            </select><ChevronDown size={18} aria-hidden="true" />
          </label>
        </div>
      </div>

      <div className="s08-search-layout">
        <div className="s08-search-results">
          <header className="s08-results-heading">
            <h2>Kết quả phù hợp</h2>
            <p>{query ? <>Các kết quả liên quan đến “{query}”</> : 'Nhập từ khóa để bắt đầu tìm kiếm'}</p>
            {preview && <span className="s08-preview-note"><Eye size={14} /> Dữ liệu minh họa để kiểm tra giao diện</span>}
          </header>
          {!query ? <div className="s08-search-empty"><Search size={32} /><strong>Khám phá nội dung trên SocCo</strong><p>Nhập từ khóa phía trên để bắt đầu tìm kiếm.</p></div> : (
            <>
              {show('people') && <section className="s08-result-group" aria-labelledby="s08-people-heading" aria-busy={searches.people.loading || searches.people.loadingMore}>
                <h3 id="s08-people-heading">Mọi người</h3>
                {sample ? samplePeople.map(person => (
                  <article className="s08-result-row" key={person.name}>
                    <div className="s08-avatar s08-person-avatar" aria-hidden="true">{person.avatar}</div>
                    <div className="s08-result-copy"><strong>{person.name}</strong><small>{person.description}</small></div>
                  </article>
                )) : <>
                  <SearchFeedback state={searches.people} empty="Không tìm thấy người phù hợp." />
                  {searches.people.items.map(person => <article className="s08-result-row" key={person.id}>
                    <div className="s08-avatar s08-person-avatar" aria-hidden="true">{(person.displayName || person.username).slice(0, 1).toUpperCase()}</div>
                    <div className="s08-result-copy">
                      <button type="button" className="s08-inline-link" onClick={() => onOpenProfile(person.username)}>{person.displayName || person.username}</button>
                      <small>@{person.username}</small>
                    </div>
                  </article>)}
                  <SearchMore state={searches.people} />
                </>}
              </section>}
              {show('communities') && <section className="s08-result-group" aria-labelledby="s08-community-heading" aria-busy={searches.communities.loading || searches.communities.loadingMore}>
                <h3 id="s08-community-heading">Cộng đồng</h3>
                {sample ? sampleCommunities.map(community => (
                  <article className="s08-result-row" key={community.name}>
                    <div className="s08-avatar s08-community-avatar" aria-hidden="true"><UsersRound size={23} /></div>
                    <div className="s08-result-copy"><strong>{community.name}</strong><small>{community.description}</small></div>
                  </article>
                )) : <>
                  <SearchFeedback state={searches.communities} empty="Không tìm thấy cộng đồng công khai." />
                  {searches.communities.items.filter(community => community.visibility === 'public').map(community => (
                    <article className="s08-result-row" key={community.id}>
                      <div className="s08-avatar s08-community-avatar" aria-hidden="true"><UsersRound size={23} /></div>
                      <div className="s08-result-copy"><strong>{community.name}</strong>
                        <small>{community.description || community.topic} · {community.memberCount.toLocaleString('vi-VN')} thành viên</small></div>
                    </article>
                  ))}
                  <SearchMore state={searches.communities} />
                </>}
              </section>}
              {show('posts') && <section className="s08-result-group" aria-labelledby="s08-posts-heading" aria-busy={searches.posts.loading || searches.posts.loadingMore}>
                <h3 id="s08-posts-heading">Bài viết</h3>
                {sample ? samplePosts.map(post => (
                  <article className="s08-result-row" key={post.author}>
                    <div className="s08-avatar s08-post-avatar" aria-hidden="true"><FileText size={22} /></div>
                    <div className="s08-result-copy"><strong>{post.author}</strong><small>{post.content}</small></div>
                  </article>
                )) : <>
                  <SearchFeedback state={searches.posts} empty="Không có bài viết công khai phù hợp." />
                  {searches.posts.items.filter(post => post.visibility === 'public').map(post => <article className="s08-result-row" key={post.id}>
                    <div className="s08-avatar s08-post-avatar" aria-hidden="true"><FileText size={22} /></div>
                    <div className="s08-result-copy">
                      <button type="button" className="s08-inline-link" onClick={() => onOpenProfile(post.author)}>{post.authorDisplayName || post.author}</button>
                      <small>{post.content.slice(0, 150)}{post.content.length > 150 ? '…' : ''}</small>
                    </div>
                    <button type="button" className="s08-result-action" onClick={() => onOpenPost(post.id)}><ArrowRight size={18} /> Xem bài viết</button>
                  </article>)}
                  <SearchMore state={searches.posts} />
                </>}
              </section>}
              {show('products') && <section className="s08-result-group" aria-labelledby="s08-products-heading" aria-busy={searches.products.loading || searches.products.loadingMore}>
                <h3 id="s08-products-heading">Sản phẩm</h3>
                {sample ? <div className="s08-unavailable"><Package size={16} /> Dữ liệu sản phẩm minh họa chưa có.</div> : <>
                  <SearchFeedback state={searches.products} empty="Không tìm thấy sản phẩm đã xuất bản." />
                  {searches.products.items.filter(product => product.status === 'published').map(product => <article className="s08-result-row" key={product.id}>
                    <div className="s08-avatar s08-product-avatar" aria-hidden="true"><Package size={22} /></div>
                    <div className="s08-result-copy"><strong>{product.title}</strong>
                      <small>{product.description} · {product.priceAmount.toLocaleString('vi-VN')} {product.priceUnit}</small></div>
                    <Link className="s08-result-action" to="/marketplace">Xem Marketplace <ArrowRight size={17} /></Link>
                  </article>)}
                  <SearchMore state={searches.products} />
                </>}
              </section>}
            </>
          )}
        </div>

        <aside id="s08-filters" className={filterOpen ? 's08-filter-panel open' : 's08-filter-panel'} aria-label="Bộ lọc kết quả">
          <div className="s08-filter-header"><h2>Lọc kết quả</h2><Sparkles size={19} aria-hidden="true" /></div>
          <fieldset className="s08-filter-group">
            <legend>Loại nội dung</legend>
            {([{ key: 'posts', label: 'Bài viết công khai' }, { key: 'people', label: 'Người dùng' },
              { key: 'communities', label: 'Nhóm & cộng đồng' }, { key: 'products', label: 'Sản phẩm' }] as const).map(item => (
              <label key={item.key} className="s08-filter-checkbox">
                <input type="checkbox" checked={selectedKinds[item.key]} onChange={event =>
                  setSelectedKinds(current => ({ ...current, [item.key]: event.target.checked }))} />
                <span>{item.label}</span>
              </label>
            ))}
          </fieldset>
          <fieldset className="s08-filter-group">
            <legend>Thời gian</legend>
            <div className="s08-filter-segments">
              <button className={range === 'any' ? 'active' : ''} type="button" aria-pressed={range === 'any'} onClick={() => updateParam('range', 'any', 'any')}>Bất kỳ</button>
              <button className={range === '30d' ? 'active' : ''} type="button" aria-pressed={range === '30d'} onClick={() => updateParam('range', '30d', 'any')}>30 ngày qua</button>
            </div>
          </fieldset>
          <fieldset className="s08-filter-group">
            <legend>Sắp xếp</legend>
            <div className="s08-filter-segments">
              <button className={sort === 'relevant' ? 'active' : ''} type="button" aria-pressed={sort === 'relevant'} onClick={() => updateParam('sort', 'relevant', 'relevant')}>Liên quan</button>
              <button className={sort === 'newest' ? 'active' : ''} type="button" aria-pressed={sort === 'newest'} onClick={() => updateParam('sort', 'newest', 'relevant')}>Mới nhất</button>
            </div>
          </fieldset>
          <button className="s08-filter-reset" type="button" onClick={reset}><RotateCcw size={17} /> Đặt lại bộ lọc</button>
          {preview && <p className="s08-filter-preview">Chế độ xem trước: các nút thao tác trên dữ liệu mẫu đã được vô hiệu hóa.</p>}
        </aside>
      </div>
    </section>
  )
}
