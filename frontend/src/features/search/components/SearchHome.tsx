import { ArrowRight, Bell, BookmarkCheck, Clock, FileText, Package, UserRoundCheck, UsersRound, X } from 'lucide-react'
import UserAvatar from '../../../shared/ui/UserAvatar'
import type { ApiRequest } from '../../../shared/types/api'
import { usePostSearch } from '../../feed'
import { isPublicPost } from '../lib/searchFilters'
import type { OpenedResult, SavedSearch, SearchHistory } from '../lib/searchHistory'
import SearchForm from './SearchForm'

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

function SavedSearchCard({ saved, request, sessionId, onOpen, onRemove }: {
  saved: SavedSearch; request: ApiRequest; sessionId: string; onOpen: () => void; onRemove: () => void
}) {
  const search = usePostSearch({ query: saved.query, scope: 'all', enabled: true, sessionId, request })
  const visible = search.posts.filter(isPublicPost)
  const fresh = visible.filter(post => new Date(post.createdAt).getTime() > saved.seenAt).length

  return (
    <article className="srch-card srch-saved">
      <header className="srch-card-head">
        <div className="srch-saved-title">
          <span className="srch-saved-icon" aria-hidden="true"><Bell size={16} /></span>
          <h3>{saved.query}</h3>
          {fresh > 0 && <span className="srch-badge">{fresh >= 5 ? '5+' : fresh} mới</span>}
        </div>
        <button type="button" className="srch-icon-btn" aria-label={'Bỏ lưu tìm kiếm ' + saved.query} onClick={onRemove}><X size={16} /></button>
      </header>
      {search.loading && <div className="srch-skeleton" aria-hidden="true"><span /><span /></div>}
      {search.error && <div className="srch-inline" role="alert">{search.error} <button type="button" className="srch-link" onClick={search.retry}>Thử lại</button></div>}
      {!search.loading && !search.error && visible.length === 0 && <p className="srch-inline">Chưa có bài viết nào khớp với tìm kiếm này.</p>}
      <ul className="srch-mini-posts">
        {visible.slice(0, 2).map(post => {
          const author = post.authorDisplayName || post.author
          return (
            <li key={post.id} className="srch-mini-post">
              <UserAvatar name={author} username={post.author} className="avatar srch-avatar sm" />
              <div className="srch-row-copy">
                <strong>{author}</strong>
                <small className="srch-clamp">{post.content || 'Bài viết có tệp đính kèm'}</small>
              </div>
              {new Date(post.createdAt).getTime() > saved.seenAt && <span className="srch-dot"><span className="sr-only">Mới</span></span>}
            </li>
          )
        })}
      </ul>
      <button type="button" className="srch-link srch-saved-more" onClick={onOpen}>Xem tất cả kết quả <ArrowRight size={14} aria-hidden="true" /></button>
    </article>
  )
}

const OPENED_ICON = { person: UserRoundCheck, post: FileText, community: UsersRound }
const OPENED_LABEL = { person: 'Trang cá nhân', post: 'Bài viết', community: 'Cộng đồng' }

export default function SearchHome({ history, request, sessionId, ...actions }: SearchHomeProps) {
  return (
    <div className="srch-home">
      <header className="srch-home-head">
        <h1>Tìm kiếm</h1>
        <SearchForm initialQuery="" large autoFocus placeholder="Tìm người, bài viết, cộng đồng và sản phẩm…" onSubmit={query => actions.onSearch(query)} />
      </header>

      <div className="srch-home-grid">
        <div className="srch-home-main">
          <section aria-labelledby="srch-updates-title">
            <h2 id="srch-updates-title" className="srch-section-title">Có gì mới từ tìm kiếm của bạn</h2>
            {history.saved.length === 0 ? (
              <div className="srch-card srch-home-empty">
                <span className="srch-empty-icon" aria-hidden="true"><Bell size={24} /></span>
                <div>
                  <strong>Lưu một tìm kiếm để theo dõi bài viết mới</strong>
                  <p>Bấm “Lưu tìm kiếm” ở trang kết quả. Bài viết mới khớp với từ khóa sẽ hiện ở đây.</p>
                </div>
              </div>
            ) : history.saved.slice(0, 3).map(saved => (
              <SavedSearchCard key={saved.query} saved={saved} request={request} sessionId={sessionId}
                onOpen={() => actions.onOpenSaved(saved.query)} onRemove={() => actions.onToggleSaved(saved.query)} />
            ))}
          </section>

          {history.opened.length > 0 && (
            <section aria-labelledby="srch-opened-title">
              <h2 id="srch-opened-title" className="srch-section-title">Bạn đã mở từ kết quả tìm kiếm</h2>
              <ul className="srch-opened">
                {history.opened.map(item => {
                  const Icon = OPENED_ICON[item.kind]
                  return (
                    <li key={item.kind + (item.kind === 'person' ? item.username : item.id)}>
                      <button type="button" className="srch-card srch-opened-item" onClick={() => actions.onOpenOpened(item)}>
                        {item.kind === 'person'
                          ? <UserAvatar name={item.title} username={item.username} className="avatar srch-avatar" />
                          : <span className="srch-group-icon" aria-hidden="true"><Icon size={20} /></span>}
                        <span className="srch-row-copy">
                          <small className="srch-kicker">{OPENED_LABEL[item.kind]}</small>
                          <strong>{item.title}</strong>
                          {item.kind !== 'person' && item.subtitle && <small className="srch-clamp">{item.subtitle}</small>}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </section>
          )}
        </div>

        <aside className="srch-home-rail" aria-label="Lối tắt tìm kiếm">
          <section className="srch-card">
            <header className="srch-card-head">
              <h2>Gần đây</h2>
              {history.recent.length > 0 && <button type="button" className="srch-link" onClick={actions.onClearRecent}>Xóa tất cả</button>}
            </header>
            {history.recent.length === 0 ? <p className="srch-inline">Các từ khóa bạn tìm sẽ hiện ở đây.</p> : (
              <ul className="srch-recent">
                {history.recent.map(query => (
                  <li key={query}>
                    <button type="button" className="srch-recent-item" onClick={() => actions.onSearch(query)}>
                      <Clock size={16} aria-hidden="true" /><span>{query}</span>
                    </button>
                    <button type="button" className="srch-icon-btn" aria-label={'Xóa ' + query + ' khỏi gần đây'} onClick={() => actions.onRemoveRecent(query)}><X size={14} /></button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {history.saved.length > 0 && (
            <section className="srch-card">
              <header className="srch-card-head"><h2>Đã lưu</h2></header>
              <ul className="srch-recent">
                {history.saved.map(saved => (
                  <li key={saved.query}>
                    <button type="button" className="srch-recent-item" onClick={() => actions.onOpenSaved(saved.query)}>
                      <Bell size={16} aria-hidden="true" /><span>{saved.query}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="srch-card">
            <header className="srch-card-head"><h2>Tìm trong</h2></header>
            <p className="srch-inline">Chọn phạm vi rồi nhập từ khóa.</p>
            <div className="srch-scopes">
              {SCOPES.map(scope => (
                <button key={scope.label} type="button" className="srch-scope" onClick={() => actions.onSearch('', scope.params)}>
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
