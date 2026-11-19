import assert from 'node:assert/strict'
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { createServer } from 'node:net'
import { fileURLToPath } from 'node:url'
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
const vite = spawn(process.execPath, [fileURLToPath(new URL('../node_modules/vite/bin/vite.js', import.meta.url)), '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { cwd: fileURLToPath(new URL('..', import.meta.url)), stdio: ['ignore', 'pipe', 'pipe'] })
let serverLogs = ''
vite.stdout.on('data', data => { serverLogs += data })
vite.stderr.on('data', data => { serverLogs += data })
const session = {
  token: 'mock.' + Buffer.from(JSON.stringify({ exp: 4102444800 })).toString('base64url') + '.signed',
  refreshToken: 'm'.repeat(43),
  sessionId: 'socco-84-87-smoke',
  user: { id: 1, username: 'layout_tester', displayName: 'Layout Tester', email: 'layout@example.com' },
}
const conversations = [
  { id: 1, name: 'QA Beta – Màn hình nhỏ với tên cuộc trò chuyện thật dài', type: 'direct', otherUserId: 2, otherUsername: 'minhanh', memberCount: 2, unreadCount: 2, lastMessage: 'Tin nhắn mới', online: true, createdAt: '2026-10-02T07:00:00Z', lastMessageAt: '2026-10-02T07:00:00Z' },
  { id: 2, name: 'hoangnam', type: 'direct', otherUserId: 3, otherUsername: 'hoangnam', memberCount: 2, unreadCount: 0, lastMessage: 'Đã nhận được', online: false, createdAt: '2026-10-01T07:00:00Z', lastMessageAt: '2026-10-01T07:00:00Z' },
]
const responseHeaders = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'Authorization, Content-Type' }

// This runs the real Web/PWA bundle in Chrome with deterministic API fixtures.
// It checks layout and interactions, not live-backend or deployment behavior.
async function withPage(browser, width, height, routePath, check, hasTouch = false) {
  const page = await browser.newPage({ viewport: { width, height }, hasTouch })
  page.setDefaultTimeout(12000)
  try {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.addInitScript(value => localStorage.setItem('chatnet-session', JSON.stringify(value)), session)
    await page.route(url => url.pathname.startsWith('/api/'), async route => {
      const path = new URL(route.request().url()).pathname
      if (path === '/api/events') {
        await route.fulfill({ headers: responseHeaders, contentType: 'text/event-stream', body: ': connected\n\n' })
        return
      }
      const json = path === '/api/conversations' ? conversations
        : path === '/api/profile' ? { username: session.user.username, displayName: session.user.displayName, updatedAt: '2026-11-17T00:00:00Z' }
        : path === '/api/preferences' ? { autoTranslate: false, targetLanguage: 'vi', appLocale: 'vi' }
        : path === '/api/marketplace/cart' ? { items: [] }
        : path === '/api/marketplace/orders' ? { orders: [] }
        : path.startsWith('/api/marketplace/products') ? { products: [] }
        : []
      await route.fulfill({ headers: responseHeaders, contentType: 'application/json', body: JSON.stringify(json) })
    })
    await page.goto(origin + routePath, { waitUntil: 'commit' })
    await check(page)
  } catch (error) {
    const state = await page.evaluate(() => ({
      route: location.pathname,
      notices: document.querySelector('main')?.innerText.slice(0, 360),
      expanded: document.querySelector('.messenger-layout')?.classList.contains('avatar-rail-expanded'),
      heads: document.querySelectorAll('.chat-head').length,
      localeRows: document.querySelectorAll('.app-locale-row').length,
    })).catch(() => null)
    throw new Error(String(error) + '\nRendered state: ' + JSON.stringify(state), { cause: error })
  } finally {
    await page.close()
  }
}

async function assertEntireControlFits(control, container) {
  await container.waitFor({ state: 'visible' })
  await control.waitFor({ state: 'visible' })
  const button = await control.boundingBox()
  const frame = await container.boundingBox()
  assert.ok(button && frame && button.x >= Math.max(0, frame.x) - 1 &&
    button.x + button.width <= Math.min(frame.x + frame.width, control.page().viewportSize().width) + 1,
    'Control clipped before any auto-scroll: ' + JSON.stringify({ button, frame }))
}

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

  const cases = [
    ['84 fallback, code and name search', () => withPage(browser, 390, 844, '/profile', async page => {
      const localeButton = page.locator('.app-locale-row:visible')
      await localeButton.waitFor({ timeout: 25000 })
      await localeButton.click({ timeout: 25000 })
      const dialog = page.getByRole('dialog', { name: 'Ngôn ngữ ứng dụng' })
      const search = dialog.locator('input[type="search"]')
      await search.fill('Avestan')
      const option = dialog.getByRole('button', { name: /Avestan/ })
      await option.waitFor()
      const labels = await option.evaluate(row => ({
        primary: row.querySelector('strong')?.textContent,
        secondary: row.querySelector('small')?.textContent,
        code: row.querySelector('b')?.textContent,
      }))
      assert.match(labels.primary ?? '', /Avestan/i)
      assert.equal(labels.code, 'AE')
      assert.notEqual(labels.secondary?.toLowerCase(), 'ae')
      assert.notEqual(labels.secondary, labels.primary)
    })],
    ...[[320, 568], [390, 844]].map(([width, height]) => [
      '85 saved empty ' + width, () => withPage(browser, width, height, '/feed', async page => {
        const empty = page.locator('.feed-empty')
        await page.getByRole('button', { name: 'Đã lưu', exact: true }).click()
        await empty.getByText('Chưa có bài viết đã lưu', { exact: true }).waitFor()
        assert.match(await empty.innerText(), /menu của bài viết/)
        assert.equal(await empty.getByRole('button', { name: 'Tạo bài viết' }).count(), 0)
        await empty.getByRole('button', { name: 'Quay lại Bảng tin' }).click()
        await empty.getByText('Chưa có bài viết', { exact: true }).waitFor()
      })
    ]),
    ...[[768, 800], [1440, 900]].map(([width, height]) => [
      '86 direct header ' + width, () => withPage(browser, width, height, '/chat', async page => {
        const head = page.locator('.conversation-panel > .chat-head')
        const translate = head.getByRole('button', { name: /Cài đặt dịch AI/ })
        const details = head.getByRole('button', { name: 'Thông tin hội thoại' })
        const layout = page.locator('.messenger-layout')
        const rail = layout.locator('.desktop-conversation-rail')
        await rail.getByRole('button', { name: /QA Beta/ }).first().click()
        await page.waitForURL('**/chat/1')
        await layout.locator('.desktop-conversation-rail.is-expanded').waitFor()
        await assertEntireControlFits(translate, head)
        await assertEntireControlFits(details, head)
        await rail.getByRole('button', { name: 'Menu hội thoại' }).click()
        await rail.getByRole('button', { name: 'Thu gọn cột avatar' }).click()
        await layout.locator('.desktop-conversation-rail.is-expanded').waitFor({ state: 'hidden' })
        await assertEntireControlFits(translate, head)
        await assertEntireControlFits(details, head)
        await head.getByRole('button', { name: 'Tìm tin nhắn trong cuộc trò chuyện' }).focus()
        await page.keyboard.press('Tab')
        assert.equal(await translate.evaluate(el => el === document.activeElement), true)
        await page.keyboard.press('Enter')
        await page.getByRole('dialog', { name: 'Cài đặt dịch AI' }).waitFor()
        await page.getByRole('dialog', { name: 'Cài đặt dịch AI' }).getByRole('button', { name: 'Đóng cài đặt dịch' }).click()
        await details.tap()
        assert.equal(await details.getAttribute('aria-expanded'), 'true')
      }, true)
    ]),
    ...[[320, 568], [390, 844]].map(([width, height]) => [
      '87 sell control ' + width, () => withPage(browser, width, height, '/marketplace', async page => {
        const tabs = page.getByRole('navigation', { name: 'Sàn mua bán' })
        const sell = tabs.getByRole('button', { name: /Bán hàng/ })
        await assertEntireControlFits(sell, tabs)
        assert.equal(await tabs.evaluate(el => el.scrollLeft), 0)
        await sell.tap()
        await page.getByRole('button', { name: 'Tạo bản nháp' }).waitFor()
        await tabs.getByRole('button', { name: /Giỏ/ }).tap()
        await page.getByText('Giỏ hàng đang trống.').waitFor()
        await tabs.getByRole('button', { name: 'Đơn hàng' }).tap()
        await page.getByText('Bạn chưa tạo yêu cầu đơn hàng.').waitFor()
        await tabs.getByRole('button', { name: 'Sản phẩm' }).tap()
        await page.getByText('Chưa có sản phẩm được đăng.').waitFor()
      }, true)
    ]),
  ]
  const requested = process.argv.slice(2)
  for (const [label, check] of cases) {
    if (requested.length && !requested.some(number => label.startsWith(number + ' '))) continue
    try {
      await check()
      console.log('PASS SOCCO-' + label)
    } catch (error) {
      console.error('FAIL SOCCO-' + label + '\n' + error)
      process.exitCode = 1
    }
  }
} finally {
  await browser?.close()
  vite.kill()
}