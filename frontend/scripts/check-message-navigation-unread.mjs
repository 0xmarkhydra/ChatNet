import assert from 'node:assert/strict'
import { createServer as createNetServer } from 'node:net'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import { createServer } from 'vite'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
process.chdir(root)
const port = await new Promise((res, rej) => {
  const probe = createNetServer()
  probe.once('error', rej)
  probe.listen(0, '127.0.0.1', () => {
    const p = probe.address().port
    probe.close(() => res(p))
  })
})
const vite = await createServer({
  root, configFile: resolve(root, 'vite.config.ts'), logLevel: 'error',
  server: { host: '127.0.0.1', port, strictPort: true },
})
const origin = 'http://127.0.0.1:' + port
const user = { id: 7001, username: 'qa_shell', displayName: 'Nguyễn Việt Anh Kiểm Thử Giao Diện Với Tên Rất Dài', email: 'qa-shell@example.invalid' }
const session = {
  token: 'mock.' + Buffer.from(JSON.stringify({ exp: 4102444800 })).toString('base64url') + '.signed',
  refreshToken: 's'.repeat(43), sessionId: 'qa-shell-synthetic', user,
}
const viewports = [{ width: 390, height: 844 }, { width: 1440, height: 900 }]
let browser
try {
  await vite.listen()
  const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
  try { browser = await chromium.launch({ headless: true, executablePath }) }
  catch (error) {
    if (!String(error).includes('Executable doesn\'t exist')) throw error
    browser = await chromium.launch({ channel: 'chrome', headless: true })
  }
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block', deviceScaleFactor: 1 })
  await context.addInitScript(value => localStorage.setItem('chatnet-session', JSON.stringify(value)), session)
  let unread = 0
  const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' }
  await context.route(url => url.pathname.startsWith('/api/'), async route => {
    const req = route.request()
    const url = new URL(req.url())
    const path = url.pathname
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors })
    if (path === '/api/events') return route.fulfill({ status: 200, headers: cors, contentType: 'text/event-stream', body: ': ready\n\n' })
    const conversation = (id, unreadCount) => ({
      id, type: 'direct', name: id === 7002 ? 'An Nhiên' : 'Hội thoại kiểm thử ' + id,
      otherUserId: id + 5000, otherUsername: 'qa_peer_' + id,
      unreadCount, memberCount: 2, lastMessage: 'Tin nhắn kiểm thử chưa đọc.',
      online: false, createdAt: '2026-11-06T00:00:00Z', lastMessageAt: '2026-11-06T00:00:00Z',
    })
    const olderPages = () => url.searchParams.has('type') ? []
      : Number(url.searchParams.get('offset')) > 0 ? [conversation(8000, unread)]
      : Array.from({ length: Number(url.searchParams.get('limit') ?? 30) },
        (_, idx) => conversation(7002 + idx, 0))
    const value = path === '/api/profile' ? { ...user, avatarSet: false, coverSet: false, updatedAt: '2026-11-06' }
      : path === '/api/conversations/unread' ? { unreadCount: unread }
      : path === '/api/conversations' ? olderPages()
      : ['/api/friends', '/api/friends/requests', '/api/contacts', '/api/posts', '/api/stories', '/api/calls/current', '/api/calls/history', '/api/conversation-categories', '/api/users/suggestions'].includes(path) ? []
      : {}
    await route.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify(value) })
  })
  const page = await context.newPage()
  page.setDefaultTimeout(75000)
  const pageErrors = []
  page.on('pageerror', error => pageErrors.push(error.message))
  // Every case has zero unread on page one. The account summary is independent of pagination.
  for (const viewport of viewports) {
    await page.setViewportSize(viewport)
    const scope = page.locator(viewport.width > 760 ? '.app-sidebar' : '.bottom-navigation')
    for (const [count, expected] of [[7, '7'], [0, null], [1, '1'], [99, '99'], [100, '99+']]) {
      unread = count
      await Promise.all([
        page.waitForResponse(response => new URL(response.url()).pathname === '/api/conversations/unread'
          && response.request().method() === 'GET' && response.ok()),
        page.goto(origin + '/feed', { waitUntil: 'domcontentloaded' }),
      ])
      await page.waitForFunction(prefix => document.title.startsWith(prefix), expected ? '(' + expected + ') SocCO' : 'SocCO')
      const chat = scope.getByRole('button', { name: /^Tin nhắn/ })
      await chat.waitFor()
      const badge = chat.locator('b')
      const shown = await badge.isVisible() ? await badge.innerText() : null
      assert.equal(shown, expected, viewport.width + 'px / account unread ' + count)
      if (count === 7) {
        await chat.click()
        await page.waitForURL('**/chat')
        await chat.and(page.locator('[aria-current=page]')).waitFor()
      }
    }
    console.log('PASS navigation unread summary and chat action at ' + viewport.width + 'x' + viewport.height)
  }
  assert.deepEqual(pageErrors, [], 'unexpected browser errors')
} finally {
  await browser?.close()
  await vite.close()
}
