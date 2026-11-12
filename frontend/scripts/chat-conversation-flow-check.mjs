// Browser check (network mocked, nothing reaches a real backend): opening a direct
// conversation and clearing history must keep the request contract and update the UI.
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
  refreshToken: 'm'.repeat(43), sessionId: 'conversation-flow', user: { id: 1, username: 'tester', displayName: 'Tester', email: 't@example.invalid' },
}
const conversation = (id, name, username) => ({ id, name, type: 'direct', otherUserId: id + 10, otherUsername: username,
  memberCount: 2, unreadCount: 0, lastMessage: 'x', createdAt: '2026-11-05T05:00:00Z', online: false })
let conversations = [conversation(1, 'Bạn bè', 'friend')]
const message = { id: 7, conversationId: 1, senderId: 11, sender: 'friend', text: 'Xin chào', createdAt: '2026-11-05T05:00:00Z',
  reactions: [], readByUserIds: [], attachments: [] }
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
  page.on('dialog', dialog => dialog.accept())
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    const method = request.method()
    const reply = (value, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(value) })
    if (path === '/api/events') return route.fulfill({ status: 200, contentType: 'text/event-stream', body: ': ok\n\n' })
    if (method !== 'GET') {
      const body = request.postData() ? JSON.parse(request.postData()) : undefined
      if (path === '/api/conversations/direct' && method === 'POST') {
        writes.push({ method, path, body })
        const created = conversation(2, 'Bạn mới', body.username)
        conversations = [created, ...conversations]
        return reply(created, 201)
      }
      if (path === '/api/conversations/1/history' && method === 'DELETE') {
        writes.push({ method, path })
        return reply({})
      }
      if (path.endsWith('/read') || path.endsWith('/channel-read')) return reply({})
      return route.abort() // unmocked writes must never leave the browser
    }
    if (path === '/api/conversations') return reply(conversations)
    if (path === '/api/conversations/1/messages') return reply([message])
    if (path === '/api/conversations/2/messages') return reply([])
    if (path === '/api/preferences') return reply({ autoTranslate: false, targetLanguage: 'vi' })
    if (path === '/api/i18n/bundle') return reply({ locale: 'vi', version: 'mock', messages: {}, cache: 'hit' })
    if (path === '/api/conversations/unread') return reply({ unreadCount: 0 })
    return reply([])
  })

  await page.goto(origin)
  await page.locator('.conversation-item').first().waitFor()

  // ---- open a direct conversation by username
  await page.locator('button[title="Tạo cuộc trò chuyện"]').click()
  await page.getByPlaceholder('Username người muốn chat').fill('  NewFriend ')
  await page.getByRole('button', { name: 'Tạo cuộc trò chuyện', exact: true }).click()
  await until(() => writes.length === 1, 'the create-direct request')
  assert.deepEqual(writes[0], { method: 'POST', path: '/api/conversations/direct', body: { username: 'newfriend' } })
  await page.waitForFunction(() => document.querySelector('.conversation-item.active')?.innerText.includes('Bạn mới') ||
    document.body.innerText.includes('Bạn mới'))
  assert.equal(await page.getByPlaceholder('Username người muốn chat').count(), 0, 'the new-chat panel closes after creating')

  // ---- clear history of conversation 1
  await page.locator('.conversation-item', { hasText: 'Bạn bè' }).first().click()
  await page.locator('[data-message-id="7"]').waitFor()
  await page.locator('button[aria-controls="conversation-details-panel"]').first().click()
  await page.getByText('Xóa lịch sử trò chuyện').click()
  await until(() => writes.some(w => w.method === 'DELETE'), 'the clear-history request')
  assert.deepEqual(writes.at(-1), { method: 'DELETE', path: '/api/conversations/1/history' })
  await page.waitForFunction(() => !document.querySelector('[data-message-id="7"]'))

  assert.deepEqual(errors, [], 'no uncaught page errors')
  console.log('PASS: chat open direct conversation and clear history (mocked network)')
} finally {
  if (browser) await browser.close()
  server.kill('SIGTERM')
}
