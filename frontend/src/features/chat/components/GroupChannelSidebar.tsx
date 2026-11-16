import { useMemo, useState } from 'react'
import { BellOff, Search, X } from 'lucide-react'
import type { GroupChannel } from '../utils/groupChannels'
import '../styles/group-channel-sidebar.css'

export type GroupChannelMenuActions = {
  groupId: number
  userId: number
  canEdit: boolean
  canLeave: boolean
  canManage: boolean
  canCreateChannel: boolean
  channelCreateBusy: boolean
  groupMuted?: boolean
  request: (path: string, init?: RequestInit) => Promise<Response>
  notify: (message: string, kind?: 'success' | 'error' | 'warning') => void
  onGroupRenamed: (name: string) => void
  onGroupNotificationChanged: (muted: boolean) => void
  onToggleGroupNotifications: () => void
  notificationBusy: boolean
  onChannelsChanged: () => Promise<void>
  onChannelDeleted: () => Promise<void>
  onLeftGroup: () => void
  onShowGroupInfo: () => void
  onShowChannelInfo: (id: number) => void
  onShowGroupManagement: (section: 'members' | 'details' | 'permissions' | 'requests' | 'rules' | 'activity') => void
  onCreateGroupActivity: (kind: 'poll' | 'note' | 'reminder') => void
  onCreateChannel: (name: string, description: string) => Promise<boolean>
}

type Props = {
  groupName: string
  memberCount: number
  groupAvatarUrl?: string
  channels: GroupChannel[]
  selectedId: number
  unreadAvailable: boolean
  open: boolean
  onSelect: (id: number) => void
  actions?: GroupChannelMenuActions
}

/** Deterministic topic initials provide a fallback when a channel has no avatar. */
export const channelTopicPreview = (name: string, topic: string) => {
  const value = (topic.trim() || name.trim()).normalize('NFC')
  const words = value.split(/\s+/).filter(Boolean)
  return words.length > 1
    ? (words[0][0] + words[words.length - 1][0]).toLocaleUpperCase('vi-VN')
    : (words[0] || '#').slice(0, 2).toLocaleUpperCase('vi-VN')
}

export const channelTopicTone = (name: string, topic: string) => {
  const value = topic.trim() || name.trim()
  let hash = 0
  for (const point of value) hash = (hash * 31 + point.codePointAt(0)!) >>> 0
  return hash % 6
}

const formatChannelTime = (timestamp?: string) => {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  if (!Number.isFinite(date.getTime())) return ''
  const now = new Date()
  return date.toDateString() === now.toDateString()
    ? date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
    : date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })
}

export default function GroupChannelSidebar({
  groupAvatarUrl, channels, selectedId, unreadAvailable, open, onSelect,
}: Props) {
  const [search, setSearch] = useState('')
  const filtered = useMemo(() => channels.filter(channel =>
    (channel.name + ' ' + channel.description + ' ' + channel.lastMessage).toLocaleLowerCase('vi-VN')
      .includes(search.trim().toLocaleLowerCase('vi-VN'))), [channels, search])

  return (
    <aside className={open ? 'group-channel-sidebar open' : 'group-channel-sidebar'}
      aria-label="Danh sách kênh hội thoại">
      <div className="group-channel-sidebar-topbar">
        <label className="group-channel-sidebar-search">
          <Search size={17} aria-hidden="true" />
          <input type="search" aria-label="Tìm kênh hội thoại" placeholder="Tìm kênh hội thoại..."
            value={search} onChange={event => setSearch(event.target.value)} />
          {search && <button type="button" aria-label="Xóa tìm kiếm kênh" onClick={() => setSearch('')}>
            <X size={15} aria-hidden="true" />
          </button>}
        </label>
      </div>
      {!unreadAvailable && <p className="group-channel-unread-unavailable" role="status">
        Số tin chưa đọc theo kênh chưa khả dụng. Cần cập nhật backend.
      </p>}
      <nav className="group-channel-sidebar-list" aria-label="Chuyển kênh hội thoại">
        {filtered.length === 0 && <p className="group-channel-sidebar-empty">Không tìm thấy kênh phù hợp.</p>}
        {filtered.map(channel => (
          <div className="group-channel-sidebar-item" key={channel.id}>
            <button type="button"
              className={channel.id === selectedId ? 'group-channel-sidebar-row selected' : 'group-channel-sidebar-row'}
              aria-current={channel.id === selectedId ? 'page' : undefined}
              aria-label={`Mở kênh ${channel.name}${channel.unreadCount ? `, ${channel.unreadCount} tin chưa đọc` : ''}`}
              title={channel.name}
              onClick={() => onSelect(channel.id)}
              onContextMenu={event => event.preventDefault()}>
              <span className={`group-channel-sidebar-avatar topic-tone-${channelTopicTone(channel.name, channel.description)}`}
                aria-hidden="true">
                {(channel.id === 0 ? groupAvatarUrl : channel.avatarUrl)
                  ? <img src={channel.id === 0 ? groupAvatarUrl : channel.avatarUrl} alt="" loading="lazy" />
                  : channelTopicPreview(channel.name, channel.description)}
              </span>
              <span className="group-channel-sidebar-content">
                <span className="group-channel-sidebar-name-row">
                  <span className="group-channel-sidebar-name-status">
                    <strong>{channel.name}</strong>
                    {channel.muted && <BellOff size={13} className="group-channel-sidebar-muted" aria-label="Đã tắt thông báo kênh" />}
                  </span>
                  <time>{formatChannelTime(channel.lastMessageAt)}</time>
                </span>
                <span className="group-channel-sidebar-topic-row" title={channel.description || 'Chưa đặt chủ đề'}>
                  {channel.description || 'Chưa đặt chủ đề'}
                </span>
                <span className="group-channel-sidebar-meta-row">
                  <small title={channel.lastMessage || 'Chưa có tin nhắn'}>{channel.lastMessage || 'Chưa có tin nhắn'}</small>
                  {channel.unreadCount > 0 && <b className="group-channel-unread" aria-label={`${channel.unreadCount} tin chưa đọc`}>
                    {channel.unreadCount > 99 ? '99+' : channel.unreadCount}
                  </b>}
                </span>
              </span>
            </button>
          </div>
        ))}
      </nav>
    </aside>
  )
}
