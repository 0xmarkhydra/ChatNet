import { useUiTranslation, type UiCopyKey } from '@/shared/i18n/locale'
import { lazy, Suspense, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowRight, FileText, Lightbulb, MapPin, UserPlus, UserRoundMinus, UserRoundCheck, MessageCircle, UsersRound } from 'lucide-react'
import { ErrorBoundary } from '../../../shared/ui/ErrorBoundary'
import { AsyncSectionFallback } from '../../../shared/ui/AsyncSectionFallback'
import type { DiscoverSectionProps } from '../types'
import { useExploreCommunities } from '../hooks/useExploreCommunities'
import CommunitySuggestions from './CommunitySuggestions'
import ExplorePosts from './ExplorePosts'
import { useExplorePeople } from '../hooks/useExplorePeople'
import UserAvatar from '../../../shared/ui/UserAvatar'
import { Button } from '../../../shared/ui/button'
import '../styles/explore-page.css'

const NearbyExplorer = lazy(() => import('./NearbyExplorer'))

type ExploreTab = 'all' | 'people' | 'posts' | 'communities' | 'recent'
const tabs: { id: ExploreTab; title: UiCopyKey }[] = [
  { id: 'all', title: 'common.all' },
  { id: 'people', title: 'discover.people' },
  { id: 'posts', title: 'discover.posts' },
  { id: 'communities', title: 'discover.communities' },
  { id: 'recent', title: 'discover.recent' },
]

function parseTab(value: string | null): ExploreTab {
  return tabs.find(tab => tab.id === value)?.id ?? 'all'
}

function friendLabel(relationship: ReturnType<DiscoverSectionProps['friendRelationship']>, trUi: ReturnType<typeof useUiTranslation>) {
  return relationship === 'accepted' ? trUi('chat.message')
    : relationship === 'incoming' ? trUi('common.accept')
      : relationship === 'outgoing' ? trUi('contacts.cancelInvitation') : trUi('contacts.addFriend')
}

export default function ExplorePage(props: DiscoverSectionProps) {
  return <ExplorePageContent key={props.sessionId} {...props} />
}

function ExplorePageContent(props: DiscoverSectionProps) {
  const trUi = useUiTranslation()

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
    <div className="explore-section-heading"><h2 id="explore-people-title">{trUi('discover.suggestedPeople')}</h2></div>
    {suggestions.loading && peopleCount === 0 ? <p role="status">{trUi('common.ui.loadingSuggestions')}</p> : suggestions.error && peopleCount === 0 ? <div role="alert" className="explore-state border-destructive/30! bg-destructive/5!">{suggestions.error} <button type="button" onClick={suggestions.retry}>{trUi("common.retry")}</button></div> : peopleCount === 0 ? <div className="explore-state explore-people-empty">
      <span className="explore-empty-icon" aria-hidden="true"><UsersRound size={22} /></span>
      <div className="explore-empty-copy"><strong>{trUi('discover.noConnections')}</strong><p>{trUi('discover.scanHint')}</p></div>
      <button type="button" onClick={() => setTab('recent')}><MapPin size={17} aria-hidden="true" /> {trUi('discover.exploreNearby')}</button>
    </div> : <div className="explore-people-grid">
      {(tab === 'all' ? peopleItems.slice(0, 3) : peopleItems).map(user => {
        const relationship = props.friendRelationship(user.id)
        const ActionIcon = relationship === 'outgoing' ? UserRoundMinus : relationship === 'incoming' ? UserRoundCheck : relationship === 'accepted' ? MessageCircle : UserPlus
        return <article key={user.id} className="explore-person grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-ui-3">
        <UserAvatar className="explore-person-avatar" name={user.displayName || user.username} username={user.username} online={user.online} />
        <div className="explore-person-info"><h3><Link className="text-inherit no-underline hover:underline" to={'/users/' + encodeURIComponent(user.username)}>{user.displayName || user.username}</Link></h3><p>@{user.username}</p></div>
        <Button variant={relationship === 'outgoing' ? 'outline' : 'secondary'} size="sm" className="col-span-2 h-auto min-h-control-touch w-full min-w-0 whitespace-normal px-ui-3 py-ui-2 text-center text-ui-label leading-tight" disabled={props.friendActionBusy === user.id} onClick={() => void props.actOnFriend(user)}>
          <ActionIcon size={16} aria-hidden="true" />
          <span className="min-w-0 wrap-anywhere">{friendLabel(relationship, trUi)}</span>
        </Button>
      </article>})}
    </div>}
  </section>

  const nearby = <section className="explore-near" aria-labelledby="explore-near-title">
    <h2 id="explore-near-title">{trUi('discover.nearYou')}</h2>
    <p>{trUi('discover.nearHint')}</p>
    <div className="explore-near-radar" aria-hidden="true" />
    <button type="button" disabled={props.nearbyBusy} onClick={() => void scanNearby()}><MapPin size={18} aria-hidden="true" />{trUi("discover.nearbyScan")}</button>
  </section>

  const tips = <section className="explore-tips" aria-labelledby="explore-tips-title">
    <h2 id="explore-tips-title"><Lightbulb size={18} aria-hidden="true" /> {trUi('discover.tips')}</h2>
    <ul>
      <li>{trUi('discover.tipProfile')}</li>
      <li>{trUi('discover.tipScan')}</li>
      <li>{trUi('discover.tipCommunity')}</li>
    </ul>
  </section>

  const shortcuts: { title: UiCopyKey; desc: UiCopyKey; icon: typeof MapPin; onClick: () => void }[] = [
    { title: 'discover.people', desc: 'discover.newConnections', icon: UserPlus, onClick: () => setTab('people') },
    { title: 'discover.posts', desc: 'discover.publicNearby', icon: FileText, onClick: () => setTab('posts') },
    { title: 'discover.communities', desc: 'discover.similarGroups', icon: UsersRound, onClick: () => setTab('communities') },
    { title: 'discover.recent', desc: 'discover.peopleAround', icon: MapPin, onClick: () => setTab('recent') },
  ]

  // Keep navigation outside the scrolling pane on Web and PWA.
  // It remains visible when the content scrolls or the global header collapses.
  return <div className="explore-shell">
    <nav className="explore-tabs" aria-label={trUi("common.ui.discoverCategories")}>
      {tabs.map(item => <button key={item.id} type="button" aria-current={tab === item.id ? 'page' : undefined}
        className={tab === item.id ? 'active' : ''} onClick={() => setTab(item.id)}>{trUi(item.title)}</button>)}
    </nav>
    <main className="explore-page">
      <h1 className="explore-visually-hidden">{trUi("discover.discover")}</h1>

    {tab === 'all' && <>
      <section className="explore-feature" aria-labelledby="explore-feature-title">
        <div className="explore-feature-content">
          <h2 id="explore-feature-title">{trUi('discover.heroTitle')}</h2>
          <p>{trUi('discover.heroHint')}</p>
          <div className="explore-feature-actions">
            <button type="button" className="explore-feature-primary" disabled={props.nearbyBusy} onClick={() => void scanNearby()}>
              <MapPin size={18} aria-hidden="true" /> {trUi('discover.findPeopleNearby')}
            </button>
            <button type="button" className="explore-feature-secondary" onClick={() => setTab('communities')}>{trUi('discover.joinCommunity')}</button>
            <button type="button" className="explore-feature-secondary" onClick={() => setTab('posts')}>{trUi('discover.viewNearbyPosts')}</button>
          </div>
        </div>
      </section>
      <section className="explore-shortcuts" aria-labelledby="explore-shortcuts-title">
        <h2 id="explore-shortcuts-title">{trUi("discover.quickDiscover")}</h2>
        <div className="explore-shortcut-grid">
          {shortcuts.map(({ title, desc, icon: Icon, onClick }) => <button key={title} type="button" onClick={onClick}>
            <span className="explore-shortcut-icon" aria-hidden="true"><Icon size={20} /></span>
            <span className="explore-shortcut-copy"><strong>{trUi(title)}</strong><small>{trUi(desc)}</small></span>
            <ArrowRight size={16} aria-hidden="true" />
          </button>)}
        </div>
      </section>
      {topics.length > 0 && <section className="explore-topics" aria-labelledby="explore-topics-title">
        <h2 id="explore-topics-title">{trUi('discover.topics')}</h2>
        <div className="explore-topic-list">
          {topics.map(topic => <button type="button" key={topic}
            aria-pressed={activeTopic === topic}
            onClick={() => setSelectedTopic(current => current === topic ? null : topic)}>
            {topic}
          </button>)}
        </div>
      </section>}
    </>}

    {tab === 'recent' ? <ErrorBoundary fallback={retry => <AsyncSectionFallback title={trUi("common.recent")} onRetry={retry} />}>
      <Suspense fallback={<AsyncSectionFallback title={trUi("common.recent")} loading />}>
        <NearbyExplorer query={props.globalSearch} onQueryChange={props.setGlobalSearch}
          users={props.nearbyUsers} peopleBusy={props.nearbyBusy} peopleScanning={props.nearbyScanning}
          peopleActive={props.nearbyUntil > 0} peopleRadiusKm={props.nearbyRadiusKm}
          resultRadiusKm={props.nearbyResultRadiusKm} onPeopleRadiusChange={props.setNearbyRadiusKm}
          peopleError={nearbyError} onScanPeople={scanNearby} onStopPeople={async () => { setNearbyError(''); await props.stopNearby() }}
          friendActionBusy={props.friendActionBusy} onFriendAction={props.actOnFriend}
          getFriendActionLabel={user => friendLabel(props.friendRelationship(user.id), trUi)} />
      </Suspense>
    </ErrorBoundary> : <div className={tab === 'all' ? 'explore-content-layout' : 'explore-content-layout explore-content-layout-single'}>
      <div className="explore-main-column">
        {isEmptyAll && <section className="explore-get-started" aria-labelledby="explore-get-started-title">
          <h2 id="explore-get-started-title">{trUi('discover.getStarted')}</h2>
          <p>{trUi('discover.twoSteps')}</p>
          <div className="explore-step-grid">
            <article className="explore-step">
              <span className="explore-step-number" aria-hidden="true">1</span>
              <h3>{trUi('discover.findNear')}</h3>
              <p>{trUi('discover.enableNearbyHint')}</p>
              <button type="button" className="explore-step-primary" disabled={props.nearbyBusy} onClick={() => void scanNearby()}>{trUi("discover.nearbyScan")}</button>
            </article>
            <article className="explore-step">
              <span className="explore-step-number" aria-hidden="true">2</span>
              <h3>{trUi('discover.joinOrCreate')}</h3>
              <p>{trUi('discover.publicCommunities')}</p>
              <button type="button" onClick={() => setTab('communities')}>{trUi('discover.viewCommunities')}</button>
            </article>
          </div>
          <p className="explore-empty-community">{trUi('discover.noPublicCommunities')}</p>
        </section>}
        {showCommunities && <CommunitySuggestions communities={communities} items={filteredCommunities}
          title={trUi("common.ui.activeCommunities")}
          onViewAll={tab === 'all' && communities.items.length > 0 ? () => setTab('communities') : undefined} />}
        {tab === 'people' && people}
        {(tab === 'all' || tab === 'posts') && <ExplorePosts request={props.request} preview={tab === 'all'} onViewAll={() => setTab('posts')} />}
      </div>
      {tab === 'all' && <aside className="explore-rail" aria-label={trUi("common.ui.discoverSuggestions")}>
        {(peopleCount > 0 || suggestions.error || suggestions.loading) && people}
        {nearby}
        {tips}
      </aside>}
    </div>}
    </main>
  </div>
}