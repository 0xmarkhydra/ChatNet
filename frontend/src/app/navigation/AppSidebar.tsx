import { useLayoutEffect, useRef } from 'react'
import { Bookmark, Compass, MessageCircle, Newspaper, Phone, Settings, ShoppingBag, UserRoundCheck } from 'lucide-react'
import type { Tab } from '../../shared/types/navigation'
import UserAvatar from '../../shared/ui/UserAvatar'

type Props = {
  tab: Tab
  section: 'groups' | 'calls' | null
  username: string
  displayName: string
  unreadTotal: number
  feedSaved: boolean
  onNavigate: (tab: Tab) => void
  onCalls: () => void
  onSaved: () => void
  onSettings: () => void
}

export default function AppSidebar({
  tab, section, username, displayName, unreadTotal, feedSaved,
  onNavigate, onCalls, onSaved, onSettings,
}: Props) {
  const activeKey = `${tab}:${section ?? ''}:${feedSaved}`
  const navRef = useRef<HTMLElement>(null)
  const activeButtonRef = useRef<HTMLButtonElement>(null)
  const pillRef = useRef<HTMLSpanElement>(null)
  const previousActiveKey = useRef<string | null>(null)
  const slideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useLayoutEffect(() => {
    const nav = navRef.current
    const activeButton = activeButtonRef.current
    const pill = pillRef.current
    if (!nav || !pill) return
    if (!activeButton) {
      pill.style.opacity = '0'
      pill.classList.remove('is-ready', 'is-sliding')
      if (slideTimerRef.current) clearTimeout(slideTimerRef.current)
      previousActiveKey.current = activeKey
      return
    }

    const measure = (animate = false) => {
      const navRect = nav.getBoundingClientRect()
      const buttonRect = activeButton.getBoundingClientRect()
      const left = buttonRect.left - navRect.left - nav.clientLeft
      const top = buttonRect.top - navRect.top - nav.clientTop + nav.scrollTop
      const previousTop = Number.parseFloat(pill.style.getPropertyValue('--sidebar-pill-y'))
      pill.style.setProperty('--sidebar-pill-x', `${left}px`)
      pill.style.setProperty('--sidebar-pill-y', `${top}px`)
      pill.style.setProperty('--sidebar-pill-w', `${buttonRect.width}px`)
      pill.style.setProperty('--sidebar-pill-h', `${buttonRect.height}px`)

      if (!pill.classList.contains('is-ready')) {
        void pill.offsetWidth
        pill.classList.add('is-ready')
      }
      pill.style.opacity = '1'
      if (animate) {
        pill.dataset.direction = top >= (Number.isNaN(previousTop) ? top : previousTop) ? 'down' : 'up'
        pill.classList.remove('is-sliding')
        void pill.offsetWidth
        pill.classList.add('is-sliding')
        if (slideTimerRef.current) clearTimeout(slideTimerRef.current)
        slideTimerRef.current = setTimeout(() => pill.classList.remove('is-sliding'), 420)
      }
    }

    const animate = previousActiveKey.current !== null && previousActiveKey.current !== activeKey
    previousActiveKey.current = activeKey
    measure(animate)
    const update = () => measure()
    const observer = new ResizeObserver(update)
    observer.observe(nav)
    observer.observe(activeButton)
    nav.addEventListener('scroll', update)
    window.addEventListener('resize', update)

    return () => {
      observer.disconnect()
      nav.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
      if (slideTimerRef.current) clearTimeout(slideTimerRef.current)
    }
  }, [activeKey])

  const mainItems = [
    { label: 'Bảng tin', Icon: Newspaper, active: (tab === 'feed' && !feedSaved) || tab === 'notifications', action: () => onNavigate('feed') },
    { label: 'Tin nhắn', Icon: MessageCircle, active: tab === 'chat' && section === null, action: () => onNavigate('chat'), count: unreadTotal },
    { label: 'Khám phá', Icon: Compass, active: tab === 'discover', action: () => onNavigate('discover') },
    { label: 'Bạn bè', Icon: UserRoundCheck, active: tab === 'contacts' || tab === 'profile', action: () => onNavigate('contacts') },
    { label: 'Cuộc gọi', Icon: Phone, active: section === 'calls', action: onCalls },
    { label: 'Marketplace', Icon: ShoppingBag, active: tab === 'market', action: () => onNavigate('market') },
  ]

  return (
    <aside className="app-sidebar" aria-label="Điều hướng SocCo">
      <div className="app-sidebar-brand">
        <span className="app-sidebar-logo"><img src="/soco-mark.svg" alt="" width="40" height="40" /></span>
        <span className="app-sidebar-brand-copy"><strong>SocCo</strong><small>ChatNet · Kết nối cộng đồng</small></span>
      </div>
      <nav className="app-sidebar-nav" aria-label="Các khu vực" ref={navRef}>
        <span ref={pillRef} className="sidebar-liquid-pill" aria-hidden="true" />
        {mainItems.map(({ label, Icon, active, action, count }) => (
          <button
            type="button"
            key={label}
            aria-label={label}
            className={active ? 'app-sidebar-link is-active' : 'app-sidebar-link'}
            aria-current={active ? 'page' : undefined}
            ref={active ? activeButtonRef : undefined}
            onClick={action}
          >
            <Icon size={22} strokeWidth={1.8} aria-hidden="true" />
            <span>{label}</span>
            {count ? <b className="app-sidebar-count">{count > 99 ? '99+' : count}</b> : null}
          </button>
        ))}
      </nav>
      <div className="app-sidebar-secondary">
        <button type="button" className={tab === 'feed' && feedSaved ? 'app-sidebar-link is-active' : 'app-sidebar-link'} aria-label="Đã lưu" aria-current={tab === 'feed' && feedSaved ? 'page' : undefined} onClick={onSaved}>
          <Bookmark size={22} strokeWidth={1.8} aria-hidden="true" /><span>Đã lưu</span>
        </button>
        <button type="button" className="app-sidebar-link" aria-label="Cài đặt" onClick={onSettings}>
          <Settings size={22} strokeWidth={1.8} aria-hidden="true" /><span>Cài đặt</span>
        </button>
      </div>
      <button type="button" className="app-sidebar-account" onClick={() => onNavigate('profile')} aria-label="Cá nhân">
        <UserAvatar username={username} name={displayName} className="app-sidebar-avatar" online />
        <span className="app-sidebar-account-copy"><strong>{displayName}</strong><small>Đang hoạt động</small></span>
      </button>
    </aside>
  )
}