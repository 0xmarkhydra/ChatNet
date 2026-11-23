import { useId, useLayoutEffect, useRef } from 'react'
import type { Tab } from '../../shared/types/navigation'
import { formatUnreadMessageDescription, type UI_MESSAGES } from '../../features/i18n/lib/i18n'
import UiIcon from '../../shared/ui/UiIcon'
import { useScrollHideChrome } from './useScrollHideChrome'

type Props = {
  tab: Tab
  t: (key: keyof typeof UI_MESSAGES) => string
  switchTab: (tab: Tab) => void
  unreadTotal: number
  pushEnabled: boolean
}

export default function BottomNavigation({
  tab,
  t,
  switchTab,
  unreadTotal,
  pushEnabled,
}: Props) {
  const activeKey = tab
  const unreadDescriptionId = useId()
  const navRef = useRef<HTMLElement>(null)
  const activeButtonRef = useRef<HTMLButtonElement>(null)
  const pillRef = useRef<HTMLSpanElement>(null)
  const previousActiveKey = useRef<string | null>(null)
  const slideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useScrollHideChrome(navRef, tab === 'feed')

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
      // Wrap the entire active tab (icon and label) with a small inset on phones.
      const inset = window.matchMedia('(max-width: 760px)').matches ? 2 : 0
      const left = buttonRect.left - navRect.left - nav.clientLeft + inset
      pill.style.setProperty('--pill-x', `${left}px`)
      pill.style.setProperty('--pill-y', `${buttonRect.top - navRect.top - nav.clientTop + inset / 2}px`)
      pill.style.setProperty('--pill-w', `${buttonRect.width - inset * 2}px`)
      pill.style.setProperty('--pill-h', `${buttonRect.height - inset}px`)

      if (!pill.classList.contains('is-ready')) {
        void pill.offsetWidth
        pill.classList.add('is-ready')
      }
      pill.style.opacity = '1'
      if (animate) {
        // Restart the liquid pulse on rapid tab changes without interrupting the slide.
        if (pill.classList.contains('is-sliding')) {
          pill.classList.remove('is-sliding')
          void pill.offsetWidth
        }
        pill.classList.add('is-sliding')
        if (slideTimerRef.current) clearTimeout(slideTimerRef.current)
        slideTimerRef.current = setTimeout(() => pill.classList.remove('is-sliding'), 520)
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

  return (
    <nav className="bottom-navigation" aria-label="Điều hướng chính" ref={navRef}>
      <span ref={pillRef} className="nav-liquid-pill" aria-hidden="true" />
      <button
        type="button"
        aria-label={t('nav.chat')}
        aria-describedby={unreadTotal > 0 ? unreadDescriptionId : undefined}
        className={tab === 'chat' ? 'active' : ''}
        aria-current={tab === 'chat' ? 'page' : undefined}
        ref={tab === 'chat' ? activeButtonRef : undefined}
        onClick={() => switchTab('chat')}
      >
        <span className="nav-icon"><UiIcon name="chat" size={25} />{unreadTotal > 0 && <b aria-hidden="true">{unreadTotal > 99 ? '99+' : unreadTotal}</b>}</span>
        <span className="nav-label">{t('nav.chat')}</span>
      </button>
      <button
        type="button"
        aria-label={t('nav.contacts')}
        title={t('nav.contacts')}
        className={tab === 'contacts' ? 'active' : ''}
        aria-current={tab === 'contacts' ? 'page' : undefined}
        ref={tab === 'contacts' ? activeButtonRef : undefined}
        onClick={() => switchTab('contacts')}
      >
        <span className="nav-icon"><UiIcon name="contacts" size={25} /></span>
        <span className="nav-label">{t('nav.contacts')}</span>
      </button>
      <button
        type="button"
        aria-label={t('nav.discover')}
        title={t('nav.discover')}
        className={tab === 'discover' ? 'active' : ''}
        aria-current={tab === 'discover' ? 'page' : undefined}
        ref={tab === 'discover' ? activeButtonRef : undefined}
        onClick={() => switchTab('discover')}
      >
        <span className="nav-icon"><UiIcon name="discover" size={25} /></span>
        <span className="nav-label">{t('nav.discover')}</span>
      </button>
      <button
        type="button"
        aria-label={t('nav.feed')}
        title={t('nav.feed')}
        className={tab === 'feed' ? 'active' : ''}
        aria-current={tab === 'feed' ? 'page' : undefined}
        ref={tab === 'feed' ? activeButtonRef : undefined}
        onClick={() => switchTab('feed')}
      >
        <span className="nav-icon"><UiIcon name="wall" size={25} /></span>
        <span className="nav-label">{t('nav.feed')}</span>
      </button>
      <button
        type="button"
        aria-label={t('nav.profile')}
        title={t('nav.profile')}
        className={tab === 'profile' ? 'active' : ''}
        aria-current={tab === 'profile' ? 'page' : undefined}
        ref={tab === 'profile' ? activeButtonRef : undefined}
        onClick={() => switchTab('profile')}
      >
        <span className="nav-icon"><UiIcon name="profile" size={25} />{!pushEnabled && <b>!</b>}</span>
        <span className="nav-label">{t('nav.profile')}</span>
      </button>
      {unreadTotal > 0 && (
        <span id={unreadDescriptionId} hidden>{formatUnreadMessageDescription(unreadTotal, t('nav.chatUnread'))}</span>
      )}
    </nav>
  )
}
