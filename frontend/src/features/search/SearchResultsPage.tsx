import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Search, Plus, ArrowRight, UsersRound, FileText, Package, SlidersHorizontal, RotateCcw, ChevronDown, Eye, Sparkles } from 'lucide-react'
import { usePostSearch } from '../feed/hooks/usePostSearch'
import type { ApiRequest } from '../../shared/types/api'
import './SearchResultsPage.css'

type Category = 'all' | 'people' | 'posts' | 'communities' | 'products'
type Sort = 'relevant' | 'newest'
type Range = 'any' | '30d'
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
  const search = usePostSearch({ query, scope: 'all', enabled: Boolean(query) && !preview && (category === 'all' || category === 'posts'), sessionId, request })

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
  const [openedAt] = useState(() => Date.now())
  const timeLimit = range === '30d' ? openedAt - 30 * 24 * 3600 * 1000 : 0
  const visiblePosts = search.posts.filter(post => (range === 'any' || new Date(post.createdAt).getTime() >= timeLimit) &&
    post.visibility === 'public')
  const orderedPosts = sort === 'newest'
    ? [...visiblePosts].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    : visiblePosts
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
          <label className="s08-search-sort"><SlidersHorizontal size={18} aria-hidden="true"/>
            <span className="sr-only">Sắp xếp kết quả</span>
            <select aria-label="Sắp xếp kết quả" value={sort} onChange={event => updateParam('sort', event.target.value, 'relevant')}>
              <option value="relevant">Liên quan</option><option value="newest">Mới nhất</option>
            </select><ChevronDown size={18} aria-hidden="true"/>
          </label>
        </div>
      </div>

      <div className="s08-search-layout">
        <div className="s08-search-results">
          <header className="s08-results-heading">
            <h2>Kết quả phù hợp</h2>
            <p>{query ? <>Các kết quả liên quan đến “{query}”</> : 'Nhập từ khóa để bắt đầu tìm kiếm'}</p>
            {preview && <span className="s08-preview-note"><Eye size={14}/> Dữ liệu minh họa để kiểm tra giao diện</span>}
          </header>
          {!query ? <div className="s08-search-empty"><Search size={32}/><strong>Khám phá nội dung trên SocCo</strong><p>Nhập từ khóa phía trên để bắt đầu tìm kiếm.</p></div> : (
            <>
              {show('people') && <section className="s08-result-group" aria-labelledby="s08-people-heading">
                <h3 id="s08-people-heading">Mọi người</h3>
                {sample ? samplePeople.map(person => (
                  <article className="s08-result-row" key={person.name}>
                    <div className="s08-avatar s08-person-avatar">{person.avatar}</div>
                    <div className="s08-result-copy"><strong>{person.name}</strong><small>{person.description}</small></div>
                    <button type="button" className="s08-result-action" disabled title="Thao tác minh họa, chưa kết nối API"><Plus size={17}/> Kết bạn</button>
                  </article>
                )) : <div className="s08-unavailable">Tìm người dùng trên toàn hệ thống sẽ được kết nối khi API tìm kiếm khả dụng.</div>}
              </section>}
              {show('communities') && <section className="s08-result-group" aria-labelledby="s08-community-heading">
                <h3 id="s08-community-heading">Cộng đồng</h3>
                {sample ? sampleCommunities.map(community => (
                  <article className="s08-result-row" key={community.name}>
                    <div className="s08-avatar s08-community-avatar"><UsersRound size={23}/></div>
                    <div className="s08-result-copy"><strong>{community.name}</strong><small>{community.description}</small></div>
                    <button type="button" className="s08-result-action" disabled title="Thao tác minh họa, chưa kết nối API"><Plus size={17}/> Tham gia</button>
                  </article>
                )) : <div className="s08-unavailable">Kết quả cộng đồng công khai sẽ xuất hiện khi API tìm cộng đồng được tích hợp.</div>}
              </section>}
              {show('posts') && <section className="s08-result-group" aria-labelledby="s08-posts-heading">
                <h3 id="s08-posts-heading">Bài viết</h3>
                {sample ? samplePosts.map(post => (
                  <article className="s08-result-row" key={post.author}>
                    <div className="s08-avatar s08-post-avatar"><FileText size={22}/></div>
                    <div className="s08-result-copy"><strong>{post.author}</strong><small>{post.content}</small></div>
                    <button type="button" className="s08-result-action" disabled title="Bài viết minh họa, chưa có ID thật"><ArrowRight size={18}/> Xem bài viết</button>
                  </article>
                )) : <>
                  {search.loading && <p className="s08-inline-status" role="status">Đang tìm bài viết…</p>}
                  {search.error && <div className="s08-inline-status" role="alert">{search.error} <button type="button" onClick={search.retry}>Thử lại</button></div>}
                  {!search.loading && !search.error && orderedPosts.length === 0 && <p className="s08-inline-status">Không có bài viết công khai phù hợp.</p>}
                  {orderedPosts.map(post => <article className="s08-result-row" key={post.id}>
                    <div className="s08-avatar s08-post-avatar"><FileText size={22}/></div>
                    <div className="s08-result-copy">
                      <button type="button" className="s08-inline-link" onClick={() => onOpenProfile(post.author)}>{post.authorDisplayName || post.author}</button>
                      <small>{post.content.slice(0, 150)}{post.content.length > 150 ? '…' : ''}</small>
                    </div>
                    <button type="button" className="s08-result-action" onClick={() => onOpenPost(post.id)}><ArrowRight size={18}/> Xem bài viết</button>
                  </article>)}
                  {search.hasMore && <button type="button" className="s08-more" onClick={() => void search.loadMore()} disabled={search.loadingMore}>
                    {search.loadingMore ? 'Đang tải…' : 'Tải thêm bài viết'}
                  </button>}
                </>}
              </section>}
              {show('products') && <section className="s08-result-group" aria-labelledby="s08-products-heading">
                <h3 id="s08-products-heading">Sản phẩm</h3>
                <div className="s08-unavailable"><Package size={16}/> Danh mục sản phẩm sẽ được kết nối với tìm kiếm toàn cục ở giai đoạn API.</div>
                <Link className="s08-explore-link" to="/marketplace">Khám phá Marketplace <ArrowRight size={15}/></Link>
              </section>}
            </>
          )}
        </div>

        <aside id="s08-filters" className={filterOpen ? 's08-filter-panel open' : 's08-filter-panel'} aria-label="Bộ lọc kết quả">
          <div className="s08-filter-header"><h2>Lọc kết quả</h2><Sparkles size={19} aria-hidden="true"/></div>
          <fieldset className="s08-filter-group">
            <legend>Loại nội dung</legend>
            {([{ key: 'posts', label: 'Bài viết công khai' }, { key: 'people', label: 'Người dùng' },
              { key: 'communities', label: 'Nhóm & cộng đồng' }, { key: 'products', label: 'Sản phẩm' }] as const).map(item => (
              <label key={item.key} className="s08-filter-checkbox">
                <input type="checkbox" checked={selectedKinds[item.key]} onChange={event =>
                  setSelectedKinds(current => ({ ...current, [item.key]: event.target.checked }))}/>
                <span>{item.label}</span>
              </label>
            ))}
          </fieldset>
          <fieldset className="s08-filter-group">
            <legend>Thời gian</legend>
            <div className="s08-filter-segments">
              <button className={range === 'any' ? 'active' : ''} type="button" onClick={() => updateParam('range', 'any', 'any')}>Bất kỳ</button>
              <button className={range === '30d' ? 'active' : ''} type="button" onClick={() => updateParam('range', '30d', 'any')}>30 ngày qua</button>
            </div>
          </fieldset>
          <fieldset className="s08-filter-group">
            <legend>Sắp xếp</legend>
            <div className="s08-filter-segments">
              <button className={sort === 'relevant' ? 'active' : ''} type="button" onClick={() => updateParam('sort', 'relevant', 'relevant')}>Liên quan</button>
              <button className={sort === 'newest' ? 'active' : ''} type="button" onClick={() => updateParam('sort', 'newest', 'relevant')}>Mới nhất</button>
            </div>
          </fieldset>
          <button className="s08-filter-reset" type="button" onClick={reset}><RotateCcw size={17}/> Đặt lại bộ lọc</button>
          {preview && <p className="s08-filter-preview">Chế độ xem trước: các nút thao tác trên dữ liệu mẫu đã được vô hiệu hóa.</p>}
        </aside>
      </div>
    </section>
  )
}
