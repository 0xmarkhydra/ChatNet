import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './app/App'
import { PWAUpdate } from './features/pwa/PWAUpdate'
import './styles/styles.css'
import './styles/mobile.css'
import './styles/mobile-nav.css'
import './features/notifications/notifications.css'
import './styles/friends.css'
import './styles/zalo-inspired.css'
import './features/discover/nearby-explorer.css'
import './features/chat/conversation-content.css'
import './styles/soco-theme.css'
import './styles/soco-screens.css'
import './styles/soco-layout-v2.css'
import './design-system/motion.css'

if (window.location.search.includes('pwa=')) {
  window.history.replaceState(window.history.state, '', `${window.location.pathname}${window.location.hash}`)
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
    {import.meta.env.PROD && <PWAUpdate />}
  </React.StrictMode>,
)
