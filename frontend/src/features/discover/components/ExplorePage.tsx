import { useState, lazy, Suspense, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Compass, Search, Sparkles, Users, FileText, MapPin, ArrowRight } from 'lucide-react'
import { ErrorBoundary } from '../../../shared/ui/ErrorBoundary'
import { AsyncSectionFallback } from '../../../shared/ui/AsyncSectionFallback'
import type { DiscoverSectionProps } from '../types'
import { useExploreCommunities } from '../hooks/useExploreCommunities'
import CommunitySuggestions from './CommunitySuggestions'
import '../styles/explore-page.css'

const NearbyExplorer = lazy(() => import('./NearbyExplorer'))
type ExploreTab = 'all' | 'people' | 'posts' | 'communities' | 'recent'
const tabs: { id: ExploreTab; title: string }[] = [
  { id: 'all', title: 'Tất cả' }, { id: 'people', title: 'Mọi người' },
  { id: 'posts', title: 'Bài viết' }, { id: 'communities', title: 'Cộng đồng' },
  { id: 'recent', title: 'Gần đây' },
]
function parseTab(value: string | null): ExploreTab {
  return tabs.find(tab => tab.id === value)?.id ?? 'all'
}
function friendLabel(relationship: ReturnType<DiscoverSectionProps['friendRelationship']>) {
  return relationship === 'accepted' ? 'Nhắn tin' :
    relationship === 'incoming' ? 'Chấp nhận' :
    relationship === 'outgoing' ? 'Hủy lời mời' : 'Kết bạn'
}

export default function ExplorePage(props: DiscoverSectionProps) {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const tab = parseTab(params.get('tab'))
  const [search, setSearch] = useState('')
  const communities = useExploreCommunities(props.request, props.sessionId, tab === 'all' || tab === 'communities')
  function setTab(value: ExploreTab) {
    const next = new URLSearchParams(params)
    if (value === 'all') next.delete('tab')
    else next.set('tab', value)
    setParams(next)
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const query = search.trim()
    if (query) navigate('/search?q=' + encodeURIComponent(query.slice(0, 120)))
  }
  const showPeople = tab === 'all' || tab === 'people'
  const showCommunities = tab === 'all' || tab === 'communities'

  return <main className="explore-page">
    <section className="explore-hero" aria-labelledby="explore-heading">
      <div className="explore-hero-text">
        <h1 id="explore-heading">Khám phá thế giới SocCo</h1>
        <p>Chủ đề dành riêng cho bạn, cộng đồng cùng sở thích và nhiều điều mới.</p>
        <form role="search" onSubmit={submit} className="explore-search">
          <Search size={20} aria-hidden="true" />
          <input aria-label="Tìm kiếm người, bài viết, hashtag, cộng đồng" placeholder="Tìm người, bài viết, hashtag, cộng đồng…" value={search} maxLength={120} onChange={event => setSearch(event.target.value)} />
          <button type="submit" disabled={!search.trim()}><Search size={18} aria-hidden="true" /> Tìm kiếm</button>
        </form>
      </div>
      <span className="explore-hero-art" aria-hidden="true"><Compass size={30} /></span>
    </section>
    <nav className="explore-tabs" aria-label="Danh mục khám phá">
      {tabs.map(item => <button key={item.id} type="button" aria-current={tab === item.id ? 'page' : undefined}
        className={tab === item.id ? 'active' : ''} onClick={() => setTab(item.id)}>{item.title}</button>)}
    </nav>
    {tab === 'recent' ? <ErrorBoundary fallback={retry => <AsyncSectionFallback title="Gần đây" onRetry={retry} />}>
      <Suspense fallback={<AsyncSectionFallback title="Gần đây" loading />}>
        <NearbyExplorer query={props.globalSearch} onQueryChange={props.setGlobalSearch}
          users={props.nearbyUsers} peopleBusy={props.nearbyBusy} peopleScanning={props.nearbyScanning}
          peopleActive={props.nearbyUntil > 0} peopleRadiusKm={props.nearbyRadiusKm}
          resultRadiusKm={props.nearbyResultRadiusKm} onPeopleRadiusChange={props.setNearbyRadiusKm}
          onScanPeople={props.findNearby} onStopPeople={props.stopNearby}
          friendActionBusy={props.friendActionBusy} onFriendAction={props.actOnFriend}
          getFriendActionLabel={user => friendLabel(props.friendRelationship(user.id))} />
      </Suspense>
    </ErrorBoundary> : <>
      {tab === 'all' && <div className="explore-feature-layout">
        <section className="explore-feature" aria-labelledby="explore-feature-title">
          <span className="explore-feature-chip"><Sparkles size={15} /> NỔI BẬT</span>
          <div><h2 id="explore-feature-title">Những chuyến đi đáng nhớ</h2>
            <p>Nội dung nổi bật sẽ xuất hiện khi hệ thống hỗ trợ tuyển chọn bài viết.</p>
            <button type="button" onClick={() => setTab('posts')}>Khám phá bài viết <ArrowRight size={17} /></button>
          </div>
        </section>
        <aside className="explore-trending" aria-labelledby="explore-trending-title">
          <h2 id="explore-trending-title">Đang được quan tâm</h2>
          <div className="explore-trending-empty"><Sparkles size={26} aria-hidden="true" />
            <p>Chưa có dữ liệu hashtag thịnh hành.</p><small>Tính năng sẽ được cập nhật khi có dữ liệu thực.</small>
          </div>
        </aside>
      </div>}
      {showCommunities && <CommunitySuggestions communities={communities} />}
      {showPeople && <section aria-labelledby="explore-people-title" className="explore-people">
        <div className="explore-section-heading"><h2 id="explore-people-title">Mọi người nên kết nối</h2></div>
        {props.nearbyUsers.length === 0 ? <div className="explore-state"><Users size={24} aria-hidden="true" />
          <p>Chưa có gợi ý từ người ở gần. Bạn có thể tìm người quanh đây hoặc tìm theo tên.</p>
          <button type="button" onClick={() => setTab('recent')}><MapPin size={17} /> Khám phá gần đây</button>
        </div> : <div className="explore-people-grid">
          {props.nearbyUsers.map(user => <article key={user.id} className="explore-person">
            <span className="explore-person-avatar" aria-hidden="true">{(user.displayName || user.username).slice(0, 1).toUpperCase()}</span>
            <div><h3>{user.displayName || user.username}</h3><p>@{user.username}</p></div>
            <button type="button" disabled={props.friendActionBusy === user.id}
              onClick={() => void props.actOnFriend(user)}>{props.friendActionBusy === user.id ? 'Đang xử lý…' : friendLabel(props.friendRelationship(user.id))}</button>
          </article>)}
        </div>}
      </section>}
      {tab === 'posts' && <section className="explore-state explore-posts" aria-labelledby="explore-posts-title">
        <FileText size={34} aria-hidden="true" /><h2 id="explore-posts-title">Khám phá bài viết</h2>
        <p>Chưa có nguồn bài viết nổi bật riêng cho Khám phá. Hãy sử dụng tìm kiếm để xem bài viết công khai.</p>
        <button type="button" onClick={() => navigate('/search?type=posts')}>Đến trang tìm kiếm <ArrowRight size={17} /></button>
      </section>}
    </>}
  </main>
}
