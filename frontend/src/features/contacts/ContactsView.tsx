import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import QRCode from 'qrcode'
import { ArrowLeft, ArrowRight, Check, Clock3, Copy, Heart, MessageCircle, MoreHorizontal, Phone, Plus, QrCode, Search, ShieldCheck, UserRound, UserRoundPlus, Users, X } from 'lucide-react'
import type { FriendConnection, FriendSearchResult } from './types'
import UserAvatar from '../../shared/ui/UserAvatar'

export type FriendsScreen = 'directory' | 'invitations'
type InvitationTab = 'incoming' | 'sent' | 'qr'
type DirectoryFilter = 'alphabetical' | 'online' | 'favorites'
type Props = {
  screen: FriendsScreen
  onScreenChange: (screen: FriendsScreen) => void
  friendQuery: string
  setFriendQuery: (value: string) => void
  friendSearching: boolean
  friendSearchError: boolean
  setFriendSearchRetry: Dispatch<SetStateAction<number>>
  contactSearchResults: FriendSearchResult[]
  friendRelationship: (id: number) => 'accepted' | 'incoming' | 'outgoing' | 'none'
  friendBusyIds: Set<number>
  actOnFriend: (friend: FriendSearchResult | FriendConnection) => Promise<void>
  setFriendMenuId: Dispatch<SetStateAction<number | null>>
  friendMenuId: number | null
  blockContact: (friend: FriendSearchResult | FriendConnection) => Promise<void>
  reportContact: (friend: FriendSearchResult | FriendConnection) => Promise<void>
  friendRequests: FriendConnection[]
  declineFriendRequest: (friend: FriendConnection) => Promise<void>
  friends: FriendConnection[]
  contactMetadata: Record<number, { nickname: string; note: string; favorite: boolean }>
  openDirectByUsername: (username: string, mediaType?: 'audio' | 'video') => Promise<void>
  setFriendPreview: (friend: FriendSearchResult | null) => void
  changePersonalContact: (friend: FriendConnection, field: 'nickname' | 'note' | 'favorite') => Promise<void>
  removeAcceptedFriend: (friend: FriendConnection) => Promise<void>
  connectionUrl: string
  onScanQr: () => void
}

const personName = (friend: FriendSearchResult) => friend.displayName || friend.username
const actionText = (relationship: ReturnType<Props['friendRelationship']>) => ({
  accepted: 'Nhắn tin', incoming: 'Chấp nhận', outgoing: 'Hủy lời mời', none: 'Kết bạn',
}[relationship])

export default function ContactsView({
  screen, onScreenChange, friendQuery, setFriendQuery, friendSearching, friendSearchError,
  setFriendSearchRetry, contactSearchResults, friendRelationship, friendBusyIds, actOnFriend,
  setFriendMenuId, friendMenuId, blockContact, reportContact, friendRequests, declineFriendRequest,
  friends, contactMetadata, openDirectByUsername, setFriendPreview, changePersonalContact,
  removeAcceptedFriend, connectionUrl, onScanQr,
}: Props) {
  const [directoryFilter, setDirectoryFilter] = useState<DirectoryFilter>('alphabetical')
  const [invitationTab, setInvitationTab] = useState<InvitationTab>('incoming')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [qrImage, setQrImage] = useState('')
  const [copyStatus, setCopyStatus] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)
  const incoming = friendRequests.filter(friend => friend.direction === 'incoming')
  const outgoing = friendRequests.filter(friend => friend.direction === 'outgoing')
  const searching = Boolean(friendQuery.trim())

  const visibleFriends = useMemo(() => {
    const items = [...friends].filter(friend =>
      directoryFilter === 'online' ? friend.online :
      directoryFilter === 'favorites' ? Boolean(contactMetadata[friend.id]?.favorite) : true)
    if (directoryFilter === 'alphabetical') items.sort((a, b) =>
      (contactMetadata[a.id]?.nickname || personName(a)).localeCompare(
        contactMetadata[b.id]?.nickname || personName(b), 'vi'))
    return items
  }, [friends, directoryFilter, contactMetadata])
  const selectedFriend = visibleFriends.find(friend => friend.id === selectedId) ?? visibleFriends[0] ?? null
  const relationshipFor = (friend: FriendSearchResult) => friendRelationship(friend.id)
  const act = (friend: FriendSearchResult | FriendConnection) => {
    if (friendRelationship(friend.id) === 'accepted') void openDirectByUsername(friend.username)
    else void actOnFriend(friend)
  }
  const startCall = (friend: FriendSearchResult) => void openDirectByUsername(friend.username, 'audio')
  const enterInvitations = () => {
    setFriendQuery('')
    setInvitationTab('incoming')
    onScreenChange('invitations')
  }
  const openSearch = () => {
    setFriendQuery('')
    onScreenChange('directory')
    window.requestAnimationFrame(() => searchRef.current?.focus())
  }
  useEffect(() => {
    let cancelled = false
    QRCode.toDataURL(connectionUrl, { width: 400, margin: 2, errorCorrectionLevel: 'M' })
      .then(image => { if (!cancelled) setQrImage(image) })
      .catch(() => { if (!cancelled) setQrImage('') })
    return () => { cancelled = true }
  }, [connectionUrl])
  useEffect(() => { if (!copyStatus) return; const timer = window.setTimeout(() => setCopyStatus(''), 3500); return () => window.clearTimeout(timer) }, [copyStatus])
  async function copyLink() {
    try {
      await navigator.clipboard.writeText(connectionUrl)
      setCopyStatus('Đã sao chép liên kết kết bạn')
    } catch { setCopyStatus('Không thể sao chép. Kiểm tra quyền clipboard.') }
  }
  const avatar = (friend: FriendSearchResult, additional = '') => (
    <UserAvatar username={friend.username} name={personName(friend)}
      className={'avatar fd-avatar ' + additional} online={friend.online} />
  )
  const menu = (friend: FriendConnection) => (
    <div className="fd-options" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setFriendMenuId(null) }}>
      <button type="button" aria-label={'Tùy chọn của ' + personName(friend)} aria-expanded={friendMenuId === friend.id}
        onClick={() => setFriendMenuId(value => value === friend.id ? null : friend.id)}><MoreHorizontal size={18} /></button>
      {friendMenuId === friend.id && <div role="menu" className="fd-option-popover">
        <button role="menuitem" type="button" onClick={() => { setFriendPreview(friend); setFriendMenuId(null) }}>Xem trang cá nhân</button>
        <button role="menuitem" type="button" onClick={() => { setFriendMenuId(null); void changePersonalContact(friend, 'nickname') }}>Đặt biệt danh</button>
        <button role="menuitem" type="button" onClick={() => { setFriendMenuId(null); void changePersonalContact(friend, 'note') }}>Ghi chú riêng</button>
        <button role="menuitem" type="button" onClick={() => { setFriendMenuId(null); void changePersonalContact(friend, 'favorite') }}>
          {contactMetadata[friend.id]?.favorite ? 'Bỏ yêu thích' : 'Yêu thích'}
        </button>
        <button role="menuitem" type="button" disabled={friendBusyIds.has(friend.id)}
          onClick={() => { setFriendMenuId(null); void blockContact(friend) }}>Chặn người dùng</button>
        <button role="menuitem" type="button" onClick={() => { setFriendMenuId(null); void reportContact(friend) }}>Báo cáo</button>
        <button role="menuitem" type="button" disabled={friendBusyIds.has(friend.id)}
          onClick={() => { setFriendMenuId(null); void removeAcceptedFriend(friend) }}>Hủy kết bạn</button>
      </div>}
    </div>
  )

  return <div className="friends-design-v2" aria-label={screen === 'directory' ? 'Danh bạ' : 'Lời mời kết bạn'}>
    {screen === 'directory' ? <>
      <section className="fd-searchbar">
        <label><Search size={22} aria-hidden="true"/>
          <input ref={searchRef} type="search" value={friendQuery} onChange={event => setFriendQuery(event.target.value)}
            placeholder="Tìm theo tên, số điện thoại hoặc ID SocCo..." aria-label="Tìm trong danh bạ" />
          {friendQuery && <button type="button" aria-label="Xóa tìm kiếm" onClick={() => {setFriendQuery('');searchRef.current?.focus()}}><X size={17}/></button>}
        </label>
        <button type="button" className="fd-primary fd-add-new" onClick={enterInvitations}><Plus size={18}/>Kết bạn mới</button>
      </section>
      <div className="fd-directory-layout">
        <section className="fd-card fd-list-card">
          {searching ? <>
            <div className="fd-list-header"><div><h2>Kết quả tìm kiếm</h2><p>Tìm người dùng theo tên, username hoặc email</p></div>
              <button type="button" className="fd-text-button" onClick={() => setFriendQuery('')}>Xóa tìm kiếm</button></div>

            {friendSearchError && !friendSearching && <p className="fd-empty" role="alert">Không thể tìm người dùng.
              <button type="button" className="fd-text-button" onClick={() => setFriendSearchRetry(value => value + 1)}>Thử lại</button></p>}
            {!friendSearching && !friendSearchError && contactSearchResults.length === 0 && <p className="fd-empty">Không tìm thấy người dùng phù hợp.</p>}
            <div className="fd-person-list">{contactSearchResults.map(friend => <div className="fd-person-row" key={friend.id}>
              <button type="button" className="fd-person-identity" onClick={() => setFriendPreview(friend)}>{avatar(friend)}
                <span><strong>{personName(friend)}</strong><small>@{friend.username}</small></span></button>
              <button type="button" className="fd-secondary fd-search-action" disabled={friendBusyIds.has(friend.id)} onClick={() => act(friend)}>{actionText(relationshipFor(friend))}</button>
            </div>)}</div>
          </> : <>
            <div className="fd-list-header"><h2>Tất cả bạn bè</h2><span>{friends.length.toLocaleString('vi-VN')} người</span></div>
            <div className="fd-filters" role="group" aria-label="Lọc danh bạ">
              {([['alphabetical','A – Z'],['online','Đang online'],['favorites','Yêu thích']] as const).map(([filter,label]) =>
                <button type="button" key={filter} className={directoryFilter === filter ? 'active' : ''}
                  aria-pressed={directoryFilter === filter} onClick={() => setDirectoryFilter(filter)}>{label}</button>)}
            </div>
            <div className="fd-person-list" aria-label="Danh sách bạn bè">
              {visibleFriends.map(friend => <div className={'fd-person-row' + (selectedFriend?.id === friend.id ? ' selected' : '')} key={friend.id}>
                <button type="button" className="fd-person-identity" aria-pressed={selectedFriend?.id === friend.id}
                  onClick={() => setSelectedId(friend.id)}>{avatar(friend)}<span>
                    <strong>{contactMetadata[friend.id]?.nickname || personName(friend)}</strong>
                    <small>{friend.online ? 'Đang hoạt động' : 'Ngoại tuyến'}
                      {contactMetadata[friend.id]?.favorite ? ' · Yêu thích' : ''}</small>
                  </span></button>
                <button type="button" className="fd-icon-btn" aria-label={'Nhắn tin cho ' + personName(friend)}
                  onClick={() => void openDirectByUsername(friend.username)}><MessageCircle size={20}/></button>
                <button type="button" className="fd-icon-btn" aria-label={'Gọi thoại cho ' + personName(friend)}
                  onClick={() => startCall(friend)}><Phone size={20}/></button>
              </div>)}
              {visibleFriends.length === 0 && <p className="fd-empty">{friends.length ? 'Không có bạn bè trong bộ lọc này.' : 'Bạn chưa có bạn bè. Nhấn Kết bạn mới để kết nối.'}</p>}
            </div>
          </>}
        </section>
        <section className="fd-card fd-profile-panel" aria-label="Thông tin bạn bè">
          {selectedFriend && !searching ? <>
            <div className="fd-profile-cover" aria-hidden="true"/>
            <div className="fd-profile-core">
              {avatar(selectedFriend, 'fd-profile-avatar')}
              <h2>{contactMetadata[selectedFriend.id]?.nickname || personName(selectedFriend)}</h2>
              <p className={selectedFriend.online ? 'fd-online' : ''}>{selectedFriend.online ? 'Đang hoạt động' : 'Ngoại tuyến'}
                {typeof selectedFriend.mutualGroups === 'number' && selectedFriend.mutualGroups > 0 ? ' · ' + selectedFriend.mutualGroups + ' nhóm chung' : ''}
              </p>
            </div>
            <div className="fd-profile-actions">
              <button type="button" className="fd-primary" onClick={() => void openDirectByUsername(selectedFriend.username)}><MessageCircle size={20}/>Nhắn tin</button>
              <button type="button" className="fd-secondary" onClick={() => startCall(selectedFriend)}><Phone size={20}/>Gọi thoại</button>
            </div>
            <div className="fd-profile-info">
              <h3>Thông tin bạn bè</h3>
              <p><UserRound size={19}/>@{selectedFriend.username}</p>
              {typeof selectedFriend.mutualGroups === 'number' && <p><Users size={19}/>{selectedFriend.mutualGroups} nhóm chung</p>}
              {contactMetadata[selectedFriend.id]?.note && <p><Heart size={19}/>{contactMetadata[selectedFriend.id].note}</p>}
              <button type="button" onClick={() => setFriendPreview(selectedFriend)}><UserRound size={19}/>Xem trang cá nhân</button>
            </div>
            <div className="fd-profile-options"><h3><MoreHorizontal size={20}/>Tùy chọn</h3>
              <div>
                <button type="button" onClick={() => void changePersonalContact(selectedFriend, 'favorite')}>
                  {contactMetadata[selectedFriend.id]?.favorite ? 'Bỏ yêu thích' : 'Ghim'}
                </button><span>·</span>
                <button type="button" disabled={friendBusyIds.has(selectedFriend.id)} onClick={() => void blockContact(selectedFriend)}>Chặn</button><span>·</span>
                <button type="button" onClick={() => void reportContact(selectedFriend)}>Báo cáo</button><span>·</span>
                <button type="button" disabled={friendBusyIds.has(selectedFriend.id)} onClick={() => void removeAcceptedFriend(selectedFriend)}>Hủy kết bạn</button>
              </div>
              {menu(selectedFriend)}
            </div>
          </> : <div className="fd-empty fd-profile-placeholder"><Users size={38}/>
            <h2>{searching ? 'Kết nối bạn bè' : 'Chưa chọn bạn bè'}</h2><p>{searching ? 'Chọn một kết quả tìm kiếm để xem hồ sơ.' : 'Kết bạn mới để xem thông tin ở đây.'}</p></div>}
        </section>
      </div>
    </> : <>
      <div className="fd-invitation-tabs">
        <button type="button" className="fd-back" onClick={() => {onScreenChange('directory');setFriendQuery('')}} aria-label="Quay lại Danh bạ"><ArrowLeft size={17}/></button>
        <div role="tablist" aria-label="Lời mời kết bạn">
          {([['incoming','Lời mời đến'],['sent','Đã gửi'],['qr','Quét QR']] as const).map(([id,label]) =>
            <button role="tab" type="button" key={id} className={invitationTab === id ? 'active' : ''}
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
            <button type="button" className="fd-outgoing-summary" onClick={openSearch}>
              <UserRoundPlus size={20}/><span><strong>Tìm bạn bè mới</strong><small>Quay về danh bạ để tìm và gửi lời mời.</small></span><ArrowRight size={18}/>
            </button>
          </> : <>
            <div className="fd-invitation-heading"><h2>Quét QR</h2><p>Quét mã kết bạn hoặc chia sẻ mã QR của bạn.</p></div>
            <div className="fd-scan-feature"><QrCode size={76}/><h3>Kết nối bằng mã QR</h3>
              <p>Dùng camera hoặc tải ảnh QR trong chức năng quét mã của SocCo.</p>
              <button type="button" className="fd-primary" onClick={onScanQr}><QrCode size={19}/>Mở trình quét QR</button></div>
          </>}
        </section>
        <aside className="fd-card fd-qr-panel">
          <h2>Kết bạn bằng QR</h2><p>Chia sẻ mã QR cá nhân hoặc mở camera để quét.</p>
          <div className="fd-qr-preview">
            {qrImage && <img src={qrImage} alt="Mã QR liên kết kết bạn của tôi"/>}
          </div>
          <small>Mã QR chính xác của tài khoản hiện tại</small>
          <div className="fd-qr-actions">
            <button type="button" className="fd-secondary" onClick={() => void copyLink()}><Copy size={17}/>Sao chép link</button>
            <button type="button" className="fd-primary" onClick={onScanQr}><QrCode size={18}/>Quét QR</button>
          </div>
          {copyStatus && <p className="fd-copy-status" role="status">{copyStatus}</p>}
          <div className="fd-security-tip"><ShieldCheck size={20}/>
            <span><strong>An toàn khi kết nối</strong><small>Bạn quyết định ai có thể gửi yêu cầu.</small></span></div>
        </aside>
      </div>
    </>}
  </div>
}
