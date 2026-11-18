import { lazy, Suspense } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Users, FileText, MapPin, ArrowRight } from 'lucide-react'
import { ErrorBoundary } from '../../../shared/ui/ErrorBoundary'
import { AsyncSectionFallback } from '../../../shared/ui/AsyncSectionFallback'
import type { DiscoverSectionProps } from '../types'
import { useExploreCommunities } from '../hooks/useExploreCommunities'
import CommunitySuggestions from './CommunitySuggestions'
import '../styles/explore-page.css'

const NearbyExplorer = lazy(() => import('./NearbyExplorer'))

export default function ExplorePage(props: DiscoverSectionProps) {
  return <ExplorePageContent key={props.sessionId} {...props} />
}
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

function ExplorePageContent(props: DiscoverSectionProps) {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const tab = parseTab(params.get('tab'))
  const communities = useExploreCommunities(props.request, props.sessionId, tab === 'all' || tab === 'communities')
  function setTab(value: ExploreTab) {
    const next = new URLSearchParams(params)
    if (value === 'all') next.delete('tab')
    else next.set('tab', value)
    setParams(next)
  }
  const people = <section aria-labelledby="explore-people-title" className="explore-people">
    <div className="explore-section-heading"><h2 id="explore-people-title">Mọi người nên kết nối</h2></div>
    {props.nearbyUsers.length === 0 ? <div className="explore-state"><span className="explore-empty-icon" aria-hidden="true"><Users size={22} /></span>
      <div className="explore-empty-copy"><strong>Chưa có gợi ý kết nối</strong><p>Thử khám phá người ở gần để tìm thêm bạn bè.</p></div>
      <button type="button" onClick={() => setTab('recent')}><MapPin size={17} /> Khám phá gần đây</button>
    </div> : <div className="explore-people-grid">
      {props.nearbyUsers.map(user => <article key={user.id} className="explore-person">
        <span className="explore-person-avatar" aria-hidden="true">{(user.displayName || user.username).slice(0, 1).toUpperCase()}</span>
        <div><h3>{user.displayName || user.username}</h3><p>@{user.username}</p></div>
        <button type="button" disabled={props.friendActionBusy === user.id}
          onClick={() => void props.actOnFriend(user)}>{props.friendActionBusy === user.id ? 'Đang xử lý…' : friendLabel(props.friendRelationship(user.id))}</button>
      </article>)}
    </div>}
  </section>
  const nearby = <section className="explore-near" aria-labelledby="explore-near-title">
    <h2 id="explore-near-title">Gần bạn</h2>
    <p>Bật quét để thấy người đang ở trong bán kính bạn chọn.</p>
    <div className="explore-near-radar" aria-hidden="true" />
    <button type="button" onClick={() => setTab('recent')}><MapPin size={17} aria-hidden="true" /> Quét người gần đây</button>
  </section>

  return <main className="explore-page">
    <h1 className="explore-visually-hidden">Khám phá</h1>
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
    </ErrorBoundary> : <div className={tab === 'all' ? 'explore-content-layout' : 'explore-content-layout explore-content-layout-single'}>
      <div className="explore-main-column">
        {(tab === 'all' || tab === 'communities') && <CommunitySuggestions communities={communities} />}
        {tab === 'people' && people}
        {tab === 'posts' && <section className="explore-state explore-posts" aria-labelledby="explore-posts-title">
          <FileText size={34} aria-hidden="true" /><h2 id="explore-posts-title">Khám phá bài viết</h2>
          <p>Chưa có nguồn bài viết nổi bật riêng cho Khám phá. Hãy sử dụng tìm kiếm để xem bài viết công khai.</p>
          <button type="button" onClick={() => navigate('/search?type=posts')}>Đến trang tìm kiếm <ArrowRight size={17} /></button>
        </section>}
      </div>
      {tab === 'all' && <aside className="explore-rail" aria-label="Gợi ý khám phá">
        {props.nearbyUsers.length > 0 && people}
        {nearby}
      </aside>}
    </div>}
  </main>
}
