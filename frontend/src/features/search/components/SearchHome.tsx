import { Bell, BookmarkCheck, Clock, FileText, Package, UserRoundCheck, UsersRound, X } from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/ui/button'
import { Skeleton } from '@/shared/ui/skeleton'
import UserAvatar from '../../../shared/ui/UserAvatar'
import type { ApiRequest } from '../../../shared/types/api'
import { usePostSearch } from '../../feed'
import { isPublicPost } from '../lib/searchFilters'
import type { OpenedResult, SavedSearch, SearchHistory } from '../lib/searchHistory'
import {
  avatarSmall, card, cardTitle, clamp2, emptyIcon, iconButton, iconTile, inline, link, plainButton, rowCopy, rowMeta, rowTitle,
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
const railCard = cn(card, 'px-ui-3 pt-ui-4 pb-ui-3')
const railHead = 'mb-ui-1 flex items-center justify-between px-ui-2'
const railRow = cn(plainButton, 'flex min-h-11 w-full min-w-0 flex-1 items-center gap-ui-3 rounded-ui-sm px-ui-2 text-[length:var(--soco-type-body)]! font-medium! hover:bg-muted')
const railIcon = 'inline-grid size-9 shrink-0 place-items-center rounded-full bg-muted text-foreground'

function SavedSearchCard({ saved, request, sessionId, onOpen, onRemove }: {
  saved: SavedSearch; request: ApiRequest; sessionId: string; onOpen: () => void; onRemove: () => void
}) {
  const search = usePostSearch({ query: saved.query, scope: 'all', enabled: true, sessionId, request })
  const visible = search.posts.filter(isPublicPost)
  const fresh = visible.filter(post => new Date(post.createdAt).getTime() > saved.seenAt).length
  const freshLabel = fresh >= 5 ? '5+' : String(fresh)

  return (
    <article className={card}>
      <header className="mb-ui-3 flex items-center gap-ui-3">
        <span className="inline-grid size-10 shrink-0 place-items-center rounded-full bg-secondary text-primary" aria-hidden="true"><Bell size={18} /></span>
        <div className="min-w-0 flex-1">
          <h3 className="m-0 truncate text-[length:var(--soco-type-subtitle)] font-bold text-foreground">{saved.query}</h3>
          <p className="m-0 text-[length:var(--soco-type-label)] text-muted-foreground">Bài viết</p>
        </div>
        {fresh > 0 && <span className="shrink-0 rounded-full bg-primary px-ui-3 py-0.5 text-[length:var(--soco-type-caption)] font-semibold text-primary-foreground">{freshLabel} mới</span>}
        <button type="button" className={iconButton} aria-label={'Bỏ lưu tìm kiếm ' + saved.query} onClick={onRemove}><X size={16} /></button>
      </header>
      {search.loading && (
        <div className="grid gap-ui-2" aria-hidden="true">
          {[0, 1].map(index => <Skeleton key={index} className="h-14" />)}
        </div>
      )}
      {search.error && <div className={inline} role="alert">{search.error} <button type="button" className={link} onClick={search.retry}>Thử lại</button></div>}
      {!search.loading && !search.error && visible.length === 0 && <p className={inline}>Chưa có bài viết nào khớp với tìm kiếm này.</p>}
      <ul className={cn(list, 'gap-ui-2')}>
        {visible.slice(0, 2).map(post => {
          const author = post.authorDisplayName || post.author
          return (
            <li key={post.id} className="flex items-center gap-ui-3 rounded-ui-sm bg-muted p-ui-3">
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
      <Button variant="ghost" className="mt-ui-3 h-10 w-full bg-border hover:bg-border/70" onClick={onOpen}>
        {fresh > 0 ? 'Xem cả ' + freshLabel + ' kết quả mới' : 'Xem tất cả kết quả'}
      </Button>
    </article>
  )
}

const OPENED_ICON = { person: UserRoundCheck, post: FileText, community: UsersRound }
const OPENED_LABEL = { person: 'Trang cá nhân', post: 'Bài viết', community: 'Cộng đồng' }

export default function SearchHome({ history, request, sessionId, ...actions }: SearchHomeProps) {

  return (
    <>
      <div className="mx-auto w-full max-w-270 px-ui-6 pt-ui-5 pb-ui-8 max-lg:px-ui-3">
        <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)] items-start gap-ui-5 max-lg:grid-cols-1">
          <div className="grid min-w-0 gap-ui-4">
            <section className="grid gap-ui-4" aria-labelledby="srch-updates-title">
              <div>
                <h2 id="srch-updates-title" className="m-0 text-[length:var(--soco-type-page)] font-bold text-foreground">Có gì mới từ tìm kiếm của bạn</h2>
                <p className="m-0 mt-ui-1 text-[length:var(--soco-type-body)] text-muted-foreground">Bài viết mới cho các tìm kiếm bạn đã lưu, kể từ lần xem trước</p>
              </div>
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
              <section className={card} aria-labelledby="srch-opened-title">
                <h2 id="srch-opened-title" className={cn(cardTitle, 'mb-ui-3')}>Bạn đã mở từ kết quả tìm kiếm</h2>
                <ul className={cn(list, 'grid-cols-3 gap-ui-3 max-sm:grid-cols-1')}>
                  {history.opened.slice(0, 3).map(item => {
                    const Icon = OPENED_ICON[item.kind]
                    return (
                      <li key={item.kind + (item.kind === 'person' ? item.username : item.id)} className="flex">
                        <button type="button" onClick={() => actions.onOpenOpened(item)}
                          className={cn(plainButton, 'flex w-full flex-col items-center gap-ui-2 rounded-ui-md bg-muted px-ui-3 py-ui-4 text-center hover:bg-border max-sm:flex-row max-sm:text-left')}>
                          {item.kind === 'person'
                            ? <UserAvatar name={item.title} username={item.username} className="avatar size-14 shrink-0 text-[length:var(--soco-type-subtitle)] font-bold" />
                            : <span className={cn(iconTile, 'size-14')} aria-hidden="true"><Icon size={22} /></span>}
                          <span className="grid min-w-0 gap-0.5">
                            <strong className={cn(rowTitle, 'text-center max-sm:text-left')}>{item.title}</strong>
                            <small className={cn(rowMeta, clamp2)}>{item.kind !== 'person' && item.subtitle ? item.subtitle : OPENED_LABEL[item.kind]}</small>
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </section>
            )}
          </div>

          <aside className="grid gap-ui-4" aria-label="Lối tắt tìm kiếm">
            <section className={railCard}>
              <header className={railHead}>
                <h2 className={cardTitle}>Gần đây</h2>
                {history.recent.length > 0 && <button type="button" className={link} onClick={actions.onClearRecent}>Xóa hết</button>}
              </header>
              {history.recent.length === 0 ? <p className={cn(inline, 'px-ui-2')}>Các từ khóa bạn tìm sẽ hiện ở đây.</p> : (
                <ul className={list}>
                  {history.recent.map(query => (
                    <li key={query} className="flex items-center gap-ui-1">
                      <button type="button" className={railRow} onClick={() => actions.onSearch(query)}>
                        <span className={railIcon}><Clock size={16} aria-hidden="true" /></span><span className="truncate">{query}</span>
                      </button>
                      <button type="button" className={iconButton} aria-label={'Xóa ' + query + ' khỏi gần đây'} onClick={() => actions.onRemoveRecent(query)}><X size={14} /></button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {history.saved.length > 0 && (
              <section className={railCard}>
                <header className={railHead}><h2 className={cardTitle}>Đã lưu</h2></header>
                <ul className={list}>
                  {history.saved.map(saved => (
                    <li key={saved.query} className="flex">
                      <button type="button" className={railRow} onClick={() => actions.onOpenSaved(saved.query)}>
                        <span className="truncate">{saved.query}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section className={railCard}>
              <header className={railHead}><h2 className={cardTitle}>Tìm trong</h2></header>
              <ul className={list}>
                {SCOPES.map(scope => (
                  <li key={scope.label} className="flex">
                    <button type="button" className={railRow} onClick={() => actions.onSearch('', scope.params)}>
                      <scope.icon size={18} aria-hidden="true" className="shrink-0 text-primary" />{scope.label}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          </aside>
        </div>
      </div>
    </>
  )
}
