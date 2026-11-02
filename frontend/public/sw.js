// Only public, versioned application files may survive a logout or account switch.
const CACHE = 'chatnet-__BUILD_ID__-runtime'
const CORE = ['/offline.html', '/manifest.webmanifest', '/icon.svg', '/icon-maskable.svg']
const PUBLIC_FILES = new Set([...CORE, '/soco-mark.svg', '/soco-maskable.svg'])
const BUILT_ASSET = /^\/assets\/[\w.-]+-[A-Za-z0-9_-]{8,}\.(?:js|css|svg|png|jpe?g|webp|avif|gif|woff2?|ico)$/

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
  const request = event.request
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  if (request.mode === 'navigate') {
    // Never retain user-specific HTML or reuse an authenticated page across accounts.
    event.respondWith(fetch(request).catch(() => caches.match('/offline.html')))
    return
  }

  // APIs, media URLs, profiles and URLs with query parameters are always network-only.
  if (url.search || request.headers.has('Authorization') ||
      !(PUBLIC_FILES.has(url.pathname) || BUILT_ASSET.test(url.pathname))) return

  event.respondWith(
    fetch(request).then((response) => {
      const policy = response.headers.get('Cache-Control') || ''
      if (response.ok && response.type === 'basic' &&
          !/(?:private|no-store|no-cache)/i.test(policy) && !response.headers.has('Set-Cookie')) {
        const copy = response.clone()
        event.waitUntil(caches.open(CACHE).then((cache) => cache.put(request, copy)))
      }
      return response
    }).catch(() => caches.match(request)),
  )
})
