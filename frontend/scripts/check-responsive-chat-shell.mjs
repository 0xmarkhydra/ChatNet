import assert from 'node:assert/strict'
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { createServer } from 'node:net'
import { resolve } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'

const port = await new Promise((resolvePort, reject) => {
  const socket = createServer()
  socket.once('error', reject)
  socket.listen(0, '127.0.0.1', () => {
    const { port: value } = socket.address()
    socket.close(() => resolvePort(value))
  })
})
const origin = 'http://127.0.0.1:' + port
const vite = spawn(process.execPath, [resolve('node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { stdio: ['ignore', 'pipe', 'pipe'] })
let serverLogs = ''
vite.stdout.on('data', data => { serverLogs += data })
vite.stderr.on('data', data => { serverLogs += data })
const session = {
  token: 'mock.' + Buffer.from(JSON.stringify({ exp: 4102444800 })).toString('base64url') + '.signed',
  refreshToken: 'm'.repeat(43),
  sessionId: 'responsive-rail-smoke',
  user: { id: 1, username: 'layout_tester', displayName: 'Layout Tester', email: 'layout@example.com' },
}
const conversations = [
  { id: 1, name: 'minhanh', type: 'direct', otherUserId: 2, otherUsername: 'minhanh', memberCount: 2, unreadCount: 2, lastMessage: 'Tin nhắn mới', online: true, createdAt: '2026-10-02T07:00:00Z', lastMessageAt: '2026-10-02T07:00:00Z' },
  { id: 2, name: 'hoangnam', type: 'direct', otherUserId: 3, otherUsername: 'hoangnam', memberCount: 2, unreadCount: 0, lastMessage: 'Đã nhận được', online: false, createdAt: '2026-10-01T07:00:00Z', lastMessageAt: '2026-10-01T07:00:00Z' },
]
const responseHeaders = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'Authorization, Content-Type' }
let browser
try {
  let ready = false
  for (let i = 0; i < 80; i++) {
    if (vite.exitCode !== null) throw new Error('Vite exited: ' + serverLogs)
    try { if ((await fetch(origin)).ok) { ready = true; break } } catch { /* wait for Vite */ }
    await delay(200)
  }
  assert.ok(ready, 'Vite did not start: ' + serverLogs)
  browser = await chromium.launch({ headless: true, channel: 'chrome' })
  for (const width of [390, 768, 1024, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 844 } })
    try {
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await page.addInitScript(value => localStorage.setItem('chatnet-session', JSON.stringify(value)), session)
      await page.route(url => url.pathname.startsWith('/api/'), async route => {
        const request = route.request()
        const url = new URL(request.url())
        const path = url.pathname
        const data = path === '/api/conversations' ? conversations
          : path === '/api/friends' ? []
          : path === '/api/profile' ? { username: session.user.username, displayName: session.user.displayName, updatedAt: '2026-11-17T00:00:00Z' }
          : path === '/api/preferences' ? { autoTranslate: false, targetLanguage: 'vi', appLocale: 'vi' }
          : path === '/api/conversation-categories' ? []
          : path.endsWith('/messages') ? []
          : path === '/api/events' ? null : []
        if (path === '/api/events') {
          await route.fulfill({ status: 200, headers: responseHeaders, contentType: 'text/event-stream', body: ': connected\n\n' })
          return
        }
        await route.fulfill({ status: 200, headers: responseHeaders, contentType: 'application/json', body: JSON.stringify(data) })
      })
      const errors = []
      page.on('pageerror', error => errors.push(error.message))
      await page.goto(origin + '/chat')
      const compact = width <= 760
      const rail = page.locator(compact ? '.conversation-avatar-rail' : '.desktop-conversation-rail')
      const row = rail.locator(compact ? '.conversation-avatar-rail-item' : '.desktop-conversation-rail-row button').first()
      await row.waitFor({ state: 'visible', timeout: 12000 })
      assert.equal(await rail.isVisible(), true, 'Current conversation rail must be visible at ' + width)
      const hiddenLegacy = page.locator('.conversation-sidebar.social-chat-list')
      if (compact) assert.equal(await hiddenLegacy.isVisible(), false, 'Legacy list must remain hidden on mobile')
      const bounds = await row.boundingBox()
      assert.ok(bounds && bounds.width > 0 && bounds.x >= -1 && bounds.x + bounds.width <= width + 1, 'Rail row must fit viewport at ' + width)
      const screen = await page.evaluate(() => ({ document: document.documentElement.scrollWidth, viewport: innerWidth }))
      assert.ok(screen.document <= screen.viewport + 1, 'Horizontal scroll at ' + width + ': ' + JSON.stringify(screen))
      await row.click()
      await page.locator('.messenger-layout.has-active').waitFor({ timeout: 12000 })
      assert.equal(await page.locator('.messenger-layout.has-active').count(), 1, 'Selecting a conversation must preserve chat shell')
      const shell = await page.locator('.app-shell').boundingBox()
      assert.ok(shell && shell.width <= width + 1, 'Chat shell must fit viewport after selection')
      // Navigate through the actual app, then return through browser history.
      if (compact) await page.goto(origin + '/contacts')
      else await page.locator('.app-sidebar').getByRole('button', { name: 'Danh bạ' }).click()
      await page.waitForURL(url => url.pathname.startsWith('/contacts'))
      await page.goBack({ waitUntil: 'domcontentloaded' })
      await page.waitForURL(url => url.pathname === '/chat' || url.pathname.startsWith('/chat/'), { timeout: 8000 })
      // On mobile an active chat intentionally hides the avatar rail. Either
      // the list or the conversation pane must be visible after Back.
      const restored = await page.waitForFunction(compactView => {
        const selectors = compactView
          ? ['.conversation-avatar-rail', '.conversation-panel']
          : ['.desktop-conversation-rail']
        return selectors.some(selector => {
          const element = document.querySelector(selector)
          if (!element) return false
          const style = getComputedStyle(element)
          return style.display !== 'none' && style.visibility !== 'hidden' &&
            element.getBoundingClientRect().width > 0 && element.getBoundingClientRect().height > 0
        })
      }, compact, { timeout: 8000 })
      assert.ok(restored, 'Chat must restore the appropriate responsive panel after navigation')
      assert.deepEqual(errors, [], 'No uncaught browser errors: ' + errors.join('; '))
      console.log('PASS chat rail layout, navigation, and viewport: ' + width + 'px')
    } finally {
      await page.close()
    }
  }
} finally {
  await browser?.close()
  vite.kill()
}
