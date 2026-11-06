import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { createServer } from 'node:net'
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'

const port = await new Promise((done, reject) => {
  const s = createServer()
  s.once('error', reject)
  s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => done(p)) })
})
const origin = `http://127.0.0.1:${port}`
const frontendRoot = process.cwd().replace(/\\/g, '/').endsWith('/frontend') ? process.cwd() : resolve('frontend')
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1',
  '--port', String(port), '--strictPort'], { cwd: frontendRoot, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, VITE_API_URL: 'http://localhost:8080' } })
let serverLog = ''
server.stdout.on('data', data => { serverLog += data.toString() })
server.stderr.on('data', data => { serverLog += data.toString() })
let browser
const assert = (condition, message) => { if (!condition) throw new Error(message) }
const conversations = [
  { id: 1, name: 'Minh Anh', type: 'direct', otherUserId: 2, otherUsername: 'minhanh', memberCount: 2, unreadCount: 1, lastMessage: 'Xin chào', online: true,
    createdAt: '2026-10-02T07:00:00Z', lastMessageAt: '2026-10-02T07:00:00Z' },
  { id: 3, name: 'Nhóm SocCO', type: 'group', memberCount: 5, unreadCount: 0, lastMessage: 'Đang làm giao diện',
    online: false, createdAt: '2026-10-02T07:00:00Z', lastMessageAt: '2026-10-02T07:00:00Z' },
]
const session = {
  token: 'mock.' + Buffer.from(JSON.stringify({ exp: 4102444800 })).toString('base64url') + '.signed',
  refreshToken: 'm'.repeat(43), sessionId: 'app-layout-smoke',
  user: { id: 1, username: 'soco_user', displayName: 'SocCO Tester', email: 'test@example.com' },
}
const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'Authorization, Content-Type', 'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS' }
let storedProfile = { username: 'soco_user', displayName: 'SocCO Tester', bio: '', city: '', avatarSet: false, coverSet: false, updatedAt: '2026-11-05T09:00:00Z' }
let profileUpdatePayload = null
let storedPrivacy = { searchableByUsername: true, searchableByName: true, searchableByEmail: false, allowFriendRequests: true, showOnlineStatus: true }
const fixturePost = {
  id: 88, author: 'minhanh', authorDisplayName: 'Minh Anh',
  content: 'Câu chuyện đẹp tại Đà Lạt #DuLichVietNam #SocCoMoments',
  likes: 12, liked: false, saved: false, comments: [], visibility: 'public',
  attachments: [{ storageRef: 'test/feed.jpg', name: 'Đà Lạt', sizeBytes: 104093,
    contentType: 'image/jpeg', kind: 'image', url: origin + '/default-profile-cover.jpg' }],
  createdAt: '2026-11-05T06:30:00Z',
}
const feedPosts = [fixturePost]
let lastCommentPayload = null
let commentRequests = 0
const suggestions = [{id: 4, username:'phuonglinh', displayName:'Phương Linh', online:true}]
let followingRequests = 0
let savedRequests = 0
let lastFeedCreated = null
let friendRequestsSent = 0


try {
  let ready = false
  for (let i=0; i<60; i++) {
    if (server.exitCode !== null) throw new Error('Vite exited: ' + serverLog)
    try { if ((await fetch(origin)).ok) { ready = true; break } } catch {}
    await delay(200)
  }
  assert(ready, 'Vite did not start: ' + serverLog)
  browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 1586, height: 992 } })
  const errors = []
  page.on('pageerror', err => errors.push(err.message))
  await page.addInitScript(value => localStorage.setItem('chatnet-session', JSON.stringify(value)), session)
  await page.route('http://localhost:8080/**', route => {
    const req = route.request(), path = new URL(req.url()).pathname
    const json = body => route.fulfill({ status: 200, contentType: 'application/json', headers: cors, body: JSON.stringify(body) })
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors })
    if (path === '/api/events') return route.fulfill({ status: 200, contentType: 'text/event-stream', headers: cors, body: ': connected\n\n' })
    if (path === '/api/feed/moderation/reports') return route.fulfill({ status: 403, contentType: 'application/json', headers: cors, body: JSON.stringify({error: 'forbidden'}) })
    if (path === '/api/conversations') return json(conversations)
    if (path === '/api/conversation-categories') return json([])
    if (path.endsWith('/messages')) return json([])
    if (path.endsWith('/members')) return json([{ id: 1, username: 'soco_user', displayName: 'SocCO Tester', role: 'owner', online: true }])
    if (path.endsWith('/group-settings')) return json({ requireApproval: false, adminCanInvite: true, adminCanApprove: true, adminCanEditInfo: true })
    if (/\/(invites|join-requests|admin-audit)$/.test(path)) return json([])
    if (path === '/api/friends') return json([])
    if (path === '/api/friends/requests') return json([])
    if (path === '/api/users/suggestions') return json(suggestions)
    if (path === '/api/users/search') return json([])
    if (path === '/api/friends/4' && req.method() === 'POST') { friendRequestsSent++; return json({ ...suggestions[0], status:'pending', direction:'outgoing', updatedAt:new Date().toISOString() }) }
    if (path === '/api/posts/88/save' && req.method() === 'POST') { fixturePost.saved = !fixturePost.saved; return json({ ...fixturePost }) }
    if (path === '/api/posts/88/comments' && req.method() === 'POST') {
      lastCommentPayload = req.postDataJSON()
      commentRequests++
      fixturePost.comments = [...fixturePost.comments, {
        id: 500 + commentRequests, author: 'soco_user', authorDisplayName: 'SocCO Tester',
        content: lastCommentPayload.content, parentId: lastCommentPayload.parentId ?? null,
        createdAt: new Date().toISOString(),
      }]
      return json({ ...fixturePost })
    }
    if (path === '/api/posts') {
      const params = new URL(req.url()).searchParams
      if (req.method() === 'POST') {
        lastFeedCreated = req.postDataJSON()
        return json({ id: 101, author: 'soco_user', authorDisplayName: 'SocCO Tester',
          content: lastFeedCreated.content, likes: 0, liked: false, saved: false, comments: [],
          attachments: [], visibility: lastFeedCreated.visibility || 'public',
          createdAt: new Date().toISOString() })
      }
      if (params.get('scope') === 'following') { followingRequests++; return json(feedPosts) }
      if (params.get('scope') === 'saved') { savedRequests++; return json(feedPosts.filter(post=>post.saved)) }
      if (params.get('q')) return json(feedPosts.filter(post=>post.content.toLowerCase().includes(params.get('q').toLowerCase())))
      if (params.get('scope') === 'mine') return json([{
        id: 91, author: 'soco_user', authorDisplayName: 'SocCO Tester',
        content: 'Bài viết kiểm thử giao diện trang cá nhân',
        likes: 3, liked: false, comments: [], visibility: 'public',
        attachments: [{
          storageRef: 'test/profile.jpg', name: 'Ảnh kiểm thử', sizeBytes: 104093,
          contentType: 'image/jpeg', kind: 'image', url: origin + '/default-profile-cover.jpg',
        }],
        createdAt: '2026-11-05T07:00:00Z',
      }])
      return json(feedPosts)
    }
    if (path === '/api/stories') return json([{
      id: 29, author: 'minhanh', authorDisplayName: 'Minh Anh',
      attachment: { storageRef: 'test/story.jpg', kind: 'image', name: 'Tin mới', sizeBytes: 104093,
        contentType: 'image/jpeg', url: origin + '/default-profile-cover.jpg' },
      createdAt: '2026-11-05T08:00:00Z', expiresAt: '2099-01-01T00:00:00Z',
    }])
    if (path === '/api/calls') return json([])
    if (path === '/api/profile') {
      if (req.method() === 'PUT') {
        profileUpdatePayload = req.postDataJSON()
        storedProfile = { ...storedProfile, ...profileUpdatePayload, updatedAt: new Date().toISOString() }
        return json({ ...storedProfile, token: session.token })
      }
      return json(storedProfile)
    }
    if (path === '/api/privacy') {
      if (req.method() === 'PUT') storedPrivacy = { ...storedPrivacy, ...req.postDataJSON() }
      return json(storedPrivacy)
    }
    if (path === '/api/preferences' || path === '/api/preferences/translation') return json({ autoTranslate: true, targetLanguage: 'en', appLocale: 'auto' })
    if (path === '/api/i18n/bundle') return json({ locale: 'vi', version: 'mock', messages: {}, cache: 'hit' })
    if (path === '/api/users/nearby') return json({ users: [], expiresAt: new Date().toISOString() })
    return json({})
  })
  await page.goto(origin)
  const sidebar = page.locator('.app-sidebar')
  await sidebar.waitFor()
  // A compact sidebar must not draw a vertical scrollbar over the chat content.
  const navScrollbars = await sidebar.locator('.app-sidebar-nav').evaluate(node => ({
    scrollbarWidth: getComputedStyle(node).scrollbarWidth,
    overflowY: getComputedStyle(node).overflowY,
  }))
  assert(navScrollbars.scrollbarWidth === 'none' && navScrollbars.overflowY === 'auto',
    'Navigation should remain scrollable without a visible scrollbar: ' + JSON.stringify(navScrollbars))
  await sidebar.getByRole('button', { name: 'Tin nhắn' }).click()
  const chatList = page.locator('.conversation-list.zalo-conversation-list')
  await chatList.waitFor({ state: 'visible' })
  assert(await chatList.evaluate(node => getComputedStyle(node).overflowX === 'hidden'),
    'Conversation list must not show an accidental horizontal scrollbar')

  // Hover must stay open across the entire 250px flyout, not just the 76px icon rail.
  const mainBeforeHover = await page.locator('.modern-frame').boundingBox()
  const firstNavButton = sidebar.getByRole('button', { name: 'Bảng tin' })
  const firstNavBounds = await firstNavButton.boundingBox()
  const navY = firstNavBounds.y + firstNavBounds.height / 2
  await page.mouse.move(45, navY)
  await page.waitForTimeout(300)
  for (const x of [120, 190, 240]) {
    await page.mouse.move(x, navY)
    await page.waitForTimeout(80)
    const bounds = await sidebar.boundingBox()
    assert(bounds && Math.abs(bounds.width - 250) < 2,
      'Sidebar must remain expanded throughout its full hover area at x=' + x)
    assert(await firstNavButton.locator('span').evaluate(node => getComputedStyle(node).opacity === '1'),
      'Sidebar label must stay visible across the flyout at x=' + x)
  }
  const mainDuringHover = await page.locator('.modern-frame').boundingBox()
  assert(mainBeforeHover && mainDuringHover &&
    Math.abs(mainBeforeHover.x - mainDuringHover.x) < 1 &&
    Math.abs(mainBeforeHover.width - mainDuringHover.width) < 1,
    'Hover flyout must not move or resize the main page')
  await page.mouse.click(170, navY)
  await page.locator('.social-feed').waitFor({ state: 'visible' })
  await page.mouse.move(270, navY)
  await page.waitForTimeout(100)
  assert(Math.abs((await sidebar.boundingBox()).width - 76) < 2,
    'Sidebar must collapse only after the pointer leaves the 250px flyout')

  // Desktop social feed layout and interactions.
  await sidebar.getByRole('button', { name: 'Bảng tin' }).click()
  const feed = page.locator('.social-feed')
  await feed.waitFor({ state: 'visible' })
  const feedCards = feed.locator('.social-feed-center .post.zalo-post')
  await feedCards.first().waitFor({ state: 'visible' })
  const socialGeometry = await page.evaluate(() => {
    const keys = ['.social-feed-stories-card', '.social-feed-launcher', '.social-feed-filter-bar',
      '.social-feed-center .post.zalo-post', '.social-feed-suggestions', '.social-feed-trending', '.social-feed-translation']
    return Object.fromEntries(keys.map(key => {
      const rect = document.querySelector(key)?.getBoundingClientRect()
      return [key, rect ? {x:rect.x,y:rect.y,width:rect.width,height:rect.height} : null]
    }))
  })
  const approx = (actual, expected, tolerance=8) => Math.abs(actual - expected) <= tolerance
  for (const [selector, x, y] of [
    ['.social-feed-stories-card', 109, 107],
    ['.social-feed-launcher', 109, 286],
    ['.social-feed-filter-bar', 109, 410],
    ['.social-feed-center .post.zalo-post', 109, 474],
    ['.social-feed-suggestions', null, 107],
    ['.social-feed-trending', null, 425],
    ['.social-feed-translation', null, 702],
  ]) {
    const rect = socialGeometry[selector]
    assert(rect && (x === null || approx(rect.x, x)) && approx(rect.y, y),
      'Social V4 frame geometry mismatch ' + selector + ': ' + JSON.stringify(socialGeometry))
  }
  const sideWidth = socialGeometry['.social-feed-suggestions'].width
  const centerWidth = socialGeometry['.social-feed-stories-card'].width
  assert(Math.abs(sideWidth / (sideWidth + centerWidth) - 337 / 1252) < .015,
    'Social feed right rail should be 20% narrower: ' + JSON.stringify({ sideWidth, centerWidth }))
  assert(await feed.locator('.social-feed-center .post.zalo-post .post-toolbar > button').count() >= 4,
    'Social V4 post must render Like / Comment / Share / Save actions')
  await feed.getByRole('button', { name: 'Tạo Story mới' }).waitFor()
  await feed.getByRole('button', { name: 'Xem Story của Minh Anh' }).waitFor()
  await feed.locator('.social-feed-stories-card').getByRole('button', { name: 'Xem tất cả' }).click()
  assert(await feed.locator('.social-feed-story-strip.is-expanded').count() === 1, 'View all stories must expand story row')
  await feed.getByRole('button', { name: 'Thu gọn' }).click()
  await feed.locator('.social-feed-suggestion-row').first().waitFor({ state: 'visible' })
  await feed.locator('.social-feed-trend').first().waitFor({ state: 'visible' })
  mkdirSync('output/playwright/layout', { recursive: true })
  await page.screenshot({ path: 'output/playwright/layout/social-feed-desktop-1586.png' })
  await feedCards.first().getByRole('button', { name: 'Lưu bài viết' }).click()
  await feedCards.first().getByRole('button', { name: 'Bỏ lưu bài viết' }).waitFor()
  assert(fixturePost.saved, 'Save button must call post save API and update state')

  // Post comments open as a dedicated desktop page, not the legacy modal.
  await feedCards.first().getByRole('button', { name: 'Bình luận', exact: true }).click()
  const commentsPage = page.locator('.post-comments-page')
  await commentsPage.waitFor({ state: 'visible' })
  await commentsPage.locator('.post-comments-thread-heading h2').waitFor({ state: 'visible' })
  assert(await page.locator('.app-page-heading strong').innerText() === 'Bình luận',
    'Post comments page title must match the expected UI')
  assert(await page.locator('.app-page-heading small').innerText() === 'Tương tác với mọi người trong cộng đồng',
    'Post comments subtitle must match the expected UI')
  const commentsLayout = await page.evaluate(() => {
    const rect = (selector) => {
      const element = document.querySelector(selector)
      const bounds = element?.getBoundingClientRect()
      return bounds ? { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height } : null
    }
    return {
      sidebar: rect('.app-sidebar'),
      post: rect('.post-comments-original'),
      comments: rect('.post-comments-thread'),
      header: rect('.chatnet-appbar'),
    }
  })
  const near = (a,b,t=5) => Math.abs(a-b) <= t
  assert(commentsLayout.sidebar && near(commentsLayout.sidebar.width,250) &&
    commentsLayout.header && near(commentsLayout.header.x,250) &&
    commentsLayout.post && near(commentsLayout.post.x,282) && near(commentsLayout.post.y,110) &&
    near(commentsLayout.post.width,821) && near(commentsLayout.post.height,841) &&
    commentsLayout.comments && near(commentsLayout.comments.x,1123) && near(commentsLayout.comments.y,110) &&
    near(commentsLayout.comments.width,428) && near(commentsLayout.comments.height,841),
    'Post comments frame mismatch: ' + JSON.stringify(commentsLayout))
  const postActionLabels = (await commentsPage.locator('.post-comments-post-actions > button').allTextContents()).map(value => value.trim())
  assert(JSON.stringify(postActionLabels) === JSON.stringify(['Thích', 'Bình luận', 'Chia sẻ']),
    'Post comments actions must have the right order and labels: ' + JSON.stringify(postActionLabels))
  assert((await commentsPage.locator('.post-comments-stats').innerText()).includes('Chia sẻ'),
    'Post comments engagement summary must include the share section without inventing counts')
  assert(await commentsPage.locator('.post-comments-author-avatar').isVisible() &&
    await commentsPage.locator('.post-comments-media img').first().isVisible(),
    'post comments must display post author avatar and media from real post data')
  const commentElementBounds = await page.evaluate(() => {
    const keys = ['.post-comments-author-avatar', '.post-comments-media img',
      '.post-comments-thread .feed-comment-form',
      '.post-comments-thread .feed-comment-compose textarea']
    return Object.fromEntries(keys.map(key => {
      const bounds = document.querySelector(key)?.getBoundingClientRect()
      return [key, bounds ? { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height } : null]
    }))
  })
  for (const [key,x,y,width,height] of [
    ['.post-comments-author-avatar',306,134,51,51],
    ['.post-comments-media img',308,261,767,489],
    ['.post-comments-thread .feed-comment-form',1139,803,389,113],
    ['.post-comments-thread .feed-comment-compose textarea',1203,827,306,51],
  ]) {
    const rect = commentElementBounds[key]
    assert(rect && near(rect.x,x,6) && near(rect.y,y,7) && near(rect.width,width,8) && near(rect.height,height,8),
      'Post comments inner geometry mismatch ' + key + ': ' + JSON.stringify(commentElementBounds))
  }
  assert(await commentsPage.locator('.feed-comment-composer-avatar').isVisible() &&
    await commentsPage.getByRole('button', { name: 'Gửi bình luận' }).isVisible(),
    'post comments must display composer avatar and send icon')
  assert(await commentsPage.getByRole('button', { name: 'Tùy chọn bài viết' }).isVisible(),
    'Post comments post options menu icon missing')
  const commentsSort = commentsPage.getByRole('combobox', { name: 'Sắp xếp bình luận' })
  assert(await commentsSort.isVisible() && await commentsSort.inputValue() === 'newest',
    'Post comments newest comments control missing')
  await commentsSort.selectOption('oldest')
  assert(await commentsSort.inputValue() === 'oldest', 'post comments comment sort should be interactive')
  await commentsSort.selectOption('newest')
  await commentsPage.getByRole('button', { name: 'Tùy chọn bài viết' }).click()
  await page.getByRole('dialog', { name: 'Tùy chọn bài viết' }).waitFor({ state: 'visible' })
  await page.getByRole('button', { name: 'Đóng', exact: true }).first().click()
  await page.getByRole('dialog', { name: 'Tùy chọn bài viết' }).waitFor({ state: 'hidden' })
  assert(await page.getByRole('dialog', { name: /Chi tiết bài viết/ }).count() === 0,
    'Desktop post comments must replace the old post-detail modal')
  assert(new URL(page.url()).searchParams.get('post') === '88',
    'Comment navigation must update the shareable post URL')
  assert(await commentsPage.locator('.post-comments-original').isVisible() &&
    await commentsPage.locator('.post-comments-thread').isVisible(),
    'post comments must show original post and comment thread')
  await commentsPage.getByRole('textbox', { name: 'Viết bình luận' }).fill('Bình luận kiểm thử trang bài viết')
  await commentsPage.getByRole('button', { name: 'Gửi bình luận' }).click()
  await commentsPage.locator('.feed-comment-threads .feed-comment-bubble').getByText('Bình luận kiểm thử trang bài viết').waitFor()
  assert(commentRequests === 1 && lastCommentPayload?.content === 'Bình luận kiểm thử trang bài viết',
    'post comments comments must be posted through the existing backend API')
  assert(await commentsPage.locator('.feed-comment-row .feed-comment-actions > button').count() >= 2 &&
    await commentsPage.locator('.feed-comment-menu > button').first().isVisible(),
    'post comments comment rows must expose Like, Reply and the three-dot menu')
  await commentsPage.getByRole('button', { name: 'Trả lời SocCO Tester' }).click()
  await commentsPage.getByRole('textbox', { name: 'Phản hồi SocCO Tester' }).fill('Phản hồi bình luận bài viết')
  await commentsPage.getByRole('button', { name: 'Gửi bình luận' }).click()
  await commentsPage.locator('.feed-comment-threads .feed-comment-bubble').getByText('Phản hồi bình luận bài viết').waitFor()
  assert(commentRequests === 2 && lastCommentPayload?.parentId === 501,
    'Replies from post comments must preserve the parent comment ID')
  await page.screenshot({ path: 'output/playwright/layout/social-post-comments-desktop-1586.png' })
  await page.setViewportSize({ width: 1000, height: 820 })
  const commentsCompact = await page.evaluate(() => {
    const post = document.querySelector('.post-comments-original')?.getBoundingClientRect()
    const thread = document.querySelector('.post-comments-thread')?.getBoundingClientRect()
    return { overflow: document.documentElement.scrollWidth - innerWidth,
      postBottom: post?.bottom, threadTop: thread?.top }
  })
  assert(commentsCompact.overflow <= 2 && commentsCompact.threadTop > commentsCompact.postBottom,
    'Compact post comments must stack comments below the post without overflow: ' + JSON.stringify(commentsCompact))
  await page.setViewportSize({ width: 1586, height: 992 })
  await sidebar.getByRole('button', { name: 'Bảng tin' }).click()
  await feed.waitFor({ state: 'visible' })
  assert(new URL(page.url()).searchParams.get('post') === null,
    'Sidebar navigation from post comments must clear the active post URL')
  await feedCards.first().getByRole('button', { name: 'Bình luận', exact: true }).click()
  await commentsPage.waitFor({ state: 'visible' })
  await page.goBack()
  await feed.waitFor({ state: 'visible' })
  assert(new URL(page.url()).searchParams.get('post') === null,
    'Browser Back must return to the feed from post comments')
  await feedCards.first().getByRole('button', { name: 'Bình luận', exact: true }).click()
  await commentsPage.waitFor({ state: 'visible' })
  await sidebar.getByRole('button', { name: 'Cá nhân' }).click()
  assert(await page.locator('.post-detail-backdrop').count() === 0,
    'Leaving post comments via sidebar must not reopen the old post-detail modal')
  await sidebar.getByRole('button', { name: 'Bảng tin' }).click()
  await feed.waitFor({ state: 'visible' })
  await feed.getByRole('button', { name: 'Đang theo dõi' }).click()
  await feedCards.first().waitFor({ state: 'visible' })
  await page.waitForFunction(() => document.querySelector('.social-feed-filter-options [aria-pressed="true"]')?.textContent?.includes('Đang theo dõi'))
  assert(followingRequests > 0, 'Following tab must request backend scope=following')
  await feed.getByRole('button', { name: 'Mới nhất', exact: true }).click()
  await feed.getByRole('button', { name: 'Dành cho bạn' }).click()
  await feed.locator('.social-feed-trend').first().click()
  assert((await page.getByRole('searchbox', { name: 'Tìm bài viết' }).inputValue()).startsWith('#'), 'Trend click must search posts')
  await page.getByRole('searchbox', { name: 'Tìm bài viết' }).fill('')
  await feed.locator('.social-feed-launcher-publish').click()
  const composer = page.getByRole('dialog', { name: 'Tạo bài viết' })
  await composer.waitFor({ state: 'visible' })
  await composer.getByRole('textbox', { name: 'Nội dung bài viết' }).fill('Bài đăng thử kiểm tra Social V4')
  await composer.getByRole('button', { name: 'Đăng', exact: true }).click()
  await composer.waitFor({ state: 'hidden' })
  assert(lastFeedCreated?.content === 'Bài đăng thử kiểm tra Social V4',
    'Compose must publish through existing API: ' + JSON.stringify(lastFeedCreated))
  await feed.locator('.social-feed-launcher-shortcuts').getByRole('button', { name: 'Ảnh / Video' }).click()
  await composer.waitFor({ state: 'visible' })
  await composer.getByRole('button', { name: 'Ảnh', exact: true }).waitFor()
  await page.getByRole('button', { name: 'Đóng tạo bài viết' }).click()
  await composer.waitFor({ state: 'hidden' })
  await feed.locator('.social-feed-launcher-shortcuts').getByRole('button', { name: 'Check-in' }).click()
  await composer.waitFor({ state: 'visible' })
  await composer.getByRole('textbox', { name: 'Địa điểm check-in' }).fill('Đà Lạt, Việt Nam')
  await composer.getByRole('button', { name: 'Đăng', exact: true }).click()
  await composer.waitFor({ state: 'hidden' })
  assert(lastFeedCreated?.content === '📍 Đà Lạt, Việt Nam',
    'Check-in should save a real location label in the published post content: ' + JSON.stringify(lastFeedCreated))
  await feed.locator('.social-feed-suggestion-row').first().getByRole('button', { name: 'Kết bạn' }).click()
  await page.waitForFunction(() => Array.from(document.querySelectorAll('.social-feed-suggestion-row')).length === 0)
  assert(friendRequestsSent > 0, 'Connection recommendation must use friend request API')
  await feed.locator('.social-feed-translation').getByRole('button', { name: /Mở tin nhắn/ }).click()
  await page.locator('.modern-messenger').waitFor({ state: 'visible' })

  // Social V4 at compact desktop and original mobile breakpoint.
  await sidebar.getByRole('button', { name: 'Bảng tin' }).click()
  await feed.waitFor({ state: 'visible' })
  await page.setViewportSize({ width: 1000, height: 820 })
  await feed.waitFor({ state: 'visible' })
  const compactFeed = await page.evaluate(() => {
    const center = document.querySelector('.social-feed-center')?.getBoundingClientRect()
    const rail = document.querySelector('.social-feed-side')?.getBoundingClientRect()
    return { overflow: document.documentElement.scrollWidth - innerWidth, centerBottom: center?.bottom, railTop: rail?.top }
  })
  assert(compactFeed.overflow <= 2 && compactFeed.railTop > compactFeed.centerBottom,
    'Compact Social V4 rail should stack without overflow: ' + JSON.stringify(compactFeed))
  await page.setViewportSize({ width: 390, height: 844 })
  await feed.locator('.stories-row .story-card').first().waitFor({ state: 'visible' })
  await feed.locator('.zalo-post-composer').waitFor({ state: 'visible' })
  await feed.locator('.feed.zalo-feed .post.zalo-post').first().getByRole('button', { name: 'Bình luận', exact: true }).click()
  await page.getByRole('dialog', { name: /Chi tiết bài viết của/ }).waitFor({ state: 'visible' })
  await page.getByRole('button', { name: 'Đóng chi tiết bài viết' }).click()
  await page.getByRole('dialog', { name: /Chi tiết bài viết của/ }).waitFor({ state: 'hidden' })
  assert(await feed.locator('.social-feed-side').isHidden(), 'Mobile must not display Social V4 discovery rail')
  const mobileFeedOverflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)
  assert(mobileFeedOverflow <= 2, 'Social V4 mobile layout must not overflow: ' + mobileFeedOverflow)
  await page.setViewportSize({ width: 1586, height: 992 })
  await feed.waitFor({ state: 'visible' })

  await sidebar.getByRole('button', { name: 'Nhóm & cộng đồng' }).click()
  await page.locator('.communication-hub-row').filter({ hasText: 'Nhóm SocCO' }).waitFor()
  assert(await page.locator('.communication-hub-row').count() === 1, 'Groups must filter real group conversations')
  await page.locator('.communication-hub-row').getByRole('button', { name: 'Mở nhóm' }).click()
  await page.locator('.conversation-info-panel').waitFor({ state: 'visible' })
  assert(await page.locator('.conversation-info-panel').getByText('Nhóm SocCO').count() > 0, 'Chat details missing active group')
  await page.locator('.conversation-info-panel').getByRole('button', { name: 'Quản lý nhóm' }).click()
  await page.locator('.group-settings-panel').waitFor({ state: 'visible' })
  await page.locator('.group-settings-panel').getByText('Bạn là chủ nhóm').waitFor({ timeout: 5000 })
  await page.getByRole('button', { name: 'Đóng thanh quản lý nhóm' }).click()
  await sidebar.getByRole('button', { name: 'Cuộc gọi' }).click()
  await page.locator('.communication-hub-call-actions .call-header-actions button').first().waitFor({ state: 'visible' })
  assert(await page.locator('.communication-hub-row').count() === 2, 'Calls must show loaded conversations')
  await sidebar.getByRole('button', { name: 'Tin nhắn' }).click()
  await page.locator('.conversation-item').filter({ hasText: 'Minh Anh' }).click()
  await page.locator('.conversation-info-panel').waitFor({ state: 'visible' })
  await page.locator('.conversation-info-panel').getByRole('button', { name: 'Tìm tin nhắn' }).click()
  await page.getByRole('dialog', { name: 'Tìm trong hội thoại' }).waitFor()
  await page.keyboard.press('Escape')

  // Desktop BA & Modules V3 / 03 · Hồ sơ cá nhân.
  await sidebar.getByRole('button', { name: 'Cá nhân' }).click()
  const profile = page.locator('.profile-page')
  await profile.waitFor({ state: 'visible' })
  await page.locator('.profile-page-post-feed .post').first().waitFor({ state: 'visible' })
  mkdirSync('output/playwright/layout', { recursive: true })
  await page.screenshot({ path: 'output/playwright/layout/profile-page-1586.png' })
  const geometry = await page.evaluate(() => {
    const keys = ['.profile-page-hero', '.profile-page-main', '.profile-page-about', '.profile-page-recent']
    return Object.fromEntries(keys.map(key => {
      const rect = document.querySelector(key)?.getBoundingClientRect()
      return [key, rect ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height } : null]
    }))
  })
  assert(Math.abs(geometry['.profile-page-hero'].x - 107) < 5 &&
    Math.abs(geometry['.profile-page-hero'].y - 108) < 5,
    'Profile hero must match social UI placement: ' + JSON.stringify(geometry))
  assert(Math.abs(geometry['.profile-page-main'].y - 424) < 8 &&
    geometry['.profile-page-about'].x > geometry['.profile-page-main'].x + 400,
    'Profile main/about two-column layout mismatch: ' + JSON.stringify(geometry))
  assert(await profile.getByRole('tab').count() === 4, 'Profile requires 4 Desktop tabs')
  await page.locator('.profile-page-post-feed .post').first().waitFor({ state: 'visible' })
  await profile.getByRole('tab', { name: 'Giới thiệu' }).click()
  assert(await profile.getByText('@soco_user').count() > 0, 'Profile intro should show actual username')
  await profile.getByRole('tab', { name: 'Bạn bè' }).click()
  await profile.getByRole('tab', { name: 'Ảnh & video' }).click()
  assert(await page.locator('.profile-page-media-item').count() === 1, 'Profile media tab must use actual loaded post attachments')
  await page.locator('.profile-page-media-item').first().click()
  await page.getByRole('dialog', { name: /Chi tiết bài viết/ }).waitFor()
  await page.getByRole('button', { name: 'Đóng chi tiết bài viết' }).click()
  await profile.getByRole('tab', { name: 'Bài viết' }).click()
  // The desktop profile editor opens as a full page, not a drawer.
  await profile.getByRole('button', { name: 'Chỉnh sửa hồ sơ' }).click()
  const editor = page.locator('.profile-editor-page')
  await editor.waitFor({ state: 'visible' })
  assert(await page.getByRole('dialog', { name: 'Chỉnh sửa hồ sơ' }).count() === 0, 'Profile editor must replace the former modal')
  const editGeometry = await page.evaluate(() => {
    const selectors = ['.profile-editor-form-card', '.profile-editor-preview-card', '.profile-editor-privacy-card']
    return Object.fromEntries(selectors.map(key => {
      const rect = document.querySelector(key)?.getBoundingClientRect()
      return [key, rect ? {x:rect.x,y:rect.y,width:rect.width,height:rect.height} : null]
    }))
  })
  assert(Math.abs(editGeometry['.profile-editor-form-card'].x - 108) < 5 &&
    Math.abs(editGeometry['.profile-editor-form-card'].y - 111) < 5 &&
    Math.abs(editGeometry['.profile-editor-preview-card'].x - 1105) < 8 &&
    Math.abs(editGeometry['.profile-editor-privacy-card'].y - 563) < 6,
    'Profile editor card positions should match Desktop frame: ' + JSON.stringify(editGeometry))
  mkdirSync('output/playwright/layout', { recursive: true })
  await page.screenshot({ path: 'output/playwright/layout/profile-editor-desktop.png' })
  await editor.getByRole('textbox', { name: 'Tên hiển thị' }).fill('Bản nháp cần hủy')
  await editor.getByRole('textbox', { name: 'Tiểu sử' }).fill('Giới thiệu đang thử')
  await editor.getByRole('textbox', { name: 'Thành phố' }).fill('Đà Nẵng')
  await editor.locator('.profile-editor-preview-name').getByText('Bản nháp cần hủy').waitFor()
  await editor.getByRole('button', { name: 'Hủy thay đổi' }).click()
  await profile.waitFor({ state: 'visible' })
  assert(profileUpdatePayload === null, 'Discard must not save unsaved identity fields')
  await profile.getByRole('button', { name: 'Chỉnh sửa hồ sơ' }).click()
  await editor.waitFor({ state: 'visible' })
  assert(await editor.getByRole('textbox', { name: 'Tên hiển thị' }).inputValue() === 'SocCO Tester', 'Cancel must restore saved display name')
  assert(await editor.getByRole('textbox', { name: 'Tiểu sử' }).inputValue() === '', 'Cancel must reset unsaved bio')
  await editor.getByRole('switch', { name: 'Tìm theo tên hiển thị' }).click()
  await page.waitForFunction(() => Array.from(document.querySelectorAll('.profile-editor-privacy-row button')).some(button =>
    button.getAttribute('aria-label') === 'Tìm theo tên hiển thị' && button.getAttribute('aria-checked') === 'false'))
  assert(storedPrivacy.searchableByName === false, 'Privacy switch must persist its own backend setting')
  await editor.getByRole('textbox', { name: 'Tên hiển thị' }).fill('SocCO Test Mới')
  await editor.getByRole('textbox', { name: 'Tiểu sử' }).fill('Yêu công nghệ, du lịch và những câu chuyện đẹp')
  await editor.getByRole('textbox', { name: 'Thành phố' }).fill('Hà Nội, Việt Nam')
  await editor.locator('.profile-editor-preview-about').getByText('Hà Nội, Việt Nam').waitFor()
  await editor.getByRole('button', { name: 'Lưu hồ sơ' }).click()
  await profile.waitFor({ state: 'visible' })
  assert(profileUpdatePayload?.bio === 'Yêu công nghệ, du lịch và những câu chuyện đẹp' &&
    profileUpdatePayload?.city === 'Hà Nội, Việt Nam' && profileUpdatePayload?.displayName === 'SocCO Test Mới',
    'Profile editor must save display name, bio and city through /api/profile: ' + JSON.stringify(profileUpdatePayload))
  await profile.getByText('Hà Nội, Việt Nam').first().waitFor()
  assert(await profile.getByText('Yêu công nghệ, du lịch và những câu chuyện đẹp').count() > 0, 'Saved bio should appear on profile')

  await sidebar.getByRole('button', { name: 'Cài đặt' }).click()
  await page.locator('.settings-card').first().waitFor({ state: 'visible' })
  await page.locator('.profile-editor-settings-entry').getByRole('button', { name: 'Chỉnh sửa hồ sơ' }).click()
  await editor.waitFor({ state: 'visible' })
  await page.setViewportSize({ width: 1000, height: 820 })
  await editor.waitFor({ state: 'visible' })
  const editResponsive = await page.evaluate(() => {
    const form = document.querySelector('.profile-editor-form-card')?.getBoundingClientRect()
    const preview = document.querySelector('.profile-editor-preview-card')?.getBoundingClientRect()
    const side = document.querySelector('.profile-editor-side')?.getBoundingClientRect()
    const grid = document.querySelector('.profile-editor-page')
    const style = grid && getComputedStyle(grid)
    return { overflow: document.documentElement.scrollWidth - window.innerWidth,
      formTop: form?.top, formHeight: form?.height, formBottom: form?.bottom,
      previewTop: preview?.top, sideTop: side?.top, sideHeight: side?.height,
      gridColumns: style?.gridTemplateColumns, gridRows: style?.gridTemplateRows, gap: style?.gap }
  })
  assert(editResponsive.overflow <= 2 && editResponsive.previewTop > editResponsive.formBottom,
    'Profile editor should stack cards with no horizontal overflow at 1000px: ' + JSON.stringify(editResponsive))
  await page.setViewportSize({ width: 1586, height: 992 })
  await editor.getByRole('button', { name: 'Hủy thay đổi' }).click()
  await sidebar.getByRole('button', { name: 'Cá nhân' }).click()
  await profile.waitFor({ state: 'visible' })
  await page.setViewportSize({ width: 1000, height: 820 })
  await profile.waitFor({ state: 'visible' })
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  assert(overflow <= 2, 'Responsive profile causes horizontal overflow at 1000px: ' + overflow)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.locator('.profile-view').waitFor({ state: 'visible' })
  assert(await page.locator('.profile-page').count() === 0, 'Mobile must keep existing profile layout')
  await page.getByRole('button', { name: 'Mở trang cá nhân' }).click()
  await page.getByRole('button', { name: 'Chỉnh sửa', exact: true }).click()
  await page.getByRole('dialog', { name: 'Chỉnh sửa hồ sơ' }).waitFor({ state: 'visible' })
  await page.getByRole('button', { name: 'Đóng chỉnh sửa hồ sơ' }).click()
  await page.setViewportSize({ width: 1586, height: 992 })
  await profile.waitFor({ state: 'visible' })
  assert(errors.length === 0, 'Uncaught JS errors: ' + errors.join('; '))
  console.log('PASS: Post comments frame, icons/actions, comments/sorting/replies, responsive, social UI groups/calls/chat, profile, full-page profile editor, privacy, save bio/city')
} catch (error) {
  console.error(error)
  process.exitCode = 1
} finally {
  if (browser) await browser.close()
  server.kill('SIGTERM')
}