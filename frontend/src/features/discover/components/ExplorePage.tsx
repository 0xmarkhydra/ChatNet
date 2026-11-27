import { lazy, Suspense, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowRight, FileText, Lightbulb, MapPin, UserPlus, UsersRound } from 'lucide-react'
import { ErrorBoundary } from '../../../shared/ui/ErrorBoundary'
import { AsyncSectionFallback } from '../../../shared/ui/AsyncSectionFallback'
import type { DiscoverSectionProps } from '../types'
import { useExploreCommunities } from '../hooks/useExploreCommunities'
import CommunitySuggestions from './CommunitySuggestions'
import ExplorePosts from './ExplorePosts'
import { useExplorePeople } from '../hooks/useExplorePeople'
import UserAvatar from '../../../shared/ui/UserAvatar'
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
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null)
  const [nearbyError, setNearbyError] = useState('')
  const tab = parseTab(params.get('tab'))
  const communities = useExploreCommunities(props.request, props.sessionId, tab === 'all' || tab === 'communities')
  const suggestions = useExplorePeople(props.request, tab === 'all' || tab === 'people')
  const peopleById = new Map(props.nearbyUsers.map(user => [user.id, user]))
  for (const user of suggestions.items) if (!peopleById.has(user.id)) peopleById.set(user.id, user)
  // Nearby scans and suggestion responses can include an already accepted friend.
  // Re-evaluate on every relationship update so accepting a request removes the card immediately.
  const peopleItems = [...peopleById.values()].filter(user => props.friendRelationship(user.id) !== 'accepted')
  const peopleCount = peopleItems.length
  const topics = [...new Set(communities.items.map(item => typeof item.topic === 'string' ? item.topic.trim() : '').filter(Boolean))]
  const activeTopic = selectedTopic && topics.includes(selectedTopic) ? selectedTopic : null
  const filteredCommunities = activeTopic
    ? communities.items.filter(item => item.topic === activeTopic || (typeof item.topic === 'string' && item.topic.trim() === activeTopic))
    : communities.items
  const isEmptyAll = tab === 'all' && communities.status === 'ready' && communities.items.length === 0 && peopleCount === 0 && !suggestions.loading && !suggestions.error
  const showCommunities = tab === 'communities' || (tab === 'all' && (communities.status !== 'ready' || filteredCommunities.length > 0))

  function setTab(value: ExploreTab) {
    if (value === tab) return
    const next = new URLSearchParams(params)
    if (value === 'all') next.delete('tab')
    else next.set('tab', value)
    setParams(next)
  }

  async function scanNearby() {
    if (props.nearbyBusy || props.nearbyScanning) return
    setNearbyError('')
    props.setGlobalSearch('')
    if (tab !== 'recent') setTab('recent')
    const error = await props.findNearby()
    if (error) setNearbyError(error)
  }

  const people = <section aria-labelledby="explore-people-title" className="explore-people">
    <div className="explore-section-heading"><h2 id="explore-people-title">Người nên kết nối</h2></div>
    {suggestions.loading && peopleCount === 0 ? <p role="status">Đang tải gợi ý kết nối…</p> : suggestions.error && peopleCount === 0 ? <div role="alert" className="explore-state border-destructive/30! bg-destructive/5!">{suggestions.error} <button type="button" onClick={suggestions.retry}>Thử lại</button></div> : peopleCount === 0 ? <div className="explore-state explore-people-empty">
      <span className="explore-empty-icon" aria-hidden="true"><UsersRound size={22} /></span>
      <div className="explore-empty-copy"><strong>Chưa có gợi ý kết nối</strong><p>Hãy quét ở mục Gần đây để tìm thêm bạn bè.</p></div>
      <button type="button" onClick={() => setTab('recent')}><MapPin size={17} aria-hidden="true" /> Khám phá gần đây</button>
    </div> : <div className="explore-people-grid">
      {(tab === 'all' ? peopleItems.slice(0, 3) : peopleItems).map(user => <article key={user.id} className="explore-person">
        <UserAvatar className="explore-person-avatar" name={user.displayName || user.username} username={user.username} online={user.online} />
        <div className="explore-person-info"><h3><Link className="text-inherit no-underline hover:underline" to={'/users/' + encodeURIComponent(user.username)}>{user.displayName || user.username}</Link></h3><p>@{user.username}</p></div>
        <button type="button" disabled={props.friendActionBusy === user.id} onClick={() => void props.actOnFriend(user)}>
          {friendLabel(props.friendRelationship(user.id))}
        </button>
      </article>)}
    </div>}
  </section>

  const nearby = <section className="explore-near" aria-labelledby="explore-near-title">
    <h2 id="explore-near-title">Gần bạn</h2>
    <p>Bật quét để tìm người trong bán kính bạn chọn và cho phép người khác tìm thấy bạn theo vị trí gần nhất.</p>
    <div className="explore-near-radar" aria-hidden="true" />
    <button type="button" disabled={props.nearbyBusy} onClick={() => void scanNearby()}><MapPin size={18} aria-hidden="true" /> Quét người gần đây</button>
  </section>

  const tips = <section className="explore-tips" aria-labelledby="explore-tips-title">
    <h2 id="explore-tips-title"><Lightbulb size={18} aria-hidden="true" /> Mẹo để kết nối</h2>
    <ul>
      <li>Hoàn thiện hồ sơ để người khác dễ nhận ra bạn.</li>
      <li>Bật quét gần đây để gặp người ở quanh bạn.</li>
      <li>Tham gia cộng đồng cùng sở thích để trò chuyện nhanh hơn.</li>
    </ul>
  </section>

  const shortcuts: { title: string; desc: string; icon: typeof MapPin; onClick: () => void }[] = [
    { title: 'Mọi người', desc: 'Gợi ý kết nối mới', icon: UserPlus, onClick: () => setTab('people') },
    { title: 'Bài viết', desc: 'Bài viết công khai quanh bạn', icon: FileText, onClick: () => setTab('posts') },
    { title: 'Cộng đồng', desc: 'Nhóm cùng sở thích', icon: UsersRound, onClick: () => setTab('communities') },
    { title: 'Gần đây', desc: 'Người ở gần bạn', icon: MapPin, onClick: () => setTab('recent') },
  ]

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
          <p>Tìm người mới, kết nối cộng đồng và khám phá các bài viết công khai trên ChatNet. Quét gần đây sẽ bật hiển thị vị trí gần nhất của bạn.</p>
          <div className="explore-feature-actions">
            <button type="button" className="explore-feature-primary" disabled={props.nearbyBusy} onClick={() => void scanNearby()}>
              <MapPin size={18} aria-hidden="true" /> Tìm người gần đây
            </button>
            <button type="button" className="explore-feature-secondary" onClick={() => setTab('communities')}>Tham gia cộng đồng</button>
            <button type="button" className="explore-feature-secondary" onClick={() => setTab('posts')}>Xem bài viết gần đây</button>
          </div>
        </div>
      </section>
      <section className="explore-shortcuts" aria-labelledby="explore-shortcuts-title">
        <h2 id="explore-shortcuts-title">Khám phá nhanh</h2>
        <div className="explore-shortcut-grid">
          {shortcuts.map(({ title, desc, icon: Icon, onClick }) => <button key={title} type="button" onClick={onClick}>
            <span className="explore-shortcut-icon" aria-hidden="true"><Icon size={20} /></span>
            <span className="explore-shortcut-copy"><strong>{title}</strong><small>{desc}</small></span>
            <ArrowRight size={16} aria-hidden="true" />
          </button>)}
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
          peopleError={nearbyError} onScanPeople={scanNearby} onStopPeople={async () => { setNearbyError(''); await props.stopNearby() }}
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
              <p>Bật hiển thị quanh đây để tìm người ở gần và gửi lời mời kết nối.</p>
              <button type="button" className="explore-step-primary" disabled={props.nearbyBusy} onClick={() => void scanNearby()}>Quét người gần đây</button>
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
        {(tab === 'all' || tab === 'posts') && <ExplorePosts request={props.request} preview={tab === 'all'} onViewAll={() => setTab('posts')} />}
      </div>
      {tab === 'all' && <aside className="explore-rail" aria-label="Gợi ý khám phá">
        {(peopleCount > 0 || suggestions.error || suggestions.loading) && people}
        {nearby}
        {tips}
      </aside>}
    </div>}
    </main>
  </div>
}