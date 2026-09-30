import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles.css'
import './mobile.css'
import './mobile-nav.css'
import './notifications.css'
import './friends.css'
import './zalo-inspired.css'

if ('serviceWorker' in navigator && import.meta.env.PROD) {
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
