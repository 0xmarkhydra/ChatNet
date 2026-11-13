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
    categoryId: 5, unreadCount: 2, online: true, lastMessage: 'Xin chào', createdAt: now, lastMessageAt: now },
  { id: 102, type: 'group', name: 'SocCo Design Team', memberCount: 4,
    avatarMembers: ['linhanh', 'nam', 'viewer'], muted: true, unreadCount: 4, online: false, lastMessage: 'Có tin mới', createdAt: now, lastMessageAt: now },
  { id: 103, type: 'direct', name: 'Nam', otherUserId: 3, otherUsername: 'nam', memberCount: 2,
    unreadCount: 0, online: false, lastMessage: 'Hẹn gặp', createdAt: now, lastMessageAt: now },
]
const channels = [
  { id: 0, conversationId: 102, name: 'Thảo luận chung', description: 'Thông tin chung', unreadCount: 1,
    lastMessage: 'Tin chung', lastMessageAt: now },
  { id: 7, conversationId: 102, name: 'Hỏi đáp', description: 'Hỏi đáp thiết kế', unreadCount: 3,
    lastMessage: 'Tin hỏi đáp', lastMessageAt: now },
]
let browser
try {
  let ready = false
  for (let i=0; i<65; i++) {
    try { if ((await fetch(origin)).ok) { ready = true; break } } catch { /* wait */ }
    await delay(150)
  }
  assert.ok(ready, 'Vite did not start')
  browser = await chromium.launch({headless:true})
  for (const width of [320,390,430]) {
    const context = await browser.newContext({
      viewport: {width,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true,serviceWorkers:'block',
    })
    await context.addInitScript(value => {
      localStorage.setItem('chatnet-session', JSON.stringify(value))
      window.EventSource = class { addEventListener() {} close() {} }
    }, session)
    const page = await context.newPage()
    const pageErrors = []
    page.on('pageerror', e => pageErrors.push(e.message))
    await page.route(url => url.pathname.startsWith('/api/'), async route => {
      const req = route.request()
      const path = new URL(req.url()).pathname
      const json = (data,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)})
      if (req.method() === 'OPTIONS') return json({})
      if (path === '/api/conversations') return json(chats)
      if (path === '/api/conversation-categories') return json([{id:5,name:'Công việc',color:'orange'}])
      if (path === '/api/conversations/memberships') return json({ids:chats.map(c=>c.id),nextAfter:null})
      if (path === '/api/conversations/102/channels') return json(channels)
      if (path === '/api/conversations/102/channel-read') return json({conversationId:102,channelId:7,lastReadMessageId:0})
      if (/^\/api\/conversations\/\d+\/messages$/.test(path)) return json([])
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
    assert.equal(await rail.locator('.conversation-avatar-rail-item').count(),3,
      width+'px all chats and groups appear in the same full-width list')
    assert.equal(await rail.locator('.conversation-avatar-rail-meta:visible').count(),3,
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
    const filters = page.locator('.conversation-rail-floating-filters .conversation-rail-filter-options')
    await rail.locator('.conversation-avatar-rail-search-line input').first().click()
    await filters.waitFor({state:'visible'})
    for(const label of ['Tất cả','Chưa đọc','Nhóm'])
      await filters.getByRole('button',{name:label}).waitFor({state:'visible'})
    await page.mouse.click(width-4,128)
    await filters.waitFor({state:'detached'})

    // Screen 2a: choosing a person opens that person's full-screen chat.
    await rail.locator('.conversation-avatar-rail-item[title="Linh Anh"]').click()
    await panel.locator('.visitor-name-link').getByText('Linh Anh').waitFor()
    await page.waitForTimeout(360)
    assert.ok(await layout.evaluate(el=>el.classList.contains('mobile-rail-chat-view')),
      width+'px direct chat uses the chat-only view')
    assert.equal(await rail.isVisible(),false,
      width+'px avatar dock must disappear from direct chat')
    fullWidth((await measure()).chat,'direct chat')
    assert.ok(await panel.locator('.media-composer').isVisible(),width+'px direct chat composer')
    const direct = await measure()
    await panel.getByRole('button',{name:'Quay lại danh sách'}).click()
    await rail.waitFor({state:'visible'})
    await page.waitForTimeout(350)
    fullWidth((await measure()).rail,'conversation list after direct chat')
    assert.equal(await panel.isVisible(),false,
      width+'px direct chat closes when returning to the full list')

    // Screen 2b: group opens the *joined* narrow avatar dock + channel picker.
    await rail.locator('.conversation-avatar-rail-item[title="SocCo Design Team"]').click()
    await picker.getByRole('button',{name:/Mở kênh Hỏi đáp/}).waitFor({state:'visible'})
    await page.waitForTimeout(410)
    assert.ok(await layout.evaluate(el=>el.classList.contains('mobile-rail-picker-view')),
      width+'px group selection opens channel-picking screen')
    assert.equal(await rail.getAttribute('data-expanded'),'false',
      width+'px avatar rail collapses beside channel picker')
    const joined = await measure()
    assert.ok(joined.rail && joined.picker &&
      Math.abs(joined.rail.width-(width<=350?52:56))<1.5 &&
      Math.abs(joined.rail.right-joined.picker.left)<1.5 &&
      Math.abs(joined.picker.right-width)<1.5 &&
      Math.abs(joined.divider.top-(joined.pickerToolbar.bottom-1))<1.5 &&
      joined.horizontalOverflow<2,
      width+'px avatar dock and channel picker join seamlessly: '+JSON.stringify(joined))
    assert.equal(await panel.isVisible(),false,
      width+'px chat remains hidden until a channel is selected')
    assert.equal(await picker.locator('.group-channel-sidebar-caption').count(),0,
      width+'px no redundant channel-list heading')
    assert.equal(await picker.locator('.group-channel-sidebar-more').count(),0,
      width+'px channel search has no extra menu button')
    await picker.getByRole('searchbox',{name:'Tìm kênh hội thoại'}).fill('Hỏi đáp')
    assert.equal(await picker.locator('.group-channel-sidebar-row').count(),1,
      width+'px searching channels filters the list')
    await picker.getByRole('searchbox',{name:'Tìm kênh hội thoại'}).fill('')
    await picker.getByRole('button',{name:/Mở kênh Hỏi đáp/}).click()

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
    assert.ok(Math.abs(groupChat.header.height-direct.header.height)<1.5 &&
      Math.abs(groupChat.chat.height-direct.chat.height)<1.5 &&
      Math.abs(groupChat.composer.width-direct.composer.width)<1.5,
      width+'px group and direct chat share the same layout: '+JSON.stringify({direct,groupChat}))
    assert.ok(await panel.locator('.media-composer').isVisible(),
      width+'px channel chat composer remains usable')
    const actions=await panel.locator('.group-mobile-actions').evaluate(el =>
      [...el.querySelectorAll('.call-header-actions button, .group-more-trigger')].map(btn=>{
        const r=btn.getBoundingClientRect()
        return {w:r.width,h:r.height,right:r.right}
      }))
    assert.equal(actions.length,5,width+'px chat header retains all five actions')
    assert.ok(actions.every(action=>Math.abs(action.w-actions[0].w)<1 &&
      Math.abs(action.h-actions[0].h)<1 && action.right<=width+1),
      width+'px chat header actions must be aligned: '+JSON.stringify(actions))

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
    await rail.getByRole('button',{name:'Mở rộng cột avatar'}).click()
    await page.waitForTimeout(360)
    assert.ok(await layout.evaluate(el=>el.classList.contains('mobile-rail-list-view')),
      width+'px picker back returns to full conversation list')
    fullWidth((await measure()).rail,'conversation list after channel picker')
    assert.equal(await picker.isVisible(),false,
      width+'px channel picker is hidden on the main list')
    assert.equal(await panel.isVisible(),false,
      width+'px full list does not leave a partial chat pane')
    assert.ok(pageErrors.length===0,width+'px no client runtime exceptions: '+JSON.stringify(pageErrors))
    await context.close()
    console.log('PASS '+width+'px: one expanding rail → group → channel → direct → expand/collapse')
  }
} finally {
  if(browser) await browser.close()
  vite.kill('SIGTERM')
}