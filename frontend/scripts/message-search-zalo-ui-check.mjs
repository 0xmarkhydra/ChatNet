import { chromium } from 'playwright'
import assert from 'node:assert/strict'

const origin = 'http://127.0.0.1:5195'
let browser
for (const channel of [undefined, 'chrome', 'msedge']) {
  try {
    browser = await chromium.launch({ headless: true, ...(channel ? { channel } : {}) })
    break
  } catch (cause) {
    if (!String(cause).includes("doesn't exist") && !String(cause).includes('not found')) throw cause
  }
}
if (!browser) {
  console.log('BLOCKED: No browser available')
  process.exit(2)
}
const session = {
  token: 'mock.' + Buffer.from(JSON.stringify({ exp: 4102444800 })).toString('base64url') + '.signed',
  refreshToken: 'r'.repeat(43),
  sessionId: 'search-zalo-ui',
  user: { id: 1, email: 'test@example.invalid', username: 'viewer', displayName: 'Người xem' },
}
const now = new Date().toISOString()
const chat = { id: 101, type: 'direct', name: 'Linh Anh', otherUserId: 2, otherUsername: 'linhanh', memberCount: 2, lastMessage: 'Gửi file', lastMessageAt: now, unreadCount: 0, online: true, createdAt: now }
const messages = Array.from({ length: 6 }, (_, i) => ({
  id: i + 1, conversationId: 101, senderId: 2, sender: 'linhanh',
  senderDisplayName: 'Linh Anh', text: 'Đây là file ghi chú số ' + i,
  createdAt: now, attachments: [], readByUserIds: [],
}))
const fileMessage = {
  id: 20, conversationId: 101, senderId: 2, sender: 'linhanh',
  senderDisplayName: 'Linh Anh', text: '', createdAt: now,
  attachments: [{ kind: 'file', name: "Compact Teacher's book_1.pdf", storageRef: 'file-1', sizeBytes: 15613296, contentType: 'application/pdf' }],
}
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'block' })
try {
  await page.addInitScript((value) => {
    localStorage.setItem('chatnet-session', JSON.stringify(value))
    class Events extends EventTarget { constructor() { super(); setTimeout(() => this.onopen?.(), 50) } close() {} }
    window.EventSource = Events
  }, session)
  await page.route(url => url.pathname.startsWith('/api/'), async (route) => {
    const req = route.request()
    const url = new URL(req.url())
    const path = url.pathname
    const json = (data) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) })
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204 })
    if (path === '/api/conversations') return json([chat])
    if (path === '/api/conversations/memberships') return json({ ids: [101], nextAfter: null })
    if (path === '/api/conversations/101/members') return json([
      { id: 1, username: 'viewer', displayName: 'Người xem', role: 'member', online: true },
      { id: 2, username: 'linhanh', displayName: 'Linh Anh', role: 'member', online: true },
    ])
    if (path === '/api/conversations/101/messages') return json(url.searchParams.has('search') ? messages : messages)
    if (path === '/api/conversations/101/shared') return json({ items: [fileMessage] })
    if (path === '/api/conversation-categories') return json([])
    if (path === '/api/friends') return json([{ id: 2, username: 'linhanh', displayName: 'Linh Anh', online: true, status: 'accepted', updatedAt: now }])
    if (path === '/api/preferences/translation') return json({ targetLanguage: 'en', autoTranslate: false })
    if (path === '/api/preferences') return json({ appLocale: 'vi' })
    if (path === '/api/push/config') return json({ configured: false })
    return json([])
  })
  await page.goto(origin)
  await page.locator('.zalo-conversation-list .conversation-item').first().click()
  await page.getByRole('button', { name: 'Tìm tin nhắn trong cuộc trò chuyện' }).last().click()
  const panel = page.getByRole('dialog', { name: 'Tìm kiếm trong trò chuyện' })
  await panel.waitFor({ state: 'visible' })
  await panel.getByRole('textbox', { name: 'Từ khóa tin nhắn' }).fill('book')
  await panel.getByText("Compact Teacher's book_1.pdf").first().waitFor({ state: 'visible' })
  assert.equal(await panel.locator('.message-search-file').count(), 1, 'File section should show filename match')
  assert.equal(await panel.locator('.message-search-result').count(), 4, 'First batch should show four messages')
  await panel.locator('.message-search-section').first().getByRole('button', { name: 'Xem thêm' }).click()
  assert.equal(await panel.locator('.message-search-result').count(), 7, 'More must reveal message and file matches')
  await panel.getByRole('button', { name: /Người gửi/ }).click()
  await panel.locator('.message-search-popover > button').filter({ hasText: 'Linh Anh' }).click()
  assert.equal(await panel.locator('.message-search-popover').count(), 0, 'Sender dropdown should close after selection')
  await panel.getByRole('button', { name: 'Ngày gửi', exact: true }).click()
  assert.equal(await panel.locator('input[type=date]').count(), 2, 'Date filter should show a range')
  await panel.locator('input[type=date]').first().fill('2020-01-01')
  await panel.getByRole('button', { name: 'Xong' }).click()
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 })
    const geometry = await panel.evaluate((element) => {
      const filters = element.querySelector('.message-search-filters')
      const controls = element.querySelector('.message-search-panel-controls')
      const chips = [...element.querySelectorAll('.message-search-filter-anchor')]
      return {
        filtersOverflow: filters.scrollWidth - filters.clientWidth,
        controlsOverflow: controls.scrollWidth - controls.clientWidth,
        clearsInside: chips.every((chip) => {
          const parent = chip.getBoundingClientRect()
          const clear = chip.querySelector('.message-search-filter-remove')?.getBoundingClientRect()
          return clear && clear.left >= parent.left - 1 && clear.right <= parent.right + 1
            && clear.top >= parent.top - 1 && clear.bottom <= parent.bottom + 1
        }),
      }
    })
    assert.ok(geometry.filtersOverflow <= 1, 'Filter row overflows at ' + width + 'px')
    assert.ok(geometry.controlsOverflow <= 1, 'Filter controls overflow at ' + width + 'px')
    assert.ok(geometry.clearsInside, 'Clear buttons must remain inside chips at ' + width + 'px')
  }
  await panel.getByRole('button', { name: 'Xóa lọc ngày gửi' }).click()
  assert.equal(await panel.getByRole('textbox', { name: 'Từ khóa tin nhắn' }).inputValue(), 'book', 'Removing date must preserve the keyword')
  assert.equal(await panel.getByRole('button', { name: 'Xóa lọc người gửi' }).count(), 1, 'Removing date must preserve sender')
  await panel.getByRole('button', { name: 'Xóa lọc người gửi' }).click()
  assert.equal(await panel.getByRole('button', { name: 'Xóa lọc người gửi' }).count(), 0, 'Sender clear should remove only sender')
  assert.equal(await panel.getByRole('textbox', { name: 'Từ khóa tin nhắn' }).inputValue(), 'book', 'Removing sender must preserve the keyword')
  await panel.getByRole('button', { name: 'Xóa từ khóa tìm kiếm' }).click()
  assert.equal(await panel.getByRole('textbox', { name: 'Từ khóa tin nhắn' }).inputValue(), '', 'Input clear must clear the keyword')
  assert.equal(await panel.locator('.message-search-result').count(), 0, 'All cleared filters should hide search results')
  await panel.getByRole('button', { name: 'Đóng tìm kiếm' }).click()
  assert.equal(await panel.count(), 0, 'Panel should close')
  console.log('PASS: Zalo-like search panel, attachment matches, sender/date dropdowns, pagination, clear, close')
} finally {
  await browser.close()
}
