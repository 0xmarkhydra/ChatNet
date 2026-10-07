import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { PWAUpdate } from './PWAUpdate'
import './styles.css'
import './mobile.css'
import './mobile-nav.css'
import './notifications.css'
import './friends.css'
import './zalo-inspired.css'
import './nearby-explorer.css'
import './conversation-content.css'

if (window.location.search.includes('pwa=')) {
  window.history.replaceState(window.history.state, '', `${window.location.pathname}${window.location.hash}`)
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
    {import.meta.env.PROD && <PWAUpdate />}
  </React.StrictMode>,
)
