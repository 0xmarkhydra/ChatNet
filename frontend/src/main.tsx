import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './app/App'
import { PWAUpdate } from './features/pwa/PWAUpdate'
import DesktopBootstrap from './platform/DesktopBootstrap'
import { isDesktopBuild } from './platform/desktop'
import './styles/styles.css'
import './styles/mobile.css'
import './styles/mobile-nav.css'
import './features/notifications/notifications.css'
import './styles/friends.css'
import './styles/zalo-inspired.css'
import './features/discover/nearby-explorer.css'
import './features/chat/conversation-content.css'
import './features/chat/chat-file-transfer.css'
import './features/chat/message-clipboard.css'
import './styles/soco-theme.css'
import './styles/soco-screens.css'
import './styles/soco-layout-v2.css'
import './features/chat/group-settings-sidebar.css'
import './features/chat/group-room-header.css'
import './design-system/motion.css'
import './features/profile/personal-timeline.css'
import './platform/desktop.css'
import './styles/app-shell.css'
import './styles/profile-page.css'
import './styles/profile-editor.css'
import './styles/social-feed.css'
import './styles/post-comments-page.css'
import './features/contacts/friends-design-v2.css'
import './styles/social-chat.css'
import './styles/chat-translation-settings.css'
import './styles/form-surfaces.css'
import './styles/settings-workspace.css'
import './features/auth/auth-screen.css'

if (window.location.search.includes('pwa=')) {
  window.history.replaceState(window.history.state, '', `${window.location.pathname}${window.location.hash}`)
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {isDesktopBuild ? <DesktopBootstrap /> : <App />}
    {import.meta.env.PROD && !isDesktopBuild && <PWAUpdate />}
  </React.StrictMode>,
)