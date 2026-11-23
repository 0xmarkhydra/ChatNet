import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Check, Image as ImageIcon, Package, SearchX, UsersRound, Video } from 'lucide-react'
import UserAvatar from '../../../shared/ui/UserAvatar'
import { useScopedState } from '../../../shared/hooks/useScopedState'
import type { ApiRequest } from '../../../shared/types/api'
import type { Post } from '../../feed'
import { joinCommunity, type CommunityResult, type PersonResult, type ProductResult } from '../api/search'
import { formatPrice, type SearchType } from '../lib/searchFilters'
import type { OpenedResult } from '../lib/searchHistory'

type Remote<T> = { items: T[]; loading: boolean; error: string; retry: () => void }
type PostRemote = Remote<Post> & { hasMore: boolean; loadingMore: boolean; loadMore: () => void }

export type SearchResultsProps = {
  type: SearchType
  query: string
  people: Remote<PersonResult>
  posts: PostRemote
  communities: Remote<CommunityResult>
  products: Remote<ProductResult>
  activeFilterCount: number
  request: ApiRequest
  sessionId: string
  onType: (type: SearchType) => void
  onResetFilters: () => void
  onOpenProfile: (username: string) => void
  onOpenPost: (postId: number) => void
  onOpened: (item: OpenedResult) => void
}

const PREVIEW = { people: 3, posts: 3, communities: 3, products: 4 }
type JoinState = 'joining' | 'joined' | 'pending' | 'error'
const noJoins: Record<number, JoinState> = {}

const postTime = (value: string) => new Date(value).toLocaleDateString('vi-VN', { day: 'numeric', month: 'short', year: 'numeric' })
const snippet = (text: string, length = 220) => text.length > length ? text.slice(0, length).trimEnd() + '…' : text

function Section({ title, count, onSeeAll, children }: { title: string; count?: number; onSeeAll?: () => void; children: ReactNode }) {
  return (
    <section className="srch-card" aria-label={title}>
      <header className="srch-card-head">
        <h2>{title}</h2>
        {onSeeAll && <button type="button" className="srch-link" onClick={onSeeAll}>Xem tất cả{count ? ' (' + count + ')' : ''}</button>}
      </header>
      {children}
    </section>
  )
}

function Status<T>({ source, label, hasMore = false }: { source: Remote<T>; label: string; hasMore?: boolean }) {
  if (source.loading) return <div className="srch-skeleton" aria-hidden="true"><span /><span /><span /></div>
  if (source.error) return <div className="srch-inline" role="alert">{source.error} <button type="button" className="srch-link" onClick={source.retry}>Thử lại</button></div>
  if (source.items.length === 0 && hasMore) return <p className="srch-inline">Chưa thấy {label} khớp bộ lọc trong các kết quả đã tải.</p>
  if (source.items.length === 0) return <p className="srch-inline">Không có {label} phù hợp.</p>
  return null
}

export default function SearchResults(props: SearchResultsProps) {
  const { type, query, people, posts, communities, products, request } = props
  const [joins, setJoins] = useScopedState<Record<number, JoinState>>(props.sessionId, noJoins)
  const all = type === 'all'
  const show = (key: Exclude<SearchType, 'all'>) => all || type === key
  const limit = <T,>(items: T[], key: keyof typeof PREVIEW) => all ? items.slice(0, PREVIEW[key]) : items
  const sources: { loading: boolean; error: string; items: unknown[] }[] = []
  if (show('people')) sources.push(people)
  if (show('posts')) sources.push(posts)
  if (show('communities')) sources.push(communities)
  if (show('products')) sources.push(products)
  const settled = sources.every(source => !source.loading)
  const noResults = settled && !(show('posts') && posts.hasMore) && sources.every(source => !source.error && source.items.length === 0)

  async function join(community: CommunityResult) {
    if (joins[community.id] && joins[community.id] !== 'error') return
    setJoins(current => ({ ...current, [community.id]: 'joining' }))
    try {
      const response = await joinCommunity(request, community.id)
      const body = response.ok ? await response.json() as { status?: string } : null
      const state: JoinState = !body ? 'error' : body.status === 'pending' ? 'pending' : 'joined'
      setJoins(current => ({ ...current, [community.id]: state }))
    } catch {
      setJoins(current => ({ ...current, [community.id]: 'error' }))
    }
  }

  if (noResults) {
    return (
      <section className="srch-card srch-empty" aria-live="polite">
        <span className="srch-empty-icon" aria-hidden="true"><SearchX size={28} /></span>
        <h2>Không tìm thấy kết quả cho “{query}”</h2>
        <p>Hãy kiểm tra chính tả, thử từ khóa ngắn hơn hoặc tìm ở loại kết quả khác.</p>
        {props.activeFilterCount > 0 && (
          <div className="srch-empty-filter">
            <span>{props.activeFilterCount} bộ lọc đang thu hẹp kết quả</span>
            <button type="button" className="srch-btn" onClick={props.onResetFilters}>Bỏ bộ lọc</button>
          </div>
        )}
        {!all && <button type="button" className="srch-btn ghost" onClick={() => props.onType('all')}>Tìm trong tất cả</button>}
      </section>
    )
  }

  return (
    <div className="srch-results">
      {show('people') && (!all || people.items.length > 0 || people.loading || Boolean(people.error)) && (
        <Section title="Mọi người" count={people.items.length} onSeeAll={all && people.items.length > PREVIEW.people ? () => props.onType('people') : undefined}>
          <Status source={people} label="người dùng" />
          <ul className="srch-list">
            {limit(people.items, 'people').map(person => (
              <li key={person.id} className="srch-row">
                <UserAvatar name={person.displayName || person.username} username={person.username} className="avatar srch-avatar" online={person.online} />
                <div className="srch-row-copy">
                  <strong>{person.displayName || person.username}</strong>
                  <small>@{person.username}{person.online ? ' · Đang hoạt động' : ''}</small>
                </div>
                <button type="button" className="srch-btn soft" onClick={() => {
                  props.onOpened({ kind: 'person', username: person.username, title: person.displayName || person.username })
                  props.onOpenProfile(person.username)
                }}>Xem trang</button>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {show('posts') && (!all || posts.items.length > 0 || posts.hasMore || posts.loading || Boolean(posts.error)) && (
        <Section title="Bài viết" onSeeAll={all && (posts.items.length > PREVIEW.posts || posts.hasMore) ? () => props.onType('posts') : undefined}>
          <Status source={posts} label="bài viết" hasMore={posts.hasMore} />
          <ul className="srch-posts">
            {limit(posts.items, 'posts').map(post => {
              const author = post.authorDisplayName || post.author
              const image = post.attachments?.some(item => item.kind === 'image')
              const video = post.attachments?.some(item => item.kind === 'video')
              return (
                <li key={post.id} className="srch-post">
                  <div className="srch-post-head">
                    <UserAvatar name={author} username={post.author} className="avatar srch-avatar sm" />
                    <div className="srch-row-copy">
                      <button type="button" className="srch-name" onClick={() => props.onOpenProfile(post.author)}>{author}</button>
                      <small>{postTime(post.createdAt)}</small>
                    </div>
                  </div>
                  <p className="srch-post-text">{snippet(post.content) || 'Bài viết không có nội dung chữ.'}</p>
                  <div className="srch-post-foot">
                    {image && <span className="srch-tag"><ImageIcon size={14} aria-hidden="true" /> Ảnh</span>}
                    {video && <span className="srch-tag"><Video size={14} aria-hidden="true" /> Video</span>}
                    <span className="srch-meta">{post.likes} lượt thích · {post.comments.length} bình luận</span>
                    <button type="button" className="srch-link" onClick={() => {
                      props.onOpened({ kind: 'post', id: post.id, title: author, subtitle: snippet(post.content, 80) })
                      props.onOpenPost(post.id)
                    }}>Xem bài viết <ArrowRight size={14} aria-hidden="true" /></button>
                  </div>
                </li>
              )
            })}
          </ul>
          {!all && posts.hasMore && (
            <button type="button" className="srch-btn ghost wide" onClick={posts.loadMore} disabled={posts.loadingMore}>
              {posts.loadingMore ? 'Đang tải…' : 'Tải thêm bài viết'}
            </button>
          )}
        </Section>
      )}

      {show('communities') && (!all || communities.items.length > 0 || communities.loading || Boolean(communities.error)) && (
        <Section title="Cộng đồng" count={communities.items.length}
          onSeeAll={all && communities.items.length > PREVIEW.communities ? () => props.onType('communities') : undefined}>
          <Status source={communities} label="cộng đồng" />
          <ul className="srch-list">
            {limit(communities.items, 'communities').map(community => {
              const state = joins[community.id]
              return (
                <li key={community.id} className="srch-row">
                  <span className="srch-group-icon" aria-hidden="true"><UsersRound size={22} /></span>
                  <div className="srch-row-copy">
                    <strong>{community.name}</strong>
                    <small>{[community.topic, community.memberCount.toLocaleString('vi-VN') + ' thành viên'].filter(Boolean).join(' · ')}</small>
                    {community.description && <small className="srch-clamp">{community.description}</small>}
                  </div>
                  <button type="button" className={state === 'joined' || state === 'pending' ? 'srch-btn soft' : 'srch-btn'} disabled={state === 'joining' || state === 'joined' || state === 'pending'}
                    onClick={() => {
                      props.onOpened({ kind: 'community', id: community.id, title: community.name, subtitle: community.topic })
                      void join(community)
                    }}>
                    {state === 'joined' ? <><Check size={15} aria-hidden="true" /> Đã tham gia</> : state === 'pending' ? 'Đã gửi yêu cầu' : state === 'joining' ? 'Đang tham gia…' : state === 'error' ? 'Thử lại' : 'Tham gia'}
                  </button>
                </li>
              )
            })}
          </ul>
          {Object.values(joins).includes('error') && <p className="srch-inline" role="alert">Không thể tham gia cộng đồng. Hãy thử lại.</p>}
        </Section>
      )}

      {show('products') && (!all || products.items.length > 0 || products.loading || Boolean(products.error)) && (
        <Section title="Sản phẩm" count={products.items.length} onSeeAll={all && products.items.length > PREVIEW.products ? () => props.onType('products') : undefined}>
          <Status source={products} label="sản phẩm" />
          <ul className="srch-products">
            {limit(products.items, 'products').map(product => (
              <li key={product.id}>
                <Link className="srch-product" to="/marketplace">
                  <span className="srch-product-thumb" aria-hidden="true"><Package size={26} /></span>
                  <strong className="srch-price-tag">{formatPrice(product.priceAmount, product.priceUnit)}</strong>
                  <span className="srch-product-title">{product.title}</span>
                  <small>{product.stock > 0 ? 'Còn ' + product.stock : 'Hết hàng'}</small>
                </Link>
              </li>
            ))}
          </ul>
          {!all && <p className="srch-inline">Kết quả được lấy từ các sản phẩm mới đăng gần đây trên Marketplace.</p>}
        </Section>
      )}
    </div>
  )
}
