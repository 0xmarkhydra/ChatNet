import { Bell, Bookmark, Compass, MessageCircle, Newspaper, Phone, Settings2, ShoppingBag, UsersRound } from 'lucide-react'
import type { Tab } from './types'
import UserAvatar from '../shared/ui/UserAvatar'

type Props = {
  tab: Tab
  section: 'groups' | 'calls' | null
  username: string
  displayName: string
  unreadTotal: number
  feedSaved: boolean
  onNavigate: (tab: Tab) => void
  onGroups: () => void
  onCalls: () => void
  onSaved: () => void
  onSettings: () => void
  onNotifications: () => void
}

export default function DesktopSidebar({
  tab, section, username, displayName, unreadTotal, feedSaved,
  onNavigate, onGroups, onCalls, onSaved, onSettings, onNotifications,
}: Props) {
  const mainItems = [
    { label: 'Bảng tin', Icon: Newspaper, active: tab === 'feed' && !feedSaved, action: () => onNavigate('feed') },
    { label: 'Tin nhắn', Icon: MessageCircle, active: tab === 'chat' && section === null, action: () => onNavigate('chat'), count: unreadTotal },
    { label: 'Khám phá', Icon: Compass, active: tab === 'discover', action: () => onNavigate('discover') },
    { label: 'Bạn bè', Icon: UsersRound, active: tab === 'contacts' || tab === 'profile', action: () => onNavigate('contacts') },
    { label: 'Nhóm & cộng đồng', Icon: UsersRound, active: section === 'groups', action: onGroups },
    { label: 'Cuộc gọi', Icon: Phone, active: section === 'calls', action: onCalls },
    { label: 'Marketplace', Icon: ShoppingBag, active: tab === 'market', action: () => onNavigate('market') },
  ]

  return (
    <aside className="app-navigation-sidebar" aria-label="Điều hướng SocCo">
      <div className="app-navigation-brand">
        <span className="app-navigation-logo"><img src="/soco-mark.svg" alt="" width="40" height="40" /></span>
        <span className="app-navigation-brand-copy"><strong>SocCo</strong><small>ChatNet · Kết nối cộng đồng</small></span>
      </div>
      <nav className="app-navigation-nav" aria-label="Các khu vực">
        {mainItems.map(({ label, Icon, active, action, count }) => (
          <button
            type="button"
            key={label}
            title={label}
            aria-label={label}
            className={active ? 'app-navigation-link is-active' : 'app-navigation-link'}
            aria-current={active ? 'page' : undefined}
            onClick={action}
          >
            <Icon size={22} strokeWidth={1.8} aria-hidden="true" />
            <span>{label}</span>
            {count ? <b className="app-navigation-count">{count > 99 ? '99+' : count}</b> : null}
          </button>
        ))}
      </nav>
      <div className="app-navigation-secondary">
        <button type="button" className="app-navigation-link" aria-label="Thông báo" onClick={onNotifications}>
          <Bell size={22} strokeWidth={1.8} aria-hidden="true" /><span>Thông báo</span>
        </button>
        <button type="button" className={tab === 'feed' && feedSaved ? 'app-navigation-link is-active' : 'app-navigation-link'} aria-label="Đã lưu" aria-current={tab === 'feed' && feedSaved ? 'page' : undefined} onClick={onSaved}>
          <Bookmark size={22} strokeWidth={1.8} aria-hidden="true" /><span>Đã lưu</span>
        </button>
        <button type="button" className="app-navigation-link" aria-label="Cài đặt" onClick={onSettings}>
          <Settings2 size={22} strokeWidth={1.8} aria-hidden="true" /><span>Cài đặt</span>
        </button>
      </div>
      <button type="button" className="app-navigation-account" onClick={() => onNavigate('profile')} aria-label="Cá nhân" title="Hồ sơ cá nhân">
        <UserAvatar username={username} name={displayName} className="app-navigation-avatar" online />
        <span className="app-navigation-account-copy"><strong>{displayName}</strong><small>Đang hoạt động</small></span>
      </button>
    </aside>
  )
}