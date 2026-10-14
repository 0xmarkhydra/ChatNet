import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { createServer } from 'node:net'
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'

// Reserve a fresh port for each run. Reusing 5173 could silently test a stale Vite process.
const port = await new Promise((resolvePort, reject) => {
  const probe = createServer()
  probe.once('error', reject)
  probe.listen(0, '127.0.0.1', () => {
    const value = probe.address().port
    probe.close(() => resolvePort(value))
  })
})
const origin = 'http://127.0.0.1:' + port
mkdirSync('output/playwright/layout', { recursive: true })
const server = spawn(process.execPath, [resolve('node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { stdio: ['ignore', 'pipe', 'pipe'] })
let logs = ''
let serverStarted = false
server.stdout.on('data', chunk => { logs += chunk.toString(); if (logs.includes('ready in') && logs.includes('http://127.0.0.1')) serverStarted = true })
server.stderr.on('data', chunk => { logs += chunk.toString() })
let browser
const check = (value, message) => { if (!value) throw new Error(message) }
const conversations = [
  { id: 1, name: 'minhanh', type: 'direct', otherUserId: 2, memberCount: 2, unreadCount: 2, lastMessage: 'Chiều nay mình xem lại bản thiết kế nhé.', online: true, createdAt: '2026-10-02T07:00:00Z', lastMessageAt: '2026-10-02T07:00:00Z' },
  { id: 2, name: 'hoangnam', type: 'direct', otherUserId: 3, memberCount: 2, unreadCount: 0, lastMessage: 'Cảm ơn bạn, mình nhận được rồi.', online: false, createdAt: '2026-10-02T07:00:00Z', lastMessageAt: '2026-10-02T07:00:00Z' },
  { id: 3, name: 'Nhóm SOCO kiểm thử giao diện mobile và desktop với tên rất dài', type: 'group', memberCount: 5, unreadCount: 0, lastMessage: 'Hẹn cả nhóm ngày mai.', online: false, createdAt: '2026-10-02T07:00:00Z', lastMessageAt: '2026-10-02T07:00:00Z' },
]
const friends = [{ id: 2, username: 'minhanh', displayName: 'Minh Anh', status: 'accepted', online: true, updatedAt: '2026-10-02T07:00:00Z' }]
const session = {
  token: 'mock.' + Buffer.from(JSON.stringify({ exp: 4102444800 })).toString('base64url') + '.signed',
  refreshToken: 'm'.repeat(43),
  sessionId: 'ui-layout-test',
  user: { id: 1, username: 'soco_user', displayName: 'SOCO Test User', email: 'test@example.com' },
}
const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'Authorization, Content-Type', 'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS' }
try {
  let ready = false
  for (let i = 0; i < 60; i++) {
    if (server.exitCode !== null) throw new Error('Vite exited: ' + logs)
    if (serverStarted) {
      try { if ((await fetch(origin)).ok) { ready = true; break } } catch { /* retry */ }
    }
    await delay(200)
  }
  check(ready, 'Vite startup failed: ' + logs)
  browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(value => localStorage.setItem('chatnet-session', JSON.stringify(value)), session)
  const errors = []
  page.on('pageerror', e => errors.push(e.message))
  await page.route('http://localhost:8080/**', route => {
    const req = route.request()
    const path = new URL(req.url()).pathname
    const json = (data, status = 200) => route.fulfill({ status, headers: cors, contentType: 'application/json', body: JSON.stringify(data) })
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors })
    if (path === '/api/events') return route.fulfill({ status: 200, contentType: 'text/event-stream', headers: cors, body: ': connected\n\n' })
    if (path === '/api/conversations') return json(conversations)
    if (path.endsWith('/messages')) return json([
      { id: 10, conversationId: 1, senderId: 2, sender: 'minhanh', text: 'Đã nhận tài liệu, chiều nay mình gọi nhé.', createdAt: '2026-10-02T07:00:00Z' },
      { id: 11, conversationId: 1, senderId: 1, sender: 'soco_user', text: 'Được, cảm ơn bạn!', createdAt: '2026-10-02T07:01:00Z' },
    ])
    if (path === '/api/friends') return json(friends)
    if (path === '/api/friends/requests') return json([])
    if (path === '/api/users/suggestions' || path === '/api/users/search') return json(friends)
    if (path === '/api/profile') return json({ username: session.user.username, displayName: session.user.displayName, avatarSet: false, coverSet: false, updatedAt: '2026-10-02T07:00:00Z' })
    if (path === '/api/preferences' || path === '/api/preferences/translation') return json({ autoTranslate: true, targetLanguage: 'en', appLocale: 'auto' })
    if (path === '/api/translate') {
      const text = req.postDataJSON()?.text || ''
      return json({ translatedText: text, translation: text, sourceLanguage: 'vi', targetLanguage: 'en' })
    }
    if (path === '/api/posts') return json([{ id: 1, author: 'minhanh', content: 'Bài viết kiểm thử giao diện SOCO trên thiết bị nhỏ và desktop.', likes: 8, liked: false, comments: [], createdAt: '2026-10-02T07:00:00Z' }])
    if (path === '/api/stories' || path === '/api/calls') return json([])
    if (path === '/api/users/nearby') return json({ users: [], expiresAt: new Date().toISOString() })
    if (path === '/api/i18n/bundle') return json({ locale: 'vi', version: 'mock', messages: {}, cache: 'hit' })
    if (/\/api\/users\/[^/]+\/(avatar|cover)$/.test(path)) return route.fulfill({ status: 404, headers: cors })
    return json({})
  })
  await page.goto(origin)
  await page.locator('.conversation-item').first().waitFor({ timeout: 12000 })
  const widths = [320, 375, 390, 430, 768, 1024, 1440]
  let checks = 0
  const geometry = async (label, width, selectors) => {
    const outer = await page.evaluate(() => ({ document: document.documentElement.scrollWidth, viewport: innerWidth }))
    check(outer.document <= outer.viewport + 1, label + ' ' + width + 'px document overflow: ' + JSON.stringify(outer))
    for (const selector of selectors) {
      const element = page.locator(selector).first()
      await element.waitFor({ timeout: 12000 })
      const shape = await element.evaluate(node => {
        const rect = node.getBoundingClientRect()
        return { x: rect.x, right: rect.right, width: rect.width, scroll: node.scrollWidth, client: node.clientWidth }
      })
      check(shape.width > 0 && shape.x >= -2 && shape.right <= width + 2, label + ' ' + width + 'px offscreen ' + selector + ': ' + JSON.stringify(shape))
      if (shape.scroll > shape.client + (selector === '.feed-view' ? 8 : 2)) {
        const offenders = await element.evaluate(root => {
          const max = root.getBoundingClientRect().right
          return [...root.querySelectorAll('*')].filter(node => node.getBoundingClientRect().right > max + 2)
            .slice(0, 8).map(node => ({
              name: node.tagName.toLowerCase(),
              class: typeof node.className === 'string' ? node.className : '',
              right: Math.round(node.getBoundingClientRect().right),
              scroll: node.scrollWidth, client: node.clientWidth,
            }))
        })
        throw new Error(label + ' ' + width + 'px overflow ' + selector + ': ' + JSON.stringify({ shape, offenders }))
      }
    }
    if ([390, 1440].includes(width)) await page.screenshot({ path: 'output/playwright/layout/' + label + '-' + width + '.png' })
    checks++
  }
  for (const width of widths) {
    await page.setViewportSize({ width, height: width <= 375 ? 667 : width <= 430 ? 844 : 900 })
    await page.getByRole('button', { name: /Tin nhắn/ }).last().click()
    await geometry('chat-list', width, ['.modern-frame', '.conversation-sidebar', '.soco-chat-list-heading', '.conversation-list'])
    await page.getByRole('button', { name: 'Danh bạ', exact: true }).click()
    await geometry('contacts', width, ['.modern-frame', '.contacts-view', '.contact-shortcuts', '.soco-section-heading'])
    await page.getByRole('button', { name: 'Bảng tin', exact: true }).click()
    await geometry('feed', width, ['.modern-frame', '.feed-view', '.post-box', '.soco-section-heading'])
    await page.getByRole('button', { name: /Cá nhân/ }).click()
    await geometry('profile', width, ['.modern-frame', '.profile-view', '.profile-hero', '.soco-section-heading'])
    const cover = await page.locator('.profile-cover-art').boundingBox()
    const name = await page.locator('.profile-identity-copy > strong').boundingBox()
    check(cover && name && name.y >= cover.y + cover.height - 3, 'Profile ' + width + 'px identity overlaps cover: ' + JSON.stringify({ cover, name }))
    if (width >= 900) {
      const heading = await page.locator('.profile-view > .soco-section-heading').boundingBox()
      const hero = await page.locator('.profile-view > .profile-hero').boundingBox()
      const edit = await page.locator('.profile-view > .profile-edit-card').boundingBox()
      const settings = await page.locator('.profile-view > .settings-card').boundingBox()
      check(heading && hero && edit && settings, 'Profile blocks absent at ' + width)
      check(hero.y >= heading.y + heading.height - 1, 'Profile hero overlaps title at ' + width)
      check(edit.y >= hero.y + hero.height - 1, 'Profile edit overlaps hero at ' + width)
      check(settings.y >= edit.y + edit.height - 1, 'Profile settings overlap edit at ' + width)
    }
    await page.getByRole('button', { name: 'Quanh đây', exact: true }).click()
    await geometry('discover', width, ['.modern-frame'])
    await page.getByRole('button', { name: /Tin nhắn/ }).last().click()
    await page.locator('.conversation-item').first().click()
    await geometry('chat-room', width, ['.modern-frame', '.conversation-panel', '.chat-head'])
    if (width <= 760) await page.getByRole('button', { name: 'Quay lại danh sách' }).click()
  }
  // Regression: connection sheet stays a fixed 50% of the viewport while results change.
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('button', { name: 'Quay lại danh sách' }).click()
  await page.locator('.soco-chat-list-heading .soco-text-action').click()
  const connect = page.locator('.connect-modal')
  await connect.waitFor()
  const beforeSearch = await connect.boundingBox()
  const search = connect.locator('input').first()
  await search.fill('minhanh')
  await page.waitForTimeout(350)
  const afterSearch = await connect.boundingBox()
  check(beforeSearch && afterSearch, 'Connect modal not rendered')
  check(Math.abs(beforeSearch.height - afterSearch.height) < 2, 'Connect modal height changes while searching')
  check(Math.abs(beforeSearch.height - 422) <= 7, 'Connect modal is not half of viewport height')
  check(afterSearch.x >= 0 && afterSearch.x + afterSearch.width <= 392, 'Connect modal clips horizontally')
  await page.screenshot({ path: 'output/playwright/layout/connect-390.png' })
  await connect.getByRole('button', { name: 'Đóng tìm và kết nối' }).click()
  // Regression: language sheet search never changes the sheet's height.
  await page.getByRole('button', { name: /Cá nhân/ }).click()
  await page.getByRole('button', { name: /Ngôn ngữ ứng dụng/ }).click()
  const locale = page.locator('.locale-picker-sheet')
  await locale.waitFor()
  const beforeLocaleSearch = await locale.boundingBox()
  await locale.locator('input[type="search"]').fill('Nhật')
  const afterLocaleSearch = await locale.boundingBox()
  check(beforeLocaleSearch && afterLocaleSearch &&
    Math.abs(beforeLocaleSearch.height - afterLocaleSearch.height) < 2,
    'Language sheet changes height after searching')
  // White-on-white modal labels were a real release regression; validate color contrast.
  const modalColors = await locale.evaluate(element => {
    const rgb = node => getComputedStyle(node).color
    return {
      bg: getComputedStyle(element).backgroundColor,
      title: rgb(element.querySelector('header strong')),
      input: rgb(element.querySelector('input[type="search"]')),
      description: rgb(element.querySelector('header small')),
    }
  })
  const luminance = value => {
    const channels = value.match(/[\d.]+/g).slice(0, 3).map(Number).map(n => {
      const c = n / 255
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
    })
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722
  }
  const contrast = (a, b) => {
    const x = luminance(a); const y = luminance(b)
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
  }
  check(contrast(modalColors.bg, modalColors.title) >= 4.5, 'Language modal title contrast regression')
  check(contrast(modalColors.bg, modalColors.input) >= 4.5, 'Language modal search contrast regression')
  check(contrast(modalColors.bg, modalColors.description) >= 4.5, 'Language modal subtitle contrast regression')
  await page.screenshot({ path: 'output/playwright/layout/language-390.png' })
  check(errors.length === 0, 'Uncaught JS errors: ' + errors.join('; '))
  console.log('PASS: SOCO layout, overflow, profile stacking: ' + checks + ' viewport/screen checks')
} catch (error) {
  console.error(error)
  process.exitCode = 1
} finally {
  if (browser) await browser.close()
  server.kill('SIGTERM')
}
