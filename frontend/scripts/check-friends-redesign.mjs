import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { mkdir } from 'node:fs/promises'
import { createServer as createNetServer } from 'node:net'
import { chromium } from 'playwright'
import { createServer } from 'vite'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const port = await new Promise((resolvePort, reject) => {
  const probe = createNetServer()
  probe.once('error', reject)
  probe.listen(0, '127.0.0.1', () => {
    const available = probe.address().port
    probe.close(() => resolvePort(available))
  })
})
const vite = await createServer({
  root, configFile: resolve(root, 'vite.config.ts'), logLevel: 'error',
  server: { host: '127.0.0.1', port, strictPort: true },
})
let browser
try {
  await vite.listen()
  const { countNotificationItems, formatNotificationBadge } = await vite.ssrLoadModule('/src/app/notification-count.ts')
  assert.equal(countNotificationItems([], []), 0)
  assert.equal(countNotificationItems([{ direction: 'outgoing' }], [{ unreadCount: 0 }]), 0)
  assert.equal(countNotificationItems([{ direction: 'incoming' }], [{ unreadCount: 7 }]), 2)
  assert.equal(countNotificationItems(Array.from({ length: 99 }, () => ({ direction: 'incoming' })), []), 99)
  assert.equal(formatNotificationBadge(99), '99')
  assert.equal(formatNotificationBadge(100), '99+')
  assert.equal(formatNotificationBadge(251), '99+')
  console.log('PASS badge count: 0, incoming + unread conversation, 99, 99+')
  const origin = 'http://127.0.0.1:' + vite.httpServer.address().port
  browser = await chromium.launch({ channel: 'chrome', headless: true })
  const context = await browser.newContext({ viewport: { width: 1478, height: 927 }, serviceWorkers: 'block' })
  const session = {
    token: 'mock.' + Buffer.from(JSON.stringify({ exp: 4102444800 })).toString('base64url') + '.signed',
    refreshToken: 'r'.repeat(43), sessionId: 'friends-redesign-test',
    user: { id: 1, username: 'tester', displayName: 'Tester', email: 'tester@example.invalid' },
  }
  await context.addInitScript(value => localStorage.setItem('chatnet-session', JSON.stringify(value)), session)
  const friends = [
    { id: 2, username: 'linhanh', displayName: 'Linh Anh', online: true, status: 'accepted', updatedAt: '2026-11-06', mutualGroups: 15 },
    { id: 3, username: 'david', displayName: 'David Chen', online: false, status: 'accepted', updatedAt: '2026-11-06' },
    { id: 4, username: 'maihuong', displayName: 'Mai Hương', online: true, status: 'accepted', updatedAt: '2026-11-06' },
  ]
  const pending = [
    { id: 5, username: 'ngochan', displayName: 'Ngọc Hân', online: true, status: 'pending', direction: 'incoming', updatedAt: '2026-11-06' },
    { id: 6, username: 'phuonglinh', displayName: 'Phương Linh', online: false, status: 'pending', direction: 'outgoing', updatedAt: '2026-11-06' },
  ]
  const targetUser = { id: 7, username: 'newfriend', displayName: 'Bạn mới', online: true }
  const requests = []
  const json = data => ({ status: 200, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' }, contentType: 'application/json', body: JSON.stringify(data) })
  await context.route('**/api/**', async route => {
    const req = route.request()
    const path = new URL(req.url()).pathname
    const method = req.method()
    requests.push(method + ' ' + path)
    if (method === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } })
    if (path === '/api/events') return route.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*' }, contentType: 'text/event-stream', body: ': ready\n\n' })
    if (path === '/api/friends/5/accept' && method === 'POST') {
      const friend = pending.find(item => item.id === 5)
      pending.splice(pending.indexOf(friend), 1)
      const accepted = { ...friend, status: 'accepted', direction: undefined }
      friends.push(accepted)
      return route.fulfill(json(accepted))
    }
    if (path === '/api/friends/6' && method === 'DELETE') {
      pending.splice(pending.findIndex(item => item.id === 6), 1)
      return route.fulfill(json({}))
    }
    if (path === '/api/friends/7' && method === 'POST') {
      const sent = { ...targetUser, status: 'pending', direction: 'outgoing', updatedAt: '2026-11-06' }
      pending.push(sent)
      return route.fulfill(json(sent))
    }
    if (path === '/api/conversations/direct' && method === 'POST') {
      return route.fulfill(json({ id: 25, type: 'direct', name: 'Linh Anh', otherUserId: 2, otherUsername: 'linhanh', memberCount: 2, unreadCount: 0, lastMessage: '', online: true, createdAt: '2026-11-06T00:00:00Z' }))
    }
    const response = (
      path === '/api/friends' ? friends :
      path === '/api/friends/requests' ? pending :
      path === '/api/contacts' ? [] :
      path === '/api/users/suggestions' || path === '/api/users/search' ? [targetUser] :
      path === '/api/conversations' || path === '/api/conversation-categories' || path === '/api/posts' ||
      path === '/api/stories' || path === '/api/calls/current' ? [] :
      path === '/api/profile' ? { username: 'tester', displayName: 'Tester', avatarSet: false, coverSet: false, updatedAt: '2026-11-06' } :
      {}
    )
    await route.fulfill(json(response))
  })
  const page = await context.newPage()
  const jsErrors = []
  page.on('pageerror', e => jsErrors.push(e.message))
  await page.goto(origin, { waitUntil: 'domcontentloaded' })
  await page.locator('.app-sidebar').getByRole('button', { name: 'Bạn bè' }).click()
  await page.getByRole('heading', { name: 'Tất cả bạn bè' }).waitFor()
  assert.equal(await page.locator('.notification-appbar .appbar-badge-count').innerText(), '1')
  const border = await page.locator('.fd-searchbar').evaluate(element => getComputedStyle(element).borderTopColor)
  assert.notEqual(border, 'rgb(19, 205, 178)', 'Directory search should not have the green border')
  assert.equal(await page.locator('.app-page-heading strong').innerText(), 'Danh bạ')
  assert.equal(await page.locator('.fd-person-row').count(), friends.length)
  assert.match(await page.locator('.fd-profile-core').innerText(), /David Chen/)
  await page.locator('.fd-person-identity').filter({ hasText: 'Linh Anh' }).click()
  assert.match(await page.locator('.fd-profile-core').innerText(), /Linh Anh/)
  await page.getByRole('button', { name: 'Đang online' }).click()
  assert.equal(await page.locator('.fd-person-row').count(), 2)
  await page.getByRole('button', { name: 'A – Z' }).click()
  console.log('PASS Danh bạ: chọn bạn bè, hồ sơ bên phải và bộ lọc')
  const dir = resolve(root, 'output', 'friends-redesign')
  await mkdir(dir, { recursive: true })
  await page.screenshot({ path: resolve(dir, 'directory-1478.png'), fullPage: true })
  await page.getByRole('button', { name: 'Mở trang Thông báo' }).click()
  await page.getByRole('heading', { name: 'Thông báo mới' }).waitFor()
  assert.equal(await page.locator('.app-page-heading strong').innerText(), 'Thông báo')
  assert.equal(await page.locator('.notification-appbar .appbar-badge-count').innerText(), '1')
  assert.match(await page.locator('.np-notification-list').innerText(), /Ngọc Hân/)
  assert.match(await page.locator('.np-detail-person').innerText(), /Ngọc Hân/)
  await page.getByRole('tab', { name: 'Nhắc đến' }).click()
  assert.match(await page.locator('.np-empty').innerText(), /Chưa có thông báo nhắc đến/)
  await page.getByRole('tab', { name: 'Tất cả' }).click()
  await page.getByRole('searchbox', { name: 'Tìm thông báo...' }).fill('Ngọc')
  assert.match(await page.locator('.np-notification-list').innerText(), /Ngọc Hân/)
  await page.getByRole('searchbox', { name: 'Tìm thông báo...' }).fill('')
  await page.screenshot({ path: resolve(dir, 'notifications-1478.png'), fullPage: true })
  await page.getByRole('tab', { name: 'Chưa đọc' }).click()
  assert.equal(await page.locator('.np-notification-row').count(), 1)
  await page.locator('.np-notification-row').first().click()
  await page.getByText('Không có thông báo chưa đọc').waitFor()
  await page.getByRole('tab', { name: 'Tất cả' }).click()
  for (const width of [390, 768, 1024, 1478]) {
    await page.setViewportSize({ width, height: 850 })
    const size = await page.evaluate(() => ({ viewport: innerWidth, pageWidth: document.documentElement.scrollWidth }))
    assert.ok(size.pageWidth <= size.viewport + 3, 'Notification overflow at ' + width + 'px')
  }
  await page.getByRole('button', { name: 'Xem lời mời kết bạn' }).click()
  assert.equal(await page.locator('.app-page-heading strong').innerText(), 'Lời mời kết bạn')
  await page.getByRole('button', { name: 'Quay lại Danh bạ' }).click()
  console.log('PASS bell opens Notifications page; filters, real requests and navigation')
  await page.getByRole('button', { name: 'Kết bạn mới' }).click()
  assert.equal(await page.locator('.app-page-heading strong').innerText(), 'Lời mời kết bạn')
  for (const name of ['Lời mời đến', 'Đã gửi', 'Quét QR']) {
    assert.equal(await page.getByRole('tab', { name }).count(), 1)
  }
  await page.getByRole('button', { name: 'Chấp nhận', exact: true }).click()
  await page.waitForFunction(() => !document.querySelector('.fd-request-copy')?.textContent?.includes('Ngọc Hân'))
  assert.ok(requests.includes('POST /api/friends/5/accept'))
  await page.locator('.notification-appbar .appbar-badge-count').waitFor({ state: 'hidden' })
  await page.getByRole('tab', { name: 'Đã gửi' }).click()
  await Promise.all([
    page.waitForResponse(resp => resp.url().includes('/api/friends/6') && resp.request().method() === 'DELETE'),
    page.getByRole('button', { name: 'Hủy lời mời' }).click(),
  ])
  assert.ok(requests.includes('DELETE /api/friends/6'))
  await page.getByRole('tab', { name: 'Quét QR' }).click()
  await page.locator('.fd-qr-preview img').waitFor({ state: 'visible' })
  assert.match(await page.locator('.fd-qr-preview img').getAttribute('src'), /^data:image\/png;base64,/)
  await page.getByRole('button', { name: 'Quét QR', exact: true }).last().click()
  await page.getByRole('dialog', { name: 'Kết nối bằng QR' }).waitFor({ state: 'visible' })
  await page.getByRole('button', { name: 'Đóng QR' }).click()
  console.log('PASS Lời mời: 3 tab, chấp nhận, hủy đã gửi, QR thực tế và scanner')
  await page.screenshot({ path: resolve(dir, 'invitations-1478.png'), fullPage: true })
  await page.getByRole('button', { name: 'Quay lại Danh bạ' }).click()
  await page.getByRole('searchbox', { name: 'Tìm trong danh bạ' }).fill('newfriend')
  await Promise.all([
    page.waitForResponse(resp => resp.url().includes('/api/friends/7') && resp.request().method() === 'POST'),
    page.getByRole('button', { name: 'Kết bạn', exact: true }).click(),
  ])
  assert.ok(requests.includes('POST /api/friends/7'))
  console.log('PASS Tìm kiếm và gửi yêu cầu kết bạn theo API')
  await page.getByRole('searchbox', { name: 'Tìm trong danh bạ' }).fill('')
  for (const width of [390, 768, 1024, 1478]) {
    await page.setViewportSize({ width, height: 850 })
    await page.locator('.fd-directory-layout').waitFor()
    const actual = await page.evaluate(() => ({ viewport: innerWidth, pageWidth: document.documentElement.scrollWidth }))
    assert.ok(actual.pageWidth <= actual.viewport + 3, 'Overflow at ' + width + 'px: ' + JSON.stringify(actual))
    if (width > 760) {
      const sidebar = page.locator('.app-sidebar')
      await page.mouse.move(width - 4, 200)
      await page.waitForFunction(() => document.querySelector('.app-sidebar')?.getBoundingClientRect().width === 76)
      await sidebar.getByRole('button', { name: 'Bạn bè' }).hover()
      await page.waitForFunction(() => document.querySelector('.app-sidebar')?.getBoundingClientRect().width === 250)
      const expanded = await sidebar.boundingBox()
      for (const selector of ['.app-sidebar-nav', '.app-sidebar-link.is-active', '.app-sidebar-account']) {
        const box = await page.locator(selector).first().boundingBox()
        assert.ok(box.x + box.width <= expanded.x + expanded.width + 1,
          'Sidebar child protrudes at ' + width + 'px: ' + selector)
      }
      await sidebar.getByRole('button', { name: 'Bạn bè' }).click()
      await page.mouse.move(width - 4, 200)
      await page.waitForFunction(() => document.querySelector('.app-sidebar')?.getBoundingClientRect().width === 76)
      console.log('PASS sidebar Friends hover-expand and mouseleave-collapse at ' + width + 'px')
    }
    if (width === 390) await page.screenshot({ path: resolve(dir, 'directory-mobile-390.png'), fullPage: true })
    console.log('PASS responsive ' + width + 'px')
  }
  await page.setViewportSize({ width: 1478, height: 850 })
  await page.getByRole('button', { name: 'Mở trang Thông báo' }).click()
  assert.equal(await page.locator('.app-page-heading strong').innerText(), 'Thông báo')
  assert.equal(await page.locator('.app-sidebar').getByRole('button', { name: 'Bảng tin' }).getAttribute('aria-current'), 'page')
  await page.locator('.app-sidebar').getByRole('button', { name: 'Bảng tin' }).click()
  assert.equal(await page.locator('.app-page-heading strong').innerText(), 'Bảng tin')
  await page.locator('.app-sidebar').getByRole('button', { name: 'Bạn bè' }).click()
  await page.getByRole('heading', { name: 'Tất cả bạn bè' }).waitFor()
  console.log('PASS bell navigates to Notification screen and sidebar returns to feed')
  await page.evaluate(() => window.addEventListener('chatnet:start-call', event => {
    document.body.dataset.friendCall = event.detail.conversationId + ':' + event.detail.mediaType
  }, { once: true }))
  await page.locator('.fd-profile-actions').getByRole('button', { name: 'Gọi thoại' }).click()
  await page.waitForFunction(() => document.body.dataset.friendCall === '25:audio')
  assert.ok(requests.includes('POST /api/conversations/direct'))
  console.log('PASS Gọi thoại: mở cuộc trò chuyện và chuyển tới CallManager')
  assert.deepEqual(jsErrors, [])
  console.log('PASS Friends design and API integration')
  await context.close()
} finally {
  await browser?.close()
  await vite.close()
}
