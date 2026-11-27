import { useUiTranslation } from '@/shared/i18n/locale'
import { UsersRound } from 'lucide-react'
import type { ExploreCommunitiesState } from '../types'
import type { PublicCommunity } from '../api/explore'

type Props = {
  communities?: ExploreCommunitiesState
  items?: PublicCommunity[]
  joinedItems?: Array<{ id: number; name: string; memberCount: number; avatarUrl?: string }>
  onOpenJoined?: (id: number) => void
  title?: string
  onViewAll?: () => void
}

export default function CommunitySuggestions({ communities, items, joinedItems, onOpenJoined, title: customTitle, onViewAll }: Props) {
  const trUi = useUiTranslation()
  const title = customTitle ?? trUi('common.ui.activeCommunities')

  if (joinedItems) return <section className="social-feed-side-card social-feed-my-communities" aria-label={title}>
    <header><h2>{title}</h2>{onViewAll && <button type="button" onClick={onViewAll}>{trUi("common.seeAll")}</button>}</header>
    {joinedItems.length === 0 && <p className="social-feed-community-empty">{trUi("discover.noCommunities")}</p>}
    <div className="social-feed-community-list">
      {joinedItems.map(group => <button type="button" className="social-feed-community-item" key={group.id}
        aria-label={trUi("common.ui.openCommunityNamed", { v1: String(group.name) })} onClick={() => onOpenJoined?.(group.id)}>
        <span className="social-feed-community-icon" aria-hidden="true"><UsersRound size={19} /></span>
        <span><strong>{group.name}</strong><small>{trUi('common.countMembers', { count: group.memberCount })}</small></span>
      </button>)}
    </div>
  </section>
  if (!communities) return null
  const visibleItems = items ?? communities.items
  return <section className="explore-communities" aria-labelledby="explore-communities-title">
    <div className="explore-section-heading">
      <h2 id="explore-communities-title">{title}</h2>
      {onViewAll && <button type="button" className="explore-view-all" onClick={onViewAll}>{trUi("common.seeAll")}</button>}
    </div>
    {communities.joinMessage && <p className="explore-note" role="status">{communities.joinMessage}</p>}
    {communities.status === 'loading' && visibleItems.length === 0 && <>
      <div className="explore-community-grid" aria-hidden="true">
        {[0, 1, 2].map(id => <div key={id} className="explore-community-card explore-skeleton" />)}
      </div>
      <p className="text-sm text-muted-foreground" role="status">{trUi('discover.loadingCommunities')}</p>
    </>}
    {communities.status === 'error' && <div className="explore-state border-destructive/30! bg-destructive/5!" role="alert">
      <p>{communities.error}</p><button type="button" onClick={communities.retry}>{trUi("common.retry")}</button>
    </div>}
    {communities.status === 'ready' && visibleItems.length === 0 && <div className="explore-state">
      <span className="explore-empty-icon" aria-hidden="true"><UsersRound size={22} /></span>
      <div className="explore-empty-copy"><strong>{trUi('discover.noSuggestedCommunities')}</strong><p>{trUi('discover.noMatchingCommunities')}</p></div>
    </div>}
    {visibleItems.length > 0 && <div className="explore-community-grid">
      {visibleItems.map((community, index) => <article key={community.id} className="explore-community-card">
        <div className={'explore-community-strip explore-card-tone-' + index % 4} aria-hidden="true" />
        <div className={'explore-community-icon explore-card-tone-' + index % 4} aria-hidden="true">
          {community.name.trim().charAt(0).toLocaleUpperCase('vi-VN') || <UsersRound size={23} />}
        </div>
        <div className="explore-community-copy">
          <h3>{community.name}</h3>
          {community.description && <p>{community.description}</p>}
          {typeof community.memberCount === 'number' && <small>{trUi("common.countMembers", { count: community.memberCount })}</small>}
        </div>
        <button type="button" disabled={communities.joiningId !== null} onClick={() => void communities.join(community.id)}>
          {communities.joiningId === community.id ? trUi("common.processing") : trUi('discover.join')}
        </button>
      </article>)}
    </div>}
  </section>
}