import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { createServer } from 'node:net'
import { resolve } from 'node:path'
import { mkdirSync } from 'node:fs'
import { setTimeout as delay } from 'node:timers/promises'
import assert from 'node:assert/strict'

const port = await new Promise((done, reject) => {
  const probe = createServer()
  probe.once('error', reject)
  probe.listen(0, '127.0.0.1', () => {
    const value = probe.address().port
    probe.close(() => done(value))
  })
})
const origin = 'http://127.0.0.1:' + port
const vite = spawn(process.execPath, [resolve('node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { stdio: 'ignore' })
const session = {
  token: 'mock.' + Buffer.from(JSON.stringify({ exp: 4102444800 })).toString('base64url') + '.signed',
  refreshToken: 'r'.repeat(43),
  sessionId: 'adaptive-pwa-test',
  user: { id: 1, username: 'viewer', displayName: 'Người xem', email: 'viewer@example.invalid' },
}
const now = new Date().toISOString()
const conversations = [
  { id: 101, type: 'direct', name: 'Linh Anh', otherUserId: 2, otherUsername: 'linhanh', memberCount: 2, unreadCount: 2, online: true, lastMessage: 'Hẹn gặp lại nhé!', lastMessageAt: now, createdAt: now },
  { id: 102, type: 'group', name: 'SocCo Design Team', memberCount: 4, unreadCount: 0, online: false, lastMessage: 'Cập nhật giao diện', lastMessageAt: now, createdAt: now },
]
const messages = [
  { id: 201, conversationId: 101, senderId: 2, sender: 'linhanh', senderDisplayName: 'Linh Anh', text: 'Xin chào bạn!', createdAt: now, attachments: [], readByUserIds: [] },
  { id: 202, conversationId: 101, senderId: 1, sender: 'viewer', senderDisplayName: 'Người xem', text: 'Chào bạn!', createdAt: now, attachments: [], readByUserIds: [2] },
  { id: 203, conversationId: 101, senderId: 2, sender: 'linhanh', senderDisplayName: 'Linh Anh', text: 'Ừ', createdAt: now, attachments: [], readByUserIds: [],
    reactions: [{ emoji: '👍', count: 2, mine: false }, { emoji: '❤️', count: 1, mine: false }] },
  { id: 204, conversationId: 101, senderId: 1, sender: 'viewer', senderDisplayName: 'Người xem', text: 'a', forwarded: true, createdAt: now, attachments: [], readByUserIds: [2],
    reactions: [{ emoji: '👍', count: 2, mine: true }, { emoji: '❤️', count: 1, mine: false }, { emoji: '😂', count: 3, mine: false }, { emoji: '🔥', count: 1, mine: false }] },
]
const reactionUsers = [
  { userId: 2, username: 'linhanh', displayName: 'Linh Anh', emoji: '❤️' },
  { userId: 1, username: 'viewer', displayName: 'Người xem', emoji: '❤️' },
]
const feedPosts = [
  { id: 301, author: 'viewer', authorDisplayName: 'Người xem', content: 'Bài viết thử nghiệm',
    likes: 2, liked: true, myReaction: '❤️', reactions: [{ emoji: '❤️', count: 2 }],
    comments: [], attachments: [], visibility: 'public', createdAt: now },
]
const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'Authorization, Content-Type', 'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS' }
let browser
mkdirSync('output/playwright/layout', { recursive: true })
try {
  let ready = false
  for (let i = 0; i < 70; i++) {
    try { ready = (await fetch(origin)).ok; if (ready) break } catch { /* starting */ }
    await delay(150)
  }
  assert.ok(ready, 'Vite did not start')
  browser = await chromium.launch({ headless: true })
  for (const width of [320, 375, 390, 430, 768, 1440]) {
    const phone = width <= 760
    const context = await browser.newContext({
      viewport: { width, height: phone ? 844 : 900 }, deviceScaleFactor: 1,
      serviceWorkers: 'block', isMobile: phone, hasTouch: phone,
    })
    await context.addInitScript(value => {
      localStorage.setItem('chatnet-session', JSON.stringify(value))
      // Never connect to a real account or remote realtime server in visual QA.
      window.EventSource = class { addEventListener() {} close() {} }
    }, session)
    const page = await context.newPage()
    let failFriendsOnce = false
    let optionalContactsFinished = width !== 320
    let callHistoryRevision = 0
    let forwardedPayload = null
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.route(url => url.pathname.startsWith('/api/'), async route => {
      const req = route.request()
      const path = new URL(req.url()).pathname
      const json = (payload, status = 200) => route.fulfill({ status, contentType: 'application/json', headers: cors, body: JSON.stringify(payload) })
      if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors })
      if (path === '/api/calls/history') return json([
        { id: 'call-201', conversationId: 101, createdBy: 2, mediaType: 'audio', status: 'ended',
          createdAt: now, startedAt: now, endedAt: now, joined: false, declined: false, isGroup: false, participantCount: 0 },
        { id: 'call-202', conversationId: 102, createdBy: 1, mediaType: 'video', status: 'ended',
          createdAt: now, startedAt: now, endedAt: now, joined: true, declined: false, isGroup: true, participantCount: 2 },
        ...(callHistoryRevision ? [{ id: 'call-203', conversationId: 101, createdBy: 1, mediaType: 'audio', status: 'ended',
          createdAt: now, startedAt: now, endedAt: now, joined: true, declined: false, isGroup: false, participantCount: 2 }] : []),
      ])
      if (/^\/api\/messages\/\d+\/reactions$/.test(path) && req.method() === 'GET')
        return json({ items: reactionUsers.map(user => ({ ...user, emoji: '👍' })), hasMore: false })
      if (/^\/api\/posts\/\d+\/reactions$/.test(path) && req.method() === 'GET')
        return json({ items: reactionUsers, hasMore: false })
      if (/^\/api\/conversations\/\d+\/messages$/.test(path) && req.method() === 'POST') {
        forwardedPayload = JSON.parse(req.postData() || '{}')
        return json({ id: 999 }, 201)
      }
      if (path === '/api/conversations') return json(conversations)
      if (path === '/api/conversations/memberships') return json({ ids: conversations.map(c => c.id), nextAfter: null })
      if (path === '/api/conversation-categories') return json([])
      if (path === '/api/contacts' && width === 320) {
        await delay(1800)
        optionalContactsFinished = true
        return json({ error: 'Optional contact metadata unavailable' }, 503)
      }
      if (/^\/api\/conversations\/\d+\/messages$/.test(path)) return json(messages)
      if (path === '/api/friends' && failFriendsOnce) {
        failFriendsOnce = false
        return json({ error: 'Temporary friend API outage' }, 503)
      }
      if (path === '/api/friends') return json([{ id: 2, username: 'linhanh', displayName: 'Linh Anh', status: 'accepted', online: true }, { id: 3, username: 'hoangnam', displayName: 'Hoàng Nam', status: 'accepted', online: false }, { id: 4, username: 'maihuong', displayName: 'Mai Hương', status: 'accepted', online: true }])
      if (path === '/api/preferences' || path === '/api/preferences/translation') return json({ targetLanguage: 'vi', autoTranslate: false, appLocale: 'vi' })
      if (path === '/api/push/config') return json({ configured: false })
      if (path === '/api/friends/requests') return json([{ id: 11, username: 'linh2', displayName: 'Linh Trần', status: 'pending', direction: 'incoming' }, { id: 12, username: 'nam2', displayName: 'Nam Nguyễn', status: 'pending', direction: 'outgoing' }])
      if (path === '/api/profile') return json({ username: 'viewer', displayName: 'Người xem', avatarSet: false, coverSet: false })
      if (path === '/api/posts') return json(feedPosts)
      if (path === '/api/stories' || path === '/api/friends/requests' || path === '/api/groups/public') return json([])
      return json([])
    })
    await page.goto(origin)
    const list = page.locator('.social-chat-layout .conversation-sidebar')
    await list.waitFor({ state: 'visible', timeout: 15000 })
    await page.locator('.conversation-item').first().waitFor({ state: 'visible' })
    const bottom = page.locator('.bottom-navigation')
    const rail = page.locator('.app-sidebar')
    const header = page.locator('.social-chat-list-header')
    if (phone) {
      assert.equal(await rail.isVisible(), false, width + ': desktop rail must be hidden')
      assert.equal(await bottom.isVisible(), true, width + ': bottom tabs must remain visible')
      assert.equal(await bottom.locator('button').count(), 6, width + ': six original tabs')
      assert.equal(await bottom.locator('.nav-label:visible').count(), 6, width + ': six visible labels')
      assert.equal(await header.isVisible(), true, width + ': chat search/filters header must be visible')
      assert.equal(await header.locator('.social-chat-list-search').count(), 0, width + ': redundant list search removed')
      assert.equal(await page.locator('.mobile-chat-appbar .appbar-search-anchor').count(), 0, width + ': top search moved out of appbar')
      assert.equal(await page.locator('.appbar-search-anchor input').count(), 1, width + ': exactly one quick-search input')
      const quickSearch = header.locator('.appbar-search-anchor input')
      assert.equal(await quickSearch.isVisible(), true, width + ': existing quick search relocated under conversation title')
      assert.equal(await header.locator('.social-chat-list-filters').isVisible(), true, width + ': chat filters')
      const compact = await page.evaluate(() => {
        const heading = document.querySelector('.social-chat-list-title')
        const search = document.querySelector('.social-chat-list-header .appbar-search')
        const filters = [...document.querySelectorAll('.social-chat-list-filters button')]
        const category = document.querySelector('.conversation-categories .category-filter-trigger')
        const icon = category.querySelector('.category-filter-mobile-icon')
        const list = document.querySelector('.zalo-conversation-list')
        return { hiddenHeading: getComputedStyle(heading).display === 'none',
          searchHeight: search.getBoundingClientRect().height,
          filterTop: filters[0].getBoundingClientRect().top,
          filterRight: filters.at(-1).getBoundingClientRect().right,
          categoryTop: category.getBoundingClientRect().top,
          categoryLeft: category.getBoundingClientRect().left,
          visibleIcon: getComputedStyle(icon).display !== 'none',
          listTop: list.getBoundingClientRect().top }
      })
      assert.ok(compact.hiddenHeading && compact.searchHeight <= 42 && compact.visibleIcon,
        width + ': compact mobile heading, search and category icon: ' + JSON.stringify(compact))
      assert.ok(Math.abs(compact.filterTop - compact.categoryTop) <= 3 && compact.filterRight < compact.categoryLeft,
        width + ': all filters and the category icon share one row without overlap: ' + JSON.stringify(compact))
      assert.ok(compact.listTop < 235, width + ': conversation list begins high enough to show more messages')
      await quickSearch.fill('Linh')
      await header.locator('.chat-quick-search').waitFor({ state: 'visible' })
      await quickSearch.fill('')
      assert.equal(await page.locator('.social-chat-groups-link').count(), 0, width + ': standalone groups shortcut removed')
      assert.equal(await header.locator('.social-chat-list-filters').getByRole('button', { name: 'Nhóm' }).isVisible(), true, width + ': groups are accessible in chat filters')
      assert.equal(await page.locator('.social-chat-new').isVisible(), false, width + ': redundant lower new-chat button hidden')
      assert.equal(await page.locator('.appbar-create-trigger').isVisible(), true, width + ': top create menu stays available')
      const viewport = await page.evaluate(() => ({ width: innerWidth, pageWidth: document.documentElement.scrollWidth }))
      assert.ok(viewport.pageWidth <= viewport.width + 1, width + ': document has horizontal overflow: ' + JSON.stringify(viewport))
      const tabs = await bottom.locator('button').evaluateAll(nodes => nodes.map(node => {
        const box = node.getBoundingClientRect()
        return { x: box.x, right: box.right, height: box.height }
      }))
      assert.ok(tabs.every(tab => tab.x >= -1 && tab.right <= width + 1 && tab.height >= 44), width + ': tabs must fit the screen and remain touch-friendly')
      assert.equal(await page.locator('.conversation-pin-menu-trigger').count(), 0,
        width + 'px: no ellipsis beside conversations')
      if (width === 390) {
        const entry = page.locator('.conversation-pin-entry').first()
        const bounds = await entry.boundingBox()
        const pointer = { pointerType: 'touch', clientX: bounds.x + 20, clientY: bounds.y + 20, button: 0 }
        await entry.dispatchEvent('pointerdown', pointer)
        await page.waitForTimeout(600)
        await page.getByRole('button', { name: 'Ghim cuộc trò chuyện' }).waitFor({ state: 'visible' })
        await entry.dispatchEvent('pointerup', pointer)
        await page.locator('.message-context-cancel').click()
        // Long-press must not also activate the conversation when the finger is lifted.
        await entry.locator('.conversation-item').click()
        assert.equal(await page.locator('.social-chat-layout.has-active').count(), 0)
      }
      await page.screenshot({ path: 'output/playwright/layout/adaptive-chat-list-' + width + '.png' })
      await page.locator('.conversation-item').first().click()
      await page.locator('.social-chat-layout .conversation-panel').waitFor({ state: 'visible' })
      assert.equal(await bottom.isVisible(), false, width + ': tabs hidden in conversation detail')
      assert.equal(await page.locator('.chatnet-appbar').isVisible(), false, width + ': compact header hidden in detail')
      const imageButton = page.getByRole('button', { name: 'Đính kèm ảnh hoặc video' })
      assert.equal(await imageButton.isVisible(), true, width + ': photo picker must remain visible')
      const imageIcon = await imageButton.evaluate(button => {
        const outer = button.getBoundingClientRect()
        const inner = button.querySelector('svg').getBoundingClientRect()
        return {
          offsetX: Math.abs((inner.left + inner.width / 2) - (outer.left + outer.width / 2)),
          offsetY: Math.abs((inner.top + inner.height / 2) - (outer.top + outer.height / 2)),
          size: inner.width, buttonWidth: outer.width,
        }
      })
      assert.ok(imageIcon.offsetX <= 2 && imageIcon.offsetY <= 2 && imageIcon.size >= 19 && imageIcon.size <= 21,
        width + 'px: image picker icon should be 20px and perfectly centered: ' + JSON.stringify(imageIcon))
      const actionShapes = await page.locator('.media-composer').evaluate(form =>
        ['.attach-button', '.chat-composer-image', '.voice-record-trigger'].map(sel => {
          const button = form.querySelector(sel)
          const icon = button.querySelector('svg:not(.chat-composer-plus)')
          const b = button.getBoundingClientRect()
          const i = icon.getBoundingClientRect()
          const s = getComputedStyle(button)
          return {
            width:b.width, height:b.height, radius:s.borderRadius, bg:s.backgroundColor, color:s.color,
            iconWidth:i.width, iconHeight:i.height,
            dx:Math.abs(b.left + b.width/2 - i.left - i.width/2),
            dy:Math.abs(b.top + b.height/2 - i.top - i.height/2),
          }
        }))
      assert.ok(actionShapes.every(a => a.width === actionShapes[0].width && a.height === actionShapes[0].height &&
        a.radius === actionShapes[0].radius && a.bg === actionShapes[0].bg && a.color === actionShapes[0].color &&
        a.iconWidth === 20 && a.iconHeight === 20 && a.dx <= 2 && a.dy <= 2),
        width + 'px: file, image and microphone buttons must have matching shape and centered icons: ' +
        JSON.stringify(actionShapes))
      assert.equal(await page.locator('[data-message-id="204"] .chat-forwarded-caption').textContent(),
        'Đã chuyển tiếp 1 tin nhắn', width + ': forwarded label must render above the message bubble')
      assert.equal(await page.locator('[data-message-id="203"] .chat-forwarded-caption').count(), 0,
        width + ': ordinary messages must not display forwarding label')
      assert.equal(await page.locator('[data-message-id="204"] .chat-forwarded-caption').evaluate(
        el => el.nextElementSibling?.classList.contains('bubble'),
      ), true, width + ': forwarded label must be immediately above the message bubble')
      const reactions = await page.evaluate(() => [203, 204].map(id => {
        const message = document.querySelector('[data-message-id="' + id + '"]')
        const scroll = document.querySelector('.social-chat-layout .messages')?.getBoundingClientRect()
        const bubble = message?.querySelector('.bubble')?.getBoundingClientRect()
        const row = message?.querySelector('.message-reactions')?.getBoundingClientRect()
        const chips = [...(message?.querySelectorAll('.message-reactions button') || [])].map(el => {
          const rect = el.getBoundingClientRect()
          return { left:rect.left,right:rect.right,width:rect.width,scrollWidth:el.scrollWidth }
        })
        return { id, isMine:message?.classList.contains('mine'), scroll:{left:scroll?.left,right:scroll?.right},
          bubble:{left:bubble?.left,right:bubble?.right,width:bubble?.width}, row:{left:row?.left,right:row?.right},chips }
      }))
      for (const react of reactions) {
        assert.ok(react.bubble.width < 85, width + 'px: regression sample must use short bubbles')
        assert.ok(react.row.left >= react.scroll.left - 1 && react.row.right <= react.scroll.right + 1,
          width + 'px: reaction row must remain inside the message viewport: ' + JSON.stringify(react))
        assert.ok(react.chips.every(chip => chip.width >= chip.scrollWidth - 1 &&
          chip.left >= react.scroll.left - 1 && chip.right <= react.scroll.right + 1),
          width + 'px: individual reactions must not shrink or be clipped: ' + JSON.stringify(react))
        assert.ok(Math.abs(react.row.right - react.bubble.right) <= 2 || (!react.isMine && react.row.right >= react.bubble.right),
          width + 'px: reaction must stay anchored to its short bubble: ' + JSON.stringify(react))
      }
      if (width === 390) {
        await page.locator('[data-message-id="203"] .reaction-chip').first().click()
        const dialog = page.getByRole('dialog', { name: 'Cảm xúc tin nhắn' })
        await dialog.waitFor({ state: 'visible' })
        await dialog.locator('.reaction-users-person').first().waitFor()
        assert.equal(await dialog.locator('.reaction-users-person').count(), 2,
          'Chat reaction should show users who reacted to the selected message')
        assert.ok(await dialog.getByText('Linh Anh', { exact: true }).isVisible())
        await dialog.getByRole('button', { name: 'Đóng danh sách cảm xúc' }).click()
        await dialog.waitFor({ state: 'hidden' })
        console.log('PASS: chat reaction participant list on PWA phone')
        const mobileBubble = page.locator('[data-message-id="203"] .bubble')
        const mobileBounds = await mobileBubble.boundingBox()
        const touch = { pointerType: 'touch', button: 0, clientX: mobileBounds.x + 15, clientY: mobileBounds.y + 15 }
        await mobileBubble.dispatchEvent('pointerdown', touch)
        await page.waitForTimeout(550)
        const actions = page.getByRole('dialog', { name: 'Tùy chọn tin nhắn' })
        await actions.waitFor({ state: 'visible' })
        assert.equal(await actions.getByRole('button', { name: 'Chuyển tiếp' }).count(), 1,
          'Mobile long-press must offer the same forward action')
        await mobileBubble.dispatchEvent('pointerup', touch)
        await actions.getByRole('button', { name: 'Đóng' }).click()
        console.log('PASS: PWA mobile long-press includes forwarding')
      }
      await page.screenshot({ path: 'output/playwright/layout/adaptive-chat-detail-' + width + '.png' })
      await page.getByRole('button', { name: 'Quay lại danh sách' }).click()
      assert.equal(await bottom.isVisible(), true, width + ': bottom tabs restored on back')
      assert.equal(await header.isVisible(), true, width + ': list restored on back')
    } else {
      assert.equal(await rail.isVisible(), true, width + ': desktop sidebar visible')
      assert.equal(await bottom.isVisible(), false, width + ': no duplicate desktop tabs')
      assert.equal(await header.isVisible(), true, width + ': conversation filters')
      await page.locator('.conversation-item').first().click()
      await page.locator('.conversation-panel').waitFor({ state: 'visible' })
      const split = await page.locator('.social-chat-layout').evaluate(el => getComputedStyle(el).gridTemplateColumns)
      assert.ok(split.split(' ').length >= 2, width + ': desktop must have split columns: ' + split)
      if (width === 1440) {
        const message = page.locator('[data-message-id="203"]')
        const bubble = message.locator('.bubble')
        const toolbar = message.locator('.chat-message-hover-toolbar')
        assert.equal(await toolbar.evaluate(el => getComputedStyle(el).visibility), 'hidden',
          'Action toolbar must be hidden until hovering')
        await bubble.hover()
        await page.waitForTimeout(240)
        assert.equal(await toolbar.evaluate(el => getComputedStyle(el).visibility), 'visible',
          'Hovering the message should reveal quick actions')
        assert.equal(await message.locator('.reaction-add').evaluate(el => getComputedStyle(el).opacity), '1',
          'Reaction picker should appear on bubble hover')
        for (const action of ['Trả lời tin nhắn', 'Chuyển tiếp tin nhắn', 'Dịch tin nhắn', 'Thêm tùy chọn tin nhắn']) {
          assert.equal(await toolbar.getByRole('button', { name: action }).count(), 1,
            'Missing desktop hover action: ' + action)
        }
        const toolbarBox = await toolbar.boundingBox()
        const bubbleBox = await bubble.boundingBox()
        const scrollerBox = await page.locator('.social-chat-layout .messages').boundingBox()
        assert.ok(toolbarBox.x >= scrollerBox.x - 1 && toolbarBox.x + toolbarBox.width <= scrollerBox.x + scrollerBox.width + 1,
          'Hover toolbar must fit inside conversation viewport')
        assert.ok(toolbarBox.height >= 37 && toolbarBox.height <= 41 && toolbarBox.width < 170,
          'Keep the quick-action toolbar compact while expanding only its invisible hover bridge: ' + JSON.stringify(toolbarBox))
        assert.equal(await toolbar.getByRole('button', { name: 'Trả lời tin nhắn' }).locator('svg.lucide-corner-up-left').count(), 1,
          'Reply should use the corner-up-left icon')
        const buttonSize = await toolbar.getByRole('button', { name: 'Trả lời tin nhắn' }).boundingBox()
        assert.ok(buttonSize.width === 31 && buttonSize.height === 31,
          'Keep the original 31px toolbar button size')
        // Crossing the gap should not collapse the hover state: the hitbox
        // bridge spans the bubble edge and the toolbar's near side.
        const crossY = toolbarBox.y + toolbarBox.height / 2
        await page.mouse.move(bubbleBox.x + bubbleBox.width - 2, crossY)
        const gapX = (bubbleBox.x + bubbleBox.width + toolbarBox.x) / 2
        await page.mouse.move(gapX, crossY)
        assert.equal(await toolbar.evaluate(el => getComputedStyle(el).visibility), 'visible',
          'Hover must survive moving across the bubble-toolbar gap')
        await page.mouse.move(toolbarBox.x + 22, crossY)
        assert.equal(await toolbar.evaluate(el => getComputedStyle(el).visibility), 'visible',
          'Toolbar should stay open when the pointer reaches its first button')

        // Own messages show the toolbar on the opposite side, with the
        // action order visually mirrored and enough room for a 40px click.
        const ownMessage = page.locator('[data-message-id="204"]')
        await ownMessage.locator('.bubble').hover()
        const ownToolbar = ownMessage.locator('.chat-message-hover-toolbar')
        const ownBar = await ownToolbar.boundingBox()
        const ownBubble = await ownMessage.locator('.bubble').boundingBox()
        assert.ok(ownBar.x + ownBar.width <= ownBubble.x + 1,
          'Own message quick actions should appear left of its bubble')
        assert.equal(await ownToolbar.evaluate(el => getComputedStyle(el).flexDirection), 'row-reverse',
          'Own message action order must mirror incoming messages')
        assert.ok(ownBar.height >= 37 && ownBar.height <= 41 && ownBar.width < 170,
          'Own-message toolbar must stay compact')
        const ownCrossY = ownBar.y + ownBar.height / 2
        await page.mouse.move(ownBubble.x + 2, ownCrossY)
        await page.mouse.move((ownBubble.x + ownBar.x + ownBar.width) / 2, ownCrossY)
        assert.equal(await ownToolbar.evaluate(el => getComputedStyle(el).visibility), 'visible',
          'Own message hover must survive crossing the mirrored gap')
        await page.mouse.move(ownBar.x + ownBar.width - 22, ownCrossY)
        assert.equal(await ownToolbar.evaluate(el => getComputedStyle(el).visibility), 'visible',
          'Own message toolbar should stay open under the pointer')
        await bubble.hover()
        await toolbar.getByRole('button', { name: 'Trả lời tin nhắn' }).click()
        const cancelReply = page.getByRole('button', { name: 'Hủy trả lời' })
        await cancelReply.waitFor({ state: 'visible' })
        await cancelReply.click()
        await page.mouse.move(0, 0)
        await page.waitForTimeout(180)
        assert.equal(await toolbar.evaluate(el => getComputedStyle(el).visibility), 'hidden')
        assert.equal(await message.locator('.reaction-chip').first().isVisible(), true,
          'Existing reactions must stay visible after mouse leaves')
        await bubble.hover()
        await toolbar.getByRole('button', { name: 'Thêm tùy chọn tin nhắn' }).click()
        const menu = page.getByRole('dialog', { name: 'Tùy chọn tin nhắn' })
        await menu.waitFor({ state: 'visible' })
        assert.equal(await menu.getByRole('button', { name: 'Ghim tin nhắn' }).count(), 1,
          'The ellipsis menu must reuse the right-click actions')
        assert.equal(await menu.getByRole('button', { name: 'Chuyển tiếp' }).count(), 1,
          'The ellipsis menu must include forwarding')
        await menu.getByRole('button', { name: 'Đóng' }).click()
        await bubble.hover()
        await toolbar.getByRole('button', { name: 'Chuyển tiếp tin nhắn' }).click()
        const picker = page.getByRole('dialog', { name: 'Chuyển tiếp tin nhắn' })
        await picker.waitFor({ state: 'visible' })
        await picker.getByRole('button', { name: /SocCo Design Team/ }).click()
        await picker.waitFor({ state: 'hidden' })
        assert.equal(forwardedPayload?.text, 'Ừ', 'Forward should send the original message to another conversation')
        assert.equal(forwardedPayload?.forwarded, true, 'Forward request must persist forwarding metadata')
        console.log('PASS: compact desktop hover toolbar, expanded hit area, mirrored controls and forwarding')
      }
      await page.screenshot({ path: 'output/playwright/layout/adaptive-chat-desktop-' + width + '.png' })
    }
    if (phone) await bottom.locator('button').nth(2).click()
    else await rail.getByRole('button', { name: 'Bạn bè' }).click()
    await page.locator('.friends-design-v2 .fd-searchbar').waitFor({ state: 'visible' })
    await page.locator('.fd-person-row').first().waitFor({ state: 'visible', timeout: 8000 })
    if (width === 320) assert.equal(optionalContactsFinished, false,
      'Mobile friends must render before slow optional contact metadata finishes')
    if (phone) {
      assert.equal(await page.locator('.fd-inline-profile').count(), 0, 'no friend details should open by default on mobile')
      const firstFriend = page.locator('.fd-person-row .fd-person-identity').first()
      await firstFriend.click()
      assert.equal(await page.locator('.fd-inline-profile').count(), 1, 'only the tapped friend should expand')
      assert.equal(await page.locator('.fd-profile-panel').isVisible(), false, 'mobile must not show the separate profile panel')
      assert.equal(await page.locator('.friends-design-v2:not(.is-call-directory) .fd-person-row .fd-icon-btn').count(), 0, 'adjacent call and message buttons must not exist in friends list')
      assert.ok(await page.locator('.fd-inline-profile').evaluate(el => el.previousElementSibling?.classList.contains('fd-person-row')),
        'friend details must appear immediately after the tapped user')
      await firstFriend.click()
      assert.equal(await page.locator('.fd-inline-profile').count(), 0, 'tapping an expanded friend should collapse details')
      await page.locator('.fd-person-row .fd-person-identity').nth(1).click()
      assert.equal(await page.locator('.fd-inline-profile').count(), 1)
      assert.ok(await page.locator('.fd-inline-profile').evaluate(el => el.previousElementSibling?.textContent?.includes('Linh Anh') || el.previousElementSibling?.classList.contains('expanded')),
        'the expanded details belong to the selected row')
    }
    const audit = await page.evaluate(() => {
      const selectors = ['.modern-frame','.friends-design-v2','.fd-searchbar','.fd-searchbar label','.fd-add-new','.fd-directory-layout','.fd-list-card','.fd-list-header','.fd-filters','.fd-person-list','.fd-person-row','.fd-profile-panel','.bottom-navigation','.chatnet-appbar']
      const measure = sel => {
        const el = document.querySelector(sel)
        if (!el) return null
        const r=el.getBoundingClientRect()
        return { x:Math.round(r.x), y:Math.round(r.y), w:Math.round(r.width), h:Math.round(r.height), right:Math.round(r.right), bottom:Math.round(r.bottom), scrollH:el.scrollHeight, clientH:el.clientHeight, overflow:getComputedStyle(el).overflowY }
      }
      const buttons = [...document.querySelectorAll('.fd-person-row:first-child button,.fd-filters button')].map(el => {
        const r=el.getBoundingClientRect()
        return { name:el.getAttribute('aria-label')||el.textContent.trim().slice(0,25),x:Math.round(r.x),right:Math.round(r.right),y:Math.round(r.y),bottom:Math.round(r.bottom) }
      })
      return { widths: {viewport:innerWidth, document:document.documentElement.scrollWidth}, boxes: Object.fromEntries(selectors.map(s=>[s,measure(s)])), buttons }
    })
    assert.ok(audit.widths.document <= audit.widths.viewport + 1,
      width + 'px: contacts must not overflow horizontally')
    if (phone) {
      const bounds = audit.boxes
      assert.ok(bounds['.fd-profile-panel'].h === 0, width + 'px: separate friend profile panel must be hidden on phones')
      assert.ok(bounds['.fd-searchbar'].bottom + 8 <= bounds['.fd-list-card'].y,
        width + 'px: search bar overlaps directory list')
      assert.ok(bounds['.friends-design-v2'].bottom <= bounds['.bottom-navigation'].y + 1,
        width + 'px: contact scrolling must stop above the fixed bottom tabs')
      const navTop = bounds['.bottom-navigation'].y
      const scroller = page.locator('.friends-design-v2')
      await scroller.evaluate(el => { el.scrollTop = el.scrollHeight })
      await page.locator('.fd-inline-profile').evaluate(el => el.scrollIntoView({ block: 'end' }))
      const scrolledProfile = await page.locator('.fd-inline-profile').boundingBox()
      assert.ok(scrolledProfile && scrolledProfile.y + scrolledProfile.height <= navTop - 5,
        width + 'px: inline friend details must be fully reachable without bottom tabs covering them: ' +
        JSON.stringify(scrolledProfile))
      await scroller.evaluate(el => { el.scrollTop = 0 })
      await page.getByRole('button', { name: 'Đang online' }).click()
      assert.equal(await page.locator('.fd-person-row').count(), 2,
        width + 'px: contacts filter must work after responsive layout changes')
      await page.getByRole('button', { name: 'A – Z' }).click()
      assert.equal(await page.locator('.fd-person-row').count(), 3)
      if (width === 390) {
        failFriendsOnce = true
        await page.getByRole('button', { name: 'Tải lại danh sách bạn bè' }).click()
        await page.getByRole('alert').getByText('Không thể tải danh sách bạn bè. Kiểm tra kết nối và thử lại.').waitFor()
        assert.equal(await page.locator('.fd-person-row').count(), 3,
          'A failed refresh must preserve previously loaded friend records')
        await page.getByRole('button', { name: 'Thử lại', exact: true }).click()
        await page.getByRole('alert').getByText('Không thể tải danh sách bạn bè. Kiểm tra kết nối và thử lại.').waitFor({ state: 'hidden' })
        assert.equal(await page.locator('.fd-person-row').count(), 3)
        console.log('PASS: mobile Contacts preserve friends during network failure and retry')
      }
      await page.screenshot({ path: 'output/playwright/layout/adaptive-contacts-' + width + '.png' })
      await page.getByRole('button', { name: 'Kết bạn mới' }).click()
      const invite = await page.evaluate(() => {
        const names = ['.fd-invitation-tabs','.fd-invitation-tabs > div','.fd-invitation-layout','.fd-invitation-list','.fd-request-row','.fd-qr-panel','.bottom-navigation']
        return Object.fromEntries(names.map(n => { const el=document.querySelector(n),r=el?.getBoundingClientRect();return [n,r?{x:r.x,y:r.y,right:r.right,bottom:r.bottom,scrollHeight:el.scrollHeight,clientHeight:el.clientHeight}:null] }))
      })
      assert.ok(invite['.fd-qr-panel'].y >= invite['.fd-invitation-list'].bottom + 8,
        width + 'px: QR card overlaps invitation list: ' + JSON.stringify(invite))
      const requestRow = page.locator('.fd-request-row').first()
      const row = await requestRow.evaluate(el => {
        const name = el.querySelector('.fd-request-copy')?.getBoundingClientRect()
        const buttons = [...el.querySelectorAll('button')].map(b => b.getBoundingClientRect())
        return { nameBottom:name?.bottom, buttonTops:buttons.map(b=>b.top), right:el.getBoundingClientRect().right, buttonRights:buttons.map(b=>b.right) }
      })
      assert.ok(row.buttonTops.every(y => y >= row.nameBottom - 1) &&
        row.buttonRights.every(x => x <= row.right + 1),
        width + 'px: invitation actions must sit below the name and inside their card: ' + JSON.stringify(row))
      await page.screenshot({ path: 'output/playwright/layout/adaptive-invitations-' + width + '.png' })
      await page.locator('.friends-design-v2').evaluate(el => { el.scrollTop = el.scrollHeight })
      const qrBottom = await page.locator('.fd-qr-panel').evaluate(el => el.getBoundingClientRect().bottom)
      assert.ok(qrBottom <= invite['.bottom-navigation'].y - 5,
        width + 'px: QR card must be reachable without overlapping bottom tabs')
      await page.getByRole('tab', { name: 'Đã gửi' }).click()
      assert.ok(await page.getByRole('button', { name: 'Hủy lời mời' }).count() > 0)
      await page.getByRole('tab', { name: 'Quét QR' }).click()
      assert.ok(await page.getByRole('button', { name: 'Mở trình quét QR' }).isVisible())
      console.log('PASS: mobile Contacts and Invitations do not overlap at ' + width + 'px')
    } else {
      assert.ok(audit.boxes['.fd-profile-panel'].x >= audit.boxes['.fd-list-card'].right + 8,
        width + 'px: desktop Contacts must keep two columns')
    }
    if (phone) await bottom.locator('button').nth(1).click()
    else await rail.getByRole('button', { name: 'Cuộc gọi' }).click()
    await page.locator('.call-center.is-embedded').waitFor({ state: 'visible' })
    await page.locator('.call-history-item').first().waitFor({ state: 'visible', timeout: 8000 })
    assert.equal(await page.locator('.call-history-item').count(), 2,
      width + 'px: call history must display actual server entries')
    assert.ok(await page.getByText('Gọi nhỡ', { exact: true }).count() > 0,
      width + 'px: missed calls must be discoverable')
    await page.getByRole('button', { name: 'Đã gọi', exact: true }).click()
    assert.equal(await page.locator('.call-history-item').count(), 1)
    await page.getByRole('button', { name: 'Tất cả', exact: true }).click()
    if (width === 390) {
      callHistoryRevision = 1
      await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
      await page.waitForFunction(() => document.querySelectorAll('.call-history-item').length === 3)
      console.log('PASS: mobile call history refreshes after app returns to foreground')
    }
    if (phone) {
      const layout = await page.evaluate(() => {
        const screen = document.querySelector('.call-center-workspace')?.getBoundingClientRect()
        const list = document.querySelector('.call-history-list')?.getBoundingClientRect()
        const nav = document.querySelector('.bottom-navigation')?.getBoundingClientRect()
        return { screen: { x: screen?.x, right: screen?.right, bottom: screen?.bottom },
          list: { x: list?.x, right: list?.right }, nav: { y: nav?.y } }
      })
      assert.ok(layout.screen?.x >= -1 && layout.screen.right <= width + 1 &&
        layout.list?.right <= width + 1 && layout.screen.bottom <= layout.nav.y + 1,
        width + 'px: call history must fit above mobile navigation: ' + JSON.stringify(layout))
    }
    await page.screenshot({ path: 'output/playwright/layout/adaptive-calls-' + width + '.png' })
    console.log('PASS: call history and filters at ' + width + 'px')
    if (width === 390) {
      await bottom.locator('button').nth(4).click()
      const likes = page.locator('.feed-post-card .feed-reaction-users-trigger').first()
      await likes.waitFor({ state: 'visible' })
      await likes.click()
      const dialog = page.getByRole('dialog', { name: 'Cảm xúc bài viết' })
      await dialog.waitFor({ state: 'visible' })
      await dialog.locator('.reaction-users-person').first().waitFor()
      assert.equal(await dialog.locator('.reaction-users-person').count(), 2,
        'Newsfeed likes should show users who reacted to the post')
      await dialog.getByRole('button', { name: 'Đóng danh sách cảm xúc' }).click()
      await dialog.waitFor({ state: 'hidden' })
      console.log('PASS: newsfeed reaction participant list on PWA phone')
    }
    assert.deepEqual(errors, [], width + ': unexpected browser JS errors')
    console.log('PASS: adaptive SocCo layout at ' + width + 'px')
    await context.close()
  }
} finally {
  await browser?.close()
  vite.kill('SIGTERM')
}
