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
  refreshToken:'r'.repeat(43),sessionId:'channel-slide-check',
  user:{id:1,username:'viewer',displayName:'Người xem',email:'viewer@example.invalid'},
}
const conversations = [
  {id:101,type:'direct',name:'Linh Anh',otherUserId:2,otherUsername:'linhanh',memberCount:2,
    categoryId:5,unreadCount:0,lastMessage:'hello',createdAt:now,lastMessageAt:now},
  {id:102,type:'group',name:'Nhóm Sản phẩm',memberCount:3,avatarMembers:['viewer','linhanh'],
    unreadCount:0,lastMessage:'group',createdAt:now,lastMessageAt:now},
]
conversations.push({id:103,type:'direct',name:'Minh Khôi',otherUserId:3,otherUsername:'minhkhoi',memberCount:2,unreadCount:0,lastMessage:'hello',createdAt:now,lastMessageAt:now})
conversations.push({id:104,type:'group',name:'Nhóm Kỹ thuật',memberCount:4,avatarMembers:['viewer','linhanh'],unreadCount:0,lastMessage:'engineering',createdAt:now,lastMessageAt:now})
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
  for (const width of [320,390,900,1366]) {
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
        if (url.searchParams.get('type') === 'group') return json(conversations.filter(c=>c.type==='group'))
        if (category !== null) return json(conversations.filter(c => (c.categoryId || 0) === Number(category)))
        return json(id ? conversations.filter(c => c.id === Number(id)) : conversations)
      }
      if (path === '/api/conversations/memberships')
        return json({ids:conversations.map(c=>c.id),nextAfter:null})
      if (path === '/api/conversation-categories')
        return json([{id:5,name:'Công việc',color:'orange'}])
      if (path === '/api/conversations/102/channels') { await delay(850); return json(channels) }
      if (path === '/api/conversations/104/channels') { await delay(850); return json([{...channels[0],conversationId:104},{...channels[1],id:9,conversationId:104,name:'Kỹ thuật'}]) }
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
    const layout=page.locator('.social-chat-layout.avatar-rail-layout')
    const sidebar=layout.locator(':scope > .group-channel-sidebar')
    const avatarSelector=isMobile?'.conversation-avatar-rail-photo':'.desktop-conversation-rail-avatar'
    const group=item.filter({hasText:'Nhóm Sản phẩm'}).first().locator(avatarSelector)
    // Sample the transform on actual animation frames, with a deliberately slow channel response.
    await page.waitForTimeout(400)
    const capture=async (action,ms=350)=>{
      await page.evaluate(mobile=>{
        window.__capturedSlideFrames=[]
        window.__capturingSlide=true
        const start=performance.now()
        const sample=()=>{
          if(!window.__capturingSlide)return
          const layout=document.querySelector('.social-chat-layout.avatar-rail-layout')
          const rail=layout?.querySelector(mobile?'.conversation-avatar-rail':'.desktop-conversation-rail')
          const pane=layout?.querySelector(':scope > .group-channel-sidebar')
          if(rail&&pane&&pane.offsetWidth){
            const p=pane.getBoundingClientRect(),r=rail.getBoundingClientRect()
            window.__capturedSlideFrames.push({time:performance.now()-start,x:p.left,railWidth:rail.offsetWidth,paneWidth:pane.offsetWidth,railX:r.left,railRight:r.right,transform:getComputedStyle(pane).transform})
          }
          requestAnimationFrame(sample)
        }
        requestAnimationFrame(sample)
      },isMobile)
      await action()
      await page.waitForTimeout(ms)
      return page.evaluate(()=>{window.__capturingSlide=false;return window.__capturedSlideFrames})
    }
    const verifyFrames=(frames,phase)=>{
      assert.ok(frames.length>=4,phase+' not enough frames')
      const widths=new Set(frames.map(f=>f.railWidth+':'+f.paneWidth))
      assert.equal(widths.size,1,phase+' intrinsic dimensions must remain fixed')
      const xs=frames.map(f=>Math.round(f.x))
      assert.ok(new Set(xs).size>=3,phase+' must interpolate: '+JSON.stringify(xs))
      return {frames:frames.length,from:xs[0],to:xs.at(-1),layout:frames[0].railWidth+':'+frames[0].paneWidth}
    }
    const openFrames=await capture(()=>group.click({timeout:4000}),500)
    await layout.waitFor({state:'visible'})
    await page.waitForFunction(()=>document.querySelector('.social-chat-layout')?.dataset.splitExpanded==='false',null,{timeout:5000})
    console.log('PASS',width,'opening',verifyFrames(openFrames,'opening'))
    await page.getByRole('button',{name:/Mở kênh Hỏi đáp/}).waitFor({state:'visible',timeout:5000})
    await page.evaluate(()=>{
      const layout=document.querySelector('.social-chat-layout.avatar-rail-layout')
      window.__slidePane=layout.querySelector('.group-channel-sidebar')
      window.__slideRail=layout.querySelector('.conversation-avatar-rail')
      window.__slideDesktop=layout.querySelector('.desktop-conversation-rail')
      return true
    })
    const closeFrames=await capture(()=>group.click({timeout:4000}))
    console.log('PASS',width,'closing',verifyFrames(closeFrames,'closing'))
    await page.waitForFunction(()=>document.querySelector('.social-chat-layout')?.dataset.splitExpanded==='true')
    assert.equal(await sidebar.evaluate(el=>el.inert),true)
    const reopenFrames=await capture(()=>group.click({timeout:4000}))
    console.log('PASS',width,'reopening',verifyFrames(reopenFrames,'reopening'))
    await page.waitForFunction(()=>document.querySelector('.social-chat-layout')?.dataset.splitExpanded==='false')
    // Rapid reversal during animation, then validate the final destination and mounts.
    await group.click({timeout:4000})
    await page.waitForTimeout(35)
    await group.click({timeout:4000})
    await page.waitForTimeout(350)
    assert.equal(await layout.getAttribute('data-split-expanded'),'false')
    assert.equal(await page.evaluate(()=>{
      const layout=document.querySelector('.social-chat-layout.avatar-rail-layout')
      return layout.querySelector('.group-channel-sidebar')===window.__slidePane &&
        layout.querySelector('.conversation-avatar-rail')===window.__slideRail &&
        layout.querySelector('.desktop-conversation-rail')===window.__slideDesktop
    }),true)
    const otherGroup=item.filter({hasText:'Nhóm Kỹ thuật'}).first().locator(avatarSelector)
    const groupFrames=await capture(()=>otherGroup.click({timeout:4000}),650)
    const metrics=verifyFrames(groupFrames,'group switch')
    const xs=groupFrames.map(f=>f.x)
    assert.ok(Math.max(...xs)>xs[0]+100 && Math.max(...xs)>xs.at(-1)+100,'both retract and reveal must animate')
    await page.getByRole('button',{name:/Mở kênh Kỹ thuật/}).waitFor({state:'visible',timeout:5000})
    assert.equal(await page.getByRole('button',{name:/Mở kênh Hỏi đáp/}).count(),0)
    console.log('PASS',width,'group-to-group retract/reveal',metrics)
    await page.getByRole('button',{name:/Mở kênh Kỹ thuật/}).click({timeout:4000})
    assert.deepEqual(errors,[])
    console.log('PASS',width,'reversal, stable mounted panes and channel hit testing')
    await context.close()
  }
} finally {
  await browser?.close()
  vite.kill()
}