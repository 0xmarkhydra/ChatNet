import assert from 'node:assert/strict'
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { createServer } from 'node:net'
import { resolve } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'

const port = await new Promise((done, reject) => {
  const probe = createServer()
  probe.once('error', reject)
  probe.listen(0, '127.0.0.1', () => {
    const n = probe.address().port
    probe.close(() => done(n))
  })
})
const origin = `http://127.0.0.1:${port}`
const vite = spawn(process.execPath,
  [resolve('node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', String(port), '--strictPort'],
  { env: { ...process.env, VITE_API_URL: 'http://localhost:8080' }, stdio: ['ignore', 'pipe', 'pipe'] })
let output = ''
vite.stdout.on('data', chunk => { output += chunk.toString() })
vite.stderr.on('data', chunk => { output += chunk.toString() })
const session = {
  token: 'test.' + Buffer.from(JSON.stringify({ exp: 4102444800 })).toString('base64url') + '.sig',
  refreshToken: 'r'.repeat(43), sessionId: 'p002-web-retry-session',
  user: { id: 1, email: 'a@example.invalid', username: 'account_a', displayName: 'Account A' },
}
const conversation = {
  id: 42, type: 'direct', name: 'account_b', otherUserId: 2, memberCount: 2,
  unreadCount: 0, online: true, lastMessage: '', lastMessageAt: '2026-10-29T02:00:00.000Z',
  createdAt: '2026-10-29T02:00:00.000Z',
}
const cors = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'Authorization, Content-Type',
  'access-control-allow-methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
}
const records = new Map()
const requests = []
let loseNextAck = false
let blockPost = false
let nextId = 900
const answer = (route, body, status = 200) => route.fulfill({
  status, headers: cors, contentType: 'application/json', body: JSON.stringify(body),
})
let browser
try {
  let ready = false
  for (let i = 0; i < 90; i++) {
    if (vite.exitCode !== null) throw Error('Vite exited: ' + output)
    try {
      if ((await fetch(origin)).ok) { ready = true; break }
    } catch { /* startup */ }
    await delay(200)
  }
  assert.ok(ready, 'Vite did not start: ' + output)
  browser = await chromium.launch({ headless: true, channel: 'chrome' })
  const context = await browser.newContext({ viewport: { width: 1100, height: 800 } })
  const page = await context.newPage()
  const pageErrors = []
  page.on('pageerror', error => pageErrors.push(error.message))
  await page.addInitScript(s => {
    localStorage.setItem('chatnet-session', JSON.stringify(s))
    window.EventSource = class TestEventSource {
      readyState = 1
      constructor() { queueMicrotask(() => this.onopen?.({})) }
      addEventListener() {}
      close() {}
    }
  }, session)
  await page.route('http://localhost:8080/**', async route => {
    const req = route.request()
    const path = new URL(req.url()).pathname
    const method = req.method()
    if (method === 'OPTIONS') return route.fulfill({ status: 204, headers: cors })
    if (path === '/api/conversations' && method === 'GET') return answer(route, [conversation])
    if (path === '/api/conversations/memberships') return answer(route, { ids: [conversation.id], nextAfter: null })
    if (path === '/api/conversations/42/messages' && method === 'GET') return answer(route,
      [...records.values()].sort((a, b) => a.id - b.id))
    if (path === '/api/conversations/42/messages' && method === 'POST') {
      const body = req.postDataJSON()
      requests.push(body)
      if (blockPost) return route.abort('failed')
      let saved = records.get(body.clientId)
      if (!saved) {
        saved = {
          id: nextId++, conversationId: 42, clientId: body.clientId,
          senderId: 1, sender: 'account_a', text: body.text,
          createdAt: new Date().toISOString(), attachments: body.attachments,
        }
        records.set(body.clientId, saved)
      }
      if (loseNextAck) {
        loseNextAck = false
        return route.abort('failed')
      }
      return answer(route, saved, requests.filter(q => q.clientId === body.clientId).length === 1 ? 201 : 200)
    }
    if (path === '/api/friends' || path === '/api/friends/requests' ||
        path === '/api/stories' || path === '/api/posts' ||
        path === '/api/users/suggestions' || path === '/api/calls') return answer(route, [])
    if (path === '/api/profile') return answer(route, { username: 'account_a', displayName: 'Account A', avatarSet: false, coverSet: false })
    if (path === '/api/privacy') return answer(route, {})
    if (path === '/api/preferences/translation') return answer(route, { autoTranslate: false, targetLanguage: 'en' })
    if (path === '/api/preferences') return answer(route, { targetLanguage: 'en', autoTranslate: false, appLocale: 'vi' })
    if (path === '/api/i18n/bundle') return answer(route, { locale: 'vi', version: 'mock', messages: {} })
    if (path === '/api/push/config') return answer(route, { configured: false, appId: '' })
    if (path === '/api/conversations/42/read') return answer(route, {})
    return answer(route, {})
  })

  await page.goto(origin)
  await page.locator('.conversation-item').first().waitFor({ timeout: 10000 })
  await page.locator('.conversation-item').first().click()
  const field = page.getByRole('textbox', { name: 'Tin nhắn' })
  const sendButton = page.getByRole('button', { name: 'Gửi tin nhắn' })
  await field.waitFor({ timeout: 10000 })

  // P0: Offline A -> B must show a durable, visible pending bubble.
  await context.setOffline(true)
  await page.evaluate(() => window.dispatchEvent(new Event('offline')))
  await field.fill('P0-02 offline message from A to B')
  await sendButton.click()
  const pending = page.locator('.chat-outbox-message').filter({ hasText: 'P0-02 offline message from A to B' })
  await pending.waitFor({ timeout: 5000 })
  assert.match(await pending.textContent(), /Đang gửi/)
  assert.equal(records.size, 0, 'nothing should be POSTed while offline')
  const savedOutbox = await page.evaluate(() => sessionStorage.getItem('chatnet:outbox:v1:1'))
  assert.ok(savedOutbox?.includes('P0-02 offline message'), 'pending message must survive a reload')

  // Reconnect must automatically flush with the same clientId and one DB row.
  await context.setOffline(false)
  await page.evaluate(() => window.dispatchEvent(new Event('online')))
  await page.waitForFunction(() => document.querySelectorAll('.chat-outbox-message').length === 0, { timeout: 10000 })
  assert.equal(records.size, 1)
  const firstClientId = [...records.keys()][0]
  assert.equal(requests.filter(x => x.clientId === firstClientId).length, 1)
  assert.equal(await page.locator('.message .bubble').filter({ hasText: 'P0-02 offline message from A to B' }).count(), 1)

  // Server commits but HTTP ACK disappears. The retry must reuse clientId.
  loseNextAck = true
  await field.fill('P0-02 lost ACK')
  await sendButton.click()
  const ambiguous = page.locator('.chat-outbox-message').filter({ hasText: 'P0-02 lost ACK' })
  await ambiguous.waitFor({ timeout: 5000 })
  await ambiguous.getByRole('button', { name: 'Gửi lại tin nhắn đang chờ' }).click({ timeout: 10000 })
  await ambiguous.waitFor({ state: 'detached', timeout: 10000 })
  const ids = requests.filter(x => x.text === 'P0-02 lost ACK').map(x => x.clientId)
  assert.equal(ids.length, 2, 'lost ACK must be replayed')
  assert.equal(new Set(ids).size, 1, 'resend must reuse the original clientId')
  assert.equal(records.size, 2, 'database cannot create a duplicate')

  // Pending is reloaded from sessionStorage rather than lost on a page refresh.
  blockPost = true
  await field.fill('P0-02 reload during outage')
  await sendButton.click()
  const recovering = page.locator('.chat-outbox-message').filter({ hasText: 'P0-02 reload during outage' })
  await recovering.waitFor({ timeout: 5000 })
  await page.reload()
  await page.locator('.conversation-item').first().click()
  await recovering.waitFor({ timeout: 10000 })
  blockPost = false
  await page.evaluate(() => window.dispatchEvent(new Event('online')))
  await recovering.waitFor({ state: 'detached', timeout: 25000 })
  assert.equal(records.size, 3)
  assert.deepEqual(pageErrors, [], 'page must not throw while offline/recovering')
  console.log('PASS: browser offline bubble, automatic resend, lost-ACK idempotency, reload recovery, no duplicate messages')
} finally {
  await browser?.close()
  vite.kill('SIGTERM')
}
