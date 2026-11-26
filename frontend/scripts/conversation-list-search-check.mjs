import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createServer } from 'node:net'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { chromium } from 'playwright'

process.chdir(fileURLToPath(new URL('..', import.meta.url)))
const port = await new Promise(done => {
  const server = createServer()
  server.listen(0, '127.0.0.1', () => {
    const port = server.address().port
    server.close(() => done(port))
  })
})
const origin = 'http://127.0.0.1:' + port
const vite = spawn(process.execPath,
  [resolve('node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', String(port), '--strictPort'],
  { stdio: 'ignore' })
let browser
try {
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch(origin)).ok) break } catch {}
    await delay(100)
  }
  for (const channel of [undefined, 'msedge', 'chrome']) {
    try { browser = await chromium.launch({ headless: true, ...(channel ? { channel } : {}) }); break }
    catch (e) { if (!String(e).includes("doesn't exist") && !String(e).includes('not found')) throw e }
  }
  if (!browser) {
    console.log('BLOCKED: no Playwright Chromium, Edge or Chrome installed')
    process.exitCode = 2
  } else {
    const context = await browser.newContext({ viewport: { width: 1200, height: 800 }, serviceWorkers: 'block' })
    const session = {
      token: 'mock.' + Buffer.from(JSON.stringify({ exp: 4102444800 })).toString('base64url') + '.signed',
      refreshToken: 'r'.repeat(43), sessionId: 'conversation-search-fixture',
      user: { id: 1, email: 'viewer@example.invalid', username: 'viewer', displayName: 'Người xem' },
    }
    await context.addInitScript(session => {
      localStorage.setItem('chatnet-session', JSON.stringify(session))
      class Events extends EventTarget { constructor() { super(); setTimeout(() => this.onopen?.(), 100) } close() {} }
      window.EventSource = Events
    }, session)
    const page = await context.newPage(), errors = [], searches = []
    page.on('pageerror', error => errors.push(error.message))
    const conversations = [
      ...Array.from({ length: 28 }, (_, i) => ({
        id: i + 100, type: 'group', name: 'Bản tin ' + i, memberCount: 3,
        unreadCount: i === 27 ? 2 : 0, lastMessage: 'Không liên quan',
        lastMessageAt: '2026-11-06T09:00:00Z', createdAt: '2026-01-01T00:00:00Z',
      })),
      { id: 129, type: 'group', name: 'Hội thoại lưu trữ', history: 'Báo lỗi phiên bản cũ',
        memberCount: 3, unreadCount: 0, lastMessage: 'Tin mới nhất',
        lastMessageAt: '2026-01-01T09:00:00Z', createdAt: '2025-01-01T00:00:00Z' },
      { id: 130, type: 'direct', name: 'Bản tin riêng', otherUsername: 'friend',
        otherUserId: 2, memberCount: 2, unreadCount: 0, lastMessage: 'Xin chào',
        lastMessageAt: '2025-12-01T00:00:00Z', createdAt: '2025-01-01T00:00:00Z' },
    ]
    const fold = value => String(value || '').toLocaleLowerCase('vi-VN')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd')
    let failOnce = false
    await page.route(url => url.pathname.startsWith('/api/'), async route => {
      const url = new URL(route.request().url()), path = url.pathname
      const json = (body, status = 200) => route.fulfill({
        status, contentType: 'application/json',
        headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' },
        body: JSON.stringify(body),
      })
      if (route.request().method() === 'OPTIONS') return route.fulfill({
        status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' },
      })
      if (path === '/api/conversations') {
        const q = url.searchParams.get('q')
        if (q) searches.push(Object.fromEntries(url.searchParams))
        if (q === 'bao loi' && failOnce) {
          failOnce = false
          return json({ error: 'temporary' }, 503)
        }
        const category = url.searchParams.get('category')
        let items = conversations.filter(item =>
          (!q || [item.name, item.history, item.lastMessage, item.otherUsername]
            .some(value => fold(value).includes(fold(q)))) &&
          (url.searchParams.get('type') !== 'group' || item.type === 'group') &&
          (url.searchParams.get('unread') !== 'true' || item.unreadCount > 0) &&
          (category === null || (category === '0' ? !item.categoryId : item.categoryId === Number(category))))
        const offset = Number(url.searchParams.get('offset') || 0)
        return json(items.slice(offset, offset + Number(url.searchParams.get('limit') || 25)))
      }
      if (path === '/api/conversations/memberships') return json({ ids: conversations.map(item => item.id), nextAfter: null })
      if (path === '/api/conversation-categories') return json([])
      if (path === '/api/preferences' || path === '/api/preferences/translation') return json({ appLocale: 'vi', autoTranslate: false, targetLanguage: 'vi' })
      if (path === '/api/push/config') return json({ configured: false })
      return json([])
    })
    await page.goto(origin)
    // The visible chat list is the rail; the legacy .conversation-list stays mounted but hidden.
    const rows = page.locator('.desktop-conversation-rail-row:visible, .conversation-avatar-rail-item:visible')
    const rail = page.locator('.desktop-conversation-rail:visible, .conversation-avatar-rail:visible')
    const searchInput = page.getByRole('searchbox', { name: 'Tìm trong danh sách hội thoại' }).filter({ visible: true })
    const failures = []
    const shows = locator => locator.first().waitFor({ timeout: 4000 }).then(() => true, () => false)
    const waitRows = async (expected, what) => {
      for (let i = 0; i < 100; i++) { if (await rows.count() === expected) return; await delay(100) }
      assert.equal(await rows.count(), expected, what)
    }
    const waitSearches = async expected => {
      for (let i = 0; i < 50 && searches.length < expected; i++) await delay(100)
      await delay(600)
      assert.equal(searches.length, expected, 'Debounce sends one request')
    }
    for (let i = 0; i < 100 && await rows.count() < 25; i++) await delay(100) // may already include the auto-loaded next page
    assert.ok(await rows.count() >= 25, 'First page of the sidebar')
    const initialCount = searches.length
    await searchInput.fill('bao loi')
    await waitSearches(initialCount + 1)
    assert.equal(searches.at(-1).q, 'bao loi', 'Query sent to database endpoint')
    // Recorded rather than thrown, so the remaining steps still run.
    if (!await shows(rows.filter({ has: page.locator('[aria-label*="Hội thoại lưu trữ"]') }).or(page.getByRole('button', { name: /Hội thoại lưu trữ/ }).filter({ visible: true })))) {
      failures.push('a conversation matched only by message history is not listed in the visible rail')
    }
    await searchInput.fill('')
    await delay(800)
    assert.equal(searches.length, initialCount + 1, 'Clearing search uses cached sidebar')
    await searchInput.fill('ban tin')
    // The rail may fetch the next page by itself when it is near the bottom, so check the requests instead of the first row count.
    for (let i = 0; i < 100 && await rows.count() < 25; i++) await delay(100)
    assert.ok(searches.some(s => s.q === 'ban tin' && s.offset === '0'), 'First page of search results')
    await rows.last().evaluate(row => { let node = row.parentElement; while (node && node.scrollHeight <= node.clientHeight) node = node.parentElement; if (node) node.scrollTop = node.scrollHeight })
    await waitRows(29, 'Second page of search results')
    assert.equal(searches.at(-1).offset, '25', 'Search results paginate independently')
    await rows.last().click()
    await page.waitForURL(/\/chat\/\d+$/)

    const filterButton = name => page.getByRole('button', { name, exact: true }).filter({ visible: true })
    if (await filterButton('Nhóm').count()) {
      await filterButton('Nhóm').click()
      await waitRows(25, 'Group filter')
      assert.equal(searches.at(-1).type, 'group')
      await filterButton('Chưa đọc').click()
      await waitRows(1, 'Unread filter')
      assert.equal(searches.at(-1).unread, 'true', 'Unread filter is applied on server')
      await filterButton('Tất cả').click()
    } else {
      failures.push('the visible rail has no all/unread/groups filter buttons')
    }

    await searchInput.fill('')
    failOnce = true
    await searchInput.fill('bao loi')
    const retry = rail.getByRole('button', { name: /Thử/ })
    if (await shows(retry)) {
      await retry.first().click()
      await retry.first().waitFor({ state: 'detached' })
    } else {
      failures.push('a failed search shows no error or retry in the visible rail')
    }
    assert.deepEqual(errors, [], 'No browser runtime errors')
    await context.close()
    assert.deepEqual(failures, [], 'Known gaps in the current layout')
    console.log('PASS: server search, debounce, cached sidebar, history matches, paging, opening older conversations, filters, error/retry')
  }
} finally {
  await browser?.close()
  vite.kill()
}
