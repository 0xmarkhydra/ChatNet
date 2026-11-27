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
  refreshToken:'r'.repeat(43),sessionId:'conversation-info-parity',
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
  for (const width of [320,390,768,1024,1366,1440,1680]) {
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
    await page.emulateMedia({reducedMotion:'reduce'})
    const measure = async () => {
      await page.locator('.chat-head').getByRole('button',{name:'Thông tin hội thoại',exact:true}).click()
      const panel = page.locator('#conversation-details-panel')
      await panel.waitFor({state:'visible'})
      const result = await panel.evaluate(p => {
        const size = e => { const r = e.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)] }
        const bounds = p.getBoundingClientRect()
        return {panel:size(p), avatar:size(p.querySelector('.conversation-info-panel-avatar')), header:size(p.querySelector('.conversation-details-heading')), row:size(p.querySelector('.conversation-info-group-menu > button')), right:Math.round(bounds.right), left:Math.round(bounds.left), top:Math.round(bounds.top)}
      })
      await panel.getByRole('button',{name:'Đóng thông tin hội thoại'}).click()
      return result
    }
    await item.filter({hasText:'Linh Anh'}).first().click()
    const direct = await measure()
    if (isMobile) await page.getByRole('button',{name:'Quay lại danh sách',exact:true}).click()
    await item.filter({hasText:'Nhóm Sản phẩm'}).first().click()
    await page.getByRole('button',{name:/Mở kênh Thảo luận chung/}).click()
    const group = await measure()
    if (isMobile) await page.getByRole('button',{name:'Quay lại danh sách kênh'}).click()
    await page.getByRole('button',{name:/Mở kênh Hỏi đáp/}).click()
    const channel = await measure()
    console.log(width, JSON.stringify({direct,group,channel}))
    for (const actual of [group,channel]) {
      for (const key of ['panel','avatar','header','row','right','left','top']) assert.deepEqual(actual[key],direct[key],width+'px '+key+' mismatch')
    }
    assert.ok(direct.left>=0 && direct.right<=width && direct.panel[0]>0)
    assert.deepEqual(errors,[])
    await context.close()
  }
} finally {
  await browser?.close()
  vite.kill()
}
