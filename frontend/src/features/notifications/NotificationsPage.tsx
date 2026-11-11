import { useEffect, useMemo, useState } from 'react'
import { Bell, Check, MessageCircle, Settings, UserRoundPlus, Users, X } from 'lucide-react'
import type { FriendConnection } from '../contacts/types'
import type { Conversation } from '../chat/types'
import UserAvatar from '../../shared/ui/UserAvatar'
import useSlidingPill from '../../shared/ui/useSlidingPill'
import { isIncomingFriendRequest, hasUnreadConversation } from './notification-count'
import './notifications-page.css'

type Notification = {
  key: string
  kind: 'friend' | 'message'
  name: string
  subtitle: string
  date: string
  username?: string
  friend?: FriendConnection
  conversation?: Conversation
}

type Props = {
  requests: FriendConnection[]
  conversations: Conversation[]
  search: string
  busyFriendIds: Set<number>
  onAccept: (friend: FriendConnection) => void
  onDecline: (friend: FriendConnection) => void
  onOpenConversation: (id: number) => void
  onOpenInvitations: () => void
  onOpenFriend: (username: string) => void
  onSettings: () => void
}

type NotificationFilter = 'all' | 'unread' | 'mentions'
const displayDate = (input: string) => {
  if (!input) return ''
  const date = new Date(input)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export default function NotificationsPage({
  requests, conversations, search, busyFriendIds, onAccept, onDecline,
  onOpenConversation, onOpenInvitations, onOpenFriend, onSettings,
}: Props) {
  const [filter, setFilter] = useState<NotificationFilter>('all')
  const filtersPill = useSlidingPill<HTMLDivElement>(filter)
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [readKeys, setReadKeys] = useState<Set<string>>(() => new Set())
  const notifications = useMemo<Notification[]>(() => {
    const pending = requests.filter(isIncomingFriendRequest).map(friend => ({
      key: 'friend:' + friend.id, kind: 'friend' as const, name: friend.displayName || friend.username,
      subtitle: 'đã gửi lời mời kết bạn', date: friend.updatedAt || '',
      username: friend.username, friend,
    }))
    const unreadChats = conversations.filter(hasUnreadConversation).map(c => ({
      key: 'chat:' + c.id, kind: 'message' as const, name: c.name,
      subtitle: 'có ' + c.unreadCount + ' tin nhắn chưa đọc',
      date: c.lastMessageAt || c.createdAt || '', conversation: c,
    }))
    return [...pending, ...unreadChats].sort((a, b) => (b.date || '').localeCompare(a.date || ''))
  }, [requests, conversations])

  const filtered = notifications.filter(item => {
    if (filter === 'mentions') return false // No mention-notification API yet.
    if (filter === 'unread' && readKeys.has(item.key)) return false
    const term = search.toLocaleLowerCase('vi-VN').trim()
    return !term || (item.name + ' ' + item.subtitle).toLocaleLowerCase('vi-VN').includes(term)
  })
  const selected = filtered.find(n => n.key === selectedKey) ?? filtered[0] ?? null
  const unseenCount = notifications.filter(n => !readKeys.has(n.key)).length

  useEffect(() => {
    // Retain local read state only for notifications still backed by active server data.
    setReadKeys(previous => {
      if (!previous.size) return previous
      const known = new Set(notifications.map(n => n.key))
      const next = new Set([...previous].filter(key => known.has(key)))
      return next.size === previous.size ? previous : next
    })
  }, [notifications])

  const markRead = (key: string) => setReadKeys(previous => {
    if (previous.has(key)) return previous
    const next = new Set(previous)
    next.add(key)
    return next
  })

  return <div className="np-screen" aria-label="Màn hình Thông báo">
    <div className="np-layout">
      <section className="np-card np-list-pane" aria-label="Thông báo mới">
        <h2>Thông báo mới</h2>
        <div ref={filtersPill.hostRef} className="np-filters sliding-pill-host" role="tablist" aria-label="Lọc thông báo">
          <span ref={filtersPill.pillRef} className="sliding-pill notifications-active-pill" aria-hidden="true" />
          {([['all','Tất cả'], ['unread','Chưa đọc'], ['mentions','Nhắc đến']] as const)
            .map(([key, label]) => <button ref={filter === key ? filtersPill.activeRef : undefined} type="button" role="tab" key={key}
              className={filter === key ? 'active' : ''} aria-selected={filter === key}
              onClick={() => setFilter(key)}>{label}</button>)}
        </div>
        <div className="np-notification-list">
          {filtered.map(item => <button key={item.key} type="button"
            className={'np-notification-row' + (selected?.key === item.key ? ' selected' : '') + (readKeys.has(item.key) ? ' is-read' : '')}
            onClick={() => { setSelectedKey(item.key); markRead(item.key) }}>
            {item.kind === 'friend' && item.username
              ? <UserAvatar username={item.username} name={item.name} online={false} className="avatar np-avatar"/>
              : <span className="np-group-avatar"><Users size={21}/></span>}
            <span className="np-notification-copy">
              <strong>{item.name}</strong><span>{item.subtitle}</span>
              <small>{displayDate(item.date)}</small>
            </span>
            <span className="np-row-icon" aria-hidden="true">
              {item.kind === 'friend' ? <UserRoundPlus size={18}/> : <MessageCircle size={18}/>}
            </span>
          </button>)}
          {!filtered.length && <div className="np-empty" role="status">
            <Bell size={27}/>
            <strong>{filter === 'mentions' ? 'Chưa có thông báo nhắc đến' : filter === 'unread' ? 'Không có thông báo chưa đọc' : 'Chưa có thông báo phù hợp'}</strong>
            <p>{filter === 'mentions' ? 'Chức năng nhận nhắc đến sẽ hiển thị khi backend hỗ trợ.' : 'Các lời mời và hội thoại chưa đọc sẽ xuất hiện ở đây.'}</p>
          </div>}
        </div>
        {filter === 'all' && unseenCount > 0 && <small className="np-unread-hint">{unseenCount} thông báo chưa xem trên thiết bị này</small>}
      </section>
      <aside className="np-card np-detail-pane" aria-label="Thông tin thông báo">
        <h2>Thông tin thông báo</h2>
        {selected ? <>
          <div className="np-detail-person">
            {selected.kind === 'friend' && selected.username
              ? <UserAvatar username={selected.username} name={selected.name} online={false} className="avatar np-detail-avatar"/>
              : <span className="np-detail-group-avatar"><Users size={35}/></span>}
            <h3>{selected.name}</h3>
            <p>{selected.subtitle}</p>
          </div>
          <div className="np-detail-description">
            {selected.kind === 'friend' && selected.friend ? <>
              <p><strong>@{selected.friend.username}</strong></p>
              <p>{typeof selected.friend.mutualGroups === 'number'
                ? 'Bạn có ' + selected.friend.mutualGroups + ' nhóm chung.'
                : 'Lời mời kết bạn đang chờ phản hồi.'}</p>
            </> : <>
              <p><strong>{selected.conversation?.type === 'group' ? 'Nhóm trò chuyện' : 'Hội thoại cá nhân'}</strong></p>
              <p>{selected.subtitle}</p>
              {selected.conversation?.lastMessage && <p className="np-message-preview">{selected.conversation.lastMessage}</p>}
            </>}
          </div>
          <div className="np-detail-actions">
            {selected.friend ? <>
              <button type="button" className="np-primary" disabled={busyFriendIds.has(selected.friend.id)}
                onClick={() => onAccept(selected.friend!)}><Check size={17}/>Chấp nhận lời mời</button>
              <button type="button" className="np-secondary" disabled={busyFriendIds.has(selected.friend.id)}
                onClick={() => onDecline(selected.friend!)}><X size={17}/>Từ chối</button>
              <button type="button" className="np-text-link" onClick={() => selected.username && onOpenFriend(selected.username)}>Xem hồ sơ người gửi</button>
            </> : selected.conversation ? <>
              <button type="button" className="np-primary" onClick={() => onOpenConversation(selected.conversation!.id)}>
                <MessageCircle size={17}/>Mở cuộc trò chuyện</button>
              <button type="button" className="np-secondary" onClick={() => markRead(selected.key)}>
                <Check size={17}/>Đánh dấu đã xem trên thiết bị</button>
            </> : null}
          </div>
        </> : <div className="np-detail-empty"><Bell size={40}/>
          <h3>Chọn một thông báo</h3><p>Chi tiết sẽ hiển thị ở đây.</p>
        </div>}
        <button type="button" className="np-settings" onClick={onSettings}>
          <Settings size={20}/><span><strong>Quản lý thông báo</strong><small>Tùy chỉnh thông báo bạn muốn nhận.</small></span>
        </button>
        <button type="button" className="np-invites-link" onClick={onOpenInvitations}>Xem lời mời kết bạn</button>
      </aside>
    </div>
  </div>
}
