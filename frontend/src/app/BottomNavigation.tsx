import { useLayoutEffect, useRef } from 'react'
import type { Tab } from './types'
import type { UI_MESSAGES } from '../features/i18n/i18n'
import UiIcon from '../shared/ui/UiIcon'
import { PhoneCall } from 'lucide-react'

type Props = {
  tab: Tab
  t: (key: keyof typeof UI_MESSAGES) => string
  switchTab: (tab: Tab) => void
  unreadTotal: number
  pushEnabled: boolean
  onCalls: () => void
  callsActive: boolean
}

export default function BottomNavigation({
  tab,
  t,
  switchTab,
  unreadTotal,
  pushEnabled,
  onCalls,
  callsActive,
}: Props) {
  const activeKey = callsActive ? 'calls' : tab
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
      pill.style.setProperty('--pill-x', `${left}px`)
      pill.style.setProperty('--pill-y', `${buttonRect.top - navRect.top - nav.clientTop}px`)
      pill.style.setProperty('--pill-w', `${buttonRect.width}px`)
      pill.style.setProperty('--pill-h', `${buttonRect.height}px`)

      if (!pill.classList.contains('is-ready')) {
        void pill.offsetWidth
        pill.classList.add('is-ready')
      }
      pill.style.opacity = '1'
      if (animate) {
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

  return (
    <nav className="bottom-navigation" aria-label="Điều hướng chính" ref={navRef}>
      <span ref={pillRef} className="nav-liquid-pill" aria-hidden="true" />
      <button
        type="button"
        aria-label={t('nav.chat')}
        title={t('nav.chat')}
        className={tab === 'chat' && !callsActive ? 'active' : ''}
        aria-current={tab === 'chat' && !callsActive ? 'page' : undefined}
        ref={tab === 'chat' && !callsActive ? activeButtonRef : undefined}
        onClick={() => switchTab('chat')}
      >
        <span className="nav-icon"><UiIcon name="chat" size={25} />{unreadTotal > 0 && <b>{unreadTotal > 99 ? '99+' : unreadTotal}</b>}</span>
        <span className="nav-label">{t('nav.chat')}</span>
      </button>
      <button type="button" aria-label="Cuộc gọi" title="Cuộc gọi" className={callsActive ? 'active' : ''} aria-current={callsActive ? 'page' : undefined} ref={callsActive ? activeButtonRef : undefined} onClick={onCalls}>
        <span className="nav-icon"><PhoneCall size={24} /></span>
        <span className="nav-label">Cuộc gọi</span>
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
    </nav>
  )
}
