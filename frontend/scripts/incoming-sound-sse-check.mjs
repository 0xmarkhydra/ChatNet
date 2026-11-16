import assert from 'node:assert/strict'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer as createPortProbe } from 'node:net'
import { chromium } from 'playwright'
import { createServer } from 'vite'

// End-to-end Web Audio acceptance with the real AuthedApp and an isolated SSE
// fixture. Never connects to production services or real account credentials.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const port = await new Promise((resolvePort, reject) => {
  const probe = createPortProbe()
  probe.once('error', reject)
  probe.listen(0, '127.0.0.1', () => {
    const address = probe.address()
    probe.close(() => resolvePort(address.port))
  })
})
// Force the isolated fixture API: the developer's .env may point at a live server.
process.env.VITE_API_URL = 'http://localhost:8080'
const vite = await createServer({
  root, configFile: resolve(root, 'vite.config.ts'),
  logLevel: 'silent', server: { host: '127.0.0.1', port, strictPort: true },
})
const origin = 'http://127.0.0.1:' + port
const session = {
  token: 'test.' + Buffer.from(JSON.stringify({ exp: 4102444800 })).toString('base64url') + '.signature',
  refreshToken: 'm'.repeat(43), sessionId: 'sse-audio-test',
  user: { id: 1, username: 'audio-test', displayName: 'Audio test', email: 'test@example.invalid' },
}
let deliverSse
const deliverPromise = new Promise(resolve => { deliverSse = resolve })
let browser
try {
  await vite.listen()
  browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1366, height: 900 } })
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  const debug = []
  page.on('console', message => {
    if (message.text().includes('[ChatNet incoming sound]')) debug.push(message.text())
  })
  await page.addInitScript(s => {
    localStorage.setItem('chatnet-session', JSON.stringify(s))
    localStorage.setItem('chatnet-message-sound-enabled-v1', 'true')
    window.__audioStarts = 0
    const NativeAudioContext = window.AudioContext
    window.AudioContext = class extends NativeAudioContext {
      createOscillator() {
        const oscillator = super.createOscillator()
        const start = oscillator.start.bind(oscillator)
        oscillator.start = (...args) => {
          window.__audioStarts += 1
          return start(...args)
        }
        return oscillator
      }
    }
  }, session)
  await page.route('http://localhost:8080/**', async route => {
    const path = new URL(route.request().url()).pathname
    const json = data => route.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify(data),
    })
    if (path === '/api/events') {
      await deliverPromise
      const incoming = { id: 177, conversationId: 1, senderId: 2,
        sender: 'other-person', text: 'Test incoming audio',
        // Simulate a valid live SSE event whose database timestamp is several hours
        // behind the recipient device clock (the reported production failure).
        createdAt: new Date(Date.now() - 4 * 60 * 60_000).toISOString(), attachments: [], channelId: 0 }
      return route.fulfill({ status: 200, contentType: 'text/event-stream',
        headers: { 'cache-control': 'no-cache', 'access-control-allow-origin': '*' },
        body: 'event: update\ndata: ' + JSON.stringify({ type: 'message', conversationId: 1, message: incoming }) + '\n\n' })
    }
    if (path === '/api/conversations') {
      return json([{ id: 1, name: 'Test conversation', type: 'direct', otherUserId: 2,
        otherUsername: 'other-person', memberCount: 2, unreadCount: 0, lastMessage: '',
        createdAt: new Date().toISOString(), online: false }])
    }
    if (path === '/api/conversations/unread') return json({ unreadCount: 0 })
    if (path.endsWith('/messages') || path.endsWith('/pins')) return json([])
    if (path === '/api/friends' || path === '/api/friends/requests' ||
        path === '/api/posts' || path === '/api/stories' || path === '/api/calls' ||
        path === '/api/conversation-categories' || path === '/api/users/suggestions' ||
        path === '/api/feed/mentions') return json([])
    if (path === '/api/preferences' || path === '/api/preferences/translation') {
      return json({ autoTranslate: false, targetLanguage: 'vi' })
    }
    if (path === '/api/i18n/bundle') return json({ locale: 'vi', version: 'mock', messages: {}, cache: 'hit' })
    if (path === '/api/conversations/memberships') return json({ ids: [1], nextAfter: null })
    return json({})
  })
  await page.goto(origin)
  const conversation = page.locator('.conversation-item').first()
  try { await conversation.waitFor({ timeout: 12000 }) } catch (error) {
    console.error('App diagnostic:', { url: page.url(), body: (await page.locator('body').innerText()).slice(0, 2400), errors })
    throw error
  }
  await conversation.click()
  // The click is the trusted gesture which unlocks Web Audio for subsequent SSE.
  await page.waitForTimeout(350)
  deliverSse()
  try {
    await page.waitForFunction(() => window.__audioStarts >= 2, null, { timeout: 10000 })
  } catch (error) {
    console.error('SSE/audio diagnostic:', { debug, errors,
      state: await page.evaluate(() => ({ starts: window.__audioStarts, title: document.title, location: location.href })) })
    throw error
  }
  assert.ok(debug.some(text => text.includes('played')), 'SSE must reach the incoming sound handler')
  assert.deepEqual(errors, [], 'real UI must not throw while receiving SSE')
  console.log('PASS: real ChatNet React application plays Web Audio for live SSE from another account despite skewed database timestamp')
} finally {
  deliverSse()
  await browser?.close()
  await vite.close()
}
