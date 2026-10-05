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

if (window.location.search.includes('pwa=')) {
  window.history.replaceState(window.history.state, '', `${window.location.pathname}${window.location.hash}`)
}

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  let refreshingForNewWorker = false
  let refreshingForNewBuild = false

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshingForNewWorker) return
    refreshingForNewWorker = true
    window.location.reload()
  })

  navigator.serviceWorker
    .register('/sw.js', { updateViaCache: 'none' })
    .then((registration) => registration.update())
    .catch(() => {})

  const currentEntry = document
    .querySelector<HTMLScriptElement>('script[type="module"][src*="/assets/index-"]')
    ?.getAttribute('src')

  const refreshForNewBuild = async () => {
    if (!currentEntry || refreshingForNewBuild || document.visibilityState === 'hidden') return
    try {
      const response = await fetch(`/index.html?__chatnet_build_check=${Date.now()}`, {
        cache: 'no-store',
        headers: { 'cache-control': 'no-cache' },
      })
      if (!response.ok) return
      const html = await response.text()
      const nextEntry = html.match(/<script[^>]+src="(\/assets\/index-[^"]+\.js)"/)?.[1]
      if (!nextEntry || nextEntry === currentEntry) return

      refreshingForNewBuild = true
      void navigator.serviceWorker.getRegistration().then((registration) => registration?.update())
      const buildId = nextEntry.split('/').pop() || 'latest'
      window.location.replace(`/?__chatnet_build=${encodeURIComponent(buildId)}&t=${Date.now()}`)
    } catch {
      // Offline/resume should keep the current working app instead of interrupting the user.
    }
  }

  window.setTimeout(() => void refreshForNewBuild(), 1200)
  window.addEventListener('pageshow', () => void refreshForNewBuild())
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void refreshForNewBuild()
  })
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
