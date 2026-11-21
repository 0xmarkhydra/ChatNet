import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createServer } from 'node:net'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const port = await new Promise((done, reject) => {
  const probe = createServer()
  probe.once('error', reject)
  probe.listen(0, '127.0.0.1', () => {
    const value = probe.address().port
    probe.close(() => done(value))
  })
})
const origin = 'http://127.0.0.1:' + port
const vite = spawn(process.execPath, [fileURLToPath(new URL('../node_modules/vite/bin/vite.js', import.meta.url)),
  '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { stdio: 'ignore', cwd: fileURLToPath(new URL('../', import.meta.url)) })
const now = new Date().toISOString()
const session = {
  token: 'mock.' + Buffer.from(JSON.stringify({ exp: 4102444800 })).toString('base64url') + '.signed',
  refreshToken: 'r'.repeat(43),
  sessionId: 'conversation-rail-check',
  user: { id: 1, username: 'viewer', displayName: 'Người xem', email: 'viewer@example.invalid' },
}
const chats = [
  { id: 101, type: 'direct', name: 'Linh Anh', otherUserId: 2, otherUsername: 'linhanh', memberCount: 2,
    categoryId: 5, pinnedAt: now, unreadCount: 2, online: true, lastMessage: 'Xin chào', createdAt: now, lastMessageAt: now },
  { id: 102, type: 'group', name: 'SocCo Design Team', memberCount: 4,
    avatarMembers: ['linhanh', 'nam', 'viewer'], muted: true, unreadCount: 4, online: false, lastMessage: 'Có tin mới', createdAt: now, lastMessageAt: now },
  { id: 103, type: 'direct', name: 'Nam', otherUserId: 3, otherUsername: 'nam', memberCount: 2,
    unreadCount: 0, online: false, lastMessage: 'Hẹn gặp', createdAt: now, lastMessageAt: now },
  { id: 104, type: 'group', name: 'Product Updates', memberCount: 3,
    avatarMembers: ['viewer','linhanh','nam'], unreadCount: 1, online: false,
    lastMessage: 'Thông báo mới', createdAt: now, lastMessageAt: now },
]
const channels = [
  { id: 0, conversationId: 102, name: 'Thảo luận chung', description: 'Thông tin chung', unreadCount: 1,
    lastMessage: 'Tin chung', lastMessageAt: now },
  { id: 7, conversationId: 102, name: 'Hỏi đáp', description: 'Hỏi đáp thiết kế', unreadCount: 3,
    lastMessage: 'Tin hỏi đáp', lastMessageAt: now },
]
const compactOnly = process.argv.includes('--compact-chat-only')
let browser
try {
  let ready = false
  for (let i=0; i<65; i++) {
    try { if ((await fetch(origin)).ok) { ready = true; break } } catch { /* wait */ }
    await delay(150)
  }
  assert.ok(ready, 'Vite did not start')
  for (const channel of [undefined, 'chrome', 'msedge']) {
    try {
      browser = await chromium.launch({headless:true, channel})
      break
    } catch (error) {
      if (!/doesn't exist|not found/.test(String(error)) || channel === 'msedge') throw error
    }
  }
  for (const width of (process.env.CHATNET_DESKTOP_ONLY ? [] : [320,390,430])) {
    const context = await browser.newContext({
      viewport: {width,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true,serviceWorkers:'block',
    })
    await context.addInitScript(value => {
      localStorage.setItem('chatnet-session', JSON.stringify(value))
      window.__chatnetTestEventSources = []
      window.EventSource = class {
        constructor() {
          this.handlers = new Map()
          window.__chatnetTestEventSources.push(this)
        }
        addEventListener(name, listener) {
          this.handlers.set(name, [...(this.handlers.get(name) || []), listener])
        }
        emit(name, payload) {
          for (const listener of this.handlers.get(name) || [])
            listener({ data: JSON.stringify(payload) })
        }
        close() {}
      }
    }, session)
    const page = await context.newPage()
    let channelFetches = 0
    const scheduledMessages = []
    let immediateSends = 0
    const realtimeConversationUpdates = new Map()
    const messageHistoryFetches = new Map()
    const messageHistoryCompleted = new Map()
    const pageErrors = []
    page.on('pageerror', e => pageErrors.push(e.message))
    await page.route(url => url.pathname.startsWith('/api/'), async route => {
      const req = route.request()
      const path = new URL(req.url()).pathname
      const json = (data,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)})
      if (req.method() === 'OPTIONS') return json({})
      if (path === '/api/conversations') {
        // A direct-route lookup is NOT the same as listing conversations:
        // GET ?id=N must return exactly that conversation or routing will
        // correctly reject the mock and navigate back to /chat.
        const lookupId = new URL(req.url()).searchParams.get('id')
        const current = chats.map(chat => ({ ...chat, ...realtimeConversationUpdates.get(chat.id) }))
        return json(lookupId ? current.filter(chat => chat.id === Number(lookupId)) : current)
      }
      if (path === '/api/conversations/101/e2ee/status') return json({mode:'legacy',epoch:0,pilotEnabled:false})
      if (path === '/api/conversation-categories') return json([{id:5,name:'Công việc',color:'orange'}])
      if (path === '/api/conversations/memberships') return json({ids:chats.map(c=>c.id),nextAfter:null})
      if (path === '/api/conversations/102/channels') {
        channelFetches += 1
        return json(channels)
      }
      if (path === '/api/conversations/102/channel-read') return json({conversationId:102,channelId:7,lastReadMessageId:0})
      if (path === '/api/conversations/104/channels') return json([
        {id:0,conversationId:104,name:'Thảo luận chung',description:'Sản phẩm',unreadCount:0,lastMessage:'',lastMessageAt:now},
        {id:9,conversationId:104,name:'Changelog',description:'Cập nhật',unreadCount:1,lastMessage:'Tính năng mới',lastMessageAt:now},
      ])
      if (/^\/api\/conversations\/\d+\/scheduled-messages$/.test(path)) {
        if (req.method() === 'POST') {
          const item = { ...req.postDataJSON(), id: 1, state: 'pending' }
          scheduledMessages.push(item)
          return json(item, 201)
        }
        return json(scheduledMessages)
      }
      if (/^\/api\/conversations\/\d+\/messages$/.test(path)) {
        if (req.method() === 'POST') immediateSends++
        const id = Number(path.split('/')[3])
        if (id !== 101 && id !== 103) return json([])
        const fetchCount = (messageHistoryFetches.get(id) || 0) + 1
        messageHistoryFetches.set(id, fetchCount)
        // Returning to a conversation deliberately has a slow response:
        // the PWA must render the prior authorized messages WITHOUT waiting.
        if (fetchCount > 1) await delay(650)
        messageHistoryCompleted.set(id, fetchCount)
        return json([{
          id:id * 100, conversationId:id, senderId:2, sender:'linhanh',
          text:'Cached conversation history '+id, createdAt:now
        }])
      }
      if (/^\/api\/conversations\/\d+\/members$/.test(path)) return json([])
      if (path === '/api/conversations/unread') return json({unreadCount:6})
      if (path === '/api/preferences' || path === '/api/preferences/translation') return json({targetLanguage:'vi',autoTranslate:false,appLocale:'vi'})
      if (path === '/api/profile') return json({username:'viewer',displayName:'Người xem'})
      if (path === '/api/push/config') return json({configured:false})
      return json([])
    })
    await page.goto(origin)
    const rail = page.locator('.conversation-avatar-rail')
    const panel = page.locator('.conversation-panel')
    const picker = page.locator('.group-channel-sidebar')
    const layout = page.locator('.social-chat-layout')
    const toggleRailFromMenu = async () => {
      await rail.getByRole('button',{name:'Menu hội thoại'}).click()
      await page.locator('.conversation-rail-menu-popover:popover-open')
        .getByRole('button',{name:/cột avatar/}).click()
    }
    const measure = async () => page.evaluate(() => {
      const rect = selector => {
        const element = document.querySelector(selector)
        if (!element) return null
        const r = element.getBoundingClientRect()
        return { x:r.x, y:r.y, width:r.width, height:r.height,
          left:r.left, right:r.right, top:r.top, bottom:r.bottom }
      }
      return { rail:rect('.conversation-avatar-rail'),
        picker:rect('.group-channel-sidebar'), chat:rect('.conversation-panel'),
        header:rect('.conversation-panel .chat-head'),
        composer:rect('.conversation-panel .media-composer'),
        divider:rect('.conversation-avatar-rail-divider'),
        pickerToolbar:rect('.group-channel-sidebar-topbar'),
        horizontalOverflow:document.documentElement.scrollWidth-innerWidth }
    })
    const fullWidth = (rect,label) => {
      assert.ok(rect && rect.left>=-1 && Math.abs(rect.width-width)<1.5 && rect.right<=width+1,
        width+'px '+label+' must span full message area: '+JSON.stringify(rect))
    }
    await rail.waitFor({state:'visible',timeout:15000})
    await rail.locator('.conversation-avatar-rail-item').first().waitFor()
    await page.waitForTimeout(350)

    // Screen 1: full-width conversation list with the ORIGINAL avatar component.
    assert.ok(await layout.evaluate(el=>el.classList.contains('mobile-rail-list-view')),
      width+'px initial screen is the conversation list')
    assert.equal(await rail.getAttribute('data-expanded'),'true',
      width+'px initial avatar rail shows names and previews')
    fullWidth((await measure()).rail,'conversation list')
    const listSearchBounds = await rail.locator('.conversation-avatar-rail-search-line').boundingBox()
    const listRailBounds = await rail.boundingBox()
    const listNameOrigin = await rail.locator('.conversation-avatar-rail-item[title="SocCo Design Team"] .conversation-avatar-rail-meta').evaluate(el => ({x:el.getBoundingClientRect().x,y:el.getBoundingClientRect().y}))
    const listAvatarOrigin = await rail.locator('.conversation-avatar-rail-item[title="SocCo Design Team"] .conversation-avatar-rail-photo').boundingBox()
    assert.ok(listSearchBounds && listRailBounds,
      width+'px the expanded avatar list has its conversation search input')
    assert.equal(await rail.locator('.conversation-avatar-rail-item').count(),4,
      width+'px all chats and groups appear in the same full-width list')
    assert.equal(await rail.locator('.conversation-avatar-rail-meta:visible').count(),4,
      width+'px names and previews remain visible')
    assert.equal(await rail.locator('.conversation-avatar-rail-item[title="SocCo Design Team"] .conversation-avatar-member').count(),3,
      width+'px group avatar uses its three participants')
    assert.equal(await panel.isVisible(),false,
      width+'px full-width list must not display the chat pane behind it')
    assert.equal(await page.locator('.conversation-sidebar').isVisible(),false,
      width+'px old duplicate conversation list stays hidden')
    const category = rail.locator('.conversation-avatar-rail-item[title="Linh Anh"] .conversation-rail-title-group .conversation-category-badge.category-icon-only.category-plain')
    await category.waitFor({state:'visible'})
    assert.equal(await category.textContent(),'',
      width+'px the colored category tag remains icon-only')
    // Header: only NAME search plus category tag and +; no All/Unread/Group
    // icons. The input gets every pixel the removed buttons freed.
    const searchInput = rail.getByRole('searchbox',{name:'Tìm trong danh sách hội thoại'})
    await searchInput.click()
    assert.equal(await page.locator('.conversation-rail-floating-filters').count(),0,
      width+'px focusing the name search must not open filter controls')
    assert.equal(await rail.locator('.rail-header-quick-filters').count(),0,
      width+'px All/Unread/Groups quick filters are entirely removed')
    assert.equal(await rail.getByRole('button',{name:/^(Tất cả hội thoại|Hội thoại chưa đọc|Nhóm hội thoại)$/}).count(),0,
      width+'px there are no obsolete filter buttons')
    const headerGeometry = await rail.evaluate(el => {
      const rect = selector => el.querySelector(selector)?.getBoundingClientRect()
      const input = rect('.conversation-avatar-rail-search-field')
      const menu = rect('.conversation-rail-menu-trigger')
      const host = el.getBoundingClientRect()
      return {inputLeft:input?.left,inputRight:input?.right,inputWidth:input?.width,
        menuLeft:menu?.left,menuRight:menu?.right,
        hostRight:host.right,heights:[input?.y,menu?.y],
        oldControls:el.querySelectorAll('.conversation-avatar-rail-top-category, .conversation-avatar-rail-create, .conversation-avatar-rail-expand-toggle').length}
    })
    assert.ok(headerGeometry.inputWidth >= (width === 320 ? 150 : 200) &&
      headerGeometry.menuRight < headerGeometry.inputLeft &&
      headerGeometry.inputRight <= headerGeometry.hostRight + 1 &&
      headerGeometry.oldControls === 0 &&
      Math.abs(headerGeometry.heights[0]-headerGeometry.heights[1]) <= 5,
      width+'px hamburger replaces the blue arrow, and name-search fills the remaining header: '+JSON.stringify(headerGeometry))
    await searchInput.fill('Nam')
    await page.waitForFunction(() => {
      const items = document.querySelectorAll('.conversation-avatar-rail-item')
      return items.length === 1 && items[0].title === 'Nam'
    },null,{timeout:2500})
    await searchInput.fill('Hẹn gặp')
    await page.waitForTimeout(750)
    assert.equal(await rail.locator('.conversation-avatar-rail-item').count(),0,
      width+'px a message-body match must NOT appear in name-only search')
    await searchInput.fill('')
    await page.waitForFunction(() =>
      document.querySelectorAll('.conversation-avatar-rail-item').length === 4,
      null,{timeout:2000})

    // Screen 2a: choosing a person opens that person's full-screen chat.
    await rail.locator('.conversation-avatar-rail-item[title="Linh Anh"]').click()
    await panel.locator('.visitor-name-link').getByText('Linh Anh').waitFor()
    await page.getByText('Cached conversation history 101').waitFor({state:'visible',timeout:2200})
    await page.waitForTimeout(160)
    assert.ok(await layout.evaluate(el=>el.classList.contains('mobile-rail-chat-view')),
      width+'px direct chat uses the chat-only view')
    assert.equal(await rail.isVisible(),false,
      width+'px avatar dock must disappear from direct chat')
    fullWidth((await measure()).chat,'direct chat')
    assert.ok(await panel.locator('.media-composer').isVisible(),width+'px direct chat composer')
    const direct = await measure()
    const mobileActions = () => panel.locator('.compact-room-actions').evaluate(el =>
      [...el.querySelectorAll('button')].map(btn => {
        const r = btn.getBoundingClientRect()
        return {w:r.width,h:r.height,right:r.right}
      }))
    const directActions = await mobileActions()
    assert.equal(directActions.length, 3, width+'px: voice, video and more actions remain visible')
    assert.ok(directActions.every(action=>action.w>=43.5 && action.h>=43.5 && action.right<=width+1),
      width+'px: all three header actions fit with 44px touch targets: '+JSON.stringify(directActions))
    assert.ok(await panel.locator('.compact-room-actions')
      .getByRole('button', {name:'Gọi video', exact:true}).isVisible(),
      width+'px: video call remains a primary action without initiating a real call in fixture QA')
    const more = panel.getByRole('button', {name:'Tùy chọn hội thoại'})
    await more.click()
    for (const label of ['Tìm tin nhắn', 'Dịch AI', 'Thông tin hội thoại']) {
      await page.getByRole('menuitem', {name:label, exact:true}).waitFor()
    }
    await page.keyboard.press('Escape')
    const composerActions = async () => panel.locator('.media-composer').evaluate(form =>
      [...form.querySelectorAll(':scope > .attach-button, :scope > .voice-record-trigger, :scope > .send-button')]
        .map(btn => {const r=btn.getBoundingClientRect();return {w:r.width,h:r.height}}))
    const directComposerActions = await composerActions()
    assert.equal(directComposerActions.length, 3, 'Composer exposes only add, microphone and send')
    assert.ok(directComposerActions.every(action => action.w >= 43.5 && action.h >= 43.5),
      width+'px: composer actions should have 44px touch targets')
    const messageInput = panel.getByRole('textbox', {name:'Tin nhắn', exact:true})
    const inputBox = await messageInput.boundingBox()
    assert.ok(inputBox && inputBox.width >= width * 0.43 && inputBox.height < 55,
      width+'px: the message input should be wide and only one row when empty: '+JSON.stringify(inputBox))
    assert.equal(await panel.getByRole('button',{name:'Đính kèm ảnh hoặc video'}).isVisible(),false)
    const plus = panel.getByRole('button',{name:'Mở menu thêm nội dung'})
    await messageInput.fill('Tin kiểm thử hẹn giờ')
    await plus.click()
    const composerMenu = page.getByRole('dialog',{name:'Thêm nội dung vào tin nhắn'})
    await composerMenu.getByRole('button',{name:'Ảnh / Video'}).waitFor()
    await composerMenu.getByRole('button',{name:'Hẹn giờ gửi'}).click()
    const schedule = page.getByRole('dialog',{name:'Tin nhắn hẹn giờ'})
    await schedule.waitFor()
    assert.equal(await schedule.getByLabel('Nội dung').inputValue(),'Tin kiểm thử hẹn giờ')
    assert.equal(scheduledMessages.length + immediateSends,0,'Opening scheduling must not send or schedule anything')
    await page.keyboard.press('Escape')
    await schedule.waitFor({state:'hidden'})
    assert.equal(await messageInput.inputValue(),'Tin kiểm thử hẹn giờ')
    assert.equal(scheduledMessages.length + immediateSends,0,'Dismissing scheduling must not write')
    await plus.click()
    await composerMenu.getByRole('button',{name:'Hẹn giờ gửi'}).click()
    await schedule.getByRole('button',{name:'Lên lịch gửi'}).click()
    await schedule.getByText('Đã lên lịch gửi.',{exact:true}).waitFor()
    assert.equal(scheduledMessages.length,1,'Only explicit confirmation schedules a message')
    assert.equal(immediateSends,0,'Scheduling never uses the immediate send endpoint')
    await page.keyboard.press('Escape')
    await schedule.waitFor({state:'hidden'})
    await messageInput.fill('')
    await panel.getByRole('button',{name:'Quay lại danh sách'}).click()
    await rail.waitFor({state:'visible'})
    await page.waitForTimeout(150)
    await rail.locator('.conversation-avatar-rail-item[title="Nam"]').click()
    await page.getByText('Cached conversation history 103').waitFor({state:'visible',timeout:2200})
    await panel.getByRole('button',{name:'Quay lại danh sách'}).click()
    await rail.waitFor({state:'visible'})
    await rail.locator('.conversation-avatar-rail-item[title="Linh Anh"]').click()
    await page.getByText('Cached conversation history 101').waitFor({state:'visible',timeout:500})
    assert.equal(messageHistoryCompleted.get(101), 1,
      width+'px cached messages must already be visible before the delayed second response arrives')
    assert.ok(messageHistoryFetches.get(101) >= 1,
      width+'px initial visit must still fetch authorized chat history')
    await panel.getByRole('button',{name:'Quay lại danh sách'}).click()
    await rail.waitFor({state:'visible'})
    await page.waitForTimeout(180)
    fullWidth((await measure()).rail,'conversation list after direct chat')
    assert.equal(await panel.isVisible(),false,
      width+'px direct chat closes when returning to the full list')

    async function verifyChannelChat() {
      // Screen 3: selecting a channel opens a full-width channel chat.
      await page.locator('.group-chat-panel .group-room-title > strong').getByText('Hỏi đáp').waitFor()
      await page.waitForTimeout(350)
      assert.ok(await layout.evaluate(el=>el.classList.contains('mobile-rail-chat-view')),
        width+'px selecting a channel enters chat-only view')
      assert.equal(await rail.isVisible(),false,
        width+'px avatar dock is hidden while reading a channel')
      assert.equal(await picker.isVisible(),false,
        width+'px channel picker closes after selection')
      const groupChat = await measure()
      fullWidth(groupChat.chat,'channel chat')
      assert.ok(Math.abs(groupChat.chat.height-direct.chat.height)<1.5 &&
        Math.abs(groupChat.composer.width-direct.composer.width)<1.5,
        width+'px group and direct chat share a full-width composer: '+JSON.stringify({direct,groupChat}))
      assert.ok(await panel.locator('.media-composer').isVisible(),
        width+'px channel chat composer remains usable')
      const actions = await panel.locator('.group-mobile-actions').evaluate(el =>
        [...el.querySelectorAll('button')].map(btn => {
          const rect = btn.getBoundingClientRect()
          return {w:rect.width,h:rect.height,right:rect.right}
        }))
      assert.ok(actions.length >= 4 && actions.every(action => action.w>0 && action.h>0 && action.right<=width+1),
        width+'px group chat call/search/translation/details actions remain available: '+JSON.stringify(actions))
      const groupComposerActions = await composerActions()
      assert.equal(groupComposerActions.length,directComposerActions.length,
        width+'px direct and channel composers must have the same primary actions')
      assert.ok(groupComposerActions.every((action,index)=>
        Math.abs(action.w-directComposerActions[index].w)<0.6 &&
        Math.abs(action.h-directComposerActions[index].h)<0.6),
        width+'px direct and channel composer controls must have identical sizes: '+JSON.stringify({directComposerActions,groupComposerActions}))
      assert.equal(await panel.locator('.group-activity-composer-trigger').isVisible(),false)
      await plus.click()
      for (const label of ['Bình chọn', 'Ghi chú nhóm', 'Nhắc hẹn nhóm']) {
        await composerMenu.getByRole('button',{name:label,exact:true}).waitFor()
      }
      await page.keyboard.press('Escape')

      // Regression: the group/channel info sheet must retain its full mobile
      // width instead of inheriting the narrow avatar/channel split.
      await panel.locator('.group-mobile-actions').getByRole('button',{name:'Thông tin hội thoại'}).click()
      await page.locator('#conversation-details-panel').waitFor({state:'visible'})
      const mobileInfo = await page.locator('#conversation-details-panel').evaluate(el => {
        const rect = el.getBoundingClientRect(), root = document.querySelector('.social-chat-layout').getBoundingClientRect()
        const style = getComputedStyle(el)
        return {left:rect.left,right:rect.right,width:rect.width,height:rect.height,
          rootLeft:root.left,rootRight:root.right,position:style.position,
          visibility:style.visibility,display:style.display,zIndex:style.zIndex,
          title:el.querySelector('h2')?.textContent}
      })
      assert.ok(mobileInfo.width >= Math.min(width,350)-5 && mobileInfo.left >= -1 &&
        mobileInfo.right <= width+1 && mobileInfo.height > 500 &&
        mobileInfo.display !== 'none' && mobileInfo.title === 'Thông tin kênh',
        width+'px channel details must use full viewport and not be clipped: '+JSON.stringify(mobileInfo))
      await page.getByRole('button',{name:'Đóng thông tin hội thoại'}).click()
    }

    if (compactOnly) {
      await rail.locator('.conversation-avatar-rail-item[title="SocCo Design Team"]').click()
      await picker.getByRole('button',{name:/Mở kênh Hỏi đáp/}).click()
      await verifyChannelChat()
      assert.deepEqual(pageErrors, [])
      console.log('PASS '+width+'px: chat and channel controls, wide composer, scheduling only after explicit confirmation')
      await context.close()
      continue
    }

    // Screen 2b: group opens the *joined* narrow avatar dock + channel picker.
    await rail.locator('.conversation-avatar-rail-item[title="SocCo Design Team"]').click()
    // This rail is remounted during navigation: wait for an intermediate frame
    // rather than sampling at a fixed wall-clock delay after the click.
    await page.waitForFunction(compactWidth => {
      const el = document.querySelector('.social-chat-layout.mobile-rail-picker-view > .conversation-avatar-rail')
      if (!el) return false
      const rect = el.getBoundingClientRect()
      return rect.left >= -1 && rect.width < innerWidth - 3 && rect.width > compactWidth + 12
    }, width <= 350 ? 52 : 56, {timeout: 2000})
    const synchronizedSlide = await page.evaluate(() => {
      const dock = document.querySelector('.social-chat-layout.mobile-rail-picker-view > .conversation-avatar-rail')
      const channelPicker = document.querySelector('.social-chat-layout.mobile-rail-picker-view > .group-channel-sidebar')
      const dockRect = dock.getBoundingClientRect()
      const pickerRect = channelPicker.getBoundingClientRect()
      return {
        dockRight: dockRect.right,
        pickerLeft: pickerRect.left,
        railWidth: getComputedStyle(dock.parentElement).getPropertyValue('--chatnet-picker-rail-width').trim(),
        transitionProperty: getComputedStyle(dock.parentElement).transitionProperty,
        leftEdge: dockRect.left,
      }
    })
    assert.ok(synchronizedSlide.transitionProperty.includes('--chatnet-picker-rail-width') &&
      Math.abs(synchronizedSlide.dockRight - synchronizedSlide.pickerLeft) < 2 &&
      synchronizedSlide.leftEdge >= -1,
      width+'px channel picker must share the avatar rail animated edge: '+JSON.stringify(synchronizedSlide))
    // The rail may be in its first new-layout frame before the grouped
    // preview receives its dimensions. Sample only after the same mounted
    // meta has a nonzero box; do not confuse that frame with a position jump.
    const slidingNameOrigin = await (await page.waitForFunction(() => {
      const el = document.querySelector(
        '.conversation-avatar-rail-item[title="SocCo Design Team"] .conversation-avatar-rail-meta')
      const box = el?.getBoundingClientRect()
      return box && box.width > 10 && box.x > 0 ? {x:box.x,y:box.y} : false
    }, null, {timeout:1200})).jsonValue()
    const slidingAvatarOrigin = await rail.locator('.conversation-avatar-rail-item[title="SocCo Design Team"] .conversation-avatar-rail-photo').boundingBox()
    assert.ok(listNameOrigin && slidingNameOrigin && listAvatarOrigin && slidingAvatarOrigin &&
      Math.abs(listNameOrigin.x - slidingNameOrigin.x) < 1.5 &&
      Math.abs(listAvatarOrigin.x - slidingAvatarOrigin.x) < 1.5 &&
      Math.abs(listAvatarOrigin.y - slidingAvatarOrigin.y) < 1.5,
      width+'px avatar and user name must retain their coordinates while the picker opens: '+
        JSON.stringify({listNameOrigin,slidingNameOrigin,listAvatarOrigin,slidingAvatarOrigin}))
    // Capture the geometry in the SAME animation frame that established
    // visibility, not in a later locator lookup after navigation can rerender.
    const progressiveSplit = await (await page.waitForFunction(() => {
      const element = document.querySelector('.social-chat-layout.mobile-rail-picker-view')
      const avatar = element?.querySelector('.conversation-avatar-rail')
      const channels = element?.querySelector('.group-channel-sidebar')
      const avatarRow = avatar?.querySelector('.conversation-avatar-rail-item')
      const channelTopbar = channels?.querySelector('.group-channel-sidebar-topbar')
      if (!element || !avatarRow || !channelTopbar) return false
      const railRect = avatar.getBoundingClientRect()
      const channelRect = channels.getBoundingClientRect()
      const lineStyle = getComputedStyle(element, '::after')
      if (railRect.width <= 0 || channelRect.width <= 0 ||
          lineStyle.content === 'none' || lineStyle.content === '') return false
      return {
        lineX: parseFloat(lineStyle.left),
        lineContent: lineStyle.content,
        railWidth: railRect.width,
        channelWidth: channelRect.width,
        avatarRowWidth: avatarRow.getBoundingClientRect().width,
        channelTopbarWidth: channelTopbar.getBoundingClientRect().width,
        railEdge: railRect.right,
        channelEdge: channelRect.left,
        parentLeft: element.getBoundingClientRect().left,
        display: getComputedStyle(element).display
      }
    }, null, {timeout:2500})).jsonValue()
    assert.ok(progressiveSplit.lineContent !== 'none' &&
      Math.abs(progressiveSplit.lineX - (progressiveSplit.railEdge - progressiveSplit.parentLeft - 1)) < 2 &&
      Math.abs(progressiveSplit.railEdge - progressiveSplit.channelEdge) < 2 &&
      Math.abs(progressiveSplit.railWidth + progressiveSplit.channelWidth - width) < 2 &&
      progressiveSplit.avatarRowWidth > width - 16 &&
      Math.abs(progressiveSplit.channelTopbarWidth - (width - (width <= 350 ? 52 : 56))) < 2,
      width+'px moving divider alone reveals reciprocal, stable-width panes: '+
        JSON.stringify(progressiveSplit))

    // Reverse as soon as the group picker first appears (before it has reached
    // its final width), then switch back again. No pending timer may win later.
    await toggleRailFromMenu()
    await page.waitForTimeout(90)
    await toggleRailFromMenu()
    assert.ok(await layout.evaluate(el => el.classList.contains('mobile-rail-picker-view') &&
      el.dataset.splitExpanded === 'false'),
      width+'px tapping during the opening animation reverses in place')
    await picker.getByRole('button',{name:/Mở kênh Hỏi đáp/}).waitFor({state:'visible'})
    await page.waitForFunction(compact => {
      const element = document.querySelector('.mobile-rail-picker-view > .conversation-avatar-rail')
      return element && Math.abs(element.getBoundingClientRect().width - compact) < .45
    }, width <= 350 ? 52 : 56, {timeout:2500})
    await page.waitForTimeout(40)
    assert.ok(await layout.evaluate(el=>el.classList.contains('mobile-rail-picker-view')),
      width+'px group selection opens channel-picking screen')
    assert.equal(await rail.getAttribute('data-expanded'),'false',
      width+'px avatar rail collapses beside channel picker')
    const compactMenu = await rail.getByRole('button',{name:'Menu hội thoại'}).evaluate(button => {
      const style=getComputedStyle(button), icon=button.querySelector('svg')
      const rect=button.getBoundingClientRect(), rail=button.closest('.conversation-avatar-rail').getBoundingClientRect()
      return {width:rect.width, iconWidth:icon?.getBoundingClientRect().width,
        leftOffset:rect.left-rail.left, color:style.color}
    })
    assert.ok(compactMenu.width === 36 && compactMenu.iconWidth === 26 &&
      compactMenu.leftOffset >= 8 && compactMenu.leftOffset <= 17,
      width+'px hamburger remains fixed at the former blue-chevron position: '+JSON.stringify(compactMenu))
    const inputClip = await rail.evaluate(el => {
      const search = el.querySelector('.conversation-avatar-rail-search-area')
      const textInput = el.querySelector('.conversation-avatar-rail-search-field, .conversation-avatar-rail-external-search, .conversation-avatar-rail-search-line')
      const edge = el.getBoundingClientRect().right
      const start = textInput?.getBoundingClientRect().left
      return {edge,start,hasSearch: Boolean(search),fullyClipped: start !== undefined && start >= edge}
    })
    assert.ok(inputClip.hasSearch && inputClip.fullyClipped,
      width+'px entire conversation search input must be concealed when avatar rail is compact: '+
        JSON.stringify(inputClip))
    const compactMeta = await rail.evaluate(el => {
      const railEdge = el.getBoundingClientRect().right
      const metaLeft = el.querySelector('.conversation-avatar-rail-meta')?.getBoundingClientRect().left
      return {railEdge,metaLeft,exposed:metaLeft === undefined ? -1 : railEdge-metaLeft}
    })
    assert.ok(compactMeta.metaLeft !== undefined && compactMeta.exposed <= 0,
      width+'px no user-name pixels can remain visible outside the collapsed avatar dock: '+
        JSON.stringify(compactMeta))
    const joined = await measure()
    assert.ok(joined.rail && joined.picker &&
      Math.abs(joined.rail.width-(width<=350?52:56))<1.5 &&
      Math.abs(joined.rail.right-joined.picker.left)<1.5 &&
      Math.abs(joined.picker.right-width)<1.5 &&
      joined.horizontalOverflow<2,
      width+'px avatar dock and channel picker join seamlessly: '+JSON.stringify(joined))
    const reciprocalFrames = await layout.evaluate(async element => {
      const avatar = element.querySelector('.conversation-avatar-rail')
      const picker = element.querySelector('.group-channel-sidebar')
      const toggle = () => {
        avatar.querySelector('.conversation-rail-menu-trigger').click()
        avatar.querySelector('.conversation-rail-menu-item:last-child').click()
      }
      const sample = () => {
        const a = avatar.getBoundingClientRect()
        const b = picker.getBoundingClientRect()
        const line = parseFloat(getComputedStyle(element, '::after').left)
        return {avatarWidth:a.width, pickerWidth:b.width, seamGap:b.left-a.right,
          lineOffset:line-(a.right-element.getBoundingClientRect().left-1)}
      }
      const searchNode = avatar.querySelector('.conversation-avatar-rail-search-area')
      const channelSearchNode = picker.querySelector('.group-channel-sidebar-search')
      const avatarRowNode = avatar.querySelector('.conversation-avatar-rail-item')
      const channelRowNode = picker.querySelector('.group-channel-sidebar-row')
      let childListMutations = 0
      const observer = new MutationObserver(records => {
        childListMutations += records.filter(record => record.type === 'childList').length
      })
      observer.observe(avatar.querySelector('.conversation-avatar-rail-scroll'), {childList:true,subtree:true})
      observer.observe(picker, {childList:true,subtree:true})
      const trajectory = [sample()]
      const frames = async count => {
        for (let i=0;i<count;i++) {
          await new Promise(requestAnimationFrame)
          trajectory.push(sample())
        }
      }
      const closed = sample()
      toggle()
      await frames(7)
      const growing = sample()
      await frames(8)
      const growingMore = sample()
      toggle()
      await frames(9)
      const reversing = sample()
      const maxFrameJump = Math.max(...trajectory.slice(1).map((point,i) =>
        Math.abs(point.avatarWidth-trajectory[i].avatarWidth)))
      const maxFrameSeam = Math.max(...trajectory.map(point =>
        Math.abs(point.seamGap)+Math.abs(point.lineOffset)))
      observer.disconnect()
      const sameNodes = searchNode === avatar.querySelector('.conversation-avatar-rail-search-area') &&
        channelSearchNode === picker.querySelector('.group-channel-sidebar-search') &&
        avatarRowNode === avatar.querySelector('.conversation-avatar-rail-item') &&
        channelRowNode === picker.querySelector('.group-channel-sidebar-row')
      return {closed,growing,growingMore,reversing,maxFrameJump,maxFrameSeam,
        sameNodes,childListMutations,grid:getComputedStyle(element).gridTemplateColumns}
    })
    assert.ok(reciprocalFrames.growing.avatarWidth > reciprocalFrames.closed.avatarWidth + 1 &&
      reciprocalFrames.growing.pickerWidth < reciprocalFrames.closed.pickerWidth - 1 &&
      reciprocalFrames.growingMore.avatarWidth > reciprocalFrames.growing.avatarWidth + 1 &&
      reciprocalFrames.growingMore.pickerWidth < reciprocalFrames.growing.pickerWidth - 1 &&
      reciprocalFrames.reversing.avatarWidth < reciprocalFrames.growingMore.avatarWidth - 1 &&
      reciprocalFrames.reversing.pickerWidth > reciprocalFrames.growingMore.pickerWidth + 1 &&
      reciprocalFrames.maxFrameJump < 70 && reciprocalFrames.maxFrameSeam < 4 &&
      reciprocalFrames.sameNodes && reciprocalFrames.childListMutations === 0 &&
      [reciprocalFrames.closed,reciprocalFrames.growing,reciprocalFrames.growingMore,reciprocalFrames.reversing]
        .every(frame => Math.abs(frame.avatarWidth+frame.pickerWidth-width)<2 &&
          Math.abs(frame.seamGap)<2 && Math.abs(frame.lineOffset)<2),
      width+'px one moving border simultaneously collapses one panel and reveals the other, including an instant reversal: '+
        JSON.stringify(reciprocalFrames))
    await page.waitForTimeout(650)
    assert.equal(await rail.locator('.conversation-avatar-rail-divider').isVisible(), false,
      width+'px remove the horizontal divider beneath the arrow')
    const channelToolbarBorder = await picker.locator('.group-channel-sidebar-topbar')
      .evaluate(el => getComputedStyle(el).borderBottomWidth)
    assert.equal(channelToolbarBorder, '0px',
      width+'px channel picker must not show the remaining horizontal rule')
    const pickerSearchBounds = await picker.locator('.group-channel-sidebar-search').boundingBox()
    const pickerMenuBounds = await rail.getByRole('button',{name:'Menu hội thoại'}).boundingBox()
    const pickerSearchGap = pickerMenuBounds && pickerSearchBounds
      ? pickerSearchBounds.x - (pickerMenuBounds.x + pickerMenuBounds.width) : 0
    assert.ok(pickerSearchBounds && listSearchBounds && listRailBounds &&
      Math.abs((pickerSearchBounds.y - joined.rail.y) -
        (listSearchBounds.y - listRailBounds.y)) < 5 &&
      Math.abs(pickerSearchBounds.height - listSearchBounds.height) < 2 &&
      pickerSearchGap >= 14 && pickerSearchGap <= 42,
      width+'px search fields share a row; channel search has comfortable gap after hamburger: '+
        JSON.stringify({pickerSearchBounds,listSearchBounds,pickerSearchGap}))
    const menuPosition = await rail.evaluate(element => {
      const button=element.querySelector('.conversation-rail-menu-trigger')
      const x=()=>button.getBoundingClientRect().x
      const before=x()
      element.classList.add('is-expanded')
      const expanded=x()
      element.classList.remove('is-expanded')
      return {before,expanded}
    })
    assert.ok(Math.abs(menuPosition.before-menuPosition.expanded) < .5,
      width+'px hamburger must stay fixed while the rail toggles: '+JSON.stringify(menuPosition))

    // The visual split is DOM-only: toggles must not remount the avatar list,
    // channel rows or chat. Rapid taps should reverse the same CSS animation.
    for (let i = 0; i < 2; i++) {
      await toggleRailFromMenu()
      await page.waitForTimeout(90)
      assert.ok(await layout.evaluate(el => el.dataset.splitExpanded === 'true'),
        width+'px click '+i+' starts the reverse rail motion')
      await toggleRailFromMenu()
      assert.ok(await layout.evaluate(el => el.dataset.splitExpanded === 'false'),
        width+'px second click '+i+' immediately reverses without freezing')
      const rapidSeam = await measure()
      assert.ok(rapidSeam.rail && rapidSeam.picker &&
        Math.abs(rapidSeam.rail.right - rapidSeam.picker.left) < 2,
        width+'px rapid reverse keeps avatar/channel seam joined: '+JSON.stringify(rapidSeam))
    }
    await page.waitForTimeout(730)
    assert.ok(await layout.evaluate(el => el.classList.contains('mobile-rail-picker-view')),
      width+'px canceled close timers never override the latest picker intent')
    assert.ok(await picker.isVisible(),width+'px picker stays open after rapid taps')

    // Switching group A → B must slide the old channel pane fully closed
    // before swapping channel data, then reveal B using the SAME divider.
    await rail.locator('.conversation-avatar-rail-item[title="Product Updates"]').click()
    await page.waitForTimeout(125)
    const movingToOtherGroup = await layout.evaluate(el => ({
      width: el.querySelector('.conversation-avatar-rail').getBoundingClientRect().width,
      currentGroup: el.querySelector('.conversation-avatar-rail-item.selected')?.title,
      expanded: el.dataset.splitExpanded,
    }))
    assert.ok(movingToOtherGroup.expanded === 'true' &&
      movingToOtherGroup.currentGroup === 'SocCo Design Team' &&
      movingToOtherGroup.width > (width <= 350 ? 52 : 56) + 8 &&
      movingToOtherGroup.width < width,
      width+'px group A remains rendered while its channels retract before switching to B: '+
        JSON.stringify(movingToOtherGroup))
    await page.waitForTimeout(1050)
    const switchState = await layout.evaluate(el => ({
      active: el.querySelector('.conversation-avatar-rail-item.selected')?.title,
      split: el.dataset.splitExpanded,
      groupRows: [...el.querySelectorAll('.group-channel-sidebar-row')].map(node => node.textContent?.trim().slice(0,50)),
      railWidth: el.querySelector('.conversation-avatar-rail')?.getBoundingClientRect().width,
      groupPanel: el.classList.contains('mobile-rail-picker-view'),
      classes:el.className,
      path:window.location.pathname,
      items:[...el.querySelectorAll('.conversation-avatar-rail-item')].map(n=>({title:n.title,selected:n.classList.contains('selected')})),
      errors:document.querySelector('.conversation-empty')?.textContent?.slice(0,100)
    }))
    assert.equal(switchState.active, 'Product Updates',
      width+'px group A to B should commit after retracting old panel: '+JSON.stringify(switchState))
    await picker.getByRole('button',{name:/Mở kênh Changelog/}).waitFor({state:'visible'})
    await page.waitForFunction(compact => {
      const root = document.querySelector('.social-chat-layout.mobile-rail-picker-view')
      return root?.dataset.splitExpanded === 'false' &&
        Math.abs(root.querySelector('.conversation-avatar-rail').getBoundingClientRect().width - compact) < 1.5
    }, width <= 350 ? 52 : 56, {timeout:2500})
    await rail.locator('.conversation-avatar-rail-item[title="SocCo Design Team"]').click()
    await picker.getByRole('button',{name:/Mở kênh Hỏi đáp/}).waitFor({state:'visible'})
    await page.waitForFunction(compact => {
      const root = document.querySelector('.social-chat-layout.mobile-rail-picker-view')
      return root?.dataset.splitExpanded === 'false' &&
        Math.abs(root.querySelector('.conversation-avatar-rail').getBoundingClientRect().width - compact) < 1.5
    }, width <= 350 ? 52 : 56, {timeout:3000})

    // Group picker → direct chat: wait for the ORIGINAL reciprocal divider
    // to finish retracting channels, then navigate. No visual overlay clone.
    await rail.locator('.conversation-avatar-rail-item[title="Nam"]').click()
    await page.waitForTimeout(105)
    const retracting = await layout.evaluate(el => {
      const avatar = el.querySelector('.conversation-avatar-rail')?.getBoundingClientRect()
      const picker = el.querySelector('.group-channel-sidebar')?.getBoundingClientRect()
      return {
        oldGroup: Boolean(el.querySelector('.conversation-avatar-rail-item[title="SocCo Design Team"].selected')),
        expanding: el.dataset.splitExpanded === 'true',
        stillPicker: el.classList.contains('mobile-rail-picker-view'),
        railWidth: avatar?.width,
        channelWidth: picker?.width,
        seamGap: avatar && picker ? picker.left-avatar.right : null,
        overlay: Boolean(document.querySelector('.chatnet-outgoing-group-picker')),
      }
    })
    assert.ok(retracting.oldGroup && retracting.expanding && retracting.stillPicker &&
      retracting.railWidth > (width <= 350 ? 52 : 56) + 8 &&
      retracting.railWidth < width - 5 && retracting.channelWidth > 5 &&
      Math.abs(retracting.seamGap) < 2 && !retracting.overlay,
      width+'px old picker retracts before direct chat navigation: '+
        JSON.stringify(retracting))
    await panel.locator('.visitor-name-link').getByText('Nam')
      .waitFor({state:'visible',timeout:2500})
    await page.waitForFunction(() =>
      document.querySelector('.social-chat-layout')?.classList.contains('mobile-rail-chat-view'),
      null, {timeout:1500})
    assert.equal(await rail.isVisible(),false,
      width+'px direct conversation opens after sliding the group picker away')
    await panel.getByRole('button',{name:'Quay lại danh sách'}).click()
    await rail.waitFor({state:'visible'})
    await rail.locator('.conversation-avatar-rail-item[title="SocCo Design Team"]').click()
    await picker.getByRole('button',{name:/Mở kênh Hỏi đáp/}).waitFor({state:'visible'})
    await page.waitForTimeout(800)
    const reopenedAfterDirect = await layout.evaluate(root => ({
      split:root.dataset.splitExpanded,
      width:root.querySelector('.conversation-avatar-rail')?.getBoundingClientRect().width,
      compact:innerWidth <= 350 ? 52 : 56,
      picker:root.classList.contains('mobile-rail-picker-view'),
      selected:root.querySelector('.conversation-avatar-rail-item.selected')?.title,
      open:root.classList.contains('mobile-channel-picker-open'),
    }))
    assert.ok(reopenedAfterDirect.picker &&
      Math.abs(reopenedAfterDirect.width-reopenedAfterDirect.compact) < 1.5,
      width+'px returning from direct chat opens the group picker with the same slide: '+
        JSON.stringify(reopenedAfterDirect))

    assert.equal(await panel.isVisible(),false,
      width+'px chat remains hidden until a channel is selected')
    assert.equal(await picker.locator('.group-channel-sidebar-caption').count(),0,
      width+'px no redundant channel-list heading')
    assert.equal(await picker.locator('.group-channel-sidebar-more').count(),0,
      width+'px channel search has no extra menu button')

    // Returning to the full avatar list only moves the divider. Both
    // existing panes remain mounted and keep their search/filter state.
    await rail.locator('.conversation-avatar-rail-item[title="SocCo Design Team"]').click()
    await page.waitForFunction(() => {
      const layout = document.querySelector('.social-chat-layout')
      const dock = layout?.querySelector('.conversation-avatar-rail')
      return layout?.dataset.splitExpanded === 'true' &&
        dock && dock.getBoundingClientRect().width > (innerWidth <= 350 ? 70 : 75) &&
        dock.getBoundingClientRect().width < innerWidth - 5
    }, null, {timeout: 1800})
    const reverseSeam = await measure()
    assert.ok(reverseSeam.picker && reverseSeam.rail &&
      Math.abs(reverseSeam.rail.right - reverseSeam.picker.left) < 2,
      width+'px closing picker must follow the expanding rail: '+JSON.stringify(reverseSeam))
    await page.waitForFunction(() => {
      const root = document.querySelector('.social-chat-layout')
      const avatar = root?.querySelector('.conversation-avatar-rail')
      return root?.dataset.splitExpanded === 'true' &&
        avatar && Math.abs(avatar.getBoundingClientRect().width - innerWidth) < 1.5
    }, null, {timeout: 1800})
    fullWidth((await measure()).rail, 'avatar list after closing channel picker')
    const cachedChannelFetches = channelFetches
    await rail.locator('.conversation-avatar-rail-item[title="SocCo Design Team"]').click()
    await picker.getByRole('button',{name:/Mở kênh Hỏi đáp/}).waitFor({state:'visible'})
    await page.waitForTimeout(470)
    assert.equal(channelFetches,cachedChannelFetches,
      width+'px opening the SAME group again after collapse must reuse channel data without refetching')
    await picker.getByRole('searchbox',{name:'Tìm kênh hội thoại'}).fill('Hỏi đáp')
    assert.equal(await picker.locator('.group-channel-sidebar-row').count(),1,
      width+'px searching channels filters the list')
    await picker.getByRole('searchbox',{name:'Tìm kênh hội thoại'}).fill('')
    await picker.getByRole('button',{name:/Mở kênh Hỏi đáp/}).click()

    await verifyChannelChat()

    // Back from channel goes to picker, not the conversation list.
    await panel.getByRole('button',{name:'Quay lại danh sách kênh'}).click()
    await picker.getByRole('button',{name:/Mở kênh Thảo luận chung/}).waitFor({state:'visible'})
    await rail.waitFor({state:'visible'})
    await page.waitForTimeout(360)
    assert.equal(await panel.isVisible(),false,
      width+'px back from channel returns to picker')
    assert.equal(await rail.getAttribute('data-expanded'),'false',
      width+'px avatar dock is compact in picker')
    await picker.getByRole('button',{name:/Mở kênh Thảo luận chung/}).click()
    await panel.locator('.group-room-title > strong').getByText('SocCo Design Team').waitFor()
    fullWidth((await measure()).chat,'general-channel chat')
    await panel.getByRole('button',{name:'Quay lại danh sách kênh'}).click()
    await picker.getByRole('button',{name:/Mở kênh Hỏi đáp/}).waitFor({state:'visible'})

    // Back from picker goes to the full-width conversation list again.
    await toggleRailFromMenu()
    await page.waitForFunction(() => {
      const root = document.querySelector('.social-chat-layout')
      const avatar = root?.querySelector('.conversation-avatar-rail')
      return root?.dataset.splitExpanded === 'true' &&
        avatar && Math.abs(avatar.getBoundingClientRect().width - innerWidth) < 1.5
    }, null, {timeout:1800})
    assert.ok(await layout.evaluate(el=>el.dataset.splitExpanded === 'true'),
      width+'px picker back returns to full conversation list')
    fullWidth((await measure()).rail,'conversation list after channel picker')
    assert.ok(await picker.count() === 1 && (await picker.boundingBox())?.width < 1.5,
      width+'px channel picker stays mounted but is fully clipped behind the moving divider')
    assert.equal(await panel.isVisible(),false,
      width+'px full list does not leave a partial chat pane')

    // Realtime messages update the compact and expanded avatar list
    // immediately. Pinned conversations remain ahead of newer unpinned ones.
    await page.waitForFunction(() =>
      window.__chatnetTestEventSources?.some(source => source.handlers.has('update')),
      null, {timeout:2500})
    const orderedTitles = () => rail.locator('.conversation-avatar-rail-item')
      .evaluateAll(nodes => nodes.map(node => node.title))
    const incoming = async (conversationId, minutes, text, channelId=0) => {
      const createdAt = new Date(Date.parse(now) + minutes * 60_000).toISOString()
      realtimeConversationUpdates.set(conversationId, {lastMessage:text,lastMessageAt:createdAt})
      await page.evaluate(message => {
        const source = window.__chatnetTestEventSources.findLast(item => item.handlers.has('update'))
        source.emit('update', {type:'message',conversationId:message.conversationId,message})
      }, {id:10000+minutes, conversationId, senderId:3, sender:'nam',
        text,createdAt,channelId})
    }
    await incoming(102, 1, 'Tin mới ở nhóm', 7)
    await page.waitForFunction(() =>
      document.querySelectorAll('.conversation-avatar-rail-item')[1]?.title === 'SocCo Design Team',
      null,{timeout:2500})
    assert.equal((await orderedTitles())[0], 'Linh Anh',
      width+'px a pinned conversation remains first after a group message')
    await incoming(103, 2, 'Tin nhắn mới từ Nam')
    await page.waitForTimeout(340)
    console.log('REALTIME_ORDER_AFTER_NAM', width, JSON.stringify(await rail.locator('.conversation-avatar-rail-item').evaluateAll(nodes => nodes.map(n => ({name:n.title,preview:n.querySelector('.conversation-avatar-rail-meta-bottom')?.textContent,time:n.querySelector('time')?.textContent})))))
    await page.waitForFunction(() =>
      document.querySelectorAll('.conversation-avatar-rail-item')[1]?.title === 'Nam',
      null,{timeout:2500})
    assert.deepEqual((await orderedTitles()).slice(0,3),
      ['Linh Anh','Nam','SocCo Design Team'],
      width+'px recent direct message goes above previous group activity')
    await incoming(104, 3, 'Tin mới tại Product Updates', 9)
    await page.waitForFunction(() =>
      document.querySelectorAll('.conversation-avatar-rail-item')[1]?.title === 'Product Updates',
      null,{timeout:2500})
    await toggleRailFromMenu()
    await page.waitForFunction(compact =>
      Math.abs(document.querySelector('.mobile-rail-picker-view .conversation-avatar-rail')
        ?.getBoundingClientRect().width - compact) < 1.5,
      width <= 350 ? 52 : 56, {timeout:2500})
    await incoming(103, 4, 'Nam có tin mới nhất')
    await page.waitForFunction(() =>
      document.querySelectorAll('.conversation-avatar-rail-item')[1]?.title === 'Nam',
      null,{timeout:2500})
    assert.equal((await orderedTitles())[0], 'Linh Anh',
      width+'px compact avatar dock preserves pinned chats while reordering')
    assert.equal(await rail.locator('.conversation-avatar-rail-item').count(),4,
      width+'px live updates preserve historical groups and chats')
    assert.ok(pageErrors.length===0,width+'px no client runtime exceptions: '+JSON.stringify(pageErrors))
    await context.close()
    console.log('PASS '+width+'px: one expanding rail → group → channel → direct → expand/collapse')
  }

  if (compactOnly) {
    await browser.close()
    vite.kill()
    process.exit(0)
  }

  // Regression: older groups must populate the NEW avatar rail even when the
  // first 25 recent conversations contain only direct chats.
  const historicalGroup = { ...chats[1], id: 900, name: 'Nhóm cũ của tôi' }
  const historicalDirect = { ...chats[0], id: 901, name: 'Chat cá nhân cũ', otherUserId: 902, otherUsername: 'oldfriend' }
  const recent = Array.from({ length: 25 }, (_, index) => ({
    ...chats[0], id: 200 + index, name: 'Bạn ' + index,
    otherUserId: 500 + index, otherUsername: 'user' + index,
  }))
  const desktop = await browser.newContext({
    viewport: { width: 1366, height: 900 }, serviceWorkers: 'block',
  })
  await desktop.addInitScript(value => {
    localStorage.setItem('chatnet-session', JSON.stringify(value))
    window.EventSource = class { addEventListener() {} close() {} }
  }, session)
  const desktopPage = await desktop.newPage()
  const desktopErrors = []
  desktopPage.on('pageerror', error => desktopErrors.push(error.message))
  let listUnavailable = true
  let groupLookupCount = 0
  let desktopChannelFetches = 0
  await desktopPage.route(url => url.pathname.startsWith('/api/'), async route => {
    const path = new URL(route.request().url()).pathname
    const params = new URL(route.request().url()).searchParams
    const json = (data, status = 200) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) })
    if (path === '/api/conversations') {
      if (params.has('id')) {
        const id = Number(params.get('id'))
        return json([historicalGroup,historicalDirect,...recent].filter(c => c.id === id))
      }
      if (params.get('type') === 'group') {
        groupLookupCount += 1
        return json([historicalGroup])
      }
      return listUnavailable ? json({ error: 'query failed' }, 500)
        : json(params.has('offset') ? [historicalDirect] : recent)
    }
    if (path === '/api/conversations/memberships')
      return json({ ids: [...recent.map(chat => chat.id), historicalGroup.id, historicalDirect.id].sort((a,b) => a-b), nextAfter: null })
    if (path === '/api/conversations/900/channels') {
      desktopChannelFetches += 1
      return json(channels.map(channel => ({ ...channel, conversationId: 900 })))
    }
    if (path === '/api/conversation-categories') return json([])
    if (path.startsWith('/api/conversations/') && path.endsWith('/messages')) return json([])
    if (path.startsWith('/api/conversations/') && path.endsWith('/members')) return json([])
    if (path === '/api/conversations/unread') return json({ unreadCount: 0 })
    if (path === '/api/preferences' || path === '/api/preferences/translation')
      return json({ targetLanguage:'vi', autoTranslate:false, appLocale:'vi' })
    if (path === '/api/profile') return json({ username:'viewer', displayName:'Người xem' })
    if (path === '/api/push/config') return json({ configured: false })
    return json([])
  })
  await desktopPage.goto(origin)
  const desktopRail = desktopPage.locator('.desktop-conversation-rail')
  const toggleDesktopFromMenu = async () => {
    await desktopRail.getByRole('button',{name:'Menu hội thoại'}).click()
    await desktopPage.locator('.conversation-rail-menu-popover:popover-open')
      .getByRole('button',{name:/cột avatar/}).click()
  }
  const retry = desktopRail.getByRole('button', { name: 'Thử tải lại các cuộc hội thoại' })
  await retry.waitFor({ state: 'visible', timeout: 15000 })
  assert.equal(await desktopRail.locator('.desktop-conversation-rail-entry').count(), 0,
    'HTTP 500 must display retry instead of pretending there are no conversations')
  listUnavailable = false
  await retry.click()
  await desktopRail.locator('.desktop-conversation-rail-entry[title="Nhóm cũ của tôi"]')
    .waitFor({ state: 'visible', timeout: 15000 })
  assert.equal(await desktopRail.locator('.desktop-conversation-rail-entry').count(), 26,
    'old groups beyond the first 25 recent conversations must appear in the avatar rail')
  assert.ok(groupLookupCount > 0, 'old group must come from the authorized group API')
  await desktopRail.locator('.desktop-conversation-rail-scroller').evaluate(element => {
    element.scrollTop = element.scrollHeight
  })
  await desktopRail.locator('.desktop-conversation-rail-entry[title="Chat cá nhân cũ"]')
    .waitFor({ state: 'visible', timeout: 15000 })
  assert.equal(await desktopRail.locator('.desktop-conversation-rail-entry').count(), 27,
    'scrolling the rail must load old direct conversations from the next API page')
  // Closing the expanded rail must visibly animate inward, right-to-left,
  // rather than jumping directly to the compact avatar width.
  if (await desktopRail.getAttribute('data-expanded') !== 'true') {
    await toggleDesktopFromMenu()
    await desktopPage.waitForTimeout(480)
  }
  const desktopHeader = await desktopRail.evaluate(el => {
    const rect = selector => el.querySelector(selector)?.getBoundingClientRect()
    const search = rect('.desktop-conversation-rail-search-field')
    const menu = rect('.conversation-rail-menu-trigger')
    const dock = el.getBoundingClientRect()
    return {searchWidth:search?.width, searchLeft:search?.left, searchRight:search?.right,
      menuLeft:menu?.left,menuRight:menu?.right,dockRight:dock.right,
      oldControls:el.querySelectorAll('.rail-header-quick-filters, .desktop-conversation-rail-top-category, .desktop-conversation-rail-plus, .desktop-conversation-rail-expand-toggle').length}
  })
  assert.ok(desktopHeader.oldControls === 0 &&
    desktopHeader.searchWidth >= 150 &&
    desktopHeader.menuRight < desktopHeader.searchLeft &&
    desktopHeader.searchRight <= desktopHeader.dockRight + 1,
    'Desktop avatar header has the hamburger replacing arrow and extended name search only: '+
      JSON.stringify(desktopHeader))
  const expandedRailBounds = await desktopRail.boundingBox()
  const expandedMenuBounds = await desktopRail.getByRole('button',{name:'Menu hội thoại'}).boundingBox()
  await toggleDesktopFromMenu()
  await desktopPage.waitForTimeout(100)
  const collapsingRailBounds = await desktopRail.boundingBox()
  assert.ok(expandedRailBounds && collapsingRailBounds &&
    collapsingRailBounds.width < expandedRailBounds.width - 10 &&
    collapsingRailBounds.width > 90 &&
    Math.abs(collapsingRailBounds.x - expandedRailBounds.x) < 1,
    'Desktop rail must smoothly contract its RIGHT edge: '+JSON.stringify({expandedRailBounds,collapsingRailBounds}))
  await desktopPage.waitForTimeout(470)
  const compactRailBounds = await desktopRail.boundingBox()
  const compactMenuBounds = await desktopRail.getByRole('button',{name:'Menu hội thoại'}).boundingBox()
  assert.ok(expandedMenuBounds && compactMenuBounds &&
    Math.abs(expandedMenuBounds.x - compactMenuBounds.x) < .6 &&
    Math.abs(expandedMenuBounds.y - compactMenuBounds.y) < .6,
    'Desktop hamburger must not move when avatar rail collapses: '+JSON.stringify({expandedMenuBounds,compactMenuBounds}))
  assert.equal(await desktopRail.locator('.desktop-conversation-rail-divider').isVisible(), false,
    'Desktop rail no longer shows a horizontal divider beneath its menu')
  assert.ok(compactRailBounds && Math.abs(compactRailBounds.width - 72) < 2,
    'Desktop rail must finish at the original compact width: '+JSON.stringify(compactRailBounds))
  const hamburgerStyle = await desktopRail.getByRole('button',{name:'Menu hội thoại'}).evaluate(button => {
    const icon=button.querySelector('svg'), rect=button.getBoundingClientRect()
    const rail=button.closest('.desktop-conversation-rail').getBoundingClientRect()
    return {iconWidth:icon?.getBoundingClientRect().width, stroke:icon?.getAttribute('stroke-width'),
      leftOffset:rect.left-rail.left}
  })
  assert.ok(hamburgerStyle.iconWidth === 26 && hamburgerStyle.stroke === '2.5' &&
    hamburgerStyle.leftOffset >= 14 && hamburgerStyle.leftOffset <= 23,
    'Compact desktop hamburger stays at the former arrow position: '+JSON.stringify(hamburgerStyle))
  await desktopRail.locator('.desktop-conversation-rail-entry[title="Nhóm cũ của tôi"]').click()
  await desktopPage.locator('.group-channel-sidebar').waitFor({ state: 'visible' })
  // Diagnose the group information sidebar over narrow tablet and wide desktop.
  await desktopPage.locator('.conversation-panel .translate-controls [aria-label="Thông tin hội thoại"]').click()
  await desktopPage.locator('#conversation-details-panel').waitFor({state:'visible'})
  for (const vw of [800,960,1366,1586]) {
    await desktopPage.setViewportSize({width:vw,height:900})
    await desktopPage.waitForTimeout(120)
    const metrics=await desktopPage.locator('#conversation-details-panel').evaluate(el=>{
      const p=el.getBoundingClientRect(),root=el.parentElement.getBoundingClientRect(),chat=el.parentElement.querySelector('.conversation-panel').getBoundingClientRect()
      const style=getComputedStyle(el)
      const at=document.elementFromPoint(p.left+Math.min(p.width/2,100),p.top+35)
      return {width:p.width,x:p.x,right:p.right,rootRight:root.right,chatRight:chat.right,height:p.height,display:style.display,position:style.position,zIndex:style.zIndex,overlaid:at===el||el.contains(at),columns:getComputedStyle(el.parentElement).gridTemplateColumns}
    })
    assert.ok(metrics.width >= (vw >= 1420 ? 290 : 250) &&
      metrics.width <= 350 && metrics.height > 500 &&
      metrics.x >= 0 && metrics.right <= metrics.rootRight &&
      metrics.rootRight - metrics.right < 45 && metrics.overlaid &&
      metrics.display === 'flex' && metrics.position === 'absolute',
      vw+'px group info pane must have its original readable width and remain on top: '+
        JSON.stringify(metrics))
  }
  // The 'Members' management page uses the same layout and must not collapse
  // into an implicit third track either.
  await desktopPage.locator('#conversation-details-panel').getByRole('button',{name:'Thành viên'}).click()
  await desktopPage.locator('.group-settings-sidebar').waitFor({state:'visible'})
  const groupManagementWidth = await desktopPage.locator('.group-settings-sidebar').evaluate(el => ({
    width:el.getBoundingClientRect().width,
    x:el.getBoundingClientRect().x,
    right:el.getBoundingClientRect().right,
    position:getComputedStyle(el).position,
  }))
  assert.ok(groupManagementWidth.width >= 290 &&
    groupManagementWidth.right <= 1586 && groupManagementWidth.x > 1000,
    'Wide desktop group management must not shrink behind group splitter: '+
      JSON.stringify(groupManagementWidth))
  await desktopPage.getByRole('button',{name:'Đóng thanh quản lý nhóm'}).click()
  await desktopPage.setViewportSize({width:1366,height:900})
  const desktopChannelToolbar = desktopPage.locator('.group-channel-sidebar-topbar')
  if (await desktopChannelToolbar.isVisible()) {
    const borderWidth = await desktopChannelToolbar.evaluate(el => getComputedStyle(el).borderBottomWidth)
    if (borderWidth !== '') assert.equal(borderWidth, '0px',
      'Desktop channel picker must not show the remaining horizontal separator')
  }
  // Desktop uses the SAME reciprocal split as mobile: the avatar and channel
  // columns gain/lose exactly complementary widths on every animation frame.
  await desktopPage.waitForFunction(() => {
    const layout = document.querySelector('.social-chat-layout.desktop-channel-panel-open.group-channel-workspace')
    const rail = layout?.querySelector('.desktop-conversation-rail')
    const picker = layout?.querySelector('.group-channel-sidebar')
    return layout && rail && picker && rail.getBoundingClientRect().width > 0 &&
      picker.getBoundingClientRect().width > 100 &&
      getComputedStyle(layout, '::after').content !== 'none'
  }, null, {timeout: 2500})
  const desktopMotion = await desktopPage.evaluate(async () => {
    const layout = document.querySelector('.social-chat-layout.desktop-channel-panel-open.group-channel-workspace')
    const rail = layout.querySelector('.desktop-conversation-rail')
    const picker = layout.querySelector('.group-channel-sidebar')
    const chat = layout.querySelector('.conversation-panel')
    const toggle = () => {
      rail.querySelector('.conversation-rail-menu-trigger').click()
      rail.querySelector('.conversation-rail-menu-item:last-child').click()
    }
    const sample = () => {
      const a = rail.getBoundingClientRect()
      const b = picker.getBoundingClientRect()
      const c = chat.getBoundingClientRect()
      const l = layout.getBoundingClientRect()
      return {a:a.width,b:b.width,gap:b.left-a.right,
        lineGap:parseFloat(getComputedStyle(layout,'::after').left)-(a.right-l.left-1),
        chatLeft:c.left,layout:getComputedStyle(layout).gridTemplateColumns}
    }
    const avatarRowNode = rail.querySelector('.desktop-conversation-rail-entry')
    const avatarSearchNode = rail.querySelector('.desktop-conversation-rail-search-field')
    const channelRowNode = picker.querySelector('.group-channel-sidebar-row')
    const channelSearchNode = picker.querySelector('.group-channel-sidebar-search')
    let childListMutations = 0
    const observer = new MutationObserver(records => {
      childListMutations += records.filter(record=>record.type === 'childList').length
    })
    observer.observe(rail,{subtree:true,childList:true})
    observer.observe(picker,{subtree:true,childList:true})
    const trajectory = [sample()]
    const frames = async count => {
      for(let i=0;i<count;i++) {
        await new Promise(requestAnimationFrame)
        trajectory.push(sample())
      }
    }
    const compact = sample()
    toggle()
    await frames(9)
    const expanding = sample()
    await frames(9)
    const expandedMore = sample()
    toggle()
    await frames(12)
    const reversing = sample()
    const maxFrameJump = Math.max(...trajectory.slice(1).map((frame,i) =>
      Math.abs(frame.a - trajectory[i].a)))
    observer.disconnect()
    const sameNodes = avatarRowNode === rail.querySelector('.desktop-conversation-rail-entry') &&
      avatarSearchNode === rail.querySelector('.desktop-conversation-rail-search-field') &&
      channelRowNode === picker.querySelector('.group-channel-sidebar-row') &&
      channelSearchNode === picker.querySelector('.group-channel-sidebar-search')
    return {compact,expanding,expandedMore,reversing,maxFrameJump,
      sameNodes,childListMutations}
  })
  const desktopFrames = [desktopMotion.compact,desktopMotion.expanding,desktopMotion.expandedMore,desktopMotion.reversing]
  assert.ok(desktopFrames.every(frame => frame.layout.split(' ').length >= 2 &&
      Math.abs(frame.a + frame.b - (desktopMotion.compact.a + desktopMotion.compact.b)) < 2 &&
      Math.abs(frame.gap) < 2 && Math.abs(frame.lineGap) < 2 &&
      Math.abs(frame.chatLeft - desktopMotion.compact.chatLeft) < 2) &&
      desktopMotion.expanding.a > desktopMotion.compact.a + 2 &&
      desktopMotion.expanding.b < desktopMotion.compact.b - 2 &&
      desktopMotion.expandedMore.a > desktopMotion.expanding.a + 2 &&
      desktopMotion.expandedMore.b < desktopMotion.expanding.b - 2 &&
      desktopMotion.reversing.a < desktopMotion.expandedMore.a - 2 &&
      desktopMotion.reversing.b > desktopMotion.expandedMore.b + 2 &&
      desktopMotion.maxFrameJump < 70 && desktopMotion.sameNodes,
    'Desktop moving divider must expand and collapse both panes SIMULTANEOUSLY while chat stays fixed: '+
      JSON.stringify(desktopMotion))
  await desktopPage.waitForTimeout(700)
  const desktopCompactMeta = await desktopRail.evaluate(el => {
    const edge = el.getBoundingClientRect().right
    const name = el.querySelector('.desktop-conversation-rail-meta')?.getBoundingClientRect().left
    return {edge,name,exposed: name === undefined ? -1 : edge-name}
  })
  assert.ok(desktopCompactMeta.name !== undefined && desktopCompactMeta.exposed <= 0,
    'Desktop compact avatar dock must fully hide user names: '+JSON.stringify(desktopCompactMeta))
  const desktopSearchClip = await desktopRail.evaluate(el => {
    const edge = el.getBoundingClientRect().right
    const search = el.querySelector('.desktop-conversation-rail-search-field')
    return {edge,inputLeft:search?.getBoundingClientRect().left}
  })
  assert.ok(desktopSearchClip.inputLeft !== undefined &&
    desktopSearchClip.inputLeft >= desktopSearchClip.edge,
    'Desktop compact avatar dock must fully conceal conversation search: '+JSON.stringify(desktopSearchClip))
  assert.ok(await desktopPage.locator('.social-chat-layout.desktop-channel-panel-open').isVisible(),
    'rapid reversal keeps desktop channel picker open; stale close timer must not hide it')
  for (const viewportWidth of [960, 800]) {
    await desktopPage.setViewportSize({width:viewportWidth,height:900})
    await desktopPage.waitForTimeout(680)
    const narrow = await desktopPage.locator('.social-chat-layout.desktop-channel-panel-open').evaluate(el => {
      const rail = el.querySelector('.desktop-conversation-rail').getBoundingClientRect()
      const picker = el.querySelector('.group-channel-sidebar').getBoundingClientRect()
      const chat = el.querySelector('.conversation-panel').getBoundingClientRect()
      const layout = el.getBoundingClientRect()
      return {railWidth:rail.width,pickerWidth:picker.width,
        gap:picker.left-rail.right,divider:parseFloat(getComputedStyle(el,'::after').left)-(rail.right-layout.left-1),
        chatLeft:chat.left,chatWidth:chat.width,overflow:document.documentElement.scrollWidth-innerWidth}
    })
    assert.ok(narrow.railWidth >= 62 && narrow.railWidth <= 66 &&
      narrow.pickerWidth > 255 && narrow.pickerWidth < 285 &&
      Math.abs(narrow.gap) < 2 && Math.abs(narrow.divider) < 2 &&
      narrow.chatWidth > 150 && narrow.overflow < 2,
      viewportWidth+'px desktop reciprocal pane geometry must remain joined without overflow: '+JSON.stringify(narrow))
  }

  // Presentation-only collapse does not clear the selected group. Reopening
  // its channels must reuse the same fetch result instead of remounting data.
  await desktopRail.locator('.desktop-conversation-rail-entry[title="Nhóm cũ của tôi"]').click()
  await desktopPage.waitForFunction(() => {
    const root = document.querySelector('.social-chat-layout.desktop-channel-panel-open')
    const avatar = root?.querySelector('.desktop-conversation-rail')
    const picker = root?.querySelector('.group-channel-sidebar')
    return root?.dataset.splitExpanded === 'true' && avatar && picker &&
      picker.getBoundingClientRect().width < 1.5 &&
      avatar.getBoundingClientRect().width > 300
  }, null, {timeout: 2000})
  const beforeReopen = desktopChannelFetches
  await desktopRail.locator('.desktop-conversation-rail-entry[title="Nhóm cũ của tôi"]').click()
  await desktopPage.waitForFunction(() => {
    const root = document.querySelector('.social-chat-layout.desktop-channel-panel-open')
    const picker = root?.querySelector('.group-channel-sidebar')
    return root?.dataset.splitExpanded === 'false' &&
      picker && picker.getBoundingClientRect().width > 180
  }, null, {timeout: 2000})
  await desktopPage.waitForTimeout(200)
  assert.equal(desktopChannelFetches, beforeReopen,
    'Desktop reopen of the same cached group must not fetch channels again')

  // Desktop group picker → direct chat preserves the former split motion:
  // the old channel pane retracts completely before changing conversation.
  await desktopRail.locator('.desktop-conversation-rail-entry[title="Chat cá nhân cũ"]').click()
  await desktopPage.waitForTimeout(110)
  const desktopRetracting = await desktopPage.locator('.social-chat-layout').evaluate(el => {
    const rail = el.querySelector('.desktop-conversation-rail')?.getBoundingClientRect()
    const picker = el.querySelector('.group-channel-sidebar')?.getBoundingClientRect()
    return {
      oldGroup: Boolean(el.querySelector('.desktop-conversation-rail-entry[title="Nhóm cũ của tôi"].selected')),
      expanding: el.dataset.splitExpanded === 'true',
      stillPicker: el.classList.contains('desktop-channel-panel-open'),
      railWidth: rail?.width,
      channelWidth: picker?.width,
      seamGap: rail && picker ? picker.left-rail.right : null,
      overlay: Boolean(document.querySelector('.chatnet-outgoing-group-picker')),
    }
  })
  assert.ok(desktopRetracting.oldGroup && desktopRetracting.expanding && desktopRetracting.stillPicker &&
    desktopRetracting.railWidth > 75 && desktopRetracting.channelWidth > 5 &&
    Math.abs(desktopRetracting.seamGap) < 2 && !desktopRetracting.overlay,
    'Desktop previous channel picker must retract before switching to private chat: '+
      JSON.stringify(desktopRetracting))
  await desktopPage.locator('.conversation-panel .visitor-name-link')
    .getByText('Chat cá nhân cũ').waitFor({state:'visible',timeout:2500})
  assert.ok(await desktopPage.locator('.social-chat-layout').evaluate(el =>
    !el.classList.contains('desktop-channel-panel-open')),
    'Desktop direct chat opens after the group picker has retracted')

  // Private chat -> group: the route may resolve asynchronously. The incoming
  // group splitter MUST start at the fully expanded rail and only THEN move
  // left to progressively reveal channels. User names never shift sideways.
  const privateName = await desktopRail.locator('.desktop-conversation-rail-entry[title="Nhóm cũ của tôi"] .desktop-conversation-rail-meta').boundingBox()
  const privateAvatar = await desktopRail.locator('.desktop-conversation-rail-entry[title="Nhóm cũ của tôi"] .desktop-conversation-rail-avatar').boundingBox()
  const privateDock = await desktopRail.boundingBox()
  await desktopPage.evaluate(() => {
    const samples = []
    window.__chatnetSlideSamples = samples
    const start = performance.now()
    const sample = () => {
      const root = document.querySelector('.social-chat-layout')
      const rail = root?.querySelector('.desktop-conversation-rail')
      const picker = root?.querySelector('.group-channel-sidebar')
      const name = root?.querySelector('.desktop-conversation-rail-entry[title="Nhóm cũ của tôi"] .desktop-conversation-rail-meta')
      const avatar = root?.querySelector('.desktop-conversation-rail-entry[title="Nhóm cũ của tôi"] .desktop-conversation-rail-avatar')
      samples.push({t:Math.round(performance.now()-start),group:root?.classList.contains('desktop-channel-panel-open'),
        split:root?.dataset.splitExpanded,railW:rail?.getBoundingClientRect().width,
        channelW:picker?.getBoundingClientRect().width,nameX:name?.getBoundingClientRect().x,
        avatarX:avatar?.getBoundingClientRect().x,avatarY:avatar?.getBoundingClientRect().y,
        dockX:rail?.getBoundingClientRect().x,
        cssSplit:root && getComputedStyle(root).getPropertyValue('--desktop-chat-split').trim(),
        cssWorkspace:root && getComputedStyle(root).getPropertyValue('--desktop-chat-workspace').trim(),
        railCssWidth:rail && getComputedStyle(rail).width,
        rootClass:root?.className})
      if(performance.now()-start<1800) requestAnimationFrame(sample)
    }
    requestAnimationFrame(sample)
  })
  await desktopRail.locator('.desktop-conversation-rail-entry[title="Nhóm cũ của tôi"]').click()
  await desktopPage.waitForTimeout(1050)
  const slideSamples = await desktopPage.evaluate(() => window.__chatnetSlideSamples || [])
  const movingSamples = slideSamples.filter(frame => frame.group && frame.split === 'false' &&
    frame.railW > 85 && frame.channelW > 10 && frame.channelW < 200)
  const initialSamples = slideSamples.filter(frame => frame.group && frame.split === 'true' &&
    frame.channelW < 2)
  assert.ok(movingSamples.length >= 2 && initialSamples.length >= 1,
    'Desktop private-to-group must first stage channel width 0, then slide open: '+
      JSON.stringify({first:slideSamples.filter(s=>s.group).slice(0,5),
        maxChannel:Math.max(0,...slideSamples.map(s=>s.channelW||0))}))
  const groupOpening = movingSamples[Math.floor(movingSamples.length / 2)]
  assert.ok(privateName && privateAvatar && privateDock &&
    Math.abs(privateName.x-groupOpening.nameX) < 1.5 &&
    Math.abs(privateAvatar.x-groupOpening.avatarX) < 1.5 &&
    Math.abs(privateAvatar.y-groupOpening.avatarY) < 1.5 &&
    Math.abs(privateDock.x-groupOpening.dockX) < 1.5,
    'Desktop private-to-group keeps avatar rail, avatar image and name fixed: '+
      JSON.stringify({privateName,privateAvatar,privateDock,groupOpening}))

  assert.deepEqual(desktopErrors, [], 'no runtime errors across older group and private chat navigation')
  await desktop.close()
  console.log('PASS desktop: retry HTTP 500 → restore historical groups in avatar rail → open group')
} finally {
  if(browser) await browser.close()
  vite.kill('SIGTERM')
}