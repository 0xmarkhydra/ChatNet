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
import './features/contacts/friends.css'
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
import './styles/motion.css'
import './features/profile/personal-timeline.css'
import './platform/desktop.css'
import './styles/app-shell.css'
import './features/profile/profile-page.css'
import './features/profile/profile-editor.css'
import './features/feed/social-feed.css'
import './features/feed/post-comments-page.css'
import './features/contacts/friends-design-v2.css'
import './features/chat/social-chat.css'
import './features/chat/chat-translation-settings.css'
import './styles/form-surfaces.css'
import './features/settings/settings-workspace.css'
import './features/auth/auth-screen.css'
import './styles/adaptive-pwa.css'
import './features/feed/story-viewer.css'

if (window.location.search.includes('pwa=')) {
  window.history.replaceState(window.history.state, '', `${window.location.pathname}${window.location.hash}`)
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {isDesktopBuild ? <DesktopBootstrap /> : <App />}
    {import.meta.env.PROD && !isDesktopBuild && <PWAUpdate />}
  </React.StrictMode>,
)