import { useId, useLayoutEffect, useRef } from 'react'
import { Bell, Bookmark, BookUser, Compass, MessageCircle, Newspaper, Scan, Search, Settings, ShoppingBag } from 'lucide-react'
import { formatUnreadMessageDescription, UI_MESSAGES, type UIMessageKey } from '../../features/i18n/lib/i18n'
import type { Tab } from '../../shared/types/navigation'
import UserAvatar from '../../shared/ui/UserAvatar'
import { Button } from '../../shared/ui/button'
import { cn } from '../../shared/lib/utils'

type Props = {
  t?: (key: UIMessageKey) => string
  tab: Tab
  section: 'groups' | 'calls' | null
  username: string
  displayName: string
  unreadTotal: number
  notificationCount: number
  feedSaved: boolean
  settingsActive: boolean
  searchActive?: boolean
  onSearch?: () => void
  onNavigate: (tab: Tab) => void
  onSaved: () => void
  onSettings: () => void
  onScreenshot?: () => void
  screenshotBusy?: boolean
}

export default function AppSidebar({
  t = key => UI_MESSAGES[key], tab, section, username, displayName, unreadTotal, notificationCount, feedSaved, settingsActive,
  onNavigate, onSaved, onSettings, onScreenshot, screenshotBusy, searchActive = false, onSearch,
}: Props) {
  const activeKey = `${tab}:${section ?? ''}:${feedSaved}:${settingsActive}:${searchActive}`
  const unreadDescriptionId = useId()
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
    ...(onSearch ? [{ label: t('common.search'), key: 'common.search', Icon: Search, active: searchActive, action: onSearch }] : []),
    { label: t('nav.feed'), key: 'nav.feed', Icon: Newspaper, active: tab === 'feed' && !feedSaved, action: () => onNavigate('feed') },
    { label: t('nav.chat'), key: 'nav.chat', Icon: MessageCircle, active: tab === 'chat' && section === null, action: () => onNavigate('chat'), count: unreadTotal },
    { label: t('nav.desktopDiscover'), key: 'nav.desktopDiscover', Icon: Compass, active: tab === 'discover' && !searchActive, action: () => onNavigate('discover') },
    { label: t('nav.desktopContacts'), key: 'nav.desktopContacts', Icon: BookUser, active: tab === 'contacts', action: () => onNavigate('contacts') },
    { label: t('nav.market'), key: 'nav.market', Icon: ShoppingBag, active: tab === 'market', action: () => onNavigate('market') },
  ]

  return (
    <aside className="app-sidebar" aria-label={t("nav.sidebar")}>
      <div className="app-sidebar-brand">
        <span className="app-sidebar-logo"><img src="/soco-mark.svg" alt="" width="40" height="40" /></span>
        <span className="app-sidebar-brand-copy"><strong>SocCo</strong><small>{t("nav.community")}</small></span>
      </div>
      <nav className="app-sidebar-nav" aria-label={t("nav.sections")} ref={navRef}>
        <span ref={pillRef} className="sidebar-liquid-pill" aria-hidden="true" />
        {mainItems.map(({ label, key, Icon, active, action, count }) => (
          <Button
            variant="ghost"
            key={key}
            aria-label={label}
            aria-keyshortcuts={key === 'common.search' ? 'Control+K Meta+K' : undefined}
            aria-describedby={count ? unreadDescriptionId : undefined}
            className={cn('app-sidebar-link justify-start', active && 'is-active')}
            aria-current={active ? 'page' : undefined}
            ref={active ? activeButtonRef : undefined}
            onClick={action}
          >
            <Icon size={22} strokeWidth={1.8} aria-hidden="true" />
            <span>{label}</span>
            {count ? <b className="app-sidebar-count" aria-hidden="true">{count > 99 ? '99+' : count}</b> : null}
          </Button>
        ))}
        {unreadTotal > 0 && <span id={unreadDescriptionId} hidden>{formatUnreadMessageDescription(unreadTotal, t("nav.chatUnread"))}</span>}
      </nav>
      <div className="app-sidebar-secondary" role="group" aria-label={t("nav.tools")}>
      {onScreenshot && (
        <Button
          type="button"
          variant="ghost"
          className="app-sidebar-link justify-start"
          aria-label={t("nav.screenshotHint")}
          aria-keyshortcuts="Control+Alt+A"
          title={`${t("nav.screenshotHint")} (Ctrl+Alt+A)`}
          disabled={screenshotBusy}
          onClick={onScreenshot}
        >
          <Scan size={22} strokeWidth={1.8} aria-hidden="true" />
          <span>{t("nav.screenshot")}</span>
        </Button>
      )}
        <Button variant="ghost" className={cn('app-sidebar-link justify-start', tab === 'notifications' && 'is-active')} aria-label={t("nav.notifications")} aria-current={tab === 'notifications' ? 'page' : undefined} onClick={() => onNavigate('notifications')}>
          <Bell size={22} strokeWidth={1.8} aria-hidden="true" /><span>{t("nav.notifications")}</span>
          {notificationCount > 0 && <b className="app-sidebar-count">{notificationCount > 99 ? '99+' : notificationCount}</b>}
        </Button>
        <Button variant="ghost" className={cn('app-sidebar-link justify-start', tab === 'feed' && feedSaved && 'is-active')} aria-label={t("nav.saved")} aria-current={tab === 'feed' && feedSaved ? 'page' : undefined} onClick={onSaved}>
          <Bookmark size={22} strokeWidth={1.8} aria-hidden="true" /><span>{t("nav.saved")}</span>
        </Button>
        <Button variant="ghost" className={cn('app-sidebar-link justify-start', settingsActive && 'is-active')} aria-label={t("nav.settings")} aria-current={settingsActive ? 'page' : undefined} onClick={onSettings}>
          <Settings size={22} strokeWidth={1.8} aria-hidden="true" /><span>{t("nav.settings")}</span>
        </Button>
      </div>
      <Button variant="ghost" className={cn('app-sidebar-account justify-start', tab === 'profile' && !settingsActive && 'is-active')} onClick={() => onNavigate('profile')} aria-label={t("nav.profile")} aria-current={tab === 'profile' && !settingsActive ? 'page' : undefined}>
        <UserAvatar username={username} name={displayName} className="app-sidebar-avatar" online />
        <span className="app-sidebar-account-copy"><strong>{displayName}</strong><small>{t("nav.active")}</small></span>
      </Button>
    </aside>
  )
}