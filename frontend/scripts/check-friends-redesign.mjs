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
  const testConversations = [{ id: 70, type: 'group', name: 'Nhóm dự án', memberCount: 3, unreadCount: 0, lastMessage: '', online: false, createdAt: '2026-11-06T00:00:00Z' }]
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
    if (path === '/api/conversations/70/members') {
      return route.fulfill(json([{ id: 1, username: 'tester', displayName: 'Tester', role: 'member', online: true }]))
    }
    if (path === '/api/conversations/70/group-settings') {
      return route.fulfill(json({ adminCanInvite: false, adminCanEditInfo: false }))
    }
    if (path === '/api/conversations/direct' && method === 'POST') {
      const conversation = { id: 25, type: 'direct', name: 'Linh Anh', otherUserId: 2, otherUsername: 'linhanh', memberCount: 2, unreadCount: 0, lastMessage: '', online: true, createdAt: '2026-11-06T00:00:00Z' }
      if (!testConversations.some(item => item.id === conversation.id)) testConversations.push(conversation)
      return route.fulfill(json(conversation))
    }
    const response = (
      path === '/api/friends' ? friends :
      path === '/api/friends/requests' ? pending :
      path === '/api/contacts' ? [] :
      path === '/api/users/suggestions' || path === '/api/users/search' ? [targetUser] :
      path === '/api/conversations' ? testConversations :
      path === '/api/conversation-categories' || path === '/api/posts' ||
      path === '/api/stories' || path === '/api/calls/current' || path === '/api/calls/history' ? [] :
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
  assert.equal(await page.locator('.app-page-heading strong').innerText(), 'Bạn bè')
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
  await page.locator('.app-sidebar').getByRole('button', { name: 'Cuộc gọi' }).click()
  const callTabs = page.locator('.call-center-tabs')
  assert.equal(await callTabs.getByRole('button').count(), 2, 'calls must have only History and Directory')
  assert.equal(await callTabs.getByRole('button', { name: 'Liên hệ' }).count(), 0, 'former contacts tab is merged into the directory')
  await callTabs.getByRole('button', { name: 'Danh bạ' }).click()
  await page.locator('.call-center-directory .fd-person-row').first().waitFor()
  assert.equal(await page.locator('.call-center-directory .fd-person-row').count(), friends.length + 1, 'merged directory must include friends and group conversations')
  assert.equal(await page.locator('.call-center-directory .fd-call-extra-section').count(), 1, 'group section should be shown inside directory')
  assert.match(await page.locator('.fd-call-extra-section').innerText(), /Nhóm dự án/)
  assert.equal(await page.locator('.fd-call-extra-section').getByRole('button', { name: 'Gọi thoại' }).count(), 1)
  assert.equal(await page.locator('.fd-call-extra-section').getByRole('button', { name: 'Gọi video' }).count(), 1)
  assert.equal(await page.locator('.call-center-directory .fd-profile-panel').count(), 0, 'call directory must not render a profile details panel')
  assert.equal(await page.locator('.call-center-directory .fd-list-card').count(), 1, 'call directory only renders the contacts list')
  assert.equal(await page.locator('.call-center-directory').getByRole('button', { name: 'Kết bạn mới' }).count(), 0, 'call directory must not expose new friend flow')
  assert.equal(await callTabs.getByRole('button', { name: 'Danh bạ' }).getAttribute('aria-pressed'), 'true')
  assert.equal(await page.locator('.call-center-directory .fd-searchbar').count(), 0, 'call directory must not have a duplicate search bar')
  assert.equal(await page.locator('.call-center-directory-search input').count(), 1, 'call directory uses the same header search as other call tabs')
  const callDirectorySearch = page.locator('.call-center-directory-search input')
  const searchRequestsBefore = requests.filter(item => item === 'GET /api/users/search').length
  await callDirectorySearch.fill('Linh')
  await page.waitForFunction(() => document.querySelectorAll('.call-center-directory .fd-person-row').length === 1)
  assert.match(await page.locator('.call-center-directory .fd-person-row').first().innerText(), /Linh Anh/)
  assert.equal(requests.filter(item => item === 'GET /api/users/search').length, searchRequestsBefore, 'call directory must filter existing friends locally, not search strangers')
  await callDirectorySearch.fill('')
  await page.locator('.call-center-directory .fd-person-row').first().waitFor()
  for (const width of [320, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 850 })
    const bounds = await page.locator('.call-center-header-actions').evaluate((container) => {
      const tabs = container.querySelector('.call-center-tabs').getBoundingClientRect()
      const search = container.querySelector('.call-center-search').getBoundingClientRect()
      const buttons = [...container.querySelectorAll('.call-center-tabs button')].map(element => element.getBoundingClientRect())
      return {
        tabsTop: tabs.top, tabsBottom: tabs.bottom,
        tabsLeft: tabs.left, tabsRight: tabs.right, searchTop: search.top,
        searchWidth: search.width,
        contained: buttons.every(box => box.left >= tabs.left - 1 && box.right <= tabs.right + 1),
        viewport: innerWidth,
      }
    })
    assert.ok(bounds.contained && bounds.tabsLeft >= -1 && bounds.tabsRight <= width + 1,
      'call tabs overflow at ' + width + 'px: ' + JSON.stringify(bounds))
    if (width <= 780) {
      assert.ok(bounds.tabsBottom + 1 <= bounds.searchTop,
        'call tabs must be on their own row above search at ' + width + 'px: ' + JSON.stringify(bounds))
      assert.ok(bounds.searchWidth >= 110, 'call search field too narrow at ' + width + 'px')
    }
    assert.ok(await page.locator('.call-center-directory .fd-person-row').first().isVisible(),
      'directory panel must stay in call workspace at ' + width + 'px')
    console.log('PASS merged 2 call tabs, separate search row and inline directory at ' + width + 'px')
  }
  await page.setViewportSize({ width: 1478, height: 927 })
  assert.equal(await page.locator('.call-center-directory').getByRole('button', { name: 'Kết bạn mới' }).count(), 0, 'new friend action remains unavailable in call directory')
  await callTabs.getByRole('button', { name: 'Lịch sử' }).click()
  await page.getByRole('heading', { name: 'Cuộc gọi gần đây' }).waitFor()
  await callTabs.getByRole('button', { name: 'Danh bạ' }).click()
  const groupRow = page.locator('.call-center-directory .fd-call-conversation-row').filter({ hasText: 'Nhóm dự án' })
  await groupRow.waitFor()
  assert.equal(await groupRow.getByRole('button', { name: 'Gọi thoại' }).count(), 1)
  assert.equal(await groupRow.getByRole('button', { name: 'Gọi video' }).count(), 1)
  const oldBackground = await groupRow.evaluate(el => getComputedStyle(el).backgroundColor)
  await groupRow.hover()
  await page.waitForTimeout(200)
  const newBackground = await groupRow.evaluate(el => getComputedStyle(el).backgroundColor)
  assert.notEqual(oldBackground, newBackground, 'group row should highlight on hover')
  await groupRow.getByRole('button', { name: 'Mở cuộc trò chuyện với Nhóm dự án' }).click()
  await page.locator('.call-center').waitFor({ state: 'detached' })
  // Active group chats can hide the desktop sidebar; reload into the test start view.
  await page.goto(origin, { waitUntil: 'domcontentloaded' })
  await page.locator('.app-sidebar').getByRole('button', { name: 'Cuộc gọi' }).click()
  await page.locator('.call-center-tabs').getByRole('button', { name: 'Danh bạ' }).click()
  const personRow = page.locator('.call-center-directory .fd-person-row').filter({ hasText: 'Linh Anh' }).first()
  await personRow.waitFor()
  assert.equal(await personRow.getByRole('button', { name: 'Gọi thoại cho Linh Anh' }).count(), 1)
  assert.equal(await personRow.getByRole('button', { name: 'Gọi video cho Linh Anh' }).count(), 1)
  const normalBackground = await personRow.evaluate(el => getComputedStyle(el).backgroundColor)
  await personRow.hover()
  await page.waitForTimeout(200)
  const hoverBackground = await personRow.evaluate(el => getComputedStyle(el).backgroundColor)
  assert.notEqual(hoverBackground, normalBackground, 'friend row should highlight on hover')
  await personRow.getByRole('button', { name: /Linh Anh/ }).first().click()
  await page.locator('.call-center').waitFor({ state: 'detached' })
  await page.locator('.app-sidebar').getByRole('button', { name: 'Bạn bè' }).click()
  await page.getByRole('heading', { name: 'Tất cả bạn bè' }).waitFor()
  assert.equal(await page.getByRole('button', { name: 'Kết bạn mới' }).count(), 1, 'sidebar friends must retain its add friend action')
  console.log('PASS Cuộc gọi: two tabs, merged friend/group directory, hover/click to chat, voice/video actions')
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
