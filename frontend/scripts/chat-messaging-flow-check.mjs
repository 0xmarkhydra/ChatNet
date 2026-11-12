// Browser check (network mocked, nothing reaches a real backend): send, offline outbox
// retry, edit, recall and react must keep the exact request contract and update the UI.
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
  refreshToken: 'm'.repeat(43), sessionId: 'messaging-flow', user: { id: 1, username: 'tester', displayName: 'Tester', email: 't@example.invalid' },
}
const base = { conversationId: 1, senderId: 1, sender: 'tester', createdAt: '2026-11-05T05:00:00Z', reactions: [], readByUserIds: [], attachments: [] }
let messages = [
  { ...base, id: 7, text: 'Tin của tôi' },
  { ...base, id: 8, text: 'Tin để thu hồi' },
  { ...base, id: 9, text: 'Tin để thả cảm xúc' },
]
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
  page.on('dialog', dialog => {
    if (dialog.type() === 'prompt') dialog.accept('Đã sửa xong')
    else dialog.accept()
  })
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    const method = request.method()
    const reply = (value, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(value) })
    if (path === '/api/events') return route.fulfill({ status: 200, contentType: 'text/event-stream', body: ': ok\n\n' })
    if (method !== 'GET') {
      const body = request.postData() ? JSON.parse(request.postData()) : undefined
      if (path === '/api/conversations/1/messages' && method === 'POST') {
        writes.push({ method, path, body })
        const created = { ...base, id: 100 + writes.length, text: body.text, clientId: body.clientId }
        messages = [...messages, created]
        return reply(created, 201)
      }
      const message = path.match(/^\/api\/messages\/(\d+)$/)
      if (message && method === 'PATCH') {
        writes.push({ method, path, body })
        const updated = { ...messages.find(m => m.id === Number(message[1])), text: body.text, editedAt: '2026-11-05T06:00:00Z' }
        messages = messages.map(m => (m.id === updated.id ? updated : m))
        return reply(updated)
      }
      if (message && method === 'DELETE') {
        writes.push({ method, path })
        const updated = { ...messages.find(m => m.id === Number(message[1])), text: '', deleted: true }
        messages = messages.map(m => (m.id === updated.id ? updated : m))
        return reply(updated)
      }
      const reaction = path.match(/^\/api\/messages\/(\d+)\/reactions$/)
      if (reaction && method === 'POST') {
        writes.push({ method, path, body })
        const updated = { ...messages.find(m => m.id === Number(reaction[1])), reactions: [{ emoji: body.emoji, count: 1, reactedByMe: true }] }
        messages = messages.map(m => (m.id === updated.id ? updated : m))
        return reply(updated)
      }
      if (path.endsWith('/read') || path.endsWith('/channel-read')) return reply({})
      return route.abort() // unmocked writes must never leave the browser
    }
    if (path === '/api/conversations') return reply([{ id: 1, name: 'Bạn bè', type: 'direct', otherUserId: 2, otherUsername: 'friend',
      memberCount: 2, unreadCount: 0, lastMessage: 'x', createdAt: '2026-11-05T05:00:00Z', online: false }])
    if (path === '/api/conversations/1/messages') return reply(messages)
    if (path === '/api/preferences') return reply({ autoTranslate: false, targetLanguage: 'vi' })
    if (path === '/api/i18n/bundle') return reply({ locale: 'vi', version: 'mock', messages: {}, cache: 'hit' })
    if (path === '/api/conversations/unread') return reply({ unreadCount: 0 })
    return reply([])
  })

  await page.goto(origin)
  await page.locator('.conversation-item').first().click()
  await page.locator('[data-message-id="7"]').waitFor()

  // ---- send
  const composer = page.getByPlaceholder(/Nhập tin nhắn|Nhắn Bạn bè/)
  await composer.fill('Xin chào')
  await composer.press('Enter')
  await until(() => writes.length === 1, 'the send request')
  assert.equal(writes[0].path, '/api/conversations/1/messages')
  assert.equal(writes[0].body.text, 'Xin chào')
  assert.deepEqual(writes[0].body.attachments, [])
  assert.match(writes[0].body.clientId, /^[0-9a-f-]{36}$/)
  assert.equal('channelId' in writes[0].body, false, 'direct chats carry no channelId')
  assert.equal(await composer.inputValue(), '', 'composer is cleared after sending')

  // ---- offline outbox: queued while offline, delivered once after reconnect
  await context.setOffline(true)
  await composer.fill('Gửi khi mất mạng')
  await composer.press('Enter')
  await delay(500)
  assert.equal(writes.length, 1, 'nothing is sent while offline')
  await context.setOffline(false)
  await until(() => writes.some(w => w.body?.text === 'Gửi khi mất mạng'), 'the queued message after reconnect')
  await delay(1500)
  const offlineWrites = writes.filter(w => w.body?.text === 'Gửi khi mất mạng')
  assert.equal(offlineWrites.length, 1, 'the queued message is delivered exactly once')

  // ---- edit
  const openMenu = async id => {
    await page.locator(`[data-message-id="${id}"] .message-selectable-text`).dispatchEvent('contextmenu', { button: 2, bubbles: true })
    const dialog = page.getByRole('dialog', { name: 'Tùy chọn tin nhắn' })
    await dialog.waitFor()
    return dialog
  }
  await (await openMenu(7)).getByRole('button', { name: 'Sửa' }).click()
  await until(() => writes.some(w => w.method === 'PATCH'), 'the edit request')
  await page.getByText('Đã sửa xong').waitFor()
  const edit = writes.find(w => w.method === 'PATCH')
  assert.deepEqual(edit, { method: 'PATCH', path: '/api/messages/7', body: { text: 'Đã sửa xong' } })

  // ---- recall
  await (await openMenu(8)).getByRole('button', { name: 'Thu hồi' }).click()
  await until(() => writes.some(w => w.method === 'DELETE'), 'the recall request')
  await page.waitForFunction(() => !document.body.innerText.includes('Tin để thu hồi'))
  assert.ok(writes.some(w => w.method === 'DELETE' && w.path === '/api/messages/8'), 'recall sends DELETE /api/messages/8')

  // ---- react
  await page.locator('[data-message-id="9"] .reaction-add').dispatchEvent('click')
  await page.getByRole('dialog', { name: 'Chọn cảm xúc' }).getByRole('button', { name: /❤️/ }).first().click()
  await until(() => writes.some(w => w.path === '/api/messages/9/reactions'), 'the reaction request')
  await page.waitForFunction(() => document.querySelector('[data-message-id="9"]')?.innerText.includes('❤️'))
  const reaction = writes.find(w => w.path === '/api/messages/9/reactions')
  assert.deepEqual(reaction, { method: 'POST', path: '/api/messages/9/reactions', body: { emoji: '❤️' } })

  assert.deepEqual(errors, [], 'no uncaught page errors')
  console.log('PASS: chat send, offline outbox retry, edit, recall and reaction (mocked network)')
} finally {
  if (browser) await browser.close()
  server.kill('SIGTERM')
}
