import { RefreshCw, Search, UserRoundSearch } from 'lucide-react'
import type { FriendSearchResult } from '../types'
import UserAvatar from '../../../shared/ui/UserAvatar'

type Relationship = 'accepted' | 'incoming' | 'outgoing' | 'none'

type Props = {
  results: FriendSearchResult[]
  loading: boolean
  error: boolean
  busyIds: ReadonlySet<number>
  relationshipFor: (id: number) => Relationship
  onAction: (friend: FriendSearchResult) => void
  onProfile: (friend: FriendSearchResult) => void
  onRetry: () => void
}

const labels: Record<Relationship, string> = {
  accepted: 'Nhắn tin',
  incoming: 'Chấp nhận',
  outgoing: 'Hủy lời mời',
  none: 'Kết bạn',
}

export default function ContactSearchResults({
  results, loading, error, busyIds, relationshipFor, onAction, onProfile, onRetry,
}: Props) {
  return <div className="fd-search-results" aria-busy={loading}>
    {loading ? <div className="fd-search-status" role="status">
      <Search size={20} aria-hidden="true" /><span>Đang tìm kiếm người dùng…</span>
    </div> : error ? <div className="fd-search-status" role="alert">
      <span>Không thể tìm người dùng. Kiểm tra kết nối rồi thử lại.</span>
      <button type="button" className="fd-secondary" onClick={onRetry}>
        <RefreshCw size={15} aria-hidden="true" /> Thử lại
      </button>
    </div> : results.length === 0 ? <div className="fd-search-status" role="status">
      <UserRoundSearch size={21} aria-hidden="true" /><span>Không tìm thấy người dùng phù hợp.</span>
    </div> : <div className="fd-person-list" aria-label="Kết quả tìm kiếm người dùng">
      {results.map(friend => {
        const name = friend.displayName || friend.username
        const busy = busyIds.has(friend.id)
        const relationship = relationshipFor(friend.id)
        return <div className="fd-person-row" key={friend.id} aria-busy={busy}>
          <button type="button" className="fd-person-identity" onClick={() => onProfile(friend)}>
            <UserAvatar username={friend.username} name={name} className="avatar fd-avatar" online={friend.online} />
            <span><strong>{name}</strong><small>@{friend.username}</small></span>
          </button>
          <button type="button" className="fd-secondary fd-search-action"
            aria-label={`${labels[relationship]} với ${name}`}
            disabled={busy} onClick={() => onAction(friend)}>
            {busy ? 'Đang xử lý…' : labels[relationship]}
          </button>
        </div>
      })}
    </div>}
  </div>
}
