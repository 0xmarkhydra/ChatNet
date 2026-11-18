import { UsersRound } from 'lucide-react'
import type { ReturnTypeOfCommunities } from '../types'
import type { PublicCommunity } from '../api/explore'

export default function CommunitySuggestions({ communities }: { communities: ReturnTypeOfCommunities }) {
  return <section className="explore-communities" aria-labelledby="explore-communities-title">
    <div className="explore-section-heading"><h2 id="explore-communities-title">Cộng đồng nên khám phá</h2></div>
    {communities.joinMessage && <p className="explore-note" role="status">{communities.joinMessage}</p>}
    {communities.status === 'loading' && communities.items.length === 0 && <div className="explore-community-grid" aria-hidden="true">
      {[0, 1, 2].map(id => <div key={id} className="explore-community-card explore-skeleton" />)}
    </div>}
    {communities.status === 'loading' && <p className="sr-only" role="status">Đang tải cộng đồng…</p>}
    {communities.status === 'error' && <div className="explore-state" role="alert">
      <p>{communities.error}</p><button type="button" onClick={communities.retry}>Thử lại</button>
    </div>}
    {communities.status === 'ready' && communities.items.length === 0 && <p className="explore-state">Hiện chưa có cộng đồng công khai phù hợp.</p>}
    {communities.items.length > 0 && <div className="explore-community-grid">
      {communities.items.map((community: PublicCommunity) => <article key={community.id} className="explore-community-card">
        <div className="explore-community-icon" aria-hidden="true"><UsersRound size={23} /></div>
        <div className="explore-community-copy"><h3>{community.name}</h3>
          {community.description && <p>{community.description}</p>}
          <small>{typeof community.memberCount === 'number' ? community.memberCount.toLocaleString('vi-VN') + ' thành viên' : 'Cộng đồng công khai'}</small>
        </div>
        <button type="button" disabled={communities.joiningId !== null} onClick={() => void communities.join(community.id)}>
          {communities.joiningId === community.id ? 'Đang xử lý…' : 'Tham gia'}
        </button>
      </article>)}
    </div>}
  </section>
}
