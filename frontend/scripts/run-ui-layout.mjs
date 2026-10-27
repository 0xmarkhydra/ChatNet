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
const pagedConversations = [...conversations, ...Array.from({ length: 27 }, (_, index) => ({
  id: index + 4, name: 'user_' + (index + 4), type: 'direct',
  memberCount: 2, unreadCount: 0, lastMessage: 'Bản tin chào mừng',
  online: false, createdAt: '2026-10-02T07:00:00Z',
  lastMessageAt: new Date(Date.UTC(2026, 9, 2, 6, 59 - index)).toISOString(),
}))]
// Keep the newest 40 messages in the first response and add older messages on demand.
const pagedMessages = Array.from({ length: 45 }, (_, index) => ({
  id: index + 1, conversationId: 1, senderId: 1, sender: 'soco_user',
  text: 'Lịch sử tin nhắn ' + (index + 1),
  createdAt: new Date(Date.UTC(2026, 9, 2, 7, index)).toISOString(),
}))
const pagedPosts = Array.from({ length: 18 }, (_, index) => ({
  id: 18 - index, author: index === 0 ? 'soco_user' : 'minhanh', content: 'Bài viết kiểm thử phân trang số ' + (18 - index),
  likes: 8, liked: false, comments: [], createdAt: '2026-10-02T07:00:00Z',
}))
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
  // Spy on generated sound without using the machine's real speakers. Deliver
  // synthetic SSE updates to the exact registered realtime event handler.
  await page.addInitScript(() => {
    window.__socoTonesPlayed = 0
    window.AudioContext = class MockNotificationAudioContext {
      state = 'suspended'
      currentTime = 0
      destination = {}
      resume() { this.state = 'running'; return Promise.resolve() }
      close() { this.state = 'closed'; return Promise.resolve() }
      createOscillator() {
        return {
          type: 'sine', frequency: { setValueAtTime() {} }, connect() {}, disconnect() {},
          start() { window.__socoTonesPlayed += 1 }, stop() {}, onended: null,
        }
      }
      createGain() {
        return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {}, disconnect() {} }
      }
    }
    const nativeListen = EventSource.prototype.addEventListener
    EventSource.prototype.addEventListener = function (type, listener, options) {
      if (type === 'update') {
        window.__socoEmitRealtime = payload => listener({ data: JSON.stringify(payload) })
      }
      return nativeListen.call(this, type, listener, options)
    }
  })
  const errors = []
  let submittedStory = null
  page.on('pageerror', e => errors.push(e.message))
  await page.route(origin + '/mock-story-upload', route =>
    route.fulfill({ status: 200, body: '' }))
  await page.route('http://localhost:8080/**', route => {
    const req = route.request()
    const currentURL = new URL(req.url())
    const path = currentURL.pathname
    const limit = Number(currentURL.searchParams.get('limit') || 100)
    const before = Number(currentURL.searchParams.get('before') || 0)
    const offset = Number(currentURL.searchParams.get('offset') || 0)
    const json = (data, status = 200) => route.fulfill({ status, headers: cors, contentType: 'application/json', body: JSON.stringify(data) })
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors })
    if (path === '/api/events') return route.fulfill({ status: 200, contentType: 'text/event-stream', headers: cors, body: ': connected\n\n' })
    if (path === '/api/conversations') return json(pagedConversations.slice(offset, offset + limit))
    if (/^\/api\/conversations\/\d+\/members$/.test(path)) return json([
      { id: 1, username: 'soco_user', displayName: 'SOCO Test User', role: 'owner', online: true },
      ...Array.from({ length: 8 }, (_, index) => ({
        id: index + 2, username: 'member_' + (index + 2),
        displayName: 'Thành viên ' + (index + 2), role: index === 0 ? 'admin' : 'member', online: index % 2 === 0,
      })),
    ])
    if (path.endsWith('/messages')) return json(
      pagedMessages.filter(message => !before || message.id < before).slice(-limit),
    )
    if (path === '/api/friends') return json(friends)
    if (path === '/api/friends/requests') return json([])
    if (path === '/api/users/suggestions' || path === '/api/users/search') return json(friends)
    if (path === '/api/profile') return json({ username: session.user.username, displayName: session.user.displayName, avatarSet: false, coverSet: false, updatedAt: '2026-10-02T07:00:00Z' })
    if (path === '/api/preferences' || path === '/api/preferences/translation') return json({ autoTranslate: true, targetLanguage: 'en', appLocale: 'auto' })
    if (path === '/api/translate') {
      const text = req.postDataJSON()?.text || ''
      return json({ translatedText: text, translation: text, sourceLanguage: 'vi', targetLanguage: 'en' })
    }
    if (path === '/api/posts') return json(pagedPosts.filter(post => !before || post.id < before).slice(0, limit))
    if (path === '/api/media/presign' && req.method() === 'POST') return json({
      uploadUrl: origin + '/mock-story-upload',
      storageRef: 'story/1/upload.png', kind: 'image', downloadUrl: origin + '/mock-story-image.png',
    })
    if (path === '/api/stories' && req.method() === 'POST') {
      submittedStory = req.postDataJSON()
      const keys = Object.keys(submittedStory?.attachment || {}).sort()
      const expected = ['contentType', 'kind', 'name', 'sizeBytes', 'storageRef']
      if (JSON.stringify(keys) !== JSON.stringify(expected)) return json({ error: 'invalid body' }, 400)
      return json({
        id: 99, author: session.user.username,
        attachment: { ...submittedStory.attachment, url: origin + '/mock-story-image.png' },
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
      }, 201)
    }
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
    await geometry('chat-list', width, ['.modern-frame', '.conversation-sidebar', '.conversation-list'])
    check(await page.locator('.soco-chat-list-heading').count() === 0, 'Removed Chat banner reappeared: ' + width)
    await page.getByRole('button', { name: 'Danh bạ', exact: true }).click()
    await geometry('contacts', width, ['.modern-frame', '.contacts-view', '.contact-shortcuts'])
    check(await page.locator('.contacts-view > .soco-section-heading').count() === 0, 'Removed Contacts banner reappeared: ' + width)
    await page.getByRole('button', { name: 'Bảng tin', exact: true }).click()
    await geometry('feed', width, ['.modern-frame', '.feed-view', '.post-box', '.soco-feed-section-label'])
    // Only social engagement actions belong in the footer. Manage post from •••.
    const ownPost = page.locator('.feed .zalo-post').filter({ hasText: 'Bài viết kiểm thử phân trang số 18' })
    check(await ownPost.locator('.feed-share-action').isVisible(),
      'Sharing must appear alongside Like and Comment: ' + width)
    check(await page.locator('.feed-owner-shortcuts').count() === 0,
      'Do not put Edit/Delete next to engagement buttons: ' + width)
    if ([320, 390, 1440].includes(width)) {
      await ownPost.getByRole('button', { name: 'Tùy chọn bài viết' }).click()
      const options = page.getByRole('dialog', { name: 'Tùy chọn bài viết' })
      check(await options.isVisible(), 'Post menu must open: ' + width)
      check(await options.getByRole('button', { name: 'Chỉnh sửa bài viết' }).isVisible(),
        'Author Edit must be inside the options menu: ' + width)
      check(await options.getByRole('button', { name: 'Xóa bài viết' }).isVisible(),
        'Author Delete must be inside the options menu: ' + width)
      if (width <= 390) {
        const bounds = await options.boundingBox()
        check(bounds && bounds.x >= -1 && bounds.x + bounds.width <= width + 1 && bounds.y >= 0,
          'Mobile options sheet must fit the viewport: ' + width)
      }
      await options.getByRole('button', { name: 'Chỉnh sửa bài viết' }).click()
      check(await options.locator('.feed-actions-editor').isVisible(),
        'Edit action must open the editor: ' + width)
      await options.getByRole('button', { name: 'Hủy' }).click()
      await options.getByRole('button', { name: 'Xóa bài viết' }).click()
      check(await options.getByText('Bài viết và các bình luận sẽ bị xóa vĩnh viễn.', { exact: false }).isVisible(),
        'Delete action must show confirmation: ' + width)
      await options.getByRole('button', { name: 'Hủy' }).click()
      await options.getByRole('button', { name: 'Đóng', exact: true }).click()
      const otherPost = page.locator('.feed .zalo-post').filter({ hasText: 'Bài viết kiểm thử phân trang số 17' })
      await otherPost.getByRole('button', { name: 'Tùy chọn bài viết' }).click()
      check(await page.getByRole('dialog').getByRole('button', { name: 'Báo cáo bài viết' }).isVisible(),
        'Other posts must show reporting: ' + width)
      check(await page.getByRole('dialog').getByRole('button', { name: 'Chỉnh sửa bài viết' }).count() === 0,
        'Other posts must not allow editing: ' + width)
      await page.keyboard.press('Escape')
      check(await page.getByRole('dialog').count() === 0, 'Escape should dismiss menu: ' + width)
    }
    await page.getByRole('button', { name: /Cá nhân/ }).click()
    await geometry('profile', width, ['.modern-frame', '.profile-view', '.profile-hero'])
    check(await page.locator('.profile-view > .soco-section-heading').count() === 0, 'Removed Profile banner reappeared: ' + width)
    const cover = await page.locator('.profile-cover-art').boundingBox()
    const name = await page.locator('.profile-identity-copy > strong').boundingBox()
    if (width <= 430) {
      const hero = await page.locator('.profile-view > .profile-hero').boundingBox()
      const edit = await page.locator('.profile-view > .profile-edit-card').boundingBox()
      const settings = await page.locator('.profile-view > .settings-card').boundingBox()
      const avatar = await page.locator('.profile-avatar-editor').boundingBox()
      check(hero && edit && settings && avatar &&
        hero.height <= 250 && edit.height <= 350 &&
        edit.y >= hero.y + hero.height - 1 &&
        settings.y >= edit.y + edit.height - 1 &&
        name && name.x >= avatar.x + avatar.width - 2,
        'Profile cards must be compact, ordered and not overlap on iPhone: ' +
        JSON.stringify({ width, hero, edit, settings, avatar, name }))
    }
    check(cover && name && name.y >= cover.y + cover.height - 3, 'Profile ' + width + 'px identity overlaps cover: ' + JSON.stringify({ cover, name }))
    if (width >= 900) {
      const hero = await page.locator('.profile-view > .profile-hero').boundingBox()
      const edit = await page.locator('.profile-view > .profile-edit-card').boundingBox()
      const settings = await page.locator('.profile-view > .settings-card').boundingBox()
      check(hero && edit && settings, 'Profile blocks absent at ' + width)
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
  await page.getByRole('button', { name: 'Tạo mới', exact: true }).click()
  await page.getByRole('menuitem', { name: /Tìm & kết nối/ }).click()
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

  // Motion regression: iOS press feedback, sheet entrance and reduced-motion support.
  const reduceMotionSheet = await locale.evaluate(node => getComputedStyle(node).animationName)
  check(reduceMotionSheet === 'none', 'Reduced-motion language sheet should not animate')
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  const sheetMotion = await locale.evaluate(node => ({
    name: getComputedStyle(node).animationName,
    duration: getComputedStyle(node).animationDuration,
  }))
  check(sheetMotion.name.includes('soco-sheet-in'), 'Language sheet entrance motion missing')
  check(parseFloat(sheetMotion.duration) >= .2, 'Language sheet motion should feel smooth')
  await locale.locator('header button').first().click()
  await page.getByRole('button', { name: 'Bảng tin', exact: true }).click()
  const activeNav = page.locator('.bottom-navigation > button.active').first()
  const tabMotion = await activeNav.locator('.nav-icon').evaluate(node => getComputedStyle(node).animationName)
  check(tabMotion.includes('soco-tab-pop'), 'Active tab spring effect missing')
  await activeNav.scrollIntoViewIfNeeded()
  const rect = await activeNav.boundingBox()
  check(rect !== null, 'Active tab missing for press test')
  await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2)
  await page.mouse.down()
  await page.waitForTimeout(90)
  const pressScale = await activeNav.evaluate(node => {
    const matrix = new DOMMatrixReadOnly(getComputedStyle(node).transform)
    return matrix.a
  })
  await page.mouse.up()
  check(pressScale < .995 && pressScale > .91, 'Touch-down scale feedback missing: ' + pressScale)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const reducedMotion = await activeNav.locator('.nav-icon').evaluate(node => getComputedStyle(node).animationName)
  check(reducedMotion === 'none', 'Reduced-motion must remove tab animation')

  // API-backed pagination: pages append once and older chat does not jump to the bottom.
  check(await page.locator('.feed-view > .soco-section-heading').count() === 0,
    'Feed still contains the removed introduction banner')
  check(await page.locator('.soco-feed-posts-label small').count() === 0,
    'Feed still displays the removed post count')
  const activeNavStyle = await activeNav.evaluate(node => ({
    bg: getComputedStyle(node).backgroundColor,
    indicator: getComputedStyle(node, '::before').content,
  }))
  check(activeNavStyle.bg === 'rgba(0, 0, 0, 0)' && (activeNavStyle.indicator === 'none' || activeNavStyle.indicator === 'normal'),
    'Bulky active navigation highlight was not removed')
  check(await page.locator('.feed .zalo-post:not(.outgoing-preview)').count() === 15, 'Feed first page must have 15 posts')
  await page.getByRole('button', { name: 'Tải thêm bài viết' }).click()
  await page.waitForFunction(() => document.querySelectorAll('.feed .zalo-post:not(.outgoing-preview)').length === 18, null, { timeout: 6000 })
  check(await page.locator('.feed .zalo-post:not(.outgoing-preview)').count() === 18,
    'Feed load more did not append the remaining 3 posts')
  check(await page.getByRole('button', { name: 'Tải thêm bài viết' }).count() === 0,
    'Feed load more should stop at the end of the list')
  await page.getByRole('button', { name: /Tin nhắn/ }).last().click()
  check(await page.locator('.conversation-item').count() === 25, 'Initial conversation page must show 25 items')
  await page.getByRole('button', { name: 'Tải thêm hội thoại' }).click()
  await page.waitForFunction(() => document.querySelectorAll('.conversation-item').length === 30, null, { timeout: 6000 })
  check(await page.locator('.conversation-item').count() === 30, 'Conversation load more did not add the next 5 items')
  await page.locator('.conversation-item').first().click()
  await page.waitForFunction(() => document.querySelectorAll('.message-press-target').length === 40, null, { timeout: 6000 })
  check(await page.locator('.message-press-target').count() === 40, 'Initial message page must show 40 items')
  const selectableMessageText = page.locator('.message-press-target .message-selectable-text').first()
  const selectableMessageResult = await selectableMessageText.evaluate(node => {
    const style = getComputedStyle(node)
    const textNode = Array.from(node.childNodes).find(child => child.nodeType === Node.TEXT_NODE)
    if (!(textNode instanceof Text) || textNode.data.length < 2) {
      return { cursor: style.cursor, userSelect: style.userSelect, selected: '', total: textNode?.textContent?.length || 0 }
    }
    const range = document.createRange()
    range.setStart(textNode, 0)
    range.setEnd(textNode, Math.min(5, textNode.data.length - 1))
    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range)
    const selected = selection?.toString() || ''
    selection?.removeAllRanges()
    return { cursor: style.cursor, userSelect: style.userSelect, selected, total: textNode.data.length }
  })
  check(selectableMessageResult.cursor === 'text' && selectableMessageResult.userSelect === 'text',
    'Message text must show an I-beam cursor and allow text selection: ' + JSON.stringify(selectableMessageResult))
  check(selectableMessageResult.selected.length > 0 && selectableMessageResult.selected.length < selectableMessageResult.total,
    'Message text must allow selecting only part of its content: ' + JSON.stringify(selectableMessageResult))
  const oldList = page.locator('.messages')
  await page.getByRole('button', { name: 'Tải thêm tin nhắn cũ' }).scrollIntoViewIfNeeded()
  const beforePosition = await oldList.evaluate(node => ({ scrollTop: node.scrollTop, height: node.scrollHeight }))
  await page.getByRole('button', { name: 'Tải thêm tin nhắn cũ' }).click()
  await page.waitForFunction(() => document.querySelectorAll('.message-press-target').length === 45, null, { timeout: 6000 })
  check(await page.locator('.message-press-target').count() === 45, 'Older messages were not appended')
  const afterPosition = await oldList.evaluate(node => ({ scrollTop: node.scrollTop, height: node.scrollHeight }))
  check(Math.abs((afterPosition.scrollTop - beforePosition.scrollTop) -
    (afterPosition.height - beforePosition.height)) < 10,
    'Loading older messages must preserve the visible scroll position: ' + JSON.stringify({ beforePosition, afterPosition }))
  check(await page.getByRole('button', { name: 'Tải thêm tin nhắn cũ' }).count() === 0,
    'Message pagination must stop when history is exhausted')

  // Regression: group management is a dedicated iPhone screen, not a 52vh panel
  // squeezing chat messages/composer into the remaining half.
  await page.getByRole('button', { name: 'Quay lại danh sách' }).click()
  for (const width of [320, 375, 390, 430]) {
    await page.setViewportSize({ width, height: width <= 375 ? 667 : width === 390 ? 844 : 932 })
    await page.getByRole('button', { name: /Tin nhắn/ }).last().click()
    await page.locator('.conversation-item').filter({ hasText: 'Nhóm SOCO' }).first().click()
    const headerAction = await page.locator('.chat-head .group-mobile-actions .call-header-actions button').first().boundingBox()
    const backAction = await page.getByRole('button', { name: 'Quay lại danh sách' }).boundingBox()
    const more = page.getByRole('button', { name: 'Tùy chọn nhóm' })
    const moreBox = await more.boundingBox()
    check(headerAction && backAction && moreBox && headerAction.width >= 40 &&
      headerAction.x >= backAction.x + backAction.width &&
      moreBox.x >= headerAction.x + headerAction.width - 1 &&
      moreBox.x + moreBox.width <= width + 1 && Math.abs(headerAction.y - backAction.y) < 8 &&
      Math.abs(moreBox.y - backAction.y) < 8,
      'Mobile group header must stay in one compact row: ' + JSON.stringify({ width, headerAction, backAction, moreBox }))
    check(await page.locator('.group-chat-panel .chat-head > .translate-controls').isVisible() === false,
      'Legacy multi-action row must be hidden on mobile')
    if (width === 320 || width === 390)
      await page.screenshot({ path: 'output/playwright/layout/group-chat-header-' + width + '.png' })

    await more.click()
    const sheet = page.getByRole('dialog', { name: 'Tùy chọn cuộc trò chuyện nhóm' })
    await sheet.waitFor()
    check(await sheet.getByRole('button', { name: 'Gọi video' }).count() === 1 &&
      await sheet.getByRole('button', { name: 'Gọi thoại' }).count() === 1 &&
      await sheet.getByRole('button', { name: /Ảnh, tệp & liên kết/ }).count() === 1,
      'Call/media actions must remain accessible in group sheet: ' + width)
    const sheetRect = await sheet.boundingBox()
    check(sheetRect && sheetRect.x >= -1 && sheetRect.x + sheetRect.width <= width + 1 &&
      sheetRect.y > 0 && sheetRect.y + sheetRect.height <= page.viewportSize().height + 1,
      'Group options sheet must respect phone viewport: ' + JSON.stringify({ width, sheetRect }))
    if (width === 390) {
      await page.screenshot({ path: 'output/playwright/layout/group-options-390.png' })
      await sheet.getByRole('button', { name: 'Ngôn ngữ dịch' }).click()
      const languages = page.getByRole('dialog', { name: 'Chọn ngôn ngữ dịch' })
      await languages.waitFor()
      await languages.getByRole('searchbox').fill('ja')
      check(await languages.locator('.soco-group-actions-language-row').count() >= 1,
        'Language search within group sheet must show supported languages')
      await languages.getByRole('button', { name: 'Quay lại tùy chọn nhóm' }).click()
      await sheet.getByRole('switch', { name: /Dịch tự động/ }).click()
      check(await sheet.getByRole('switch', { name: /Dịch tự động/ }).getAttribute('aria-checked') === 'false',
        'Group translation toggle must reuse existing preference state')
      await sheet.getByRole('switch', { name: /Dịch tự động/ }).click()
      await page.keyboard.press('Escape')
      check(await page.getByRole('dialog', { name: 'Tùy chọn cuộc trò chuyện nhóm' }).count() === 0,
        'Escape must close group sheet')
      await more.click()
    }
    await page.getByRole('dialog', { name: 'Tùy chọn cuộc trò chuyện nhóm' })
      .getByRole('button', { name: /Thành viên & quản lý nhóm/ }).click()
    const group = page.locator('.group-settings-panel')
    await group.waitFor()
    await group.getByText('Bạn là chủ nhóm').waitFor()
    const geometry = await group.evaluate(node => {
      const panel = node.getBoundingClientRect()
      const frame = node.closest('.conversation-panel').getBoundingClientRect()
      const header = node.querySelector('.group-settings-heading').getBoundingClientRect()
      return {
        panelHeight: panel.height, frameHeight: frame.height,
        panelTop: panel.top, frameTop: frame.top,
        scrollHeight: node.scrollHeight, clientHeight: node.clientHeight,
        headerTop: header.top, viewport: innerHeight,
      }
    })
    check(Math.abs(geometry.panelHeight - geometry.frameHeight) < 3 && Math.abs(geometry.panelTop - geometry.frameTop) < 3,
      'Group management must fill the entire chat region: ' + JSON.stringify({ width, geometry }))
    check(geometry.scrollHeight > geometry.clientHeight, 'Long member lists must scroll independently: ' + width)
    check(await page.locator('.conversation-panel > .messages').isVisible() === false,
      'Chat messages must not render behind group management: ' + width)
    check(await page.locator('.conversation-panel > .media-composer').isVisible() === false,
      'Composer must not render behind group management: ' + width)
    await group.evaluate(node => { node.scrollTop = node.scrollHeight })
    await page.waitForTimeout(80)
    const sticky = await group.evaluate(node => {
      const panel = node.getBoundingClientRect()
      const header = node.querySelector('.group-settings-heading').getBoundingClientRect()
      return { top: header.top, panelTop: panel.top }
    })
    check(Math.abs(sticky.top - sticky.panelTop) < 3, 'Group header must remain sticky while scrolling: ' + width)
    await group.evaluate(node => { node.scrollTop = 0 })
    if (width === 390) await page.screenshot({ path: 'output/playwright/layout/group-settings-390.png' })
    await group.getByRole('button', { name: 'Quay lại cuộc trò chuyện' }).click()
    check(await page.locator('.group-settings-panel').count() === 0 && await page.locator('.messages').isVisible(),
      'Closing group management must restore messages: ' + width)
    check(await page.locator('.media-composer').isVisible(), 'Closing group management must restore the composer: ' + width)
    await page.getByRole('button', { name: 'Quay lại danh sách' }).click()
  }

  // Regression: the quick-create menu is attached to the + action, not to the
  // conversation sidebar where it used to hide the heading/list on desktop.
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: width === 320 ? 667 : width === 390 ? 844 : 900 })
    await page.getByRole('button', { name: /Tin nhắn/ }).last().click()
    const create = page.getByRole('button', { name: 'Tạo mới', exact: true })
    await create.click()
    const menu = page.getByRole('menu', { name: 'Tạo cuộc trò chuyện mới' })
    await menu.waitFor()
    check(await menu.getByRole('menuitem').count() === 3, 'Quick-create must show 3 actions')
    const placement = await page.evaluate(() => {
      const menu = document.querySelector('.appbar-create-anchor > .quick-create-menu').getBoundingClientRect()
      const trigger = document.querySelector('.appbar-create-trigger').getBoundingClientRect()
      const list = document.querySelector('.conversation-sidebar').getBoundingClientRect()
      return { menu: { x: menu.x, y: menu.y, right: menu.right, bottom: menu.bottom },
        trigger: { y: trigger.y, bottom: trigger.bottom }, sidebarRight: list.right, viewport: innerWidth }
    })
    check(placement.menu.x >= 0 && placement.menu.right <= width + 1,
      'Quick-create popup horizontal overflow: ' + JSON.stringify({ width, placement }))
    if (width > 760) check(placement.menu.x >= placement.sidebarRight - 3 &&
      placement.menu.y >= placement.trigger.bottom - 2,
      'Desktop quick-create must open under +, clear of the conversation list: ' + JSON.stringify(placement))
    else check(placement.menu.y > placement.trigger.bottom + 70 &&
      placement.menu.bottom <= (width === 320 ? 667 : 844) - 60,
      'Mobile quick-create must be a bottom sheet, not cover the chat-list title: ' + JSON.stringify(placement))
    if (width === 390 || width === 1440)
      await page.screenshot({ path: 'output/playwright/layout/quick-create-' + width + '.png' })
    await page.keyboard.press('Escape')
    check(await page.getByRole('menu', { name: 'Tạo cuộc trò chuyện mới' }).count() === 0,
      'Escape must close the create menu')
    await create.click()
    await page.getByRole('button', { name: 'Đóng menu tạo mới' }).click({ position: { x: 5, y: 5 } })
    check(await page.getByRole('menu', { name: 'Tạo cuộc trò chuyện mới' }).count() === 0,
      'Tapping outside must close create menu')
  }

  // Logout must be one full-width settings row, not a detached right-aligned button.
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: width === 320 ? 667 : width === 390 ? 844 : 900 })
    await page.getByRole('button', { name: /Cá nhân/ }).click()
    const signout = page.locator('.settings-card .settings-logout-row')
    await signout.waitFor()
    check(await page.locator('.profile-actions').count() === 0,
      'Detached account actions footer must be removed')
    const placement = await page.evaluate(() => {
      const button = document.querySelector('.settings-logout-row').getBoundingClientRect()
      const card = document.querySelector('.profile-view .settings-card').getBoundingClientRect()
      return { button: { x: button.x, right: button.right, width: button.width, y: button.y },
        card: { x: card.x, right: card.right, width: card.width } }
    })
    check(Math.abs(placement.button.x - placement.card.x) < 2 &&
      Math.abs(placement.button.right - placement.card.right) < 2 &&
      placement.button.width > 250,
      'Sign-out row must fill settings card: ' + JSON.stringify({ width, placement }))
    await signout.scrollIntoViewIfNeeded()
    if (width === 390 || width === 1440)
      await page.screenshot({ path: 'output/playwright/layout/profile-actions-' + width + '.png' })
  }

  // Regression: frontend must POST only strict AttachmentInput fields.
  // A presigned download URL in POST /api/stories previously triggered "invalid body".
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('button', { name: 'Bảng tin', exact: true }).click()
  await page.locator('input[aria-label="Chọn ảnh hoặc video cho Story"]').setInputFiles({
    name: 'soco-story.png', mimeType: 'image/png',
    buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+bS8EAAAAASUVORK5CYII=', 'base64'),
  })
  await page.waitForFunction(() => document.querySelectorAll('.story-card').length >= 2, null, { timeout: 12000 })
  check(submittedStory?.attachment?.storageRef === 'story/1/upload.png' &&
    !Object.hasOwn(submittedStory.attachment, 'url') &&
    !Object.hasOwn(submittedStory.attachment, 'id'),
    'Story payload must contain only fields accepted by strict backend decoder')

  // Integration: real UI setting + the App's EventSource handler + Web Audio
  // oscillator. No beep for our own messages, duplicates or disabled sound.
  await page.getByRole('button', { name: /Cá nhân/ }).click()
  const soundSwitch = page.locator('.message-sound-row button[role="switch"]')
  await soundSwitch.waitFor()
  check(await soundSwitch.getAttribute('aria-checked') === 'true',
    'Incoming sound must default to enabled, separate from push permissions')
  await page.waitForFunction(() => typeof window.__socoEmitRealtime === 'function')
  const emitMessage = (id, senderId, type = 'message') => page.evaluate(
    ({ id, senderId, type }) => window.__socoEmitRealtime({
      type, conversationId: 1,
      message: { id, senderId, conversationId: 1, text: 'Tin kiểm thử âm báo',
        createdAt: new Date().toISOString() },
    }),
    { id, senderId, type },
  )
  const tones = () => page.evaluate(() => window.__socoTonesPlayed)
  const beforeTone = await tones()
  await emitMessage(92001, 2)
  check(await tones() === beforeTone + 2,
    'Incoming message from another user must emit one two-tone notification')
  await emitMessage(92001, 2)
  await emitMessage(92002, 1)
  await emitMessage(92003, 2, 'message.updated')
  check(await tones() === beforeTone + 2,
    'Duplicate, own message and edit must not play additional sounds')
  await soundSwitch.click()
  check(await soundSwitch.getAttribute('aria-checked') === 'false' &&
    await page.evaluate(() => localStorage.getItem('chatnet-message-sound-enabled-v1')) === 'false',
    'Mute switch must persist locally')
  await emitMessage(92004, 2)
  check(await tones() === beforeTone + 2, 'Disabled sound must suppress incoming message')
  await soundSwitch.click()
  check(await soundSwitch.getAttribute('aria-checked') === 'true',
    'Sound should be re-enabled without affecting push settings')
  await page.getByRole('button', { name: 'Nghe thử' }).click()
  check(await tones() >= beforeTone + 6, 'Manual sound preview must generate sound')
  check(!errors.length, 'Uncaught JS errors: ' + errors.join('; '))
  console.log('PASS: SOCO layout, overflow, profile stacking: ' + checks + ' viewport/screen checks')
} catch (error) {
  console.error(error)
  process.exitCode = 1
} finally {
  if (browser) await browser.close()
  server.kill('SIGTERM')
}
