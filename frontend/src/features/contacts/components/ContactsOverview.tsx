import { ArrowRight, Check, ChevronRight, Compass, QrCode, RefreshCw, ShieldCheck, Sparkles, UserRoundPlus, Users, X } from 'lucide-react'
import type { FriendConnection, FriendSearchResult } from '../types'
import UserAvatar from '../../../shared/ui/UserAvatar'
import ContactQrPanel from './ContactQrPanel'
import '../styles/contacts-overview.css'

type Props = {
  friends: FriendConnection[]
  friendRequests: FriendConnection[]
  suggestions: FriendSearchResult[]
  suggestionsLoading: boolean
  suggestionsError: boolean
  friendsLoading: boolean
  friendsError: string
  onRetryFriends: () => void
  onRetrySuggestions: () => void
  friendBusyIds: Set<number>
  actOnFriend: (friend: FriendSearchResult | FriendConnection) => Promise<void>
  declineFriendRequest: (friend: FriendConnection) => Promise<void>
  onDirectory: () => void
  onInvitations: () => void
  onSettings: () => void
  connectionUrl: string
  onScanQr: () => void
}

const displayName = (friend: FriendSearchResult) => friend.displayName || friend.username

export default function ContactsOverview({
  friends, friendRequests, suggestions, suggestionsLoading, suggestionsError,
  friendsLoading, friendsError, onRetryFriends, onRetrySuggestions, friendBusyIds,
  actOnFriend, declineFriendRequest, onDirectory, onInvitations, onSettings, connectionUrl, onScanQr,
}: Props) {
  const incoming = friendRequests.filter(friend => friend.direction === 'incoming')
  const connectedIds = new Set([...friends, ...friendRequests].map(friend => friend.id))
  const availableSuggestions = suggestions.filter(friend => !connectedIds.has(friend.id))
  const recommended = availableSuggestions.slice(0, 4)

  return <div className="contacts-overview" aria-label="Tổng quan Bạn bè">
    <section className="co-stats" aria-label="Thống kê kết nối">
      <button type="button" className="co-stat" onClick={onDirectory}>
        <span className="co-stat-icon co-stat-friends"><Users size={24} aria-hidden="true" /></span>
        <span><strong>{friendsLoading ? '…' : friends.length.toLocaleString('vi-VN')}</strong><small>Bạn bè</small></span>
      </button>
      <button type="button" className="co-stat" onClick={onInvitations}>
        <span className="co-stat-icon co-stat-requests"><UserRoundPlus size={23} aria-hidden="true" /></span>
        <span><strong>{friendsLoading ? '…' : incoming.length.toLocaleString('vi-VN')}</strong><small>Lời mời đến</small></span>
      </button>
      <button type="button" className="co-stat" onClick={onDirectory}>
        <span className="co-stat-icon co-stat-suggestions"><Sparkles size={23} aria-hidden="true" /></span>
        <span><strong>{suggestionsLoading ? '…' : suggestionsError ? '–' : availableSuggestions.length.toLocaleString('vi-VN')}</strong><small>Gợi ý kết nối hiện có</small></span>
      </button>
    </section>

    <div className="co-layout">
      <div className="co-main">
        <section className="co-section" aria-labelledby="co-requests-title">
          <div className="co-section-heading">
            <div><h2 id="co-requests-title">Lời mời kết bạn {incoming.length > 0 && <span className="co-count-pill">{incoming.length}</span>}</h2><p>{friendsLoading ? 'Đang đồng bộ lời mời' : `${incoming.length} lời mời đang chờ phản hồi`}</p></div>
            <button type="button" onClick={onInvitations}>Xem tất cả <ArrowRight size={16} aria-hidden="true" /></button>
          </div>
          <div className="co-request-card">
            {friendsLoading && <div className="co-skeleton-list" role="status" aria-label="Đang tải bạn bè và lời mời"><span className="co-skeleton-avatar" /><span className="co-skeleton-copy"><i /><i /></span><span className="co-skeleton-button" /></div>}
            {!friendsLoading && friendsError && <div className="co-feedback" role="alert"><span>Không tải được danh sách kết nối. Thử lại để xem thông tin mới nhất.</span><button type="button" onClick={onRetryFriends}><RefreshCw size={15} aria-hidden="true" /> Thử lại</button></div>}
            {!friendsLoading && !friendsError && incoming.length === 0 && <p className="co-empty">Bạn chưa có lời mời kết bạn mới.</p>}
            {!friendsLoading && incoming.slice(0, 3).map(friend => <div className="co-request" key={friend.id}>
              <UserAvatar username={friend.username} name={displayName(friend)} className="avatar co-avatar" online={friend.online} />
              <div className="co-person">
                <strong>{displayName(friend)}</strong>
                <small>{typeof friend.mutualGroups === 'number' ? `${friend.mutualGroups} nhóm chung · ` : ''}Đang chờ phản hồi</small>
              </div>
              <div className="co-request-actions">
                <button type="button" className="co-primary" disabled={friendBusyIds.has(friend.id)} onClick={() => void actOnFriend(friend)}>
                  <Check size={17} aria-hidden="true" /> {friendBusyIds.has(friend.id) ? 'Đang xử lý…' : 'Chấp nhận'}
                </button>
                <button type="button" className="co-secondary" disabled={friendBusyIds.has(friend.id)} onClick={() => void declineFriendRequest(friend)}>
                  <X size={17} aria-hidden="true" /> Từ chối
                </button>
              </div>
            </div>)}
          </div>
        </section>

        <section className="co-section" aria-labelledby="co-suggestions-title">
          <div className="co-section-heading">
            <div><h2 id="co-suggestions-title"><Sparkles size={20} aria-hidden="true" /> Bạn bè có thể quen</h2><p>Khám phá những kết nối mới trong cộng đồng SocCo.</p></div>
            <button type="button" onClick={onDirectory}>Tìm bạn mới <ArrowRight size={16} aria-hidden="true" /></button>
          </div>
          {suggestionsLoading && <div className="co-suggestion-grid" role="status" aria-label="Đang tải gợi ý kết nối">{Array.from({ length: 4 }, (_, index) => <div className="co-suggestion co-skeleton-card" key={index} aria-hidden="true"><span className="co-skeleton-avatar" /><span className="co-skeleton-copy"><i /><i /></span><span className="co-skeleton-button" /></div>)}</div>}
          {suggestionsError && !suggestionsLoading && <div className="co-feedback" role="alert"><span>Không tải được gợi ý kết nối. Bạn có thể thử lại.</span><button type="button" onClick={onRetrySuggestions}><RefreshCw size={15} aria-hidden="true" /> Thử lại</button></div>}
          {!suggestionsLoading && !suggestionsError && recommended.length === 0 && <p className="co-empty">Chưa có gợi ý kết nối phù hợp.</p>}
          {!suggestionsLoading && recommended.length > 0 && <div className="co-suggestion-grid">
            {recommended.map(friend => <article className="co-suggestion" key={friend.id}>
              <div className="co-suggestion-avatar-wrap"><UserAvatar username={friend.username} name={displayName(friend)} className="avatar co-suggestion-avatar" online={friend.online} /></div>
              <strong title={displayName(friend)}>{displayName(friend)}</strong>
              <small className="co-mutual">{typeof friend.mutualGroups === 'number' ? <><Users size={12} aria-hidden="true" /> {friend.mutualGroups} nhóm chung</> : `@${friend.username}`}</small>
              <button type="button" className="co-secondary" aria-label={`Kết bạn với ${displayName(friend)}`} disabled={friendBusyIds.has(friend.id)} onClick={() => void actOnFriend(friend)}>
                <UserRoundPlus size={17} aria-hidden="true" /> {friendBusyIds.has(friend.id) ? 'Đang gửi…' : 'Kết bạn'}
              </button>
            </article>)}
          </div>}
        </section>
        <div className="co-discover-banner"><div className="co-discover-badge"><Compass size={19} aria-hidden="true" /></div><div><strong>Kết nối nhiều hơn mỗi ngày</strong><span>Tìm kiếm người quen hoặc khám phá những người bạn mới.</span></div><button type="button" onClick={onDirectory}>Khám phá <ArrowRight size={15} aria-hidden="true" /></button></div>
      </div>
      <aside className="co-side" aria-label="Kết nối và quyền riêng tư">
        <section className="co-qr-wrap" aria-label="Kết nối bằng QR"><div className="co-side-eyebrow"><QrCode size={15} aria-hidden="true" /> KẾT NỐI NHANH</div><ContactQrPanel connectionUrl={connectionUrl} onScanQr={onScanQr} /></section>
        <section className="co-privacy">
          <h2><ShieldCheck size={22} aria-hidden="true" /> Quyền riêng tư</h2>
          <p>Chủ động lựa chọn cách bạn xuất hiện và kết nối trên SocCo.</p>
          <div className="co-privacy-details"><div><ShieldCheck size={16} aria-hidden="true" /><span>Kiểm soát quyền riêng tư</span><ChevronRight size={15} aria-hidden="true" /></div><div><UserRoundPlus size={16} aria-hidden="true" /><span>Quản lý lời mời kết bạn</span><ChevronRight size={15} aria-hidden="true" /></div></div>
          <button type="button" onClick={onSettings}>Quản lý quyền riêng tư <ArrowRight size={16} aria-hidden="true" /></button>
        </section>
      </aside>
    </div>
  </div>
}
