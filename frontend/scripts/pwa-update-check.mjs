import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { watchPWAUpdates } from '../src/pwa-updates.ts'

const flush = () => new Promise((resolve) => setImmediate(resolve))
const workers = new EventTarget()
const registration = new EventTarget()
let updateChecks = 0
let reloads = 0
let notices = 0
let interval
let sentMessage
workers.controller = null
workers.register = async (url, options) => {
  assert.equal(url, '/sw.js')
  assert.equal(options.updateViaCache, 'none')
  return registration
}
registration.update = async () => { updateChecks++ }
globalThis.window = Object.assign(new EventTarget(), {
  location: { reload() { reloads++ } },
  setInterval(callback, delay) {
    assert.equal(delay, 60_000)
    interval = callback
    return 1
  },
  clearInterval() { interval = undefined },
})
globalThis.document = Object.assign(new EventTarget(), { visibilityState: 'visible' })
Object.defineProperty(globalThis, 'navigator', {
  value: { serviceWorker: workers, onLine: true },
  configurable: true,
})

const watcher = watchPWAUpdates(() => { notices++ })
await flush()
workers.controller = {}
workers.dispatchEvent(new Event('controllerchange'))
assert.equal(notices, 0, 'first installation must not show update banner')
assert.equal(reloads, 0, 'first installation must not reload')

const waiting = Object.assign(new EventTarget(), {
  postMessage(message) { sentMessage = message },
})
registration.installing = waiting
registration.dispatchEvent(new Event('updatefound'))
registration.waiting = waiting
waiting.dispatchEvent(new Event('statechange'))
assert.equal(notices, 1, 'installed update must show banner')
assert.equal(reloads, 0, 'update must wait for user consent')
assert.equal(sentMessage, undefined, 'update must not activate before click')

interval()
await flush()
assert.equal(updateChecks, 2, 'open app must poll for updates')
for (const name of ['focus', 'pageshow', 'online']) {
  window.dispatchEvent(new Event(name))
  await flush()
}
assert.equal(updateChecks, 5, 'resume and reconnect must check for updates')
document.visibilityState = 'hidden'
interval()
await flush()
assert.equal(updateChecks, 5, 'hidden app must skip polling')
document.visibilityState = 'visible'
document.dispatchEvent(new Event('visibilitychange'))
await flush()
assert.equal(updateChecks, 6, 'returning to app must check for updates')
navigator.onLine = false
interval()
await flush()
assert.equal(updateChecks, 6, 'offline app must skip polling')
navigator.onLine = true
registration.update = async () => { throw new Error('network unavailable') }
interval()
await flush()
assert.equal(reloads, 0, 'network failure must not reload app')

watcher.apply()
assert.equal(sentMessage, 'SKIP_WAITING')
assert.equal(reloads, 0, 'reload must wait for activation')
workers.dispatchEvent(new Event('controllerchange'))
workers.dispatchEvent(new Event('controllerchange'))
assert.equal(reloads, 1, 'user-approved update reloads exactly once')
watcher.stop()
const noticesAtStop = notices
waiting.dispatchEvent(new Event('statechange'))
workers.dispatchEvent(new Event('controllerchange'))
assert.equal(notices, noticesAtStop, 'cleanup removes listeners')
assert.equal(interval, undefined, 'cleanup clears polling')

registration.waiting = waiting
const resumed = watchPWAUpdates(() => { notices++ })
await flush()
assert.ok(notices > noticesAtStop, 'already waiting update must show banner')
registration.waiting = null
workers.dispatchEvent(new Event('controllerchange'))
assert.equal(reloads, 1, 'activation from another tab must not force reload')
resumed.apply()
assert.equal(reloads, 2, 'already activated update reloads on click')
resumed.stop()

let finishRegistration
workers.register = () => new Promise((resolve) => { finishRegistration = resolve })
const stopped = watchPWAUpdates(() => assert.fail('disposed watcher must not notify'))
stopped.stop()
finishRegistration(registration)
await flush()

const events = {}
let skipped = 0
const deleted = []
runInNewContext(readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8'), {
  self: {
    addEventListener(name, handler) { events[name] = handler },
    skipWaiting() { skipped++; return Promise.resolve() },
    clients: { claim: async () => {} },
  },
  caches: {
    open: async () => ({ addAll: async () => {} }),
    keys: async () => ['chatnet-old-runtime', 'chatnet-__BUILD_ID__-runtime', 'other-app'],
    delete: async (key) => { deleted.push(key) },
  },
})
let work
const event = { waitUntil(promise) { work = promise } }
events.install(event)
await work
assert.equal(skipped, 0, 'SW install must leave update waiting')
events.message({ ...event, data: 'SKIP_WAITING' })
await work
assert.equal(skipped, 1, 'SW must accept explicit activation')
events.activate(event)
await work
assert.deepEqual(deleted, ['chatnet-old-runtime'], 'only obsolete ChatNet caches are removed')

// Security regression: authenticated content must never enter the shared SW cache.
const fetchEvents = {}
const cachedPaths = []
const cachedResponses = new Map([['/offline.html', 'offline fallback']])
let networkResponse
let networkFails = false
runInNewContext(readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8'), {
  URL,
  self: {
    location: { origin: 'https://soco.test' },
    addEventListener(name, handler) { fetchEvents[name] = handler },
  },
  caches: {
    match: async (request) => cachedResponses.get(typeof request === 'string' ? request : request.url),
    open: async () => ({
      put: async (request, response) => {
        cachedPaths.push(request.url)
        cachedResponses.set(request.url, response)
      },
    }),
  },
  fetch: async () => {
    if (networkFails) throw new Error('offline')
    return networkResponse
  },
})

function swFetch(path, { mode = 'cors', method = 'GET', headers = {} } = {}) {
  let reply
  const pending = []
  fetchEvents.fetch({
    request: { url: 'https://soco.test' + path, mode, method, headers: new Headers(headers) },
    respondWith(promise) { reply = promise },
    waitUntil(promise) { pending.push(promise) },
  })
  return { reply, pending }
}
function publicResponse(cacheControl = '') {
  return {
    ok: true, type: 'basic',
    headers: new Headers(cacheControl ? { 'Cache-Control': cacheControl } : {}),
    clone() { return this },
  }
}
networkResponse = publicResponse()
for (const path of ['/api/chat/messages', '/media/secret.png', '/profile/123', '/assets/user-avatar.jpg', '/assets/index-12345678.js?token=abc']) {
  assert.equal(swFetch(path).reply, undefined, path + ' must remain network-only')
}
assert.equal(swFetch('/assets/index-12345678.js', { headers: { Authorization: 'Bearer token' } }).reply, undefined)
assert.equal(swFetch('/assets/index-12345678.js', { method: 'POST' }).reply, undefined)
let result = swFetch('/conversation/42', { mode: 'navigate' })
assert.equal(await result.reply, networkResponse, 'navigation uses network response')
assert.deepEqual(cachedPaths, [], 'navigation must not cache user-specific HTML')
networkFails = true
result = swFetch('/conversation/42', { mode: 'navigate' })
assert.equal(await result.reply, 'offline fallback', 'offline page is public, not a stale user session')
networkFails = false
networkResponse = publicResponse('private, no-store')
result = swFetch('/assets/index-12345678.js')
await result.reply
await Promise.all(result.pending)
assert.deepEqual(cachedPaths, [], 'private or no-store response must not be cached')
networkResponse = publicResponse()
result = swFetch('/assets/index-12345678.js')
await result.reply
await Promise.all(result.pending)
assert.deepEqual(cachedPaths, ['https://soco.test/assets/index-12345678.js'], 'only public build assets may be cached')
networkFails = true
result = swFetch('/assets/index-12345678.js')
assert.equal(await result.reply, networkResponse, 'public built asset remains usable offline')

console.log('PASS: PWA update consent, offline fallback and private cache isolation')
