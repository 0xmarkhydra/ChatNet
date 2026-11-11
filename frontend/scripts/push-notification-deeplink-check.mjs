import assert from 'node:assert/strict'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import { chromium } from 'playwright'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
let server, browser
try {
  server = await createServer({ root, server: { host: '127.0.0.1', port: 0, strictPort: false }, logLevel: 'error' })
  await server.listen()
  const address = server.httpServer.address()
  assert.ok(address && typeof address === 'object')
  browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' })
  const session = {
    token: 'mock.' + Buffer.from(JSON.stringify({ exp: 4102444800 })).toString('base64url') + '.signed',
    refreshToken: 'r'.repeat(43), sessionId: 'notification-jump-test',
    user: { id: 1, email: 'viewer@example.invalid', username: 'viewer', displayName: 'Người xem' },
  }
  const now = new Date().toISOString()
  const chat = { id: 101, type: 'direct', name: 'Tin nhắn thử nghiệm', otherUserId: 2,
    otherUsername: 'sender', memberCount: 2, lastMessage: 'Mới', lastMessageAt: now,
    unreadCount: 1, online: true, createdAt: now }
  const asMessage = (id) => ({
    id, conversationId: 101, senderId: 2, sender: 'sender', senderDisplayName: 'Người gửi',
    text: id === 7 ? 'Tin nhắn được nhấn từ thông báo' : 'Tin nhắn #' + id,
    createdAt: now, attachments: [], readByUserIds: [],
  })
  const requested = []
  const browserErrors = []
  page.on('pageerror', (error) => browserErrors.push(error.message))
  await page.addInitScript((data) => {
    localStorage.setItem('chatnet-session', JSON.stringify(data))
    class Events extends EventTarget { constructor() { super(); setTimeout(() => this.onopen?.(), 20) } close() {} }
    window.EventSource = Events
    const original = Element.prototype.scrollIntoView
    Element.prototype.scrollIntoView = function(...args) {
      if (this instanceof HTMLElement && this.dataset.messageId) {
        (window.__notificationScrolls ??= []).push(this.dataset.messageId)
      }
      return original?.apply(this, args)
    }
  }, session)
  await page.route('**/api/**', async (route) => {
    const req = route.request()
    const url = new URL(req.url())
    const path = url.pathname
    const json = (value) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(value) })
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204 })
    if (path === '/api/conversations') return json([chat])
    if (path === '/api/conversations/memberships') return json({ ids: [101], nextAfter: null })
    if (path === '/api/conversations/101/members') return json([{ id: 1, username: 'viewer', displayName: 'Người xem' }, { id: 2, username: 'sender', displayName: 'Người gửi' }])
    if (path === '/api/conversations/101/messages') {
      requested.push(url.search)
      return json(url.searchParams.has('before')
        ? [4, 5, 6, 7].map(asMessage)
        : Array.from({ length: 20 }, (_, i) => asMessage(100 + i)))
    }
    if (path === '/api/conversation-categories') return json([])
    if (path === '/api/friends') return json([])
    if (path === '/api/preferences') return json({ targetLanguage: 'en', autoTranslate: false, appLocale: 'vi' })
    if (path === '/api/preferences/translation') return json({ targetLanguage: 'en', autoTranslate: false })
    if (path === '/api/push/config') return json({ configured: false })
    return json([])
  })

  await page.goto(`http://127.0.0.1:${address.port}/?conversation=101&message=7`)
  await page.locator('[data-message-id="7"]').waitFor({ state: 'visible', timeout: 20000 })
  await page.waitForFunction(() => window.__notificationScrolls?.includes('7'))
  assert.ok(requested.some((query) => query.includes('before=8')), 'deep link must request history around the exact message')
  assert.equal(await page.locator('[data-message-id="7"]').count(), 1, 'target message must be visible')
  assert.equal(new URL(page.url()).searchParams.has('message'), false, 'notification target should be consumed from the URL')
  assert.deepEqual(browserErrors, [])
  console.log('PASS: PWA notification deep link loads the exact historical message and scrolls to it')
} finally {
  await browser?.close()
  await server?.close()
}
