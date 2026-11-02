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
let heldPostText = ''
let heldPostStarted
let releaseHeldPost
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
  let page = await context.newPage()
  const pageErrors = []
  const watchPage = candidate => candidate.on('pageerror', error => pageErrors.push(error.message))
  watchPage(page)
  await context.addInitScript(s => {
    localStorage.setItem('chatnet-session', JSON.stringify(s))
    window.EventSource = class TestEventSource {
      readyState = 1
      constructor() { queueMicrotask(() => this.onopen?.({})) }
      addEventListener() {}
      close() {}
    }
  }, session)
  await context.route('http://localhost:8080/**', async route => {
    const req = route.request()
    const path = new URL(req.url()).pathname
    const method = req.method()
    if (method === 'OPTIONS') return route.fulfill({ status: 204, headers: cors })
    if (path === '/api/conversation-categories') return answer(route, [])
    if (path === '/api/conversations' && method === 'GET') return answer(route, [conversation])
    if (path === '/api/conversations/memberships') return answer(route, { ids: [conversation.id], nextAfter: null })
    if (path === '/api/conversations/42/messages' && method === 'GET') return answer(route,
      [...records.values()].sort((a, b) => a.id - b.id))
    if (path === '/api/conversations/42/messages' && method === 'POST') {
      const body = req.postDataJSON()
      requests.push(body)
      if (blockPost) return route.abort('failed')
      if (body.text === heldPostText) {
        heldPostStarted?.()
        await new Promise(resolveHeld => { releaseHeldPost = resolveHeld })
      }
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
  try { await page.locator('.conversation-item').first().waitFor({ timeout: 10000 }) }
  catch (error) {
    console.error('Browser UI diagnostic:', (await page.locator('body').innerText()).slice(0, 2500))
    console.error('Browser runtime errors:', pageErrors)
    throw error
  }
  await page.locator('.conversation-item').first().click()
  let field = page.getByRole('textbox', { name: 'Tin nhắn' })
  let sendButton = page.getByRole('button', { name: 'Gửi tin nhắn' })
  await field.waitFor({ timeout: 10000 })

  // P0: Offline A -> B must show a durable, visible pending bubble.
  await context.setOffline(true)
  await page.evaluate(() => window.dispatchEvent(new Event('offline')))
  await field.fill('P0-02 offline message from A to B')
  await sendButton.click()
  let pending = page.locator('.chat-outbox-message').filter({ hasText: 'P0-02 offline message from A to B' })
  await pending.waitFor({ timeout: 5000 })
  assert.match(await pending.textContent(), /Chờ có mạng|Đang gửi|Đang xác nhận/)
  assert.equal(records.size, 0, 'nothing should be POSTed while offline')
  const savedOutbox = await page.evaluate(() =>
    Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index))
      .filter(key => key?.startsWith('chatnet:outbox:v2:1:'))
      .map(key => localStorage.getItem(key)))
  assert.ok(savedOutbox.some(raw => raw?.includes('P0-02 offline message')),
    'pending message must be stored durably')

  // Closing the tab/PWA must not erase the queue. Reopen while the message API is unavailable.
  blockPost = true
  await page.close()
  await context.setOffline(false)
  page = await context.newPage()
  watchPage(page)
  await page.goto(origin)
  await page.locator('.conversation-item').first().waitFor({ timeout: 10000 })
  await page.locator('.conversation-item').first().click()
  field = page.getByRole('textbox', { name: 'Tin nhắn' })
  sendButton = page.getByRole('button', { name: 'Gửi tin nhắn' })
  await field.waitFor({ timeout: 10000 })
  pending = page.locator('.chat-outbox-message').filter({ hasText: 'P0-02 offline message from A to B' })
  await pending.waitFor({ timeout: 10000 })
  assert.match(await pending.textContent(), /Chờ có mạng|Đang gửi|Đang xác nhận/)

  // Ensure the simulated outage actually intercepted one attempted POST.
  for (let i = 0; i < 40 && requests.length === 0; i += 1) await delay(125)
  assert.equal(requests.length, 1, 'the reopened tab should attempt a send while the API is unavailable')

  // Reconnect must automatically flush with the same clientId and one DB row.
  blockPost = false
  await page.evaluate(() => window.dispatchEvent(new Event('online')))
  await page.waitForFunction(() => document.querySelectorAll('.chat-outbox-message').length === 0, { timeout: 10000 })
  assert.equal(records.size, 1)
  const firstClientId = [...records.keys()][0]
  assert.equal(requests.filter(x => x.clientId === firstClientId).length, 2,
    'reopen outage and successful retry must reuse the same clientId')
  assert.equal(await page.locator('.message .bubble').filter({ hasText: 'P0-02 offline message from A to B' }).count(), 1)

  // All online sends use one pump: a second message cannot overtake a slow first request.
  const orderedFirst = 'P0-03 ordered first'
  const orderedSecond = 'P0-03 ordered second'
  heldPostText = orderedFirst
  const firstReachedServer = new Promise(resolveStarted => { heldPostStarted = resolveStarted })
  await field.fill(orderedFirst)
  await sendButton.click()
  await Promise.race([
    firstReachedServer,
    delay(5000).then(() => { throw new Error('first ordered send did not reach the server') }),
  ])
  await field.fill(orderedSecond)
  await sendButton.click()
  await delay(250)
  assert.deepEqual(requests.filter(x => x.text === orderedFirst || x.text === orderedSecond).map(x => x.text),
    [orderedFirst], 'second POST must wait for the first receipt')
  assert.ok(releaseHeldPost, 'first POST gate was not installed')
  releaseHeldPost()
  await page.waitForFunction(() => document.querySelectorAll('.chat-outbox-message').length === 0,
    { timeout: 10000 })
  assert.deepEqual(requests.filter(x => x.text === orderedFirst || x.text === orderedSecond).map(x => x.text),
    [orderedFirst, orderedSecond])
  heldPostText = ''
  heldPostStarted = undefined
  releaseHeldPost = undefined

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
  assert.equal(records.size, 4, 'database cannot create a duplicate')

  // Pending is reloaded from durable local storage rather than lost on a page refresh.
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
  assert.equal(records.size, 5)
  assert.deepEqual(pageErrors, [], 'page must not throw while offline/recovering')
  console.log('PASS: durable close/reopen queue, serialized sends, automatic resend, lost-ACK idempotency, reload recovery')
} finally {
  await browser?.close()
  vite.kill('SIGTERM')
}