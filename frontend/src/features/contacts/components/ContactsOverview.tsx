import { ArrowRight, Check, ShieldCheck, UserRoundPlus, Users, X } from 'lucide-react'
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
  friends, friendRequests, suggestions, suggestionsLoading, suggestionsError, friendBusyIds,
  actOnFriend, declineFriendRequest, onDirectory, onInvitations, onSettings, connectionUrl, onScanQr,
}: Props) {
  const incoming = friendRequests.filter(friend => friend.direction === 'incoming')
  const connectedIds = new Set([...friends, ...friendRequests].map(friend => friend.id))
  const recommended = suggestions.filter(friend => !connectedIds.has(friend.id)).slice(0, 3)

  return <div className="contacts-overview" aria-label="Tổng quan Bạn bè">
    <section className="co-stats" aria-label="Thống kê kết nối">
      <button type="button" className="co-stat" onClick={onDirectory}>
        <span className="co-stat-icon co-stat-friends"><Users size={24} aria-hidden="true" /></span>
        <span><strong>{friends.length.toLocaleString('vi-VN')}</strong><small>Bạn bè</small></span>
      </button>
      <button type="button" className="co-stat" onClick={onInvitations}>
        <span className="co-stat-icon co-stat-requests"><UserRoundPlus size={23} aria-hidden="true" /></span>
        <span><strong>{incoming.length.toLocaleString('vi-VN')}</strong><small>Lời mời đến</small></span>
      </button>
      <button type="button" className="co-stat" onClick={onDirectory}>
        <span className="co-stat-icon co-stat-suggestions"><Users size={23} aria-hidden="true" /></span>
        <span><strong>{recommended.length.toLocaleString('vi-VN')}</strong><small>Gợi ý kết nối hiện có</small></span>
      </button>
    </section>

    <div className="co-layout">
      <div className="co-main">
        <section className="co-section" aria-labelledby="co-requests-title">
          <div className="co-section-heading">
            <div><h2 id="co-requests-title">Lời mời kết bạn</h2><p>{incoming.length} lời mời đang chờ phản hồi</p></div>
            <button type="button" onClick={onInvitations}>Xem tất cả <ArrowRight size={16} aria-hidden="true" /></button>
          </div>
          <div className="co-request-card">
            {incoming.length === 0 && <p className="co-empty">Bạn chưa có lời mời kết bạn mới.</p>}
            {incoming.slice(0, 3).map(friend => <div className="co-request" key={friend.id}>
              <UserAvatar username={friend.username} name={displayName(friend)} className="avatar co-avatar" online={friend.online} />
              <div className="co-person">
                <strong>{displayName(friend)}</strong>
                <small>{typeof friend.mutualGroups === 'number' ? `${friend.mutualGroups} nhóm chung · ` : ''}Đang chờ phản hồi</small>
              </div>
              <div className="co-request-actions">
                <button type="button" className="co-primary" disabled={friendBusyIds.has(friend.id)} onClick={() => void actOnFriend(friend)}>
                  <Check size={17} aria-hidden="true" /> Chấp nhận
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
            <div><h2 id="co-suggestions-title">Bạn bè có thể quen</h2></div>
            <button type="button" onClick={onDirectory}>Tìm bạn mới <ArrowRight size={16} aria-hidden="true" /></button>
          </div>
          {suggestionsLoading && <p className="co-empty" role="status">Đang tải gợi ý kết nối...</p>}
          {suggestionsError && !suggestionsLoading && <p className="co-empty" role="alert">Không tải được gợi ý. Bạn có thể tìm bạn trong Danh bạ.</p>}
          {!suggestionsLoading && !suggestionsError && recommended.length === 0 && <p className="co-empty">Chưa có gợi ý kết nối phù hợp.</p>}
          {recommended.length > 0 && <div className="co-suggestion-grid">
            {recommended.map(friend => <article className="co-suggestion" key={friend.id}>
              <UserAvatar username={friend.username} name={displayName(friend)} className="avatar co-suggestion-avatar" online={friend.online} />
              <strong>{displayName(friend)}</strong>
              <small>{typeof friend.mutualGroups === 'number' ? `${friend.mutualGroups} nhóm chung` : `@${friend.username}`}</small>
              <button type="button" className="co-secondary" disabled={friendBusyIds.has(friend.id)} onClick={() => void actOnFriend(friend)}>
                <UserRoundPlus size={17} aria-hidden="true" /> Kết bạn
              </button>
            </article>)}
          </div>}
        </section>
      </div>
      <aside className="co-side" aria-label="Kết nối và quyền riêng tư">
        <ContactQrPanel connectionUrl={connectionUrl} onScanQr={onScanQr} />
        <section className="co-privacy">
          <h2><ShieldCheck size={22} aria-hidden="true" /> Quyền riêng tư</h2>
          <p>Kiểm soát ai được xem hồ sơ và gửi lời mời kết bạn.</p>
          <button type="button" onClick={onSettings}>Quản lý quyền riêng tư <ArrowRight size={16} aria-hidden="true" /></button>
        </section>
      </aside>
    </div>
  </div>
}
