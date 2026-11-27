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
    categoryId:5,unreadCount:125,lastMessage:'hello',createdAt:now,lastMessageAt:now},
  {id:102,type:'group',name:'Nhóm Sản phẩm',memberCount:3,avatarMembers:['viewer','linhanh'],
    unreadCount:0,lastMessage:'group',createdAt:now,lastMessageAt:now},
]
conversations.push({id:103,type:'direct',name:'Minh Khôi',otherUserId:3,otherUsername:'minhkhoi',memberCount:2,manualUnread:true,unreadCount:0,lastMessage:'hello',createdAt:now,lastMessageAt:now})
conversations.push({id:104,type:'group',name:'Nhóm Kỹ thuật',memberCount:4,avatarMembers:['viewer','linhanh'],unreadCount:7,lastMessage:'engineering',createdAt:now,lastMessageAt:now})
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
    await group.click()
    await page.waitForTimeout(350)
    const inspect = async () => {
      const expected = [['Linh Anh','99+'],['Minh Khôi','•'],['Nhóm Kỹ thuật','7']]
      for (const [name,label] of expected) {
        const row=item.filter({hasText:name}).first()
        const badge=row.locator('.conversation-rail-compact-unread')
        assert.equal(await badge.innerText(),label)
        assert.ok(await badge.isVisible())
        const rect=await badge.evaluate(el=>{
          const b=el.getBoundingClientRect(), a=el.closest('.conversation-rail-avatar-anchor').getBoundingClientRect(), p=el.closest('.social-chat-layout').querySelector('.group-channel-sidebar').getBoundingClientRect()
          return {left:b.left,right:b.right,top:b.top,bottom:b.bottom,avatarLeft:a.left,avatarRight:a.right,seam:p.left}
        })
        assert.ok(rect.left>=rect.avatarLeft-3 && rect.right<=rect.avatarRight+1 && rect.right<=rect.seam && rect.left>=0,JSON.stringify(rect))
        assert.ok(await badge.evaluate(el=>{const r=el.getBoundingClientRect();return el.parentElement.parentElement.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))}))
        assert.equal(await row.locator('.desktop-conversation-rail-unread,.conversation-avatar-rail-count').isVisible(),false)
      }
      assert.equal(await item.filter({hasText:'Nhóm Sản phẩm'}).first().locator('.conversation-rail-compact-unread').count(),0)
    }
    await inspect()
    await group.click()
    await page.waitForTimeout(350)
    assert.equal(await rail.locator('.conversation-rail-compact-unread:visible').count(),0)
    assert.ok(await item.filter({hasText:'Linh Anh'}).first().locator('.desktop-conversation-rail-unread,.conversation-avatar-rail-count').isVisible())
    await group.click()
    await page.waitForTimeout(350)
    await inspect()
    assert.deepEqual(errors,[])
    console.log('PASS',width,'compact unread badges 99+, manual unread, group count, expanded restore, no clipping')
    await context.close()
  }
} finally {
  await browser?.close()
  vite.kill()
}