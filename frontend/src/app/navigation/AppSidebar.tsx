import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { Bell, Bookmark, BookUser, ChevronDown, ChevronsLeft, ChevronsRight, Compass, MessageCircle, MessageSquarePlus, Newspaper, Plus, Scan, Search, Settings, ShoppingBag, SquarePen, UserRound, UserRoundPlus, Users } from 'lucide-react'
import { formatUnreadMessageDescription } from '../../features/i18n/lib/i18n'
import type { Tab } from '../../shared/types/navigation'
import UserAvatar from '../../shared/ui/UserAvatar'
import { Button } from '../../shared/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '../../shared/ui/dropdown-menu'
import { cn } from '../../shared/lib/utils'
import SidebarSearch from './SidebarSearch'

type Props = {
  tab: Tab
  section: 'groups' | 'calls' | null
  username: string
  displayName: string
  unreadTotal: number
  notificationCount: number
  feedSaved: boolean
  settingsActive: boolean
  onNavigate: (tab: Tab) => void
  onSaved: () => void
  onSettings: () => void
  onNewPost: () => void
  onNewDirect: () => void
  onNewGroup: () => void
  onAddFriend: () => void
  onSell: () => void
  onSearch: (query: string, scope: string) => void
  onScreenshot?: () => void
  screenshotBusy?: boolean
}

export default function AppSidebar({
  tab, section, username, displayName, unreadTotal, notificationCount, feedSaved, settingsActive,
  onNavigate, onSaved, onSettings, onNewPost, onNewDirect, onNewGroup, onAddFriend, onSell, onSearch, onScreenshot, screenshotBusy,
}: Props) {
  const [collapsed, setCollapsed] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const activeKey = `${tab}:${section ?? ''}:${feedSaved}:${settingsActive}`
  const unreadDescriptionId = useId()
  const navRef = useRef<HTMLElement>(null)
  const activeButtonRef = useRef<HTMLButtonElement>(null)
  const pillRef = useRef<HTMLSpanElement>(null)
  const previousActiveKey = useRef<string | null>(null)
  const slideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.isComposing || event.altKey || event.shiftKey || !(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'k') return
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) return
      event.preventDefault()
      event.stopPropagation()
      setSearchOpen(true)
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [])

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
      const top = buttonRect.top - navRect.top - nav.clientTop + nav.scrollTop
      const previousTop = Number.parseFloat(pill.style.getPropertyValue('--sidebar-pill-y'))
      pill.style.setProperty('--sidebar-pill-x', `${buttonRect.left - navRect.left - nav.clientLeft}px`)
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
  }, [activeKey, collapsed])

  const mainItems = [
    { label: 'Bảng tin', Icon: Newspaper, active: tab === 'feed' && !feedSaved, action: () => onNavigate('feed') },
    { label: 'Tin nhắn', Icon: MessageCircle, active: tab === 'chat' && section === null, action: () => onNavigate('chat'), count: unreadTotal },
    { label: 'Khám phá', Icon: Compass, active: tab === 'discover', action: () => onNavigate('discover') },
    { label: 'Danh bạ', Icon: BookUser, active: tab === 'contacts', action: () => onNavigate('contacts') },
    { label: 'Marketplace', Icon: ShoppingBag, active: tab === 'market', action: () => onNavigate('market') },
  ]

  return (
    <>
      <aside className={cn('app-sidebar', collapsed && 'is-collapsed')} aria-label="Điều hướng SocCo">
        <div className="app-sidebar-brand">
          <span className="app-sidebar-logo"><img src="/soco-mark.svg" alt="" width="40" height="40" /></span>
          <span className="app-sidebar-brand-copy"><strong>SocCo</strong></span>
          <Button type="button" variant="ghost" size="icon" className="app-sidebar-collapse" aria-label={collapsed ? 'Mở rộng thanh bên' : 'Thu gọn thanh bên'} aria-expanded={!collapsed} onClick={() => setCollapsed(value => !value)}>
            {collapsed ? <ChevronsRight size={20} /> : <ChevronsLeft size={20} />}
          </Button>
        </div>
        <div className="app-sidebar-primary-actions">
          <Button variant="outline" type="button" className="app-sidebar-link app-sidebar-search justify-start" aria-label="Tìm kiếm" aria-keyshortcuts="Control+K" onClick={() => setSearchOpen(true)}>
            <Search size={20} aria-hidden="true" /><span>Tìm kiếm</span><kbd className="app-sidebar-shortcut">Ctrl K</kbd>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="app-sidebar-link app-sidebar-create justify-start" aria-label="Tạo mới">
                <Plus size={21} aria-hidden="true" /><span>Tạo mới</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" side="right" className="min-w-56">
              <DropdownMenuLabel>Tạo mới</DropdownMenuLabel>
              <DropdownMenuItem onSelect={onNewPost}><SquarePen size={17} />Bài viết mới</DropdownMenuItem>
              <DropdownMenuItem onSelect={onNewDirect}><MessageSquarePlus size={17} />Chat riêng</DropdownMenuItem>
              <DropdownMenuItem onSelect={onNewGroup}><Users size={17} />Tạo nhóm</DropdownMenuItem>
              <DropdownMenuItem onSelect={onAddFriend}><UserRoundPlus size={17} />Thêm bạn</DropdownMenuItem>
              <DropdownMenuItem onSelect={onSell}><ShoppingBag size={17} />Đăng bán sản phẩm</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <nav className="app-sidebar-nav" aria-label="Các khu vực" ref={navRef}>
          <span ref={pillRef} className="sidebar-liquid-pill" aria-hidden="true" />
          {mainItems.map(({ label, Icon, active, action, count }) => (
            <Button variant="ghost" key={label} aria-label={label} aria-describedby={count ? unreadDescriptionId : undefined} className={cn('app-sidebar-link justify-start', active && 'is-active')} aria-current={active ? 'page' : undefined} ref={active ? activeButtonRef : undefined} onClick={action}>
              <Icon size={21} strokeWidth={1.8} aria-hidden="true" />
              <span>{label}</span>
              {count ? <b className="app-sidebar-count" aria-hidden="true">{count > 99 ? '99+' : count}</b> : null}
            </Button>
          ))}
          {unreadTotal > 0 && <span id={unreadDescriptionId} hidden>{formatUnreadMessageDescription(unreadTotal)}</span>}
        </nav>
        <div className="app-sidebar-secondary" role="group" aria-label="Tiện ích">
          <Button variant="ghost" className={cn('app-sidebar-link justify-start', tab === 'notifications' && 'is-active')} aria-label="Thông báo" aria-current={tab === 'notifications' ? 'page' : undefined} onClick={() => onNavigate('notifications')}>
            <Bell size={21} aria-hidden="true" /><span>Thông báo</span>
            {notificationCount > 0 && <b className="app-sidebar-count app-sidebar-notification-count" aria-hidden="true">{notificationCount > 99 ? '99+' : notificationCount}</b>}
          </Button>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className={cn('app-sidebar-account justify-start', tab === 'profile' && !settingsActive && 'is-active')} aria-label="Menu tài khoản">
              <UserAvatar username={username} name={displayName} className="app-sidebar-avatar" online />
              <span className="app-sidebar-account-copy"><strong>{displayName}</strong><small>Đang hoạt động</small></span>
              <ChevronDown className="app-sidebar-account-chevron" size={17} aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="right" align="end" className="min-w-52">
            <DropdownMenuLabel>{displayName}</DropdownMenuLabel>
            <DropdownMenuItem onSelect={() => onNavigate('profile')}><UserRound size={17} />Hồ sơ</DropdownMenuItem>
            <DropdownMenuItem onSelect={onSaved}><Bookmark size={17} />Đã lưu</DropdownMenuItem>
            <DropdownMenuItem onSelect={onSettings}><Settings size={17} />Cài đặt</DropdownMenuItem>
            {onScreenshot && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem disabled={screenshotBusy} onSelect={onScreenshot}><Scan size={17} />Chụp màn hình</DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </aside>
      <SidebarSearch open={searchOpen} onOpenChange={setSearchOpen} onSearch={onSearch} />
    </>
  )
}
