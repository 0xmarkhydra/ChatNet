import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Check, Package, SearchX, UsersRound } from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/ui/button'
import { Skeleton } from '@/shared/ui/skeleton'
import UserAvatar from '../../../shared/ui/UserAvatar'
import { useScopedState } from '../../../shared/hooks/useScopedState'
import type { ApiRequest } from '../../../shared/types/api'
import type { Post } from '../../feed'
import { joinCommunity, type CommunityResult, type PersonResult, type ProductResult } from '../api/search'
import { formatPrice, type SearchType } from '../lib/searchFilters'
import type { OpenedResult } from '../lib/searchHistory'
import { avatar, card, cardHead, cardTitle, clamp2, emptyIcon, iconTile, inline, link, plainButton, rowCopy, rowMeta, rowTitle, touchButton } from './ui'

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
  /** Posts are drawn by the feed card so they behave like they do in the feed. */
  renderPosts: (posts: Post[], onOpen: (postId: number) => void) => ReactNode
  onOpened: (item: OpenedResult) => void
  /** A past search of the user's that matches the query without accents or case, offered as a correction. */
  suggestion?: string
  /** The user's other recent searches, offered when nothing matches. */
  recentQueries: string[]
  onSearch: (query: string) => void
  /** Shown under the empty state, e.g. discovery suggestions. */
  below?: ReactNode
}

const row = 'flex items-center gap-ui-3 py-ui-2 [&+&]:border-t [&+&]:border-border max-sm:flex-wrap'
const rowAction = 'max-lg:h-11 max-sm:ml-15'


const PREVIEW = { people: 3, posts: 3, communities: 3, products: 4 }
type JoinState = 'joining' | 'joined' | 'pending' | 'error'
const noJoins: Record<number, JoinState> = {}

const snippet = (text: string, length = 220) => text.length > length ? text.slice(0, length).trimEnd() + '…' : text

function Section({ title, count, onSeeAll, bare, children }: { title: string; count?: number; onSeeAll?: () => void; bare?: boolean; children: ReactNode }) {
  return (
    <section className={bare ? 'grid gap-ui-3' : card} aria-label={title}>
      <header className={cardHead}>
        <h2 className={cardTitle}>{title}</h2>
        {onSeeAll && <button type="button" className={link} onClick={onSeeAll}>Xem tất cả{count ? ' (' + count + ')' : ''}</button>}
      </header>
      {children}
    </section>
  )
}

function Status<T>({ source, label, hasMore = false }: { source: Remote<T>; label: string; hasMore?: boolean }) {
  if (source.loading) return <div className="grid gap-ui-2 py-ui-1" aria-hidden="true">{[0, 1, 2].map(index => <Skeleton key={index} className="h-11" />)}</div>
  if (source.error) return <div className={inline} role="alert">{source.error} <button type="button" className={link} onClick={source.retry}>Thử lại</button></div>
  if (source.items.length === 0 && hasMore) return <p className={inline}>Chưa thấy {label} khớp bộ lọc trong các kết quả đã tải.</p>
  if (source.items.length === 0) return <p className={inline}>Không có {label} phù hợp.</p>
  return null
}

export default function SearchResults(props: SearchResultsProps) {
  const { type, query, people, posts, communities, products, request } = props
  const [joins, setJoins] = useScopedState<Record<number, JoinState>>(props.sessionId, noJoins)
  const all = type === 'all'
  const show = (key: Exclude<SearchType, 'all'>) => all || type === key
  const openPost = (id: number) => {
    const post = posts.items.find(item => item.id === id)
    if (post) props.onOpened({ kind: 'post', id, title: post.authorDisplayName || post.author, subtitle: snippet(post.content, 80) })
    props.onOpenPost(id)
  }
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
      <div className="flex flex-col gap-ui-3">
        <section className={cn(card, 'grid justify-items-center gap-ui-2 px-ui-6 pt-ui-8 pb-ui-6 text-center')} aria-live="polite">
          <span className={cn(emptyIcon, 'mb-ui-1 size-16')} aria-hidden="true"><SearchX size={28} /></span>
          <h2 className="m-0 text-[length:var(--soco-type-page)] font-bold [overflow-wrap:anywhere] text-foreground">Không có kết quả cho “{query}”</h2>
          {props.suggestion && (
            <p className="m-0 text-[length:var(--soco-type-body)] text-foreground/80">
              Có phải bạn muốn tìm <button type="button" className={cn(link, 'font-bold!')} onClick={() => props.onSearch(props.suggestion ?? '')}>{props.suggestion}</button>?
            </p>
          )}
          {props.activeFilterCount > 0 && (
            <div className="mt-ui-4 flex w-full items-center gap-ui-3 rounded-ui-sm bg-muted px-ui-4 py-ui-3 text-left max-sm:flex-col max-sm:items-stretch max-sm:text-center">
              <div className="min-w-0 flex-1">
                <p className="m-0 text-[length:var(--soco-type-body)] font-semibold text-foreground">{props.activeFilterCount} bộ lọc đang thu hẹp kết quả</p>
                <p className="m-0 mt-0.5 text-[length:var(--soco-type-label)] text-muted-foreground">Bỏ lọc để xem thêm kết quả ở mọi nơi</p>
              </div>
              <Button variant="secondary" size="sm" className={cn(touchButton, 'text-primary')} onClick={props.onResetFilters}>Bỏ bộ lọc</Button>
            </div>
          )}
          {!all && <Button variant="secondary" size="sm" className={cn(touchButton, 'mt-ui-2 text-primary')} onClick={() => props.onType('all')}>Tìm trong tất cả</Button>}
          <p className="m-0 mt-ui-2 text-[length:var(--soco-type-label)] text-muted-foreground">Mẹo: kiểm tra chính tả, gõ có dấu hoặc dùng từ khóa ngắn hơn.</p>
        </section>
        {props.recentQueries.length > 0 && (
          <section className={card} aria-label="Tìm kiếm gần đây">
            <h2 className={cn(cardTitle, 'mb-ui-3')}>Tìm kiếm gần đây</h2>
            <ul className="m-0 flex list-none flex-wrap gap-ui-2 p-0">
              {props.recentQueries.map(recent => (
                <li key={recent}>
                  <button type="button" className={cn(plainButton, 'inline-flex h-9 items-center rounded-full bg-border px-ui-4 text-[length:var(--soco-type-body)]! font-medium! hover:bg-border/70 max-lg:h-11')}
                    onClick={() => props.onSearch(recent)}>{recent}</button>
                </li>
              ))}
            </ul>
          </section>
        )}
        {props.below}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-ui-3">
      {show('people') && (!all || people.items.length > 0 || people.loading || Boolean(people.error)) && (
        <Section title="Mọi người" count={people.items.length} onSeeAll={all && people.items.length > PREVIEW.people ? () => props.onType('people') : undefined}>
          <Status source={people} label="người dùng" />
          <ul className="m-0 grid list-none p-0">
            {limit(people.items, 'people').map(person => (
              <li key={person.id} className={row}>
                <UserAvatar name={person.displayName || person.username} username={person.username} className={avatar} online={person.online} />
                <div className={rowCopy}>
                  <strong className={rowTitle}>{person.displayName || person.username}</strong>
                  <small className={rowMeta}>@{person.username}{person.online ? ' · Đang hoạt động' : ''}</small>
                </div>
                <Button variant="secondary" size="sm" className={rowAction} onClick={() => {
                  props.onOpened({ kind: 'person', username: person.username, title: person.displayName || person.username })
                  props.onOpenProfile(person.username)
                }}>Xem trang</Button>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {show('posts') && (!all || posts.items.length > 0 || posts.hasMore || posts.loading || Boolean(posts.error)) && (
        <Section bare title="Bài viết" onSeeAll={all && (posts.items.length > PREVIEW.posts || posts.hasMore) ? () => props.onType('posts') : undefined}>
          <Status source={posts} label="bài viết" hasMore={posts.hasMore} />
          <div className="feed zalo-feed grid gap-ui-3">{props.renderPosts(limit(posts.items, 'posts'), openPost)}</div>
          {!all && posts.hasMore && (
            <Button variant="secondary" className="mt-ui-3 h-11 w-full" onClick={posts.loadMore} disabled={posts.loadingMore}>
              {posts.loadingMore ? 'Đang tải…' : 'Tải thêm bài viết'}
            </Button>
          )}
        </Section>
      )}

      {show('communities') && (!all || communities.items.length > 0 || communities.loading || Boolean(communities.error)) && (
        <Section title="Cộng đồng" count={communities.items.length}
          onSeeAll={all && communities.items.length > PREVIEW.communities ? () => props.onType('communities') : undefined}>
          <Status source={communities} label="cộng đồng" />
          <ul className="m-0 grid list-none p-0">
            {limit(communities.items, 'communities').map(community => {
              const state = joins[community.id]
              return (
                <li key={community.id} className={row}>
                  <span className={iconTile} aria-hidden="true"><UsersRound size={22} /></span>
                  <div className={rowCopy}>
                    <strong className={rowTitle}>{community.name}</strong>
                    <small className={rowMeta}>{[community.topic, community.memberCount.toLocaleString('vi-VN') + ' thành viên'].filter(Boolean).join(' · ')}</small>
                    {community.description && <small className={cn(rowMeta, clamp2)}>{community.description}</small>}
                  </div>
                  <Button size="sm" variant={state === 'joined' || state === 'pending' ? 'secondary' : 'default'} className={rowAction} disabled={state === 'joining' || state === 'joined' || state === 'pending'}
                    onClick={() => {
                      props.onOpened({ kind: 'community', id: community.id, title: community.name, subtitle: community.topic })
                      void join(community)
                    }}>
                    {state === 'joined' ? <><Check size={15} aria-hidden="true" /> Đã tham gia</> : state === 'pending' ? 'Đã gửi yêu cầu' : state === 'joining' ? 'Đang tham gia…' : state === 'error' ? 'Thử lại' : 'Tham gia'}
                  </Button>
                </li>
              )
            })}
          </ul>
          {Object.values(joins).includes('error') && <p className={inline} role="alert">Không thể tham gia cộng đồng. Hãy thử lại.</p>}
        </Section>
      )}

      {show('products') && (!all || products.items.length > 0 || products.loading || Boolean(products.error)) && (
        <Section title="Sản phẩm" count={products.items.length} onSeeAll={all && products.items.length > PREVIEW.products ? () => props.onType('products') : undefined}>
          <Status source={products} label="sản phẩm" />
          <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-ui-3 p-0">
            {limit(products.items, 'products').map(product => (
              <li key={product.id}>
                <Link className="group grid gap-0.5 rounded-ui-sm text-foreground no-underline" to="/marketplace">
                  <span className="mb-ui-1 grid aspect-4/3 place-items-center rounded-ui-sm bg-secondary text-primary" aria-hidden="true"><Package size={26} /></span>
                  <strong className="text-[length:var(--soco-type-body)] font-bold">{formatPrice(product.priceAmount, product.priceUnit)}</strong>
                  <span className="truncate text-[length:var(--soco-type-label)] group-hover:underline">{product.title}</span>
                  <small className={rowMeta}>{product.stock > 0 ? 'Còn ' + product.stock : 'Hết hàng'}</small>
                </Link>
              </li>
            ))}
          </ul>
          {!all && <p className={inline}>Kết quả được lấy từ các sản phẩm mới đăng gần đây trên Marketplace.</p>}
        </Section>
      )}
    </div>
  )
}
