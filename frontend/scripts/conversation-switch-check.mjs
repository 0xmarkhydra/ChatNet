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
  refreshToken:'r'.repeat(43),sessionId:'conversation-switch-perf',
  user:{id:1,username:'viewer',displayName:'Người xem',email:'viewer@example.invalid'},
}
const conversations = [
  {id:101,type:'direct',name:'Linh Anh',otherUserId:2,otherUsername:'linhanh',memberCount:2,
    categoryId:5,unreadCount:0,lastMessage:'hello',createdAt:now,lastMessageAt:now},
  {id:102,type:'group',name:'Nhóm Sản phẩm',memberCount:3,avatarMembers:['viewer','linhanh'],
    unreadCount:0,lastMessage:'group',createdAt:now,lastMessageAt:now},
]
conversations.push({id:103,type:'direct',name:'Minh Khôi',otherUserId:3,otherUsername:'minhkhoi',memberCount:2,unreadCount:0,lastMessage:'hello',createdAt:now,lastMessageAt:now})
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
  for (const width of (process.env.CHATNET_STRESS ? [1366] : [320,390,1024,1366])) {
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
      if (path.endsWith('/e2ee/status')) { await delay(300); return json({mode:'legacy',epoch:0}) }
      if (/^\/api\/conversations\/\d+\/messages$/.test(path)) {
        const id=Number(path.split('/')[3]), channelId=Number(url.searchParams.get('channelId')||0)
        await delay(id===103?900:120)
        return json(Array.from({length:40},(_,i)=>({id:id*1000+channelId*100+i,conversationId:id,channelId,senderId:2,sender:'linhanh',text:'room-'+id+'-'+channelId+'-'+i,createdAt:new Date(Date.now()-60000*(40-i)).toISOString()})))
      }
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
    await page.emulateMedia({reducedMotion:'no-preference'})
    const timeline=page.locator('.messages')
    const select=async name=>item.filter({hasText:name}).first().click({timeout:6000})
    const back=async()=>{if(isMobile)await page.getByRole('button',{name:'Quay lại danh sách',exact:true}).click()}
    const latest=async (id,channel=0)=> {
      await timeline.getByText('room-'+id+'-'+channel+'-39',{exact:true}).waitFor({state:'visible',timeout:6000})
      await page.waitForTimeout(50)
      const metrics=await timeline.evaluate(el=>({top:el.scrollTop,max:el.scrollHeight-el.clientHeight,x:el.getBoundingClientRect().x,right:el.getBoundingClientRect().right,width:el.clientWidth,overflow:el.scrollWidth-el.clientWidth,text:el.innerText}))
      assert.ok(metrics.max-metrics.top<100,JSON.stringify({id,channel,...metrics,text:undefined}))
      assert.ok(metrics.x>=-1 && metrics.right<=width+1 && metrics.overflow<=1,JSON.stringify({...metrics,text:undefined}))
      assert.equal(metrics.text.includes('room-'+(id===101?103:101)+'-'),false,'wrong conversation displayed')
      console.log('PASS latest',width,id,channel,JSON.stringify({...metrics,text:undefined}))
    }
    await select('Linh Anh')
    await timeline.waitFor({state:'visible'})
    await page.waitForTimeout(80)
    const pendingNotice=await page.locator('.chat-encryption-notice').boundingBox()
    await latest(101)
    await page.waitForTimeout(400)
    const readyNotice=await page.locator('.chat-encryption-notice').boundingBox()
    assert.ok(pendingNotice&&readyNotice&&Math.abs(pendingNotice.height-readyNotice.height)<=1,JSON.stringify({pendingNotice,readyNotice}))
    await back()
    await select('Minh Khôi')
    await timeline.waitFor({state:'visible'})
    assert.equal((await timeline.innerText()).includes('room-101-'),false)
    await back()
    await select('Linh Anh')
    await latest(101)
    await page.waitForTimeout(1000)
    assert.equal((await timeline.innerText()).includes('room-103-'),false,'late response must not replace room A')
    await back()
    await select('Nhóm Sản phẩm')
    await page.getByRole('button',{name:/Mở kênh Thảo luận chung/}).click({timeout:6000})
    await latest(102)
    if (isMobile) await page.getByRole('button',{name:'Quay lại danh sách kênh'}).click()
    await page.getByRole('button',{name:/Mở kênh Hỏi đáp/}).click({timeout:6000})
    await latest(102,7)
    assert.equal((await timeline.innerText()).includes('room-102-0-'),false)
    if (process.env.CHATNET_STRESS) {
      await select('Linh Anh')
      await latest(101)
      const timings=[]
      for (let cycle=0; cycle<25; cycle++) {
        const start=performance.now()
        await select('Minh Khôi')
        await page.locator('.chat-head').getByText('Minh Khôi',{exact:true}).waitFor({state:'visible',timeout:5000})
        assert.equal((await timeline.innerText()).includes('room-101-'),false)
        await select('Linh Anh')
        await page.locator('.chat-head').getByText('Linh Anh',{exact:true}).waitFor({state:'visible',timeout:5000})
        assert.equal((await timeline.innerText()).includes('room-103-'),false)
        const dimensions=await timeline.evaluate(el=>({width:el.clientWidth,overflow:el.scrollWidth-el.clientWidth,right:el.getBoundingClientRect().right}))
        assert.ok(dimensions.width>0 && dimensions.overflow<=1 && dimensions.right<=width+1)
        timings.push(performance.now()-start)
      }
      await page.waitForTimeout(1000)
      await latest(101)
      console.log('PASS stress: 50 switches, mean round-trip action duration',Math.round(timings.reduce((a,b)=>a+b,0)/timings.length),'ms (mock API + browser automation)')
    }
    assert.deepEqual(errors,[])
    console.log('PASS switching',width)
    await context.close()
  }
} finally {
  await browser?.close()
  vite.kill()
}