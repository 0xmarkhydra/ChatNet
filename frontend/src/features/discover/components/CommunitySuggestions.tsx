import { UsersRound } from 'lucide-react'
import type { ExploreCommunitiesState } from '../types'
import type { PublicCommunity } from '../api/explore'

type Props = {
  communities: ExploreCommunitiesState
  items?: PublicCommunity[]
  title?: string
  onViewAll?: () => void
}

export default function CommunitySuggestions({ communities, items = communities.items, title = 'Cộng đồng đang hoạt động', onViewAll }: Props) {
  return <section className="explore-communities" aria-labelledby="explore-communities-title">
    <div className="explore-section-heading">
      <h2 id="explore-communities-title">{title}</h2>
      {onViewAll && <button type="button" className="explore-view-all" onClick={onViewAll}>Xem tất cả</button>}
    </div>
    {communities.joinMessage && <p className="explore-note" role="status">{communities.joinMessage}</p>}
    {communities.status === 'loading' && items.length === 0 && <>
      <div className="explore-community-grid" aria-hidden="true">
        {[0, 1, 2].map(id => <div key={id} className="explore-community-card explore-skeleton" />)}
      </div>
      <p className="sr-only" role="status">Đang tải cộng đồng…</p>
    </>}
    {communities.status === 'error' && <div className="explore-state" role="alert">
      <p>{communities.error}</p><button type="button" onClick={communities.retry}>Thử lại</button>
    </div>}
    {communities.status === 'ready' && items.length === 0 && <div className="explore-state">
      <span className="explore-empty-icon" aria-hidden="true"><UsersRound size={22} /></span>
      <div className="explore-empty-copy"><strong>Chưa có cộng đồng gợi ý</strong><p>Hiện chưa có cộng đồng công khai phù hợp.</p></div>
    </div>}
    {items.length > 0 && <div className="explore-community-grid">
      {items.map((community, index) => <article key={community.id} className="explore-community-card">
        <div className={'explore-community-strip explore-card-tone-' + index % 4} aria-hidden="true" />
        <div className={'explore-community-icon explore-card-tone-' + index % 4} aria-hidden="true">
          {community.name.trim().charAt(0).toLocaleUpperCase('vi-VN') || <UsersRound size={23} />}
        </div>
        <div className="explore-community-copy">
          <h3>{community.name}</h3>
          {community.description && <p>{community.description}</p>}
          {typeof community.memberCount === 'number' && <small>{community.memberCount.toLocaleString('vi-VN')} thành viên</small>}
        </div>
        <button type="button" disabled={communities.joiningId !== null} onClick={() => void communities.join(community.id)}>
          {communities.joiningId === community.id ? 'Đang xử lý…' : 'Tham gia'}
        </button>
      </article>)}
    </div>}
  </section>
}
