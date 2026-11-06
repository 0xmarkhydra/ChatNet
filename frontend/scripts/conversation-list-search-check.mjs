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
    await page.route('**/api/**', async route => {
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
    const rows = page.locator('.conversation-list .conversation-item')
    const searchInput = page.getByRole('searchbox', { name: 'Tìm kiếm toàn bộ cuộc trò chuyện' })
    await page.waitForFunction(() => document.querySelectorAll('.conversation-list .conversation-item').length === 25)
    const initialCount = searches.length
    await searchInput.fill('bao loi')
    await page.locator('.conversation-list .conversation-item').filter({ hasText: 'Hội thoại lưu trữ' }).waitFor()
    assert.equal(await rows.count(), 1, 'Old conversation matched by historical message')
    assert.equal(searches.at(-1).q, 'bao loi', 'Query sent to database endpoint')
    assert.equal(searches.length, initialCount + 1, 'Debounce sends one request')
    await rows.first().click()
    await page.locator('.conversation-list .conversation-item.active').waitFor()
    await searchInput.fill('')
    await page.waitForFunction(() => document.querySelectorAll('.conversation-list .conversation-item').length >= 25)
    assert.equal(searches.length, initialCount + 1, 'Clearing search uses cached sidebar')
    await searchInput.fill('ban tin')
    await page.waitForFunction(() => document.querySelectorAll('.conversation-list .conversation-item').length === 25)
    await page.getByRole('button', { name: 'Tải thêm hội thoại' }).click()
    await page.waitForFunction(() => document.querySelectorAll('.conversation-list .conversation-item').length === 29)
    assert.equal(searches.at(-1).offset, '25', 'Search results paginate independently')
    await page.getByRole('button', { name: 'Nhóm', exact: true }).click()
    await page.waitForFunction(() => document.querySelectorAll('.conversation-list .conversation-item').length === 25)
    assert.equal(searches.at(-1).type, 'group')
    await page.getByRole('button', { name: 'Chưa đọc', exact: true }).click()
    await page.locator('.conversation-list .conversation-item').filter({ hasText: 'Bản tin 27' }).waitFor()
    assert.equal(await rows.count(), 1)
    assert.equal(searches.at(-1).unread, 'true', 'Unread filter is applied on server')
    await page.getByRole('button', { name: 'Tất cả', exact: true }).click()
    failOnce = true
    await searchInput.fill('bao loi')
    await page.locator('.conversation-list .conversation-search-status[role="alert"]').waitFor()
    await page.getByRole('button', { name: 'Thử lại' }).click()
    await page.locator('.conversation-list .conversation-item').filter({ hasText: 'Hội thoại lưu trữ' }).waitFor()
    assert.deepEqual(errors, [], 'No browser runtime errors')
    await context.close()
    console.log('PASS: global historical search, debounce, cached sidebar, server filters, paging, opening older conversations, error/retry')
  }
} finally {
  await browser?.close()
  vite.kill()
}
