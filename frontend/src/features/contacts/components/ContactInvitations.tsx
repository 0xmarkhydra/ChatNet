import { useState } from 'react'
import { ArrowLeft, ArrowRight, Check, Clock3, QrCode, UserRoundPlus, X } from 'lucide-react'
import type { FriendConnection, FriendSearchResult } from '../types'
import UserAvatar from '../../../shared/ui/UserAvatar'
import useSlidingPill from '../../../shared/ui/useSlidingPill'
import ContactQrPanel from './ContactQrPanel'

type InvitationTab = 'incoming' | 'sent' | 'qr'
type Props = {
  friendRequests: FriendConnection[]
  friendBusyIds: Set<number>
  actOnFriend: (friend: FriendSearchResult | FriendConnection) => Promise<void>
  declineFriendRequest: (friend: FriendConnection) => Promise<void>
  connectionUrl: string
  onScanQr: () => void
  onBack: () => void
  onSearch: () => void
}

const personName = (friend: FriendConnection) => friend.displayName || friend.username

export default function ContactInvitations({ friendRequests, friendBusyIds, actOnFriend, declineFriendRequest, connectionUrl, onScanQr, onBack, onSearch }: Props) {
  const [invitationTab, setInvitationTab] = useState<InvitationTab>('incoming')
  const { hostRef, pillRef, activeRef } = useSlidingPill<HTMLDivElement>(invitationTab)
  const incoming = friendRequests.filter(friend => friend.direction === 'incoming')
  const outgoing = friendRequests.filter(friend => friend.direction === 'outgoing')
  const avatar = (friend: FriendConnection) => (
    <UserAvatar username={friend.username} name={personName(friend)} className="avatar fd-avatar" online={friend.online} />
  )
  return <>
      <div className="fd-invitation-tabs">
        <button type="button" className="fd-back" onClick={onBack} aria-label="Quay lại Danh bạ"><ArrowLeft size={17}/></button>
        <div ref={hostRef} className="sliding-pill-host" role="tablist" aria-label="Lời mời kết bạn">
          <span ref={pillRef} className="sliding-pill invitation-active-pill" aria-hidden="true" />
          {([['incoming','Lời mời đến'],['sent','Đã gửi'],['qr','Quét QR']] as const).map(([id,label]) =>
            <button ref={invitationTab === id ? activeRef : undefined} role="tab" type="button" key={id} className={invitationTab === id ? 'active' : ''}
              aria-selected={invitationTab === id} onClick={() => setInvitationTab(id)}>{label}</button>)}
        </div>
        <small>{incoming.length + outgoing.length} đang chờ xử lý</small>
      </div>
      <div className="fd-invitation-layout">
        <section className="fd-card fd-invitation-list" role="tabpanel">
          {invitationTab === 'incoming' ? <>
            <div className="fd-invitation-heading"><h2>Lời mời đến</h2><p>Lời mời sẽ không tự động được chấp nhận</p></div>
            {incoming.length === 0 && <p className="fd-empty">Chưa có lời mời kết bạn đến.</p>}
            {incoming.map(friend => <div className="fd-request-row" key={friend.id}>
              {avatar(friend)}<div className="fd-request-copy"><strong>{personName(friend)}</strong>
                <span>@{friend.username} · Đang chờ phản hồi</span></div>
              <button type="button" className="fd-primary" disabled={friendBusyIds.has(friend.id)} onClick={() => void actOnFriend(friend)}><Check size={17}/>Chấp nhận</button>
              <button type="button" className="fd-secondary" disabled={friendBusyIds.has(friend.id)} onClick={() => void declineFriendRequest(friend)}><X size={17}/>Từ chối</button>
            </div>)}
            <button type="button" className="fd-outgoing-summary" onClick={() => setInvitationTab('sent')}>
              <Clock3 size={18}/><span><strong>Đã gửi {outgoing.length} lời mời</strong><small>Bạn có thể hủy lời mời khi chưa được chấp nhận.</small></span><ArrowRight size={18}/>
            </button>
          </> : invitationTab === 'sent' ? <>
            <div className="fd-invitation-heading"><h2>Đã gửi</h2><p>Những lời mời đang chờ người nhận phản hồi</p></div>
            {outgoing.length === 0 && <p className="fd-empty">Bạn chưa có lời mời đang chờ.</p>}
            {outgoing.map(friend => <div className="fd-request-row" key={friend.id}>
              {avatar(friend)}<div className="fd-request-copy"><strong>{personName(friend)}</strong><span>@{friend.username} · Đang chờ</span></div>
              <button type="button" className="fd-secondary" disabled={friendBusyIds.has(friend.id)}
                onClick={() => void actOnFriend(friend)}><X size={17}/>Hủy lời mời</button>
            </div>)}
            <button type="button" className="fd-outgoing-summary" onClick={onSearch}>
              <UserRoundPlus size={20}/><span><strong>Tìm bạn bè mới</strong><small>Quay về danh bạ để tìm và gửi lời mời.</small></span><ArrowRight size={18}/>
            </button>
          </> : <>
            <div className="fd-invitation-heading"><h2>Quét QR</h2><p>Quét mã kết bạn hoặc chia sẻ mã QR của bạn.</p></div>
            <div className="fd-scan-feature"><QrCode size={76}/><h3>Kết nối bằng mã QR</h3>
              <p>Dùng camera hoặc tải ảnh QR trong chức năng quét mã của SocCo.</p>
              <button type="button" className="fd-primary" onClick={onScanQr}><QrCode size={19}/>Mở trình quét QR</button></div>
          </>}
        </section>
        <ContactQrPanel connectionUrl={connectionUrl} onScanQr={onScanQr} />
      </div>

  </>
}
