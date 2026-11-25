import { lazy, Suspense, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowRight, FileText, MapPin, Search, UsersRound } from 'lucide-react'
import { ErrorBoundary } from '../../../shared/ui/ErrorBoundary'
import { AsyncSectionFallback } from '../../../shared/ui/AsyncSectionFallback'
import type { DiscoverSectionProps } from '../types'
import { useExploreCommunities } from '../hooks/useExploreCommunities'
import CommunitySuggestions from './CommunitySuggestions'
import '../styles/explore-page.css'

const NearbyExplorer = lazy(() => import('./NearbyExplorer'))

type ExploreTab = 'all' | 'people' | 'posts' | 'communities' | 'recent'
const tabs: { id: ExploreTab; title: string }[] = [
  { id: 'all', title: 'Tất cả' },
  { id: 'people', title: 'Mọi người' },
  { id: 'posts', title: 'Bài viết' },
  { id: 'communities', title: 'Cộng đồng' },
  { id: 'recent', title: 'Gần đây' },
]

function parseTab(value: string | null): ExploreTab {
  return tabs.find(tab => tab.id === value)?.id ?? 'all'
}

function friendLabel(relationship: ReturnType<DiscoverSectionProps['friendRelationship']>) {
  return relationship === 'accepted' ? 'Nhắn tin'
    : relationship === 'incoming' ? 'Chấp nhận'
      : relationship === 'outgoing' ? 'Hủy lời mời' : 'Kết bạn'
}

export default function ExplorePage(props: DiscoverSectionProps) {
  return <ExplorePageContent key={props.sessionId} {...props} />
}

function ExplorePageContent(props: DiscoverSectionProps) {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null)
  const tab = parseTab(params.get('tab'))
  const communities = useExploreCommunities(props.request, props.sessionId, tab === 'all' || tab === 'communities')
  const peopleCount = props.nearbyUsers.length
  const topics = [...new Set(communities.items.map(item => typeof item.topic === 'string' ? item.topic.trim() : '').filter(Boolean))]
  const activeTopic = selectedTopic && topics.includes(selectedTopic) ? selectedTopic : null
  const filteredCommunities = activeTopic
    ? communities.items.filter(item => item.topic === activeTopic || (typeof item.topic === 'string' && item.topic.trim() === activeTopic))
    : communities.items
  const isEmptyAll = tab === 'all' && communities.status === 'ready' && communities.items.length === 0 && peopleCount === 0
  const showCommunities = tab === 'communities' || (tab === 'all' && (communities.status !== 'ready' || filteredCommunities.length > 0))

  function setTab(value: ExploreTab) {
    const next = new URLSearchParams(params)
    if (value === 'all') next.delete('tab')
    else next.set('tab', value)
    setParams(next)
  }

  const people = <section aria-labelledby="explore-people-title" className="explore-people">
    <div className="explore-section-heading"><h2 id="explore-people-title">Người nên kết nối</h2></div>
    {peopleCount === 0 ? <div className="explore-state explore-people-empty">
      <span className="explore-empty-icon" aria-hidden="true"><UsersRound size={22} /></span>
      <div className="explore-empty-copy"><strong>Chưa có gợi ý kết nối</strong><p>Hãy quét ở mục Gần đây để tìm thêm bạn bè.</p></div>
      <button type="button" onClick={() => setTab('recent')}><MapPin size={17} aria-hidden="true" /> Khám phá gần đây</button>
    </div> : <div className="explore-people-grid">
      {props.nearbyUsers.map(user => <article key={user.id} className="explore-person">
        <span className="explore-person-avatar" aria-hidden="true">{(user.displayName || user.username).slice(0, 1).toUpperCase()}</span>
        <div className="explore-person-info"><h3>{user.displayName || user.username}</h3><p>@{user.username}</p></div>
        <button type="button" disabled={props.friendActionBusy === user.id} onClick={() => void props.actOnFriend(user)}>
          {props.friendActionBusy === user.id ? 'Đang xử lý…' : friendLabel(props.friendRelationship(user.id))}
        </button>
      </article>)}
    </div>}
  </section>

  const nearby = <section className="explore-near" aria-labelledby="explore-near-title">
    <h2 id="explore-near-title">Gần bạn</h2>
    <p>Bật quét để thấy người đang ở trong bán kính bạn chọn.</p>
    <div className="explore-near-radar" aria-hidden="true" />
    <button type="button" onClick={() => setTab('recent')}><MapPin size={18} aria-hidden="true" /> Quét người gần đây</button>
  </section>

  // Keep navigation outside the scrolling pane on Web and PWA.
  // It remains visible when the content scrolls or the global header collapses.
  return <div className="explore-shell">
    <nav className="explore-tabs" aria-label="Danh mục khám phá">
      {tabs.map(item => <button key={item.id} type="button" aria-current={tab === item.id ? 'page' : undefined}
        className={tab === item.id ? 'active' : ''} onClick={() => setTab(item.id)}>{item.title}</button>)}
    </nav>
    <main className="explore-page">
      <h1 className="explore-visually-hidden">Khám phá</h1>

    {tab === 'all' && <>
      <section className="explore-feature" aria-labelledby="explore-feature-title">
        <div className="explore-feature-content">
          <h2 id="explore-feature-title">Hôm nay bạn muốn khám phá gì?</h2>
          <p>Tìm người mới, kết nối cộng đồng và khám phá các bài viết công khai trên ChatNet.</p>
          <div className="explore-feature-actions">
            <button type="button" className="explore-feature-primary" onClick={() => setTab('recent')}>
              <MapPin size={18} aria-hidden="true" /> Tìm người gần đây
            </button>
            <button type="button" className="explore-feature-secondary" onClick={() => setTab('communities')}>Tham gia cộng đồng</button>
            <button type="button" className="explore-feature-secondary" onClick={() => navigate('/search?type=posts')}>Xem bài viết mới</button>
          </div>
        </div>
      </section>
      {topics.length > 0 && <section className="explore-topics" aria-labelledby="explore-topics-title">
        <h2 id="explore-topics-title">Chủ đề cho bạn</h2>
        <div className="explore-topic-list">
          {topics.map(topic => <button type="button" key={topic}
            aria-pressed={activeTopic === topic}
            onClick={() => setSelectedTopic(current => current === topic ? null : topic)}>
            {topic}
          </button>)}
        </div>
      </section>}
    </>}

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
        {isEmptyAll && <section className="explore-get-started" aria-labelledby="explore-get-started-title">
          <h2 id="explore-get-started-title">Bắt đầu khám phá ChatNet</h2>
          <p>Hai bước giúp bạn kết nối nhanh nhất.</p>
          <div className="explore-step-grid">
            <article className="explore-step">
              <span className="explore-step-number" aria-hidden="true">1</span>
              <h3>Tìm người gần bạn</h3>
              <p>Khám phá những người ở gần và gửi lời mời kết nối.</p>
              <button type="button" className="explore-step-primary" onClick={() => setTab('recent')}>Quét người gần đây</button>
            </article>
            <article className="explore-step">
              <span className="explore-step-number" aria-hidden="true">2</span>
              <h3>Tham gia hoặc tạo cộng đồng</h3>
              <p>Khám phá các cộng đồng công khai cùng sở thích.</p>
              <button type="button" onClick={() => setTab('communities')}>Xem cộng đồng</button>
            </article>
          </div>
          <p className="explore-empty-community">Chưa có cộng đồng công khai nào</p>
        </section>}
        {showCommunities && <CommunitySuggestions communities={communities} items={filteredCommunities}
          title="Cộng đồng đang hoạt động"
          onViewAll={tab === 'all' && communities.items.length > 0 ? () => setTab('communities') : undefined} />}
        {tab === 'people' && people}
        {tab === 'posts' && <section className="explore-state explore-posts" aria-labelledby="explore-posts-title">
          <FileText size={34} aria-hidden="true" /><h2 id="explore-posts-title">Khám phá bài viết</h2>
          <p>Chưa có danh sách bài viết nổi bật riêng cho Khám phá. Hãy tìm các bài viết công khai trên ChatNet.</p>
          <button type="button" onClick={() => navigate('/search?type=posts')}>Đến trang tìm kiếm <ArrowRight size={17} aria-hidden="true" /></button>
        </section>}
      </div>
      {tab === 'all' && <aside className="explore-rail" aria-label="Gợi ý khám phá">
        {peopleCount > 0 && people}
        {nearby}
      </aside>}
    </div>}
    </main>
  </div>
}
