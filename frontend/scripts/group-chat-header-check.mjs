import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createServer } from 'node:net'
import { fileURLToPath } from 'node:url'
import { setTimeout as delay } from 'node:timers/promises'
import { chromium } from 'playwright'

const cwd = fileURLToPath(new URL('../', import.meta.url))
const port = await new Promise((resolve, reject) => {
  const server = createServer()
  server.once('error', reject)
  server.listen(0, '127.0.0.1', () => {
    const { port } = server.address()
    server.close(() => resolve(port))
  })
})
const origin = `http://127.0.0.1:${port}`
const vite = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(port), '--strictPort'],
  { cwd, stdio: 'ignore' })
const now = new Date().toISOString()
const group = { id: 46, type: 'group', name: 'Báo lỗi SocCo', memberCount: 5,
  avatarMembers: ['viewer', 'linhanh', 'nam'], lastMessage: 'Giao diện chat', createdAt: now, lastMessageAt: now }
const description = 'Mô tả kênh rất dài để kiểm tra nội dung không tràn ra khỏi tiêu đề. '.repeat(10).trim()
const channels = [
  { id: 0, conversationId: 46, name: 'Thảo luận chung', description: 'Thông tin chung', unreadCount: 0 },
  { id: 7, conversationId: 46, name: 'Hỏi đáp', description, unreadCount: 0 },
]
let browser
try {
  let ready = false
  for (let attempt = 0; attempt < 80 && !ready; attempt++) {
    try { ready = (await fetch(origin)).ok } catch { await delay(150) }
  }
  assert.ok(ready, 'Vite did not start')
  browser = await chromium.launch({ headless: true })
  for (const width of [390, 900, 1064, 1366]) {
    const mobile = width <= 760
    const context = await browser.newContext({ viewport: { width, height: 900 }, serviceWorkers: 'block' })
    await context.addInitScript(() => {
      localStorage.setItem('chatnet-session', JSON.stringify({
        token: 'mock.' + btoa(JSON.stringify({ exp: 4102444800 })) + '.signed',
        refreshToken: 'r'.repeat(43), sessionId: 'group-chat-header-check',
        user: { id: 1, username: 'viewer', displayName: 'Người xem', email: 'viewer@example.invalid' },
      }))
      window.EventSource = class { addEventListener() {} close() {} }
    })
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.route(url => url.pathname.startsWith('/api/'), async route => {
      const path = new URL(route.request().url()).pathname
      const json = data => route.fulfill({ json: data })
      if (path === '/api/conversations') return json([group])
      if (path === '/api/conversations/memberships') return json({ ids: [group.id], nextAfter: null })
      if (path === '/api/conversations/46/channels') return json(channels)
      if (path === '/api/conversations/unread') return json({ unreadCount: 0 })
      if (path === '/api/preferences' || path === '/api/preferences/translation')
        return json({ targetLanguage: 'vi', autoTranslate: false, appLocale: 'vi' })
      if (path === '/api/push/config') return json({ configured: false })
      return json([])
    })
    await page.goto(origin + '/chat')
    const entry = mobile ? '.conversation-avatar-rail-item' : '.desktop-conversation-rail-entry'
    const groupEntry = page.locator(`${entry}[title="${group.name}"]`)
    if (mobile) await groupEntry.click({ timeout: 10000 })
    else await groupEntry.press('Enter', { timeout: 10000 })
    const picker = page.locator('.group-channel-sidebar')
    const header = page.locator('.group-chat-panel > .chat-head')
    let panelWidth
    for (const general of [true, false]) {
      if (mobile && !general) await header.getByRole('button', { name: 'Quay lại danh sách kênh' }).click()
      await picker.getByRole('button', { name: general ? /Mở kênh Thảo luận chung/ : /Mở kênh Hỏi đáp/ }).click()
      const label = header.locator(general ? '.group-room-member-count > span' : '.group-channel-parent-label')
      await label.waitFor({ state: 'visible', timeout: 6000 })
      assert.equal((await label.textContent()).trim(), general ? '5 thành viên' : description)
      const layout = await label.evaluate((element, mobile) => {
        const header = element.closest('.chat-head')
        const toolbar = header.querySelector(mobile ? '.group-mobile-actions' : '.translate-controls')
        const title = header.querySelector('.group-room-title > strong')
        return {
          labelRight: element.getBoundingClientRect().right,
          toolbarLeft: toolbar.getBoundingClientRect().left,
          headerRight: header.getBoundingClientRect().right,
          headerWidth: header.getBoundingClientRect().width,
          titleFits: title.scrollWidth <= title.clientWidth + 1,
          textOverflows: element.scrollWidth > element.clientWidth,
          ellipsis: getComputedStyle(element).textOverflow,
          actions: [...toolbar.querySelectorAll('button')].map(button => {
            const { left, right, height, y } = button.getBoundingClientRect()
            return { left, right, height, y }
          }),
        }
      }, mobile)
      panelWidth = Math.round(layout.headerWidth)
      assert.equal(layout.actions.length, 5)
      assert.ok(layout.labelRight <= layout.toolbarLeft - 1 &&
        layout.actions.every((action, index, actions) => action.right <= layout.headerRight &&
          action.height > 0 && action.height === actions[0].height && Math.abs(action.y - actions[0].y) < 1 &&
          (!index || actions[index - 1].right <= action.left)),
        `${width}px ${general ? 'group' : 'channel'} text and actions must not overlap: ${JSON.stringify(layout)}`)
      if (!mobile) assert.ok(layout.titleFits, `${width}px short title must fit`)
      if (!general) assert.ok(layout.textOverflows && layout.ellipsis === 'ellipsis', `${width}px long channel description must use ellipsis`)
    }
    assert.deepEqual(errors, [])
    await context.close()
    console.log(`PASS ${width}px viewport (${panelWidth}px panel): group and channel header`)
  }
} finally {
  if (browser) await browser.close()
  vite.kill()
}
