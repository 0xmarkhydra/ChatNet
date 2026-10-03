import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles.css'
import './mobile.css'
import './mobile-nav.css'
import './notifications.css'
import './friends.css'
import './zalo-inspired.css'
import './nearby-explorer.css'

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  let refreshingForNewWorker = false

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshingForNewWorker) return
    refreshingForNewWorker = true
    window.location.reload()
  })

  navigator.serviceWorker
    .register('/sw.js', { updateViaCache: 'none' })
    .then((registration) => registration.update())
    .catch(() => {})
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
