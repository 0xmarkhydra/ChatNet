import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { createServer } from 'node:net'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import assert from 'node:assert/strict'

process.chdir(fileURLToPath(new URL('..', import.meta.url)))
const port = await new Promise(done => {
  const server = createServer()
  server.listen(0, '127.0.0.1', () => {
    const port = server.address().port
    server.close(() => done(port))
  })
})
const origin = `http://127.0.0.1:${port}`
const vite = spawn(process.execPath, [resolve('node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { stdio: 'ignore' })
let browser
try {
  let ready = false
  for (let attempt = 0; attempt < 80; attempt++) {
    try { ready = (await fetch(origin)).ok; if (ready) break } catch { /* Starting */ }
    await delay(100)
  }
  assert.ok(ready, 'Vite must start')
  for (const channel of [undefined, 'msedge', 'chrome']) {
    try { browser = await chromium.launch({ headless: true, ...(channel ? { channel } : {}) }); break }
    catch (error) { if (!String(error).includes("doesn't exist") && !String(error).includes('not found')) throw error }
  }
  if (!browser) { console.log('BLOCKED: browser unavailable'); process.exitCode = 2 }
  else {
    const session = {
      token: 'mock.' + Buffer.from(JSON.stringify({exp:4102444800})).toString('base64url') + '.signed',
      refreshToken: 'r'.repeat(43), sessionId: 'chat-visual-qa',
      user: {id:1,email:'viewer@example.invalid',username:'viewer',displayName:'Người xem'},
    }
    const today = new Date().toISOString()
    const conversations = [
      {id:101,type:'direct',name:'Linh Anh',otherUserId:2,otherUsername:'linhanh',memberCount:2,
        lastMessage:'Chiều nay mình gặp ở quán cũ nhé',lastMessageAt:today,unreadCount:0,online:true,createdAt:today},
      {id:102,type:'group',name:'Team ChatNet',memberCount:3,lastMessage:'Minh Anh: đã cập nhật file UI',lastMessageAt:today,unreadCount:3,online:false,createdAt:today},
      {id:103,type:'direct',name:'David Chen',otherUserId:3,otherUsername:'david',memberCount:2,lastMessage:'Ok, mình sẽ xem lại ngay.',lastMessageAt:today,unreadCount:1,online:false,createdAt:today},
      {id:104,type:'direct',name:'Phương Linh',otherUserId:4,otherUsername:'phuong',memberCount:2,lastMessage:'Cảm ơn nhé!',lastMessageAt:today,unreadCount:0,online:false,createdAt:today},
    ]
    const photo = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="700" height="420"><rect width="700" height="420" fill="#c0d3ba"/><circle cx="360" cy="210" r="95" fill="#77543b"/></svg>')
    const messages = [
      {id:1,conversationId:101,senderId:2,sender:'linhanh',senderDisplayName:'Linh Anh',text:'Chào bạn! Lâu rồi chúng ta chưa\nđi uống cà phê với nhau ☕',createdAt:today,attachments:[],readByUserIds:[]},
      {id:2,conversationId:101,senderId:1,sender:'viewer',senderDisplayName:'Người xem',text:'Đúng rồi, thứ Bảy đi nhé!\nMình cũng muốn gặp mọi người.',createdAt:today,attachments:[],readByUserIds:[2]},
      {id:3,conversationId:101,senderId:2,sender:'linhanh',senderDisplayName:'Linh Anh',text:'That sounds wonderful!',translatedText:'Nghe tuyệt đấy!',translationLanguage:'en',createdAt:today,attachments:[],readByUserIds:[]},
      {id:4,conversationId:101,senderId:2,sender:'linhanh',senderDisplayName:'Linh Anh',text:'',createdAt:today,attachments:[{kind:'image',storageRef:'preview',name:'coffee.svg',url:photo,sizeBytes:1234}],readByUserIds:[]},
    ]
    for (const width of [1586, 1200, 768, 390]) {
      const ctx = await browser.newContext({viewport:{width,height:992},serviceWorkers:'block'})
      await ctx.addInitScript(session => {
        localStorage.setItem('chatnet-session', JSON.stringify(session))
        class Events extends EventTarget { constructor(){super();setTimeout(()=>this.onopen?.(),50)} close(){} }
        window.EventSource = Events
      }, session)
      const page = await ctx.newPage()
      const jsErrors = []
      page.on('pageerror', error => jsErrors.push(error.message))
      await page.route('**/api/**', async route => {
        const req = route.request(), u = new URL(req.url()), p = u.pathname
        const json = (payload, status=200) => route.fulfill({status,contentType:'application/json',
          headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*'},body:JSON.stringify(payload)})
        if (req.method() === 'OPTIONS') return route.fulfill({status:204,
          headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'GET,POST,PUT,DELETE,OPTIONS'}})
        if (p === '/api/conversations') return json(conversations)
        if (p === '/api/conversations/memberships') return json({ids:conversations.map(c=>c.id),nextAfter:null})
        if (p === '/api/conversations/101/messages') return json(messages)
        if (p === '/api/conversation-categories') return json([])
        if (p === '/api/friends') return json([{id:2,username:'linhanh',displayName:'Linh Anh',online:true,status:'accepted',updatedAt:today}])
        if (p === '/api/preferences/translation') return json({targetLanguage:'en',autoTranslate:false})
        if (p === '/api/preferences') return json({appLocale:'vi'})
        if (p === '/api/push/config') return json({configured:false})
        return json([])
      })
      await page.goto(origin)
      await page.locator('.zalo-conversation-list .conversation-item').first().waitFor({state:'visible'})
      await page.locator('.zalo-conversation-list .conversation-item').first().click()
      await page.locator('.social-chat-layout.has-active').waitFor({state:'visible'})
      const detailsButton = page.locator('.chat-head button[aria-label="Thông tin hội thoại"]:visible').first()
      if (width > 760) {
        await detailsButton.click()
        await page.locator('.social-chat-details').waitFor({state:'visible'})
      }
      const selectors = {
        list: '.social-chat-list', listHeading: '.social-chat-list-title h2',
        listSearch: '.social-chat-list-search', filter: '.social-chat-list-filters',
        firstRow: '.zalo-conversation-list .conversation-item',
        stage: '.social-chat-layout .conversation-panel',
        stageHeader: '.social-chat-layout .chat-head',
        date: '.social-chat-layout .day-divider span',
        avatar: '.social-chat-layout .chat-message-sender-avatar',
        firstBubble: '.social-chat-layout .message:not(.mine) .bubble',
        banner: '.social-chat-ai-banner', composer: '.media-composer',
        details: '.social-chat-details',
        detailsAvatar: '.social-chat-details-avatar',
        detailsCall: '.social-chat-details-actions .call-header-actions button',
        detailsFirstOption: '.social-chat-details-links button',
        composerSend: '.media-composer .send-button',
        composerImage: '.media-composer .chat-composer-image',
        composerMic: '.media-composer .voice-record-trigger',
        translatedCard: '.social-chat-layout .chat-translated-card',
        photo: '.social-chat-layout .chat-message-photo img',
        photoTime: '.social-chat-layout .chat-image-time',
      }
      const rects = {}
      for (const [name,selector] of Object.entries(selectors)) {
        const first = page.locator(selector).first()
        const rect = await first.count() ? await first.boundingBox() : null
        if (rect) rects[name] = Object.fromEntries(['x','y','width','height'].map(key=>[key,Math.round(rect[key])]))
      }
      if (width === 1586) {
        const scroll = await page.locator('.social-chat-layout .messages').evaluate(el => ({top:el.scrollTop,height:el.clientHeight,total:el.scrollHeight}))
        assert.equal(scroll.top, 0, 'reference message timeline must fit without forced scroll')
        const target = {
          list:[272,108,347,842], stage:[637,108,605,842], details:[1260,108,292,842],
          listSearch:[289,190,312,46], firstRow:[282,302,325,79],
          stageHeader:[638,109,604,79], composer:[652,860,574,74], banner:[653,802,574,42],
          date:[877,209,121,29], avatar:[652,273,32,32],
          composerSend:[1140,874,69,44], detailsAvatar:[1359,193,93,93],
        }
        for (const [name,expected] of Object.entries(target)) {
          const actual = rects[name]
          assert.ok(actual, `${name} should be rendered`)
          const delta = expected.map((v,i)=>Math.abs(v-actual[['x','y','width','height'][i]]))
          console.log(name, 'actual', actual, 'target', expected, 'delta', delta)
          assert.ok(delta.every(v=>v<=3), `${name} deviates more than expected: ${delta.join(',')}`)
        }
        console.log('content', JSON.stringify({firstBubble:rects.firstBubble,translatedCard:rects.translatedCard,photo:rects.photo,photoTime:rects.photoTime,composerImage:rects.composerImage,composerMic:rects.composerMic}))
        assert.ok(rects.avatar, 'incoming message avatar visible')
        assert.ok(rects.translatedCard, 'combined original and AI translation visible')
        assert.ok(rects.photo && rects.photo.width === 258 && rects.photo.height === 142, 'photo size must match reference')
        assert.ok(rects.photoTime, 'photo time chip visible')
      } else console.log(`${width}px:`, JSON.stringify(rects))
      if (width > 760) {
        const headerButtons = page.locator('.chat-head .translate-controls button:visible')
        assert.equal(await headerButtons.count(), 4, 'header contains call, video, search and info only')
      } else {
        await detailsButton.click()
        await page.locator('.social-chat-details').waitFor({state:'visible'})
      }
      assert.ok(await page.getByRole('button', {name:'Chặn tin nhắn và cuộc gọi'}).count(), 'block action present')
      assert.ok(await page.getByRole('button', {name:'Xóa lịch sử trò chuyện'}).count(), 'clear action present')
      for (const name of ['Chặn tin nhắn và cuộc gọi', 'Xóa lịch sử trò chuyện']) {
        page.once('dialog', dialog => dialog.dismiss())
        await page.getByRole('button', {name}).click()
      }
      await page.getByRole('button', {name:'Đóng thông tin hội thoại'}).click()
      await page.locator('.social-chat-details').waitFor({state:'detached'})
      assert.deepEqual(jsErrors, [], `browser errors at ${width}px`)
      await ctx.close()
    }
    console.log('PASS: chat S00 geometry at 1586x992, responsive rendering at 1200/768/390')
  }
} finally {
  await browser?.close()
  vite.kill()
}