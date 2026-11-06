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
  return (
    <nav className="bottom-navigation" aria-label="Điều hướng chính">
      <button
        type="button"
        aria-label={t('nav.chat')}
        title={t('nav.chat')}
        className={tab === 'chat' && !callsActive ? 'active' : ''}
        onClick={() => switchTab('chat')}
      >
        <span className="nav-icon"><UiIcon name="chat" size={25} />{unreadTotal > 0 && <b>{unreadTotal > 99 ? '99+' : unreadTotal}</b>}</span>
      </button>
      <button type="button" aria-label="Cuộc gọi" title="Cuộc gọi" className={callsActive ? 'active' : ''} onClick={onCalls}>
        <span className="nav-icon"><PhoneCall size={24} /></span>
      </button>
      <button
        type="button"
        aria-label={t('nav.contacts')}
        title={t('nav.contacts')}
        className={tab === 'contacts' ? 'active' : ''}
        onClick={() => switchTab('contacts')}
      >
        <span className="nav-icon"><UiIcon name="contacts" size={25} /></span>
      </button>
      <button
        type="button"
        aria-label={t('nav.discover')}
        title={t('nav.discover')}
        className={tab === 'discover' ? 'active' : ''}
        onClick={() => switchTab('discover')}
      >
        <span className="nav-icon"><UiIcon name="discover" size={25} /></span>
      </button>
      <button
        type="button"
        aria-label={t('nav.feed')}
        title={t('nav.feed')}
        className={tab === 'feed' ? 'active' : ''}
        onClick={() => switchTab('feed')}
      >
        <span className="nav-icon"><UiIcon name="wall" size={25} /></span>
      </button>
      <button
        type="button"
        aria-label={t('nav.profile')}
        title={t('nav.profile')}
        className={tab === 'profile' ? 'active' : ''}
        onClick={() => switchTab('profile')}
      >
        <span className="nav-icon"><UiIcon name="profile" size={25} />{!pushEnabled && <b>!</b>}</span>
      </button>
    </nav>
  )
}
