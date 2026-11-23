import { ArrowRight, Bell, BookmarkCheck, Clock, FileText, Package, UserRoundCheck, UsersRound, X } from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import UserAvatar from '../../../shared/ui/UserAvatar'
import type { ApiRequest } from '../../../shared/types/api'
import { usePostSearch } from '../../feed'
import { isPublicPost } from '../lib/searchFilters'
import type { OpenedResult, SavedSearch, SearchHistory } from '../lib/searchHistory'
import SearchForm from './SearchForm'
import {
  avatar, avatarSmall, card, cardHead, cardTitle, clamp2, emptyIcon, iconButton, iconTile, inline, link, plainButton, rowCopy, rowMeta, rowTitle, sectionTitle,
} from './ui'

export type SearchHomeProps = {
  history: SearchHistory
  request: ApiRequest
  sessionId: string
  onSearch: (query: string, params?: Record<string, string>) => void
  onOpenSaved: (query: string) => void
  onRemoveRecent: (query: string) => void
  onClearRecent: () => void
  onToggleSaved: (query: string) => void
  onOpenOpened: (item: OpenedResult) => void
}

const SCOPES: { label: string; icon: typeof Package; params: Record<string, string> }[] = [
  { label: 'Bài viết đã lưu', icon: BookmarkCheck, params: { type: 'posts', in: 'saved' } },
  { label: 'Người bạn theo dõi', icon: UserRoundCheck, params: { type: 'posts', in: 'following' } },
  { label: 'Cộng đồng', icon: UsersRound, params: { type: 'communities' } },
  { label: 'Sản phẩm', icon: Package, params: { type: 'products' } },
]

const list = 'm-0 grid list-none p-0'
const recentItem = cn(plainButton, 'flex min-h-10 min-w-0 flex-1 items-center gap-ui-3 rounded-ui-sm px-ui-2 text-[length:var(--soco-type-body)]! hover:bg-muted max-lg:min-h-11 [&>svg]:shrink-0 [&>svg]:text-muted-foreground')

function SavedSearchCard({ saved, request, sessionId, onOpen, onRemove }: {
  saved: SavedSearch; request: ApiRequest; sessionId: string; onOpen: () => void; onRemove: () => void
}) {
  const search = usePostSearch({ query: saved.query, scope: 'all', enabled: true, sessionId, request })
  const visible = search.posts.filter(isPublicPost)
  const fresh = visible.filter(post => new Date(post.createdAt).getTime() > saved.seenAt).length

  return (
    <article className={card}>
      <header className={cardHead}>
        <div className="flex min-w-0 items-center gap-ui-2">
          <span className="inline-grid size-7 shrink-0 place-items-center rounded-full bg-secondary text-primary" aria-hidden="true"><Bell size={16} /></span>
          <h3 className="m-0 truncate text-[length:var(--soco-type-subtitle)] font-bold text-foreground">{saved.query}</h3>
          {fresh > 0 && <span className="shrink-0 rounded-full bg-primary px-ui-2 py-0.5 text-[length:var(--soco-type-caption)] font-bold text-primary-foreground">{fresh >= 5 ? '5+' : fresh} mới</span>}
        </div>
        <button type="button" className={iconButton} aria-label={'Bỏ lưu tìm kiếm ' + saved.query} onClick={onRemove}><X size={16} /></button>
      </header>
      {search.loading && (
        <div className="grid gap-ui-2" aria-hidden="true">
          {[0, 1].map(index => <span key={index} className="h-14 animate-pulse rounded-ui-sm bg-muted motion-reduce:animate-none" />)}
        </div>
      )}
      {search.error && <div className={inline} role="alert">{search.error} <button type="button" className={link} onClick={search.retry}>Thử lại</button></div>}
      {!search.loading && !search.error && visible.length === 0 && <p className={inline}>Chưa có bài viết nào khớp với tìm kiếm này.</p>}
      <ul className={cn(list, 'gap-ui-2')}>
        {visible.slice(0, 2).map(post => {
          const author = post.authorDisplayName || post.author
          return (
            <li key={post.id} className="flex items-center gap-ui-3 rounded-ui-sm bg-muted px-ui-3 py-ui-2">
              <UserAvatar name={author} username={post.author} className={avatarSmall} />
              <div className={rowCopy}>
                <strong className={rowTitle}>{author}</strong>
                <small className={cn(rowMeta, clamp2)}>{post.content || 'Bài viết có tệp đính kèm'}</small>
              </div>
              {new Date(post.createdAt).getTime() > saved.seenAt && (
                <span className="size-2 shrink-0 rounded-full bg-primary"><span className="sr-only">Mới</span></span>
              )}
            </li>
          )
        })}
      </ul>
      <button type="button" className={cn(link, 'mt-ui-2')} onClick={onOpen}>Xem tất cả kết quả <ArrowRight size={14} aria-hidden="true" /></button>
    </article>
  )
}

const OPENED_ICON = { person: UserRoundCheck, post: FileText, community: UsersRound }
const OPENED_LABEL = { person: 'Trang cá nhân', post: 'Bài viết', community: 'Cộng đồng' }

export default function SearchHome({ history, request, sessionId, ...actions }: SearchHomeProps) {
  return (
    <div className="mx-auto w-full max-w-290 px-ui-5 pt-ui-6 pb-ui-8 max-lg:px-ui-3 max-lg:pt-ui-4">
      <header className="mb-ui-6 grid gap-ui-3">
        {/* Legacy global h1 rules are unlayered, so these utilities need the important modifier. */}
        <h1 className="m-0! text-[length:var(--soco-type-display)]! font-bold text-foreground">Tìm kiếm</h1>
        <SearchForm initialQuery="" large autoFocus placeholder="Tìm người, bài viết, cộng đồng và sản phẩm…" onSubmit={query => actions.onSearch(query)} />
      </header>

      <div className="grid grid-cols-[minmax(0,1fr)_320px] items-start gap-ui-5 max-xl:grid-cols-[minmax(0,1fr)_280px] max-lg:grid-cols-1">
        <div className="grid min-w-0 gap-ui-6">
          <section className="grid gap-ui-3" aria-labelledby="srch-updates-title">
            <h2 id="srch-updates-title" className={sectionTitle}>Có gì mới từ tìm kiếm của bạn</h2>
            {history.saved.length === 0 ? (
              <div className={cn(card, 'flex items-center gap-ui-4')}>
                <span className={emptyIcon} aria-hidden="true"><Bell size={24} /></span>
                <div>
                  <strong className="text-[length:var(--soco-type-body)] text-foreground">Lưu một tìm kiếm để theo dõi bài viết mới</strong>
                  <p className="m-0 mt-ui-1 text-[length:var(--soco-type-label)] text-muted-foreground">Bấm “Lưu tìm kiếm” ở trang kết quả. Bài viết mới khớp với từ khóa sẽ hiện ở đây.</p>
                </div>
              </div>
            ) : history.saved.slice(0, 3).map(saved => (
              <SavedSearchCard key={saved.query} saved={saved} request={request} sessionId={sessionId}
                onOpen={() => actions.onOpenSaved(saved.query)} onRemove={() => actions.onToggleSaved(saved.query)} />
            ))}
          </section>

          {history.opened.length > 0 && (
            <section className="grid gap-ui-3" aria-labelledby="srch-opened-title">
              <h2 id="srch-opened-title" className={sectionTitle}>Bạn đã mở từ kết quả tìm kiếm</h2>
              <ul className={cn(list, 'grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-ui-3')}>
                {history.opened.map(item => {
                  const Icon = OPENED_ICON[item.kind]
                  return (
                    <li key={item.kind + (item.kind === 'person' ? item.username : item.id)}>
                      <button type="button" onClick={() => actions.onOpenOpened(item)}
                        className={cn(plainButton, card, 'flex w-full items-center gap-ui-3 transition-shadow hover:shadow-ui-md motion-reduce:transition-none')}>
                        {item.kind === 'person'
                          ? <UserAvatar name={item.title} username={item.username} className={avatar} />
                          : <span className={iconTile} aria-hidden="true"><Icon size={20} /></span>}
                        <span className={rowCopy}>
                          <small className={cn(rowMeta, 'font-semibold tracking-wide uppercase')}>{OPENED_LABEL[item.kind]}</small>
                          <strong className={rowTitle}>{item.title}</strong>
                          {item.kind !== 'person' && item.subtitle && <small className={cn(rowMeta, clamp2)}>{item.subtitle}</small>}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </section>
          )}
        </div>

        <aside className="grid gap-ui-3 max-lg:-order-1" aria-label="Lối tắt tìm kiếm">
          <section className={card}>
            <header className={cardHead}>
              <h2 className={cardTitle}>Gần đây</h2>
              {history.recent.length > 0 && <button type="button" className={link} onClick={actions.onClearRecent}>Xóa tất cả</button>}
            </header>
            {history.recent.length === 0 ? <p className={inline}>Các từ khóa bạn tìm sẽ hiện ở đây.</p> : (
              <ul className={list}>
                {history.recent.map(query => (
                  <li key={query} className="flex items-center gap-ui-1">
                    <button type="button" className={recentItem} onClick={() => actions.onSearch(query)}>
                      <Clock size={16} aria-hidden="true" /><span className="truncate">{query}</span>
                    </button>
                    <button type="button" className={iconButton} aria-label={'Xóa ' + query + ' khỏi gần đây'} onClick={() => actions.onRemoveRecent(query)}><X size={14} /></button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {history.saved.length > 0 && (
            <section className={card}>
              <header className={cardHead}><h2 className={cardTitle}>Đã lưu</h2></header>
              <ul className={list}>
                {history.saved.map(saved => (
                  <li key={saved.query} className="flex">
                    <button type="button" className={recentItem} onClick={() => actions.onOpenSaved(saved.query)}>
                      <Bell size={16} aria-hidden="true" /><span className="truncate">{saved.query}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className={card}>
            <header className={cardHead}><h2 className={cardTitle}>Tìm trong</h2></header>
            <p className={inline}>Chọn phạm vi rồi nhập từ khóa.</p>
            <div className="mt-ui-2 grid grid-cols-2 gap-ui-2">
              {SCOPES.map(scope => (
                <button key={scope.label} type="button" onClick={() => actions.onSearch('', scope.params)}
                  className={cn(plainButton, 'grid min-h-18 justify-items-start gap-ui-2 rounded-ui-sm bg-muted p-ui-3 text-[length:var(--soco-type-label)]! font-semibold! hover:bg-secondary [&>svg]:text-primary')}>
                  <scope.icon size={18} aria-hidden="true" />{scope.label}
                </button>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </div>
  )
}
