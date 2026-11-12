import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './app/App'
import { PWAUpdate } from './features/pwa/components/PWAUpdate'
import DesktopBootstrap from './platform/DesktopBootstrap'
import { isDesktopBuild } from './platform/desktop'
import './styles/styles.css'
import './styles/mobile.css'
import './styles/mobile-nav.css'
import './features/notifications/styles/notifications.css'
import './features/contacts/styles/friends.css'
import './styles/zalo-inspired.css'
import './features/discover/styles/nearby-explorer.css'
import './features/chat/styles/conversation-content.css'
import './features/chat/styles/chat-file-transfer.css'
import './features/chat/styles/message-clipboard.css'
import './styles/soco-theme.css'
import './styles/soco-screens.css'
import './styles/soco-layout-v2.css'
import './features/chat/styles/group-settings-sidebar.css'
import './features/chat/styles/group-room-header.css'
import './styles/motion.css'
import './features/profile/styles/personal-timeline.css'
import './platform/desktop.css'
import './styles/app-shell.css'
import './features/profile/styles/profile-page.css'
import './features/profile/styles/profile-editor.css'
import './features/feed/styles/social-feed.css'
import './features/feed/styles/smart-composer.css'
import './features/feed/styles/post-comments-page.css'
import './features/contacts/styles/friends-design-v2.css'
import './features/chat/styles/social-chat.css'
import './features/chat/styles/chat-translation-settings.css'
import './styles/form-surfaces.css'
import './features/settings/styles/settings-workspace.css'
import './features/auth/styles/auth-screen.css'
import './styles/adaptive-pwa.css'
import './features/feed/styles/story-viewer.css'

if (window.location.search.includes('pwa=')) {
  window.history.replaceState(window.history.state, '', `${window.location.pathname}${window.location.hash}`)
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {isDesktopBuild ? <DesktopBootstrap /> : <App />}
    {import.meta.env.PROD && !isDesktopBuild && <PWAUpdate />}
  </React.StrictMode>,
)