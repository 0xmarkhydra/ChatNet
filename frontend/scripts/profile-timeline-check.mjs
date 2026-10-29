import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { createServer } from 'node:net'
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

process.chdir(fileURLToPath(new URL('..', import.meta.url)))
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

const session = {
  token: 'mock.' + Buffer.from(JSON.stringify({ exp: 4102444800 })).toString('base64url') + '.signed',
  refreshToken: 'm'.repeat(43), sessionId: 'profile-test',
  user: { id: 1, username: 'tester', displayName: 'Người dùng kiểm thử với tên tiếng Việt dài', email: 'test@example.invalid' },
}
let posts = Array.from({ length: 17 }, (_, i) => ({
  id: 17 - i, author: 'tester', content: 'Khoảnh khắc ' + (17 - i),
  visibility: i % 2 ? 'private' : 'friends', likes: 0, liked: false, comments: [],
  createdAt: new Date().toISOString(),
}))
let failList = false
let failCreate = false
let privacy = { searchableByUsername: true, searchableByName: true, searchableByEmail: false, allowFriendRequests: true, showOnlineStatus: true }
let privacyWrites = 0
const errors = []
const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'Authorization, Content-Type', 'access-control-allow-methods': 'GET, POST, PATCH, DELETE, OPTIONS' }
try {
  for (let i = 0; i < 60; i++) {
    if (server.exitCode !== null) throw new Error('Vite exited: ' + logs)
    try { if (serverStarted && (await fetch(origin)).ok) break } catch {}
    await delay(200)
  }
  try {
    browser = await chromium.launch({ headless: true })
  } catch (error) {
    if (!String(error).includes("Executable doesn't exist")) throw error
    browser = await chromium.launch({ headless: true, channel: 'chrome' })
  }
  for (const width of [390, 768, 1024, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 844 }, reducedMotion: 'reduce', serviceWorkers: 'block' })
    await context.addInitScript(value => localStorage.setItem('chatnet-session', JSON.stringify(value)), session)
    const page = await context.newPage()
    page.on('pageerror', error => errors.push(error.message))
    await context.route('http://localhost:8080/**', route => {
      const req = route.request()
      const u = new URL(req.url())
      const json = (data, status = 200) => route.fulfill({ status, headers: cors, contentType: 'application/json', body: JSON.stringify(data) })
      if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors })
      if (u.pathname === '/api/events') return route.fulfill({ headers: cors, contentType: 'text/event-stream', body: ': connected\n\n' })
      if (u.pathname === '/api/profile') return json({ ...session.user, avatarSet: false, coverSet: false, updatedAt: new Date().toISOString() })
      if (u.pathname === '/api/preferences' || u.pathname === '/api/preferences/translation') return json({ appLocale: 'vi', autoTranslate: false, targetLanguage: 'vi' })
      if (u.pathname === '/api/privacy') {
        if (req.method() === 'PUT') {
          privacy = req.postDataJSON()
          privacyWrites += 1
        }
        return json(privacy)
      }
      if (u.pathname === '/api/push/config') return json({ configured: false })
      if (u.pathname === '/api/posts' && req.method() === 'POST') {
        if (failCreate) return json({ error: 'Không đăng được bài viết' }, 500)
        const post = { ...posts[0], ...req.postDataJSON(), id: 100, comments: [], likes: 0 }
        posts = [post, ...posts.filter(item => item.id !== post.id)]
        return json(post, 201)
      }
      if (u.pathname === '/api/posts') {
        if (u.searchParams.get('scope') !== 'mine') return json([])
        if (failList) return json({ error: 'offline' }, 503)
        const before = Number(u.searchParams.get('before') || 0)
        return json(posts.filter(item => !before || item.id < before).slice(0, Number(u.searchParams.get('limit') || 15)))
      }
      if (u.pathname.endsWith('/like')) {
        const post = posts.find(item => item.id === Number(u.pathname.split('/')[3]))
        post.liked = !post.liked
        post.likes = post.liked ? 1 : 0
        return json(post)
      }
      return json([])
    })
    await page.goto(origin)
    await page.getByRole('navigation', { name: 'Điều hướng chính' }).getByRole('button', { name: 'Cá nhân' }).click()
    await page.getByRole('button', { name: 'Mở trang cá nhân' }).click()
    await page.getByRole('heading', { name: 'Trang cá nhân', exact: true }).waitFor()
    const timeline = page.getByRole('region', { name: 'Dòng thời gian cá nhân' })
    await timeline.locator('.post').nth(14).waitFor()
    check(await timeline.locator('.post').count() === 15, 'First page must have 15 own posts')
    await timeline.getByRole('button', { name: 'Xem bài viết cũ hơn' }).click()
    await timeline.getByText('Khoảnh khắc 1', { exact: true }).waitFor()
    check(await timeline.locator('.post').count() === 17, 'Older own posts missing or duplicated')
    await timeline.locator('.post').first().getByRole('button', { name: 'Thích', exact: true }).click()
    await page.waitForFunction(() => document.querySelector('.personal-timeline-content .post .liked'))
    check(await timeline.getByRole('textbox', { name: 'Nội dung bài viết' }).count() === 0, 'Composer must open in a popup')
    await timeline.getByRole('button', { name: 'Đăng bài', exact: true }).click()
    const popup = page.getByRole('dialog', { name: 'Tạo bài viết', exact: true })
    await popup.waitFor()
    check(await popup.getByRole('button', { name: 'Đăng', exact: true }).isDisabled(), 'Empty post can be submitted')
    const draft = popup.getByRole('textbox', { name: 'Nội dung bài viết' })
    await draft.fill('Bản nháp được giữ khi đăng lỗi')
    await page.keyboard.press('Escape')
    await popup.waitFor({ state: 'hidden' })
    await timeline.getByRole('button', { name: 'Tiếp tục bản nháp của bạn...' }).click()
    check(await draft.inputValue() === 'Bản nháp được giữ khi đăng lỗi', 'Closing popup lost draft')
    await page.screenshot({ path: 'output/playwright/layout/profile-popup-' + width + '.png' })
    failCreate = true
    await popup.getByRole('button', { name: 'Đăng', exact: true }).click()
    await popup.getByRole('alert').waitFor()
    check(await draft.inputValue() === 'Bản nháp được giữ khi đăng lỗi', 'Failed create lost draft')
    failCreate = false
    await popup.getByLabel('Ai có thể xem?').selectOption('private')
    await popup.getByRole('button', { name: 'Đăng', exact: true }).click()
    await timeline.locator('.post').filter({ hasText: 'Bản nháp được giữ khi đăng lỗi' }).waitFor()
    check(posts[0].visibility === 'private', 'Visibility not sent to server')
    await popup.waitFor({ state: 'hidden' })
    await timeline.getByRole('button', { name: 'Đăng bài', exact: true }).click()
    check(await draft.inputValue() === '', 'Successful create did not clear draft')
    await popup.getByRole('button', { name: 'Đóng tạo bài viết' }).click()
    await page.getByRole('button', { name: 'Chỉnh sửa', exact: true }).click()
    const drawer = page.getByRole('dialog', { name: 'Chỉnh sửa hồ sơ' })
    await drawer.waitFor()
    await drawer.getByRole('region', { name: 'Quyền trường thông tin' }).waitFor()
    const searchable = drawer.getByRole('switch', { name: 'Cho phép tìm bằng tên', exact: true })
    const wasChecked = await searchable.getAttribute('aria-checked')
    const writesBefore = privacyWrites
    await searchable.click()
    await page.waitForFunction(expected => document.querySelector('.profile-field-permissions [aria-label="Cho phép tìm bằng tên"]')?.getAttribute('aria-checked') === expected, String(wasChecked !== 'true'))
    check(privacyWrites === writesBefore + 1, 'Privacy was not saved through the API')
    check(await searchable.getAttribute('aria-checked') !== wasChecked, 'Privacy toggle did not update')
    const bounds = await drawer.boundingBox()
    check(Math.abs(bounds.x + bounds.width - width) <= 1, 'Editor must attach to right edge')
    await page.screenshot({ path: 'output/playwright/layout/profile-editor-' + width + '.png' })
    await page.keyboard.press('Escape')
    await drawer.waitFor({ state: 'hidden' })
    check(await page.getByRole('heading', { name: 'Trang cá nhân', exact: true }).isVisible(), 'Editor navigated away from timeline')
    // Check reload recovery without replacing the existing timeline with fake empty state.
    failList = true
    await timeline.getByRole('button', { name: 'Tải lại dòng thời gian' }).click()
    await timeline.getByRole('alert').waitFor()
    failList = false
    await timeline.getByRole('button', { name: 'Thử lại' }).click()
    await timeline.getByRole('alert').waitFor({ state: 'detached' })
    check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Horizontal overflow at ' + width)
    await page.screenshot({ path: 'output/playwright/layout/personal-timeline-' + width + '.png', fullPage: true })
    await page.getByRole('button', { name: 'Quay lại hồ sơ' }).click()
    await page.locator('.profile-edit-card').waitFor()
    await context.close()
    posts = posts.filter(post => post.id !== 100).map(post => ({ ...post, liked: false, likes: 0 }))
  }
  check(errors.length === 0, errors.join('\n'))
  console.log('PASS: profile timeline, pagination, publishing, privacy input, failed drafts, likes, recovery and responsive widths')
} finally {
  await browser?.close()
  server.kill()
}