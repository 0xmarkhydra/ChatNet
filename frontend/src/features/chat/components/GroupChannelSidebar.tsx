import { useMemo, useState } from 'react'
import { ArrowLeft, Search, UsersRound, X } from 'lucide-react'
import type { GroupChannel } from '../utils/groupChannels'
import '../styles/group-channel-sidebar.css'

type Props = {
  groupName: string
  memberCount: number
  groupAvatarUrl?: string
  channels: GroupChannel[]
  selectedId: number
  unreadAvailable: boolean
  open: boolean
  onSelect: (id: number) => void
  onClose: () => void
  onBack: () => void
}

/** The channel thumbnail derives from its topic and never needs an image upload. */
export const channelTopicPreview = (name: string, topic: string) => {
  const value = (topic.trim() || name.trim()).normalize('NFC')
  const words = value.split(/\s+/).filter(Boolean)
  return words.length > 1
    ? (words[0][0] + words[words.length - 1][0]).toLocaleUpperCase('vi-VN')
    : (words[0] || '#').slice(0, 2).toLocaleUpperCase('vi-VN')
}

export const channelTopicTone = (name: string, topic: string) => {
  const text = topic.trim() || name.trim()
  let hash = 0
  for (const point of text) hash = (hash * 31 + point.codePointAt(0)!) >>> 0
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

export default function GroupChannelSidebar({ groupName, memberCount, groupAvatarUrl, channels, selectedId, unreadAvailable, open, onSelect, onClose, onBack }: Props) {
  const [search, setSearch] = useState('')
  const filtered = useMemo(() => channels.filter(channel =>
    (channel.name + ' ' + channel.description + ' ' + channel.lastMessage).toLocaleLowerCase('vi-VN')
      .includes(search.trim().toLocaleLowerCase('vi-VN'))), [channels, search])

  return (
    <aside className={open ? 'group-channel-sidebar open' : 'group-channel-sidebar'}
      aria-label="Danh sách kênh hội thoại">
      <header className="group-channel-sidebar-heading">
        <button type="button" className="group-channel-sidebar-back" aria-label="Quay lại danh sách hội thoại" onClick={onBack}>
          <ArrowLeft size={19} aria-hidden="true" />
        </button>
        <span className="group-channel-sidebar-icon">{groupAvatarUrl ? <img src={groupAvatarUrl} alt="" onError={event => { event.currentTarget.style.display = "none" }} /> : <UsersRound size={19} aria-hidden="true" />}</span>
        <div className="group-channel-sidebar-intro">
          <strong title={groupName}>{groupName}</strong>
          <small>{memberCount} thành viên · {channels.length} kênh</small>
        </div>
        <button type="button" className="group-channel-sidebar-close" aria-label="Đóng danh sách kênh" onClick={onClose}>
          <X size={19} aria-hidden="true" />
        </button>
      </header>
      <label className="group-channel-sidebar-search">
        <Search size={17} aria-hidden="true" />
        <input type="search" aria-label="Tìm kênh hội thoại" placeholder="Tìm kênh hội thoại..."
          value={search} onChange={event => setSearch(event.target.value)} />
        {search && <button type="button" aria-label="Xóa tìm kiếm kênh"
          onClick={() => setSearch('')}><X size={15} aria-hidden="true" /></button>}
      </label>
      <div className="group-channel-sidebar-caption">
        <span>Kênh hội thoại</span>
        <small>{filtered.length}</small>
      </div>
      {!unreadAvailable && <p className="group-channel-unread-unavailable" role="status">
        Số tin chưa đọc theo kênh chưa khả dụng. Cần cập nhật backend.
      </p>}
      <nav className="group-channel-sidebar-list" aria-label="Chuyển kênh hội thoại">
        {filtered.length === 0 && (
          <p className="group-channel-sidebar-empty">Không tìm thấy kênh phù hợp.</p>
        )}
        {filtered.map(channel => (
          <button type="button" key={channel.id} className={channel.id === selectedId ? 'group-channel-sidebar-row selected' : 'group-channel-sidebar-row'}
            aria-current={channel.id === selectedId ? 'page' : undefined}
            aria-label={`Mở kênh ${channel.name}${channel.unreadCount ? `, ${channel.unreadCount} tin chưa đọc` : ''}`}
            onClick={() => { onSelect(channel.id); onClose() }}>
            <span className={`group-channel-sidebar-avatar topic-tone-${channelTopicTone(channel.name, channel.description)}`} aria-hidden="true">
              {channelTopicPreview(channel.name, channel.description)}
            </span>
            <span className="group-channel-sidebar-content">
              <span className="group-channel-sidebar-name-row">
                <strong>{channel.name}</strong>
                <time>{formatChannelTime(channel.lastMessageAt)}</time>
              </span>
              <span className="group-channel-sidebar-topic-row" title={channel.description || 'Chưa đặt chủ đề'}>
                {channel.description || 'Chưa đặt chủ đề'}
              </span>
              <span className="group-channel-sidebar-meta-row">
                <small title={channel.lastMessage || 'Chưa có tin nhắn'}>
                  {channel.lastMessage || 'Chưa có tin nhắn'}
                </small>
                {channel.unreadCount > 0 && (
                  <b className="group-channel-unread" aria-label={`${channel.unreadCount} tin chưa đọc`}>
                    {channel.unreadCount > 99 ? '99+' : channel.unreadCount}
                  </b>
                )}
              </span>
            </span>
          </button>
        ))}
      </nav>
    </aside>
  )
}