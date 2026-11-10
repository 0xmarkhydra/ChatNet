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
const portraitImageUrl = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="360" height="900" viewBox="0 0 360 900"><rect width="360" height="900" fill="#f3f6fa"/><rect x="0" y="0" width="65" height="65" fill="#f24"/><rect x="295" y="0" width="65" height="65" fill="#2ac"/><rect x="0" y="835" width="65" height="65" fill="#4a2"/><rect x="295" y="835" width="65" height="65" fill="#f90"/></svg>')
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
let rejectStoryDirect = false
const storyReplyRequests = []
const mediaOnly = process.argv.includes('--media-only')


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
  await page.route('**/api/**', route => {
    const req = route.request(), path = new URL(req.url()).pathname
    const json = body => route.fulfill({ status: 200, contentType: 'application/json', headers: cors, body: JSON.stringify(body) })
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors })
    if (path === '/api/events') return route.fulfill({ status: 200, contentType: 'text/event-stream', headers: cors, body: ': connected\n\n' })
    if (path === '/api/feed/moderation/reports') return route.fulfill({ status: 403, contentType: 'application/json', headers: cors, body: JSON.stringify({error: 'forbidden'}) })
    if (path === '/api/conversations/direct' && req.method() === 'POST') {
      if (req.postDataJSON().username !== 'minhanh') return json({})
      if (rejectStoryDirect) return route.fulfill({
        status: 403, contentType: 'application/json', headers: cors,
        body: JSON.stringify({ error: 'Không thể mở cuộc trò chuyện' }),
      })
      return json(conversations[0])
    }
    if (path === '/api/conversations/1/messages' && req.method() === 'POST') {
      const body = req.postDataJSON()
      storyReplyRequests.push(body)
      return json({
        id: 250 + storyReplyRequests.length, clientId: body.clientId,
        conversationId: 1, senderId: 1, sender: 'soco_user',
        text: body.text, attachments: body.attachments || [],
        createdAt: new Date().toISOString(),
      })
    }
    if (mediaOnly && path === '/api/conversations/1/messages' && req.method() === 'GET') return json([{
      id: 12, conversationId: 1, senderId: 2, sender: 'minhanh',
      senderDisplayName: 'Minh Anh', text: '',
      attachments: [
        { kind: 'image', storageRef: 'test/chat-photo-1', name: 'Ảnh hội thoại 1',
          sizeBytes: 300, contentType: 'image/jpeg', url: origin + '/default-profile-cover.jpg' },
        { kind: 'image', storageRef: 'test/chat-photo-2', name: 'Ảnh hội thoại 2',
          sizeBytes: 300, contentType: 'image/svg+xml', url: portraitImageUrl },
      ],
      createdAt: '2026-11-06T08:00:00Z', readByUserIds: [],
    }])
    if (mediaOnly && path === '/api/conversations/1/shared' && new URL(req.url()).searchParams.get('kind') === 'media') return json({
      items: [{
        id: 12, sender: 'minhanh', senderDisplayName: 'Minh Anh',
        text: '', createdAt: '2026-11-06T08:00:00Z',
        attachments: [
          { kind: 'image', storageRef: 'test/chat-photo-1', name: 'Ảnh đã chia sẻ 1', sizeBytes: 300,
            contentType: 'image/jpeg', url: origin + '/default-profile-cover.jpg' },
          { kind: 'image', storageRef: 'test/chat-photo-2', name: 'Ảnh đã chia sẻ 2', sizeBytes: 300,
            contentType: 'image/svg+xml', url: portraitImageUrl },
        ],
      }], nextBefore: null,
    })
    if (mediaOnly && /\/api\/conversations\/\d+\/pins$/.test(path)) return json([])
    if (path === '/api/conversations') return json(conversations)
    if (path === '/api/conversation-categories') return json([])
    if (path.endsWith('/messages')) return json([])
    if (path.endsWith('/members')) return json([{ id: 1, username: 'soco_user', displayName: 'SocCO Tester', role: 'owner', online: true }])
    if (path.endsWith('/group-settings')) return json({ requireApproval: false, adminCanInvite: true, adminCanApprove: true, adminCanEditInfo: true })
    if (/\/(invites|join-requests|admin-audit)$/.test(path)) return json([])
    if (path === '/api/friends') return json([])
    if (path === '/api/friends/requests') return json([])
    if (path === '/api/users/minhanh/profile') return json({
      id: 2, username: 'minhanh', displayName: 'Minh Anh',
      avatarSet: false, coverSet: false, allowFriendRequests: true,
      updatedAt: '2026-11-05T00:00:00Z',
    })
    if (path === '/api/users/suggestions') return json(suggestions)
    if (path === '/api/users/search') return json([])
    if (path === '/api/friends/4' && req.method() === 'POST') { friendRequestsSent++; return json({ ...suggestions[0], status:'pending', direction:'outgoing', updatedAt:new Date().toISOString() }) }
    if (path === '/api/posts/88/reactions' && req.method() === 'POST') {
      const selected = req.postDataJSON().emoji
      fixturePost.myReaction = fixturePost.myReaction === selected ? '' : selected
      fixturePost.liked = Boolean(fixturePost.myReaction)
      fixturePost.likes += fixturePost.liked ? 1 : -1
      return json({ ...fixturePost })
    }
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
      if (params.get('author') === 'minhanh') return json(feedPosts)
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
  for (const [selector, y] of [
    ['.social-feed-stories-card', 107],
    ['.social-feed-launcher', 286],
    ['.social-feed-filter-bar', 410],
    ['.social-feed-center .post.zalo-post', 474],
    ['.social-feed-suggestions', 107],
    ['.social-feed-trending', 425],
    ['.social-feed-translation', 702],
  ]) {
    const rect = socialGeometry[selector]
    assert(rect && approx(rect.y, y),
      'Social feed vertical alignment mismatch ' + selector + ': ' + JSON.stringify(socialGeometry))
  }
  const centerRect = socialGeometry['.social-feed-stories-card']
  const sideRect = socialGeometry['.social-feed-suggestions']
  const centerWidth = centerRect.width
  const sideWidth = sideRect.width
  assert(centerWidth >= 540 && centerWidth <= 640 && sideWidth >= 260 && sideWidth <= 330
    && sideRect.x >= centerRect.x + centerWidth + 14
    && ['.social-feed-launcher', '.social-feed-filter-bar', '.social-feed-center .post.zalo-post']
      .every(selector => approx(socialGeometry[selector].x, centerRect.x, 2)
        && approx(socialGeometry[selector].width, centerWidth, 2)),
    'Feed cards, composer and stories must share a compact central column next to a narrower rail: '
      + JSON.stringify(socialGeometry))
  const postCard = feedCards.first()
  const postActions = postCard.locator('.feed-post-toolbar > button')
  assert(await postActions.count() === 4,
    'Post must show exactly four equal actions: Like, Comment, Share, Save')
  assert(await postCard.locator('.feed-reaction-control, .feed-reaction-picker').count() === 0,
    'Post must use a single heart reaction without a multi-reaction menu')
  const heartButton = postCard.getByRole('button', { name: 'Thích bài viết' })
  assert(await heartButton.locator('svg.lucide-heart').count() === 1,
    'Post Like button must use a heart icon')
  await heartButton.hover()
  assert(await postCard.locator('.feed-reaction-picker').count() === 0,
    'Hovering Like must not open a reaction picker')
  const postGeometry = await postCard.evaluate(card => {
    const buttons = [...card.querySelectorAll('.feed-post-toolbar > button')]
    const boxes = buttons.map(button => button.getBoundingClientRect())
    const toolbar = card.querySelector('.feed-post-toolbar')
    return {
      columns: getComputedStyle(toolbar).gridTemplateColumns,
      buttonWidths: boxes.map(box => box.width),
      reactionSummary: Boolean(card.querySelector('.feed-post-likes svg.lucide-heart')),
      mediaWidth: card.querySelector('.feed-media-preview img')?.getBoundingClientRect().width,
      cardWidth: card.getBoundingClientRect().width,
      mediaBoxes: ['.feed-media-preview', '.media-attachments', '.media-item', '.media-image-button', '.media-item img']
        .map(selector => {
          const elem = card.querySelector(selector)
          const rect = elem?.getBoundingClientRect()
          return { selector, width: rect?.width, left: rect?.left, maxWidth: elem ? getComputedStyle(elem).maxWidth : null, display: elem ? getComputedStyle(elem).display : null }
        }),
    }
  })
  assert(postGeometry.reactionSummary
    && postGeometry.buttonWidths.length === 4
    && postGeometry.buttonWidths.every(width => Math.abs(width - postGeometry.buttonWidths[0]) <= 2)
    && postGeometry.mediaWidth >= postGeometry.cardWidth - 70,
    'Post card should align four action columns and show full-width media: ' + JSON.stringify(postGeometry))
  const feedImage = postCard.locator('.feed-media-preview .media-count-1 .media-item img').first()
  await feedImage.evaluate(image => image.decode())
  async function verifyUncroppedFeedImage() {
    const image = await feedImage.evaluate(element => {
      const rect = element.getBoundingClientRect()
      const css = getComputedStyle(element)
      return {
        width: rect.width,
        height: rect.height,
        naturalWidth: element.naturalWidth,
        naturalHeight: element.naturalHeight,
        fit: css.objectFit,
        maxHeight: css.maxHeight,
      }
    })
    const allowedHeight = Number.parseFloat(image.maxHeight)
    const naturalDisplayHeight = image.width * image.naturalHeight / image.naturalWidth
    assert(image.naturalWidth > 0 && image.naturalHeight > 0
      && image.fit === 'contain' && allowedHeight > 0 && allowedHeight <= 440
      && Math.abs(image.height - Math.min(naturalDisplayHeight, allowedHeight)) <= 2,
      'Single feed photo must be height-limited while displaying its full contents: ' + JSON.stringify(image))
  }
  await verifyUncroppedFeedImage()
  if (mediaOnly) {
    const popups = []
    page.on('popup', popup => { popups.push(popup.url()); void popup.close() })
    const viewer = page.getByRole('dialog', { name: 'Xem ảnh và video' })

    await postCard.getByRole('button', { name: 'Xem bài viết có ảnh Đà Lạt' }).click()
    const postComments = page.locator('.post-comments-page')
    await postComments.waitFor({ state: 'visible' })
    assert(await viewer.count() === 0, 'Feed image should open post comments, not the image viewer')
    assert(popups.length === 0, 'Clicking feed image must not open S3')
    // Start the chat portion without the post=... deep-link that keeps Feed active.
    await page.goto(origin)
    await sidebar.getByRole('button', { name: 'Tin nhắn' }).click()
    await page.locator('.zalo-conversation-list .conversation-item').first().click()
    const chatImages = page.locator('.chat-message-media .media-image-button')
    try {
      await chatImages.first().waitFor({ state: 'visible', timeout: 9000 })
    } catch (error) {
      console.log('MEDIA ERRORS', JSON.stringify(errors), 'server', serverLog.slice(-900))
      console.log('MEDIA DEBUG', JSON.stringify(await page.evaluate(() => ({
        url: location.href,
        active: Boolean(document.querySelector('.social-chat-layout.has-active')),
        visibleMessages: document.querySelector('.social-chat-layout .messages')?.innerText.slice(0, 700),
        mediaItems: document.querySelectorAll('.chat-message-media').length,
        images: document.querySelectorAll('.media-image-button').length,
        chatListVisible: Boolean(document.querySelector('.zalo-conversation-list')),
        chatListItems: [...document.querySelectorAll('.zalo-conversation-list .conversation-item')].slice(0,3).map(element => ({name: element.innerText.slice(0,60), active: element.className})),
        mainSnippet: document.querySelector('main')?.innerText.slice(0,400),
        bodySnippet: document.body.innerText.slice(0,450),
      }))))
      throw error
    }
    assert(await chatImages.count() === 2, 'Chat fixture must show two image attachments')
    const thumbs = await chatImages.locator('img').evaluateAll(async images => {
      await Promise.all(images.map(img => img.decode()))
      return images.map(img => {
        const rect = img.getBoundingClientRect()
        const css = getComputedStyle(img)
        return {
          width: rect.width, height: rect.height,
          naturalWidth: img.naturalWidth, naturalHeight: img.naturalHeight,
          fit: css.objectFit, aspect: css.aspectRatio, minHeight: css.minHeight,
        }
      })
    })
    assert(thumbs.length === 2 && thumbs.some(img => img.naturalHeight > img.naturalWidth)
      && thumbs.some(img => img.naturalWidth > img.naturalHeight)
      && thumbs.every(img => img.width <= 221 && img.height <= 221
        && img.fit === 'contain' && img.aspect === 'auto'
        && img.minHeight === '0px' && img.naturalWidth > 0 && img.naturalHeight > 0
        && Math.abs(img.width / img.height - img.naturalWidth / img.naturalHeight) < 0.025),
      'Landscape and portrait thumbnails must retain the exact original aspect ratio: ' + JSON.stringify(thumbs))
    await chatImages.first().click()
    await viewer.waitFor({ state: 'visible' })
    assert(await viewer.locator('.media-viewer-content img').isVisible(),
      'Chat image must open in the in-app media viewer')
    async function measurePreview() {
      return viewer.locator('.media-viewer-content img').evaluate(async img => {
        await img.decode()
        const rect = img.getBoundingClientRect()
        const frame = img.parentElement.getBoundingClientRect()
        return {
          fit: getComputedStyle(img).objectFit,
          width: rect.width, height: rect.height,
          naturalWidth: img.naturalWidth, naturalHeight: img.naturalHeight,
          frameWidth: frame.width, frameHeight: frame.height,
        }
      })
    }
    function assertUncroppedPreview(info, label) {
      assert(info.fit === 'contain' && info.naturalWidth > 0 && info.naturalHeight > 0
        && info.width <= Math.min(info.frameWidth, info.naturalWidth) + 1
        && info.height <= Math.min(info.frameHeight, info.naturalHeight) + 1
        && Math.abs(info.width / info.height - info.naturalWidth / info.naturalHeight) < 0.025,
        label + ': image should be fully visible and never upscaled beyond original pixels: ' + JSON.stringify(info))
    }
    assertUncroppedPreview(await measurePreview(), 'Landscape preview')
    await viewer.getByRole('button', { name: 'Ảnh tiếp theo' }).click()
    assert(await viewer.locator('.media-viewer-heading span').innerText() === '2 / 2',
      'Chat image viewer must navigate attachments')
    assertUncroppedPreview(await measurePreview(), 'Portrait preview')
    await page.keyboard.press('ArrowLeft')
    assert(await viewer.locator('.media-viewer-heading span').innerText() === '1 / 2',
      'Chat image viewer must navigate by keyboard')
    await viewer.getByRole('button', { name: 'Đóng trình xem ảnh' }).click()
    await viewer.waitFor({ state: 'detached' })

    await page.locator('.chat-head button[aria-label="Thông tin hội thoại"]:visible').first().click()
    await page.locator('.social-chat-details').getByRole('button', { name: 'Ảnh & video' }).click()
    const sharedDialog = page.getByRole('dialog', { name: 'Nội dung đã chia sẻ' })
    await sharedDialog.waitFor({ state: 'visible' })
    await sharedDialog.locator('.shared-media-card').first().click()
    await viewer.waitFor({ state: 'visible' })
    assert(await viewer.locator('.media-viewer-content img').isVisible(),
      'Shared media must open in the same viewer')
    await page.keyboard.press('Escape')
    await viewer.waitFor({ state: 'detached' })
    assert(await sharedDialog.isVisible(), 'Closing media viewer must preserve the shared content dialog')
    assert(popups.length === 0, 'Feed, chat and shared media must not open external browser tabs')
    await page.setViewportSize({ width: 390, height: 844 })
    await sharedDialog.locator('.shared-media-card').first().click()
    await viewer.waitFor({ state: 'visible' })
    assertUncroppedPreview(await measurePreview(), 'Mobile landscape preview')
    await viewer.getByRole('button', { name: 'Ảnh tiếp theo' }).click()
    assertUncroppedPreview(await measurePreview(), 'Mobile portrait preview')
    const mobileImage = await viewer.locator('.media-viewer-content img').boundingBox()
    assert(mobileImage && mobileImage.x >= 0 && mobileImage.y >= 0
      && mobileImage.x + mobileImage.width <= 391
      && mobileImage.y + mobileImage.height <= 845,
      'Mobile portrait photo must fit fully within the viewport: ' + JSON.stringify(mobileImage))
    await viewer.getByRole('button', { name: 'Đóng trình xem ảnh' }).click()
    await viewer.waitFor({ state: 'detached' })
    assert(popups.length === 0, 'Mobile media preview must not open an external tab')
    console.log('Media viewer PASS: desktop/mobile feed/chat/shared, no external tabs, carousel, keyboard, escape')
    await browser.close()
    browser = null
    server.kill()
    process.exit(0)
  }
  const likeLayout = await postCard.evaluate(card => {
    const row = card.querySelector('.post-engagement-summary')
    const likes = card.querySelector('.feed-post-likes')
    const comments = card.querySelector('.feed-post-conversation-stats')
    const rowBox = row.getBoundingClientRect(), likesBox = likes.getBoundingClientRect(), commentsBox = comments.getBoundingClientRect()
    return {
      rowLeft: rowBox.left, rowRight: rowBox.right,
      likesLeft: likesBox.left, likesRight: likesBox.right,
      commentsLeft: commentsBox.left, commentsRight: commentsBox.right,
      likesCentered: Math.abs(likesBox.y - commentsBox.y) <= 4,
    }
  })
  assert(likeLayout.likesLeft - likeLayout.rowLeft < 20
    && likeLayout.rowRight - likeLayout.commentsRight < 20
    && likeLayout.commentsLeft > likeLayout.likesRight
    && likeLayout.likesCentered,
    'Post engagement count must align left and comments right in one row: ' + JSON.stringify(likeLayout))
  if (process.argv.includes('--likes-only')) {
    const firstLike = postCard.getByRole('button', { name: 'Thích bài viết' })
    await firstLike.click()
    await postCard.getByRole('button', { name: 'Bỏ thích bài viết' }).waitFor()
    assert(await postCard.locator('.feed-post-likes').innerText() === '13 lượt thích', 'Like count must update after React')
    await postCard.locator('.visitor-name-link').click()
    const visitor = page.getByRole('dialog', { name: 'Trang cá nhân người dùng' })
    await visitor.locator('.post').first().waitFor({ state: 'visible' })
    const visitorAlignment = await visitor.locator('.post').first().evaluate(card => {
      const row = card.querySelector('.post-engagement-summary').getBoundingClientRect()
      const likes = card.querySelector('.feed-post-likes').getBoundingClientRect()
      const comments = card.querySelector('.feed-post-conversation-stats').getBoundingClientRect()
      return { rowLeft: row.left, rowRight: row.right, likesLeft: likes.left, likesRight: likes.right, commentsLeft: comments.left, commentsRight: comments.right }
    })
    assert(visitorAlignment.likesLeft - visitorAlignment.rowLeft < 20
      && visitorAlignment.rowRight - visitorAlignment.commentsRight < 20
      && visitorAlignment.commentsLeft > visitorAlignment.likesRight,
      'Profile timeline like summary must align left, comments right: ' + JSON.stringify(visitorAlignment))
    assert(await visitor.locator('.post').first().getByRole('button', { name: 'Bỏ thích bài viết' }).locator('svg.lucide-heart').count() === 1,
      'Profile timeline must share the heart button')
    await visitor.getByRole('button', { name: 'Quay lại', exact: true }).click()
    await visitor.waitFor({ state: 'detached' })
    await postCard.getByRole('button', { name: 'Bình luận', exact: true }).click()
    const detail = page.locator('.post-comments-page')
    await detail.waitFor({ state: 'visible' })
    await page.mouse.move(500, 250)
    await page.waitForTimeout(180)
    const detailFrame = await page.locator('.modern-frame').boundingBox()
    assert(Math.abs((await sidebar.boundingBox()).width - 76) < 2,
      'Post detail must not force the sidebar open')
    assert(detailFrame && Math.abs(detailFrame.x - mainBeforeHover.x) < 1,
      'Post detail must not shift main content to accommodate a permanently expanded sidebar')
    await page.mouse.move(45, navY)
    await page.waitForTimeout(180)
    assert(Math.abs((await sidebar.boundingBox()).width - 250) < 2,
      'Post detail should retain sidebar hover expansion')
    const detailFrameHovered = await page.locator('.modern-frame').boundingBox()
    assert(detailFrameHovered && Math.abs(detailFrameHovered.x - detailFrame.x) < 1,
      'Hovering sidebar in post detail must not shift the main page')
    await page.mouse.move(500, 250)
    await page.waitForTimeout(180)
    assert(Math.abs((await sidebar.boundingBox()).width - 76) < 2,
      'Sidebar must collapse after the pointer leaves on post detail')
    const detailLike = detail.getByRole('button', { name: 'Bỏ thích bài viết' })
    assert(await detailLike.locator('svg.lucide-heart').count() === 1
      && await detail.locator('.post-comments-stats .lucide-heart').count() === 1,
      'Post detail must use the same heart for controls and stats')
    assert(await detail.locator('.feed-reaction-control,.feed-reaction-picker').count() === 0,
      'Post detail must not show legacy multi-reaction picker')
    const detailActions = detail.locator('.post-comments-post-actions > button')
    const widths = await detailActions.evaluateAll(buttons => buttons.map(button => button.getBoundingClientRect().width))
    assert(widths.length === 3 && widths.every(width => Math.abs(width - widths[0]) < 2),
      'Post detail controls must have equal widths: ' + JSON.stringify(widths))
    await detailLike.click()
    await detail.getByRole('button', { name: 'Thích bài viết' }).waitFor()
    console.log('Like consistency PASS: summary alignment, heart icon in feed/detail, toggle/untoggle, equal action widths')
    await browser.close()
    browser = null
    server.kill()
    process.exit(0)
  }
  mkdirSync('output/playwright/layout', { recursive: true })
  await page.screenshot({ path: 'output/playwright/layout/feed-post-single-heart.png' })
  // The post editor should start short, expand with text, and shrink back without its own scrollbar.
  await feed.locator('.social-feed-launcher-publish').click()
  const createDialog = page.getByRole('dialog', { name: 'Tạo bài viết' })
  await createDialog.waitFor({ state: 'visible' })
  const postInput = createDialog.getByRole('textbox', { name: 'Nội dung bài viết' })
  await postInput.fill('xinh quá nhé')
  const measureComposer = () => postInput.evaluate(field => ({
    height: field.getBoundingClientRect().height,
    contentHeight: field.scrollHeight,
    overflowY: getComputedStyle(field).overflowY,
    resize: getComputedStyle(field).resize,
  }))
  const shortComposer = await measureComposer()
  assert(shortComposer.height <= 85 && shortComposer.overflowY === 'hidden'
    && shortComposer.resize === 'none',
    'Short post text must not create a large editor or an internal scrollbar: ' + JSON.stringify(shortComposer))
  await postInput.fill(Array(30).fill('Hôm nay mình muốn chia sẻ một câu chuyện').join(' '))
  const longComposer = await measureComposer()
  assert(longComposer.height > shortComposer.height + 80
    && longComposer.height >= longComposer.contentHeight - 2,
    'Post editor should grow as the caption wraps: ' + JSON.stringify(longComposer))
  await postInput.fill('xinh quá nhé')
  const shrunkComposer = await measureComposer()
  assert(Math.abs(shrunkComposer.height - shortComposer.height) < 3,
    'Post editor must shrink again when text is removed: ' + JSON.stringify(shrunkComposer))
  await createDialog.getByRole('button', { name: 'Đóng tạo bài viết' }).click()
  await createDialog.waitFor({ state: 'detached' })
  if (process.argv.includes('--post-only')) {
    await page.setViewportSize({ width: 390, height: 844 })
    await verifyUncroppedFeedImage()
    console.log('Post card PASS: uncropped image on desktop/mobile, single heart, 4 equal actions', JSON.stringify(postGeometry))
    await browser.close()
    browser = null
    server.kill()
    process.exit(0)
  }
  await feed.getByRole('button', { name: 'Tạo Story mới' }).waitFor()
  await feed.getByRole('button', { name: 'Xem Story của Minh Anh' }).waitFor()
  await feed.getByRole('button', { name: 'Xem Story của Minh Anh' }).click()
  const storyDialog = page.getByRole('dialog', { name: 'Khoảnh khắc của Minh Anh' })
  await storyDialog.waitFor({ state: 'visible' })
  assert(await storyDialog.locator('.story-screen-people').isVisible(), 'S09 story list must be visible on desktop')
  assert(await storyDialog.locator('.story-screen-stage img').isVisible(), 'S09 story media must be visible')
  assert(await storyDialog.locator('.story-screen-insights').isVisible(), 'S09 story action panel must be visible')
  assert(await storyDialog.getByRole('button', { name: 'Xem hồ sơ' }).isVisible(), 'S09 profile action missing')
  const avatarStyle = await storyDialog.locator('.story-screen-person-avatar').first().evaluate(node => ({
    clip: getComputedStyle(node).overflow,
    shape: getComputedStyle(node).borderRadius,
    initials: getComputedStyle(node.querySelector('.avatar-initials')).position,
  }))
  assert(avatarStyle.clip === 'hidden' && avatarStyle.initials === 'absolute',
    'S09 avatar initials must be clipped behind the photo: ' + JSON.stringify(avatarStyle))
  const progress = storyDialog.locator('.story-screen-progress-track > span').first()
  const progressWidth = () => progress.evaluate(node => parseFloat(node.style.width || '0'))
  const firstProgress = await progressWidth()
  await page.waitForTimeout(450)
  const movingProgress = await progressWidth()
  assert(movingProgress > firstProgress, 'Image Story progress must increase while playing')
  await storyDialog.getByRole('button', { name: 'Tạm dừng Story' }).click()
  const pausedProgress = await progressWidth()
  await page.waitForTimeout(350)
  assert(Math.abs(await progressWidth() - pausedProgress) < 1, 'Image Story progress must stop when paused')
  await storyDialog.getByRole('button', { name: 'Tiếp tục Story' }).click()
  await page.waitForTimeout(350)
  assert(await progressWidth() > pausedProgress, 'Image Story progress must resume')
  if (process.argv.includes('--story-reply-only')) {
    const input = storyDialog.getByRole('textbox', { name: 'Trả lời Story của Minh Anh' })
    await input.fill('đẹp vậy')
    const focusStyle = await input.evaluate(element => ({
      outline: getComputedStyle(element).outlineStyle,
      shadow: getComputedStyle(element).boxShadow,
      border: getComputedStyle(element).borderRightWidth,
    }))
    assert(focusStyle.outline === 'none' && focusStyle.shadow === 'none' && focusStyle.border === '0px',
      'Story composer should not show a vertical input divider: ' + JSON.stringify(focusStyle))
    rejectStoryDirect = true
    const failedDirect = page.waitForResponse(response => response.url().includes('/api/conversations/direct') && response.request().method() === 'POST')
    await storyDialog.getByRole('button', { name: 'Trả lời Story', exact: true }).click()
    assert((await failedDirect).status() === 403, 'Test must cover failed direct lookup')
    await storyDialog.getByRole('button', { name: 'Trả lời Story', exact: true }).waitFor({ state: 'visible' })
    assert(await input.inputValue() === 'đẹp vậy' && await storyDialog.isVisible(),
      'Failed story reply must preserve draft and viewer')
    assert(storyReplyRequests.length === 0, 'Failed lookup must not send message')
    rejectStoryDirect = false
    const directResponse = page.waitForResponse(response => response.url().includes('/api/conversations/direct') && response.request().method() === 'POST' && response.status() === 200)
    const sendResponse = page.waitForResponse(response => response.url().includes('/api/conversations/1/messages') && response.request().method() === 'POST')
    await storyDialog.getByRole('button', { name: 'Trả lời Story', exact: true }).click()
    await directResponse
    assert((await sendResponse).ok(), 'Story reply should receive a successful chat send receipt')
    await storyDialog.waitFor({ state: 'hidden' })
    assert(storyReplyRequests.length === 1
      && storyReplyRequests[0].text.includes('đẹp vậy')
      && storyReplyRequests[0].text.startsWith('↪️ Trả lời Story')
      && typeof storyReplyRequests[0].clientId === 'string',
      'Reply Story must send a single contextual message using chat outbox: ' + JSON.stringify(storyReplyRequests))
    console.log('Story reply PASS: no focus divider; failed lookup keeps draft; single chat message with Story context')
    await browser.close()
    browser = null
    server.kill()
    process.exit(0)
  }
  await storyDialog.getByRole('button', { name: 'Đóng', exact: true }).click()
  await storyDialog.waitFor({ state: 'hidden' })
  if (process.argv.includes('--story-only')) {
    await page.setViewportSize({ width: 390, height: 844 })
    await feed.getByRole('button', { name: 'Xem Story của Minh Anh' }).evaluate(button => button.click())
    await storyDialog.waitFor({ state: 'visible' })
    assert(await storyDialog.locator('.story-screen-stage img').isVisible(), 'S09 mobile media must be visible')
    assert(!(await storyDialog.locator('.story-screen-people').isVisible()), 'S09 mobile people panel must collapse')
    assert(!(await storyDialog.locator('.story-screen-insights').isVisible()), 'S09 mobile insights panel must collapse')
    await storyDialog.waitFor({ state: 'hidden', timeout: 9000 })
    console.log('S09 Story viewer PASS: desktop/mobile, avatar clipping, ticking/pause/resume progress, auto-close after 7s')
    await browser.close()
    browser = null
    server.kill()
    process.exit(0)
  }
  await feed.locator('.social-feed-stories-card').getByRole('button', { name: 'Xem tất cả' }).click()
  assert(await feed.locator('.social-feed-story-strip.is-expanded').count() === 1, 'View all stories must expand story row')
  await feed.getByRole('button', { name: 'Thu gọn' }).click()
  await feed.locator('.social-feed-suggestion-row').first().waitFor({ state: 'visible' })
  await feed.locator('.social-feed-trend').first().waitFor({ state: 'visible' })
  mkdirSync('output/playwright/layout', { recursive: true })
  await page.screenshot({ path: 'output/playwright/layout/social-feed-desktop-1586.png' })
  const reactionTestStyle = await page.addStyleTag({ content: '.app-sidebar, .app-sidebar * { pointer-events: none !important }' })
  await feedCards.first().getByRole('button', { name: 'Lưu bài viết' }).click()
  await feedCards.first().getByRole('button', { name: 'Bỏ lưu bài viết' }).waitFor()
  assert(fixturePost.saved, 'Save button must call post save API and update state')

  // Post comments open as a dedicated desktop page, not the legacy modal.
  const commentsOnly = process.argv.includes('--comments-only')
  if (commentsOnly) {
    // The sidebar flyout covers the tiny feed action during test navigation.
    // Trigger the existing React click handler to exercise the comments page itself.
    await feedCards.first().getByRole('button', { name: 'Bình luận', exact: true })
      .evaluate(button => button.click())
  } else {
    await feedCards.first().getByRole('button', { name: 'Bình luận', exact: true }).click()
    await reactionTestStyle.evaluate(style => style.remove())
  }
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
  const commentsActions = commentsPage.locator('.post-comments-post-actions')
  assert(await commentsActions.locator('.feed-reaction-primary').count() === 1
    && await commentsActions.getByRole('button', { name: 'Bình luận' }).count() === 1
    && await commentsActions.getByRole('button', { name: 'Chia sẻ bài viết' }).count() === 1,
    'Post comments must reuse the compact feed reaction, comment and share actions')
  const commentsActionGeometry = await commentsActions.evaluate(node => {
    const buttons = [...node.querySelectorAll(':scope > button')]
    const bounds = node.getBoundingClientRect()
    return { display: getComputedStyle(node).display, width: bounds.width,
      buttons: buttons.map(button => button.getBoundingClientRect().width) }
  })
  assert(commentsActionGeometry.display === 'flex'
    && commentsActionGeometry.buttons.length === 2
    && commentsActionGeometry.buttons.every(width => width <= 42),
    'Post comments actions should be compact icons: ' + JSON.stringify(commentsActionGeometry))
  await commentsActions.locator('.feed-reaction-primary').hover()
  const commentsPicker = commentsActions.locator('.feed-reaction-picker')
  await commentsPicker.waitFor({ state: 'visible' })
  assert(await commentsPicker.locator('.feed-reaction-option').count() === 6,
    'Post comments must show the same six reaction choices as feed')
  const menuBounds = await commentsPicker.boundingBox()
  const postBounds = await commentsPage.locator('.post-comments-original').boundingBox()
  assert(menuBounds && postBounds && menuBounds.x >= postBounds.x
    && menuBounds.x + menuBounds.width <= postBounds.x + postBounds.width
    && menuBounds.y >= postBounds.y,
    'Reaction picker must fit within the post panel: ' + JSON.stringify({ menuBounds, postBounds }))
  await page.screenshot({ path: 'output/playwright/layout/post-comments-reaction-picker.png' })
  await page.mouse.move(700, 600)
  await commentsPicker.waitFor({ state: 'hidden' })
  await commentsActions.getByRole('button', { name: 'Bình luận' }).click()
  assert(await commentsPage.getByRole('textbox', { name: 'Viết bình luận' }).evaluate(node => node === document.activeElement),
    'Post comments action must focus the existing composer')
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
  if (commentsOnly) {
    console.log('Post comments UI PASS: shared reactions, compact actions, composer and responsive layout')
    await browser.close()
    browser = null
    server.kill()
    process.exit(0)
  }
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
  await page.locator('.chat-head .translate-controls button[aria-label="Thông tin hội thoại"]').click()
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
  await page.locator('.chat-head .translate-controls button[aria-label="Thông tin hội thoại"]').click()
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
  const workspace = page.locator('.settings-workspace')
  await workspace.waitFor({ state: 'visible' })
  assert(await workspace.getByRole('button', { name: 'Quyền riêng tư' }).getAttribute('aria-current') === 'page',
    'Desktop settings must open on the privacy section')
  const settingsGeometry = await page.evaluate(() => {
    const menu = document.querySelector('.settings-workspace-menu')?.getBoundingClientRect()
    const panel = document.querySelector('.settings-workspace-panel')?.getBoundingClientRect()
    return { menuRight: menu?.right, panelLeft: panel?.left, panelWidth: panel?.width }
  })
  assert(settingsGeometry.panelLeft > settingsGeometry.menuRight && settingsGeometry.panelWidth > 400,
    'Settings must show two readable columns: ' + JSON.stringify(settingsGeometry))
  await page.screenshot({ path: 'output/playwright/layout/settings-desktop.png' })
  const nameAudience = workspace.getByRole('combobox', { name: 'Ai tìm bằng tên hiển thị?' })
  assert(await nameAudience.inputValue() === 'private', 'Previously saved privacy must appear in settings')
  await nameAudience.selectOption('everyone')
  assert(storedPrivacy.searchableByName === false, 'Privacy draft must not save before confirmation')
  await workspace.getByRole('button', { name: 'Hủy', exact: true }).click()
  assert(await nameAudience.inputValue() === 'private', 'Cancel must restore saved privacy')
  await nameAudience.selectOption('everyone')
  await workspace.getByRole('button', { name: 'Lưu thay đổi' }).click()
  await workspace.locator('.settings-workspace-save:disabled').waitFor()
  assert(storedPrivacy.searchableByName === true, 'Save changes must persist privacy through /api/privacy')
  await workspace.getByRole('button', { name: 'Ngôn ngữ & dịch AI' }).click()
  await workspace.locator('.app-locale-row').click()
  await page.locator('.locale-picker-overlay').waitFor({ state: 'visible' })
  await page.locator('.locale-picker-sheet header button').click()
  await workspace.getByRole('button', { name: 'Thông tin tài khoản' }).click()
  await workspace.getByRole('button', { name: 'Chỉnh sửa hồ sơ' }).click()
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