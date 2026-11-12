// Browser check (network mocked, nothing reaches a real backend): conversation-scoped UI state
// resets when the conversation changes, while drafts, the offline outbox and message history survive.
import assert from 'node:assert/strict'
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { createServer } from 'node:net'
import { fileURLToPath } from 'node:url'
import { setTimeout as delay } from 'node:timers/promises'

const root = fileURLToPath(new URL('../', import.meta.url))
const port = await new Promise((resolve, reject) => {
  const probe = createServer()
  probe.once('error', reject)
  probe.listen(0, '127.0.0.1', () => { const p = probe.address().port; probe.close(() => resolve(p)) })
})
const origin = 'http://127.0.0.1:' + port
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(port), '--strictPort'],
  { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] })
let logs = ''
server.stdout.on('data', d => { logs += d })
server.stderr.on('data', d => { logs += d })
let browser

const session = {
  token: 'mock.' + Buffer.from(JSON.stringify({ exp: 4102444800 })).toString('base64url') + '.signed',
  refreshToken: 'm'.repeat(43), sessionId: 'scoped-ui-state', user: { id: 1, username: 'tester', displayName: 'Tester', email: 't@example.invalid' },
}
const conversation = (id, name, username) => ({ id, name, type: 'direct', otherUserId: id + 10, otherUsername: username,
  memberCount: 2, unreadCount: 0, lastMessage: 'x', createdAt: '2026-11-05T05:00:00Z', online: false })
const message = (id, conversationId, text) => ({ id, conversationId, senderId: conversationId + 10, sender: 'friend', text,
  createdAt: '2026-11-05T05:00:00Z', reactions: [], readByUserIds: [], attachments: [] })
const history = {
  1: [message(7, 1, 'Tin của bạn A')],
  2: [message(8, 2, 'Tin của bạn B')],
}
const writes = []
const until = async (condition, what) => {
  for (let i = 0; i < 100; i++) { if (condition()) return; await delay(100) }
  assert.fail('Timed out waiting for ' + what)
}

try {
  let ready = false
  for (let i = 0; i < 70; i++) {
    if (server.exitCode !== null) throw Error('Vite exited: ' + logs)
    try { if ((await fetch(origin)).ok) { ready = true; break } } catch {}
    await delay(200)
  }
  assert.ok(ready, logs)
  for (const channel of [undefined, 'msedge', 'chrome']) {
    try { browser = await chromium.launch({ headless: true, ...(channel ? { channel } : {}) }); break }
    catch (error) { if (!/doesn't exist|not found|Executable/.test(String(error))) throw error }
  }
  assert.ok(browser, 'NOT RUN: no Chromium, Edge or Chrome available for Playwright')
  const context = await browser.newContext({ viewport: { width: 1366, height: 900 }, serviceWorkers: 'block' })
  await context.addInitScript(s => {
    localStorage.setItem('chatnet-session', JSON.stringify(s))
    class MockEventSource extends EventTarget { constructor() { super(); setTimeout(() => this.onopen?.(), 50) } close() {} }
    window.EventSource = MockEventSource
  }, session)
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    const method = request.method()
    const reply = (value, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(value) })
    if (path === '/api/events') return route.fulfill({ status: 200, contentType: 'text/event-stream', body: ': ok\n\n' })
    if (method !== 'GET') {
      const sent = path.match(/^\/api\/conversations\/(\d+)\/messages$/)
      if (sent && method === 'POST') {
        const body = JSON.parse(request.postData())
        writes.push({ conversationId: Number(sent[1]), body })
        const created = { ...message(100 + writes.length, Number(sent[1]), body.text), senderId: 1, sender: 'tester', clientId: body.clientId }
        return reply(created, 201)
      }
      if (path.endsWith('/read') || path.endsWith('/channel-read')) return reply({})
      return route.abort() // unmocked writes must never leave the browser
    }
    if (path === '/api/conversations') return reply([conversation(1, 'Bạn A', 'a'), conversation(2, 'Bạn B', 'b')])
    const list = path.match(/^\/api\/conversations\/(\d+)\/messages$/)
    if (list) return reply(history[Number(list[1])] ?? [])
    if (path === '/api/preferences') return reply({ autoTranslate: false, targetLanguage: 'vi' })
    if (path === '/api/i18n/bundle') return reply({ locale: 'vi', version: 'mock', messages: {}, cache: 'hit' })
    if (path === '/api/conversations/unread') return reply({ unreadCount: 0 })
    return reply([])
  })

  const openConversation = async name => {
    await page.locator('.conversation-item', { hasText: name }).first().click()
  }
  const composer = page.getByPlaceholder(/Nhập tin nhắn|Nhắn /)
  const detailsOpen = () => page.locator('#conversation-details-panel').count()
  const replyBar = () => page.locator('.composer-reply-preview').count()

  await page.goto(origin)
  await page.locator('.conversation-item').first().waitFor()

  // Conversation A: open details, start a reply, type a draft.
  await openConversation('Bạn A')
  await page.locator('[data-message-id="7"]').waitFor()
  await page.locator('button[aria-controls="conversation-details-panel"]').first().click()
  await page.locator('#conversation-details-panel').waitFor()
  await page.locator('[data-message-id="7"] .message-selectable-text').dispatchEvent('contextmenu', { button: 2, bubbles: true })
  await page.getByRole('dialog', { name: 'Tùy chọn tin nhắn' }).getByRole('button', { name: 'Trả lời' }).click()
  await page.locator('.composer-reply-preview').waitFor()
  await composer.fill('nháp của A')

  // A -> B: scoped UI resets, history of B is loaded, A's draft is not lost.
  await openConversation('Bạn B')
  await page.locator('[data-message-id="8"]').waitFor()
  assert.equal(await detailsOpen(), 0, 'details panel is closed in the next conversation')
  assert.equal(await replyBar(), 0, 'reply target does not follow into the next conversation')
  assert.equal(await page.locator('[data-message-id="7"]').count(), 0, 'history of A is not shown in B')
  assert.equal(await composer.inputValue(), '', 'a draft belongs to its own conversation')

  // A -> B -> A: nothing from the first visit comes back, the draft does.
  await openConversation('Bạn A')
  await page.locator('[data-message-id="7"]').waitFor()
  assert.equal(await detailsOpen(), 0, 'details do not reopen after returning')
  assert.equal(await replyBar(), 0, 'reply target does not reappear after returning')
  assert.equal(await composer.inputValue(), 'nháp của A', 'the draft of A survives switching away and back')

  // Offline outbox survives a conversation switch and is delivered once to the right conversation.
  await composer.fill('')
  await context.setOffline(true)
  await composer.fill('gửi sau cho A')
  await composer.press('Enter')
  await delay(300)
  await openConversation('Bạn B')
  await page.locator('[data-message-id="8"]').waitFor()
  await context.setOffline(false)
  await until(() => writes.length >= 1, 'the queued message after reconnect')
  await delay(1500)
  const queued = writes.filter(w => w.body.text === 'gửi sau cho A')
  assert.equal(queued.length, 1, 'queued message is delivered exactly once')
  assert.equal(queued[0].conversationId, 1, 'queued message stays with the conversation it was written in')

  assert.deepEqual(errors.filter(e => !/Failed to load resource|net::ERR/.test(e)), [], 'no page or console errors')
  console.log('PASS: scoped chat UI state resets per conversation; drafts, outbox and history are kept (mocked network)')
} finally {
  if (browser) await browser.close()
  server.kill('SIGTERM')
}
