const CACHE = 'chatnet-__BUILD_ID__-runtime'
const CORE = ['/offline.html', '/manifest.webmanifest', '/icon.svg', '/icon-maskable.svg']

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(CORE)))
})

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') event.waitUntil(self.skipWaiting())
})

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys()
    await Promise.all(keys.filter((key) => key.startsWith('chatnet-') && key !== CACHE).map((key) => caches.delete(key)))
    await self.clients.claim()
  })())
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return

  const url = new URL(event.request.url)

  // API and cross-origin traffic must always stay network-only.
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const copy = response.clone()
          caches.open(CACHE).then((cache) => cache.put('/', copy))
          return response
        })
        .catch(async () => (await caches.match('/')) || caches.match('/offline.html')),
    )
    return
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone()
          caches.open(CACHE).then((cache) => cache.put(event.request, copy))
        }
        return response
      })
      .catch(() => caches.match(event.request)),
  )
})
