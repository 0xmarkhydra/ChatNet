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
  '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
  stdio: 'ignore', cwd: fileURLToPath(new URL('../', import.meta.url)),
})
const now = new Date().toISOString()
const session = {
  token: 'mock.' + Buffer.from(JSON.stringify({exp:4102444800})).toString('base64url') + '.signed',
  refreshToken:'r'.repeat(43),sessionId:'conversation-hover-menu',
  user:{id:1,username:'viewer',displayName:'Người xem',email:'viewer@example.invalid'},
}
const conversations = [
  {id:101,type:'direct',name:'Linh Anh',otherUserId:2,otherUsername:'linhanh',memberCount:2,
    categoryId:5,unreadCount:1,lastMessage:'hello',createdAt:now,lastMessageAt:now},
  {id:102,type:'group',name:'Nhóm Sản phẩm',memberCount:3,avatarMembers:['viewer','linhanh'],
    unreadCount:1,lastMessage:'group',createdAt:now,lastMessageAt:now},
]
const channels = [
  {id:0,conversationId:102,name:'Thảo luận chung',description:'Tổng quan',unreadCount:0,lastMessage:'',lastMessageAt:now},
  {id:7,conversationId:102,name:'Hỏi đáp',description:'Câu hỏi',unreadCount:0,lastMessage:'',lastMessageAt:now},
]
let browser
try {
  for (let i=0;i<65;i++) {
    try {if ((await fetch(origin)).ok) break} catch {}
    await delay(150)
  }
  browser = await chromium.launch({headless:true})
  for (const width of [900,1366,1680]) {
    const isMobile = width <= 760
    const context = await browser.newContext({
      viewport:{width,height:850},isMobile,hasTouch:isMobile,serviceWorkers:'block',
    })
    await context.addInitScript(value => {
      localStorage.setItem('chatnet-session',JSON.stringify(value))
      window.EventSource = class {addEventListener(){} close(){}}
    },session)
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', e => errors.push(e.message))
    await page.route(url => url.pathname.startsWith('/api/'), async route => {
      const url = new URL(route.request().url()), path = url.pathname
      const json = (data,status=200) => route.fulfill({
        status,contentType:'application/json',body:JSON.stringify(data),
      })
      if (path === '/api/conversations') {
        const id = url.searchParams.get('id')
        const category = url.searchParams.get('category')
        if (url.searchParams.get('type') === 'group') return json([conversations[1]])
        if (category !== null) return json(conversations.filter(c => (c.categoryId || 0) === Number(category)))
        return json(id ? conversations.filter(c => c.id === Number(id)) : conversations)
      }
      if (path === '/api/conversations/memberships')
        return json({ids:conversations.map(c=>c.id),nextAfter:null})
      if (path === '/api/conversation-categories')
        return json([{id:5,name:'Công việc',color:'orange'}])
      if (path === '/api/conversations/102/channels') return json(channels)
      if (/^\/api\/conversations\/\d+\/messages$/.test(path)) return json([])
      if (/^\/api\/conversations\/\d+\/members$/.test(path)) return json([])
      if (path === '/api/conversations/unread') return json({unreadCount:1})
      if (path === '/api/preferences' || path === '/api/preferences/translation')
        return json({targetLanguage:'vi',autoTranslate:false,appLocale:'vi'})
      if (path === '/api/profile') return json({username:'viewer',displayName:'Người xem'})
      if (path === '/api/push/config') return json({configured:false})
      return json([])
    })
    await page.goto(origin)
    const rail=page.locator(isMobile?'.conversation-avatar-rail':'.desktop-conversation-rail')
    const rowSelector=isMobile?'.conversation-avatar-rail-item':'.desktop-conversation-rail-entry'
    const item=rail.locator(rowSelector)
    await item.first().waitFor({state:'visible',timeout:15000})
    const hamburger=rail.getByRole('button',{name:'Menu hội thoại'})
    await hamburger.waitFor({state:'visible'})
    await page.emulateMedia({reducedMotion:'reduce'})
    const rows=rail.locator('.desktop-conversation-rail-row')
    const first=rows.filter({hasText:'Linh Anh'})
    const second=rows.filter({hasText:'Nhóm Sản phẩm'})
    const verify = async (phase) => {
      await page.mouse.move(width-25,700)
      await page.evaluate(()=>document.activeElement?.blur())
      const time=first.locator('time'), menu=first.locator('.desktop-conversation-rail-more-action')
      await time.waitFor({state:'visible',timeout:5000})
      assert.equal(await menu.isVisible(),false,phase+' menu hidden at rest')
      await page.waitForTimeout(350)
      const before=await time.boundingBox()
      await first.locator('.desktop-conversation-rail-entry').hover({timeout:5000})
      await menu.waitFor({state:'visible',timeout:5000})
      assert.equal(await time.isVisible(),false,phase+' time hidden on hover')
      assert.equal(await second.locator('.desktop-conversation-rail-more-action').isVisible(),false)
      const action=await menu.boundingBox()
      assert.ok(before && action && Math.abs(before.x+before.width-action.x-action.width)<=2 && Math.abs(before.y+before.height/2-action.y-action.height/2)<=2,JSON.stringify({phase,before,action}))
      await menu.click()
      const popup=page.getByRole('dialog',{name:'Tùy chọn cuộc trò chuyện Linh Anh'})
      await popup.waitFor({state:'visible'})
      await page.keyboard.press('Escape')
      await popup.waitFor({state:'hidden'})
      await page.mouse.move(width-25,700)
      await page.evaluate(()=>document.activeElement?.blur())
      await time.waitFor({state:'visible'})
      assert.equal(await menu.isVisible(),false)
      console.log('PASS',width,phase,JSON.stringify({before,action}))
    }
    await verify('initial conversation list')
    await second.locator('.desktop-conversation-rail-avatar').click({timeout:5000})
    await page.locator('.social-chat-layout.group-channel-workspace.desktop-channel-panel-open').waitFor({state:'visible',timeout:5000})
    await page.waitForTimeout(700)
    const popover=page.locator('.conversation-rail-menu-popover:popover-open')
    // The picker can be initially expanded after a responsive layout update.
    // Explicitly collapse it through the real menu before testing the return.
    if (await page.locator('.social-chat-layout.avatar-rail-layout').getAttribute('data-split-expanded') === 'true') {
      await hamburger.click()
      await popover.getByRole('button',{name:/Thu gọn cột avatar|Mở rộng cột avatar/}).click()
    }
    await page.waitForFunction(()=>document.querySelector('.social-chat-layout.avatar-rail-layout')?.dataset.splitExpanded!=='true',null,{timeout:5000})
    await page.waitForTimeout(450)
    assert.equal(await first.locator('.desktop-conversation-rail-more-action').isVisible(),false)
    await hamburger.click()
    await popover.getByRole('button',{name:'Tìm hội thoại'}).click()
    await page.waitForFunction(()=>document.querySelector('.social-chat-layout.avatar-rail-layout')?.dataset.splitExpanded==='true',null,{timeout:5000})
    await page.waitForTimeout(450)
    await verify('return from channel picker')
    await hamburger.click()
    await popover.getByRole('button',{name:/Thu gọn cột avatar|Mở rộng cột avatar/}).click()
    await page.waitForFunction(()=>document.querySelector('.social-chat-layout.avatar-rail-layout')?.dataset.splitExpanded!=='true',null,{timeout:5000})
    await page.waitForTimeout(450)
    await hamburger.click()
    await popover.getByRole('button',{name:/Thu gọn cột avatar|Mở rộng cột avatar/}).click()
    await page.waitForFunction(()=>document.querySelector('.social-chat-layout.avatar-rail-layout')?.dataset.splitExpanded==='true',null,{timeout:5000})
    await page.waitForTimeout(450)
    await verify('after second split cycle')
    assert.deepEqual(errors,[])
    await context.close()
  }
} finally {
  await browser?.close()
  vite.kill()
}