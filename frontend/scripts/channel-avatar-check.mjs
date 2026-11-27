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
  refreshToken:'r'.repeat(43),sessionId:'channel-avatar-check',
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
    channels[1].avatarUrl = undefined
    const photo = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL/nwAAAABJRU5ErkJggg=='
    let allowed = true, uploads = 0, updates = 0
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', e => errors.push(e.message))
    await page.route(url => url.pathname.startsWith('/api/') || url.pathname === '/_mock_photo', async route => {
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
      if (path === '/api/conversations/102/channels/7/avatar') {
        if (!allowed) return json({error:'Không có quyền'},403)
        if (route.request().method()==='GET') return json({canUpdateAvatar:true})
        const body = route.request().postDataJSON(); updates++
        channels[1].avatarUrl=body.attachment?photo:undefined
        return json({conversationId:102,channelId:7,avatarUrl:channels[1].avatarUrl||'',avatarSet:!!body.attachment})
      }
      if (path === '/api/media/presign') { uploads++; return json({uploadUrl:origin+'/_mock_photo',storageRef:'s3://mock/profile/1/channel.png',key:'channel.png',kind:'image',expiresAt:'2099-01-01T00:00:00Z',downloadUrl:photo}) }
      if (path === '/_mock_photo') return route.fulfill({status:200,body:''})
      if (/^\/api\/conversations\/\d+\/messages$/.test(path)) return json([])
      if (/^\/api\/conversations\/\d+\/members$/.test(path)) return json([{id:1,username:'viewer',displayName:'Người xem',role:'owner'}])
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
    await item.filter({hasText:'Nhóm Sản phẩm'}).first().click()
    const channelButton=page.getByRole('button',{name:/Mở kênh Hỏi đáp/})
    await channelButton.click()
    await page.locator('.chat-head').getByRole('button',{name:'Thông tin hội thoại',exact:true}).click()
    const panel=page.locator('#conversation-details-panel')
    const camera=panel.getByRole('button',{name:'Đổi ảnh kênh'})
    await camera.click({timeout:5000})
    const modal=page.locator('.group-photo-modal')
    const input=modal.getByLabel('Tệp ảnh kênh')
    await input.setInputFiles({name:'huge.png',mimeType:'image/png',buffer:Buffer.alloc(13*1024*1024)})
    assert.equal(await modal.getByRole('button',{name:'Lưu ảnh'}).isDisabled(),true)
    await input.setInputFiles({name:'channel.png',mimeType:'image/png',buffer:Buffer.from(photo.split(',')[1],'base64')})
    allowed=false
    await modal.getByRole('button',{name:'Lưu ảnh'}).click()
    await page.getByText('Không có quyền',{exact:true}).first().waitFor({timeout:5000})
    assert.equal(uploads,0)
    assert.equal(updates,0)
    allowed=true
    await modal.getByRole('button',{name:'Lưu ảnh'}).click()
    await modal.waitFor({state:'hidden',timeout:6000})
    assert.equal(updates,1)
    assert.equal(uploads,1)
    assert.equal(conversations[1].avatarUrl,undefined)
    await panel.locator('.group-photo-avatar-wrap img').waitFor({state:'visible'})
    assert.equal(await panel.locator('.group-photo-avatar-wrap img').getAttribute('src'),photo)
    await camera.click()
    await modal.getByRole('button',{name:'Gỡ ảnh'}).click()
    await modal.getByRole('button',{name:'Lưu ảnh'}).click()
    await modal.waitFor({state:'hidden',timeout:6000})
    assert.equal(updates,2)
    assert.equal(uploads,1)
    assert.equal(channels[1].avatarUrl,undefined)
    assert.equal(conversations[1].avatarUrl,undefined)
    assert.deepEqual(errors,[])
    console.log('PASS',width,'camera, size validation, permission check, save and remove only channel avatar')
    await context.close()
  }
} finally {
  await browser?.close()
  vite.kill()
}