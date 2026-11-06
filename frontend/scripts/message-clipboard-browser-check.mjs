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
  probe.listen(0, '127.0.0.1', () => {
    const port = probe.address().port
    probe.close(() => resolve(port))
  })
})
const origin = 'http://127.0.0.1:' + port
const signedS3Image = 'https://s3-hcm-r2.s3cloud.vn/chatnet/chat/2/2026/11/0123456789abcdef0123456789abcdef.png?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Signature=' + 'a'.repeat(64)
const imageBytes = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/Sc8B+wAAAABJRU5ErkJggg==', 'base64')
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(port), '--strictPort'],
  { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] })
let logs = ''
server.stdout.on('data', data => { logs += data.toString() })
server.stderr.on('data', data => { logs += data.toString() })
let browser

const session = {
  token: 'mock.' + Buffer.from(JSON.stringify({ exp: 4102444800 })).toString('base64url') + '.signed',
  refreshToken: 'm'.repeat(43), sessionId: 'copy-ui-test',
  user: { id: 1, username: 'tester', displayName: 'Tester', email: 'test@example.invalid' },
}
const messages = [
  { id: 7, text: 'Xem https://example.com/report.pdf nhé', attachments: [] },
  { id: 8, text: '', attachments: [{ id: 21, storageRef: 's3://chat/image', name: 'photo.png', sizeBytes: 68,
    contentType: 'image/png', kind: 'image', url: origin + '/mock-image.png' }] },
  { id: 9, text: 'Lời chào', attachments: [] },
  { id: 10, text: '', attachments: [{ id: 31, storageRef: 'chat/file-31', name: 'bao-cao.pdf', sizeBytes: 1024,
    contentType: 'application/pdf', kind: 'file', url: origin + '/mock-document.pdf?ticket=123' }] },
  { id: 11, text: '', attachments: [{ id: 32, storageRef: 'chat/file-32', name: 'tai-lieu.docx', sizeBytes: 1024,
    contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    kind: 'file' }] },
  { id: 12, text: '', attachments: [{ id: 33, storageRef: 's3://bucket/chatnet/chat/2/2026/11/fake.png',
    name: 's3-screen.png', sizeBytes: 68, contentType: 'image/png', kind: 'image', url: signedS3Image }] },
].map(message => ({ ...message, conversationId: 1, senderId: 2, sender: 'friend',
  createdAt: '2026-11-05T05:00:00Z', reactions: [], readByUserIds: [] }))

try {
  let ready = false
  for (let i = 0; i < 70; i++) {
    if (server.exitCode !== null) throw Error('Vite exited: ' + logs)
    try { if ((await fetch(origin)).ok) { ready = true; break } } catch {}
    await delay(200)
  }
  assert.ok(ready, logs)
  browser = await chromium.launch({ channel: 'chrome', headless: true })
  const page = await browser.newPage({ viewport: { width: 1366, height: 900 } })
  await page.addInitScript(s => localStorage.setItem('chatnet-session', JSON.stringify(s)), session)
  await page.addInitScript(() => {
    window.__copied = []
    const nativeFetch = window.fetch.bind(window)
    window.fetch = (url, options) => {
      const target = typeof url === 'string' ? url : url instanceof URL ? url.href : url.url
      if (target.startsWith('https://s3-hcm-r2.s3cloud.vn/')) {
        return Promise.reject(new TypeError('S3 CORS blocked the image fetch'))
      }
      return nativeFetch(url, options)
    }
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true, value: {
        writeText: async value => { window.__copied.push({ kind: 'text', value }) },
        write: async items => {
          const blob = await items[0].getType('image/png')
          window.__copied.push({ kind: 'image', type: blob.type })
        },
      },
    })
  })
  await page.route(origin + '/mock-image.png', route =>
    route.fulfill({ status: 200, contentType: 'image/png', body: imageBytes }))
  // The image loads in <img>, while a cross-origin fetch has no ACAO header.
  // The same-origin media proxy is independently tested with mocked Node fetch.
  await page.route('https://s3-hcm-r2.s3cloud.vn/**', route =>
    route.fulfill({ status: 200, contentType: 'image/png', body: imageBytes }))
  let proxyReads = 0
  await page.route(origin + '/__chatnet_copy_image?**', route => {
    assert.equal(new URL(route.request().url()).searchParams.get('url'), signedS3Image)
    proxyReads++
    return route.fulfill({ status: 200, contentType: 'image/png', body: imageBytes })
  })
  await page.route('http://localhost:8080/**', route => {
    const path = new URL(route.request().url()).pathname
    const reply = value => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(value) })
    if (path === '/api/events') return route.fulfill({ status: 200, contentType: 'text/event-stream', body: ': ok\n\n' })
    if (path === '/api/conversations') return reply([{ id: 1, name: 'Bạn bè', type: 'direct', otherUserId: 2,
      otherUsername: 'friend', memberCount: 2, unreadCount: 0, lastMessage: 'Lời chào',
      createdAt: '2026-11-05T05:00:00Z', online: false }])
    if (path === '/api/conversations/1/messages') return reply(messages)
    if (path === '/api/conversation-categories' || path === '/api/friends' || path === '/api/friends/requests' ||
      path === '/api/users/suggestions' || path === '/api/posts' || path === '/api/calls') return reply([])
    if (path === '/api/preferences' || path === '/api/preferences/translation') return reply({ autoTranslate: false, targetLanguage: 'vi' })
    if (path === '/api/i18n/bundle') return reply({ locale: 'vi', version: 'mock', messages: {}, cache: 'hit' })
    return reply({})
  })
  await page.goto(origin)
  await page.locator('.conversation-item').first().click()
  await page.locator('[data-message-id="7"] a.message-inline-link').waitFor()
  const copy = async (locator, expected) => {
    await locator.click({ button: 'right' })
    const dialog = page.getByRole('dialog', { name: 'Tùy chọn tin nhắn' })
    await dialog.waitFor()
    const copyButtons = dialog.locator('.message-context-actions button').filter({ hasText: /Sao chép/ })
    assert.equal(await copyButtons.count(), 1, 'Menu must expose exactly one Copy action')
    const action = dialog.getByRole('button', { name: 'Sao chép', exact: true })
    assert.equal(await action.count(), 1)
    assert.equal(await action.locator('span[aria-hidden="true"]').textContent(), '▣')
    const before = await page.evaluate(() => window.__copied.length)
    await action.click()
    await page.waitForFunction(count => window.__copied.length > count, before, { timeout: 15000 })
    const last = await page.evaluate(() => window.__copied.at(-1))
    assert.deepEqual(last, expected)
  }
  await copy(page.locator('[data-message-id="7"] a.message-inline-link'),
    { kind: 'text', value: 'https://example.com/report.pdf' })
  await copy(page.locator('[data-message-id="8"] img'), { kind: 'image', type: 'image/png' })
  await copy(page.locator('[data-message-id="9"] .message-selectable-text'),
    { kind: 'text', value: 'Lời chào' })
  await copy(page.locator('[data-message-id="10"] .media-file-card'),
    { kind: 'text', value: origin + '/mock-document.pdf?ticket=123' })
  await copy(page.locator('[data-message-id="11"] .media-file-card'),
    { kind: 'text', value: 'tai-lieu.docx' })
  await copy(page.locator('[data-message-id="12"] img'), { kind: 'image', type: 'image/png' })
  assert.equal(proxyReads, 1, 'CORS-blocked S3 image must fall back to same-origin proxy')
  console.log('PASS: Chrome copy text, link, image, file, and S3 image blocked by CORS using same-origin fallback')
} finally {
  if (browser) await browser.close()
  server.kill('SIGTERM')
}
