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
  refreshToken:'r'.repeat(43),sessionId:'quick-like-check',
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
  for (const width of [320,390,1366]) {
    const isMobile = width <= 760
    const context = await browser.newContext({
      viewport:{width,height:850},isMobile,hasTouch:isMobile,serviceWorkers:'block',
    })
    await context.addInitScript(value => {
      localStorage.setItem('chatnet-session',JSON.stringify(value))
      window.EventSource = class {addEventListener(){} close(){}}
    },session)
    const page = await context.newPage()
    const sent = []
    const errors = []
    page.on('pageerror', e => errors.push(e.message))
    page.on('console', msg => {if(msg.type()==='error' && msg.text().includes('same key')) errors.push(msg.text())})
    await page.route(url => url.pathname.startsWith('/api/'), async route => {
      const url = new URL(route.request().url()), path = url.pathname
      const json = (data,status=200) => route.fulfill({
        status,contentType:'application/json',body:JSON.stringify(data),
      })
      if (path.endsWith('/e2ee/status')) return json({mode:'legacy',epoch:0})
      if (path === '/api/conversations/101/messages' && route.request().method()==='POST') { const body=route.request().postDataJSON(); sent.push(body); return json({id:900+sent.length,conversationId:101,senderId:1,sender:'viewer',text:body.text,attachments:[],createdAt:now,clientId:body.clientId}) }
      if (path === '/api/chat/quick-replies') return json([{key:'camon',text:'Cảm ơn bạn'}])
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
    await item.filter({hasText:'Linh Anh'}).first().click()
    const input = page.getByPlaceholder('Nhập tin nhắn…')
    await input.waitFor({state:'visible'})
    const like = page.getByRole('button',{name:'Gửi Like',exact:true})
    const send = page.getByRole('button',{name:'Gửi tin nhắn',exact:true})
    await like.waitFor({state:'visible'})
    // Allow the initial encryption-status gate to settle before measuring the composer.
    await page.waitForTimeout(400)
    await like.waitFor({state:'visible'})
    const a=await like.boundingBox(), b=await send.boundingBox(), t=await input.boundingBox()
    assert.ok(a && b && t && a.x+a.width<=b.x+1 && Math.abs(a.y-b.y)<15 && b.x+b.width<=width+1 && t.width>=56, JSON.stringify({width,a,b,t}))
    await input.fill('Nội dung đang soạn')
    const receipt = page.waitForResponse(res => res.url().includes('/api/conversations/101/messages') && res.request().method()==='POST' && res.ok(),{timeout:10000})
    await (isMobile ? like.tap() : like.click())
    await receipt
    assert.equal(sent.length,1)
    assert.equal(sent[0].text,'👍')
    assert.deepEqual(sent[0].attachments,[])
    await page.waitForFunction(()=>document.querySelector('.messages')?.innerText.includes('👍'),{},{timeout:10000})
    assert.equal(await input.inputValue(),'Nội dung đang soạn')
    assert.deepEqual(errors,[])
    console.log('PASS quick Like layout and draft at '+width+'px',JSON.stringify({a,b,t,sent}))
    await context.close()
  }
} finally {
  await browser?.close()
  vite.kill()
}