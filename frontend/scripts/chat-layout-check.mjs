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
      await page.route(url => url.pathname.startsWith('/api/'), async route => {
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
        if (p === '/api/preferences') return json({targetLanguage:'en',autoTranslate:false,appLocale:'vi'})
        if (p === '/api/push/config') return json({configured:false})
        return json([])
      })
      await page.goto(origin)
      // Initial desktop/mobile navigation is avatar-first; the legacy list
      // remains mounted but intentionally hidden until the rail is expanded.
      const firstConversation = page.locator('.desktop-conversation-rail-row button:visible, .conversation-avatar-rail-item:visible').first()
      await firstConversation.waitFor({state:'visible'})
      await firstConversation.click()
      await page.locator('.social-chat-layout.has-active').waitFor({state:'visible'})
      assert.equal(await page.locator('.social-chat-ai-banner').count(), 0,
        'Translation settings must no longer take space above the composer')
      const translationButton = page.locator('.chat-head .translate-controls .translation-toolbar-toggle')
      await translationButton.waitFor({state:'visible'})
      await translationButton.click()
      await page.getByRole('dialog', {name:'Cài đặt dịch AI'}).waitFor({state:'visible'})
      await page.keyboard.press('Escape')
      await page.getByRole('dialog', {name:'Cài đặt dịch AI'}).waitFor({state:'hidden'})
      // Icon-only manual translation follows each bubble, not a chip below it.
      for (const [messageId, direction] of [[1, 'incoming'], [2, 'outgoing']]) {
        const placement = await page.locator(`[data-message-id="${messageId}"]`).evaluate(message => {
          const bubble = message.querySelector('.message-content > .bubble')
          const action = bubble?.querySelector('.chat-translation-action')
          if (!bubble || !action) return null
          const svg = action.querySelector('svg')
          const b = bubble.getBoundingClientRect(), a = action.getBoundingClientRect()
          const glyph = svg?.getBoundingClientRect()
          return {
            bubble: {left:b.left, right:b.right, top:b.top, height:b.height},
            action: {left:a.left, right:a.right, top:a.top, width:a.width, height:a.height},
            label: action.getAttribute('aria-label'),
            text: action.textContent?.trim(),
            svg: !!svg,
            glyphOffset: glyph ? {
              x: (glyph.left + glyph.width / 2) - (a.left + a.width / 2),
              y: (glyph.top + glyph.height / 2) - (a.top + a.height / 2),
            } : null,
            viewport: window.innerWidth,
          }
        })
        if (placement?.action.width === 0) {
          // Pointer-based desktop layouts intentionally replace the per-bubble
          // icon with a hover toolbar. Validate its translation control instead
          // of asserting the hidden fallback has a nonzero bounding box.
          const content = page.locator(`[data-message-id="${messageId}"] .message-content`)
          await content.hover()
          const action = content.locator('.chat-message-hover-toolbar button[aria-label="Dịch tin nhắn"]')
          await action.waitFor({ state: 'visible' })
          const bounds = await action.boundingBox()
          assert.ok(bounds && bounds.width >= 30 && bounds.height >= 30,
            `Desktop translation toolbar must remain accessible (${direction}, ${width}px)`)
          continue
        }
        assert.ok(placement && placement.svg && placement.label === 'Dịch' &&
          placement.text === '' && Math.abs(placement.action.width - 30) < 0.1,
          `Translation must be an accessible icon only (${direction}, ${width}px): ${JSON.stringify(placement)}`)
        assert.ok(Math.abs(placement.glyphOffset.x) < 1 && Math.abs(placement.glyphOffset.y) < 1,
          `Translation SVG must be centered inside its click target (${direction}, ${width}px): ${JSON.stringify(placement)}`)
        assert.ok(Math.abs(placement.action.top + placement.action.height / 2 -
          placement.bubble.top - placement.bubble.height / 2) < 2,
          `Translation icon must remain centered on its bubble (${direction}, ${width}px)`)
        assert.ok(direction === 'incoming'
          ? placement.action.left >= placement.bubble.right + 6 &&
            placement.action.left <= placement.bubble.right + 12
          : placement.action.right <= placement.bubble.left - 6 &&
            placement.action.right >= placement.bubble.left - 12,
        `Translation icon must sit outside the correct bubble side (${direction}, ${width}px)`)
        assert.ok(placement.action.left >= 0 && placement.action.right <= placement.viewport,
          `Translation icon must fit inside the viewport (${direction}, ${width}px)`)
      }
      const detailsButton = page.locator('.chat-head button[aria-label="Thông tin hội thoại"]:visible').first()
      if (width > 760) {
        await detailsButton.click()
        await page.locator('.social-chat-details').waitFor({state:'visible'})
      }
      // Optional translation buttons extend message height; measure from the top.
      await page.locator('.social-chat-layout .messages').evaluate(el => { el.style.scrollBehavior = 'auto'; el.scrollTop = 0 })
      const selectors = {
        stage: '.social-chat-layout .conversation-panel',
        stageHeader: '.social-chat-layout .chat-head',
        date: '.social-chat-layout .day-divider span',
        avatar: '.social-chat-layout .chat-message-sender-avatar',
        firstBubble: '.social-chat-layout .message:not(.mine) .bubble',
        composer: '.media-composer',
        details: '.social-chat-details',
        detailsAvatar: '.social-chat-details-avatar',
        detailsCall: '.social-chat-details-actions .call-header-actions button',
        detailsFirstOption: '.social-chat-details-links button',
        composerSend: '.media-composer .send-button',
        composerImage: '.media-composer .chat-composer-image',
        composerMic: '.media-composer .voice-record-trigger',
        translationAction: '[data-message-id="3"] .chat-translation-action',
        photo: '.social-chat-layout .chat-message-photo img',
        photoTime: '.social-chat-layout .chat-image-time',
      }
      const rects = {}
      for (const [name,selector] of Object.entries(selectors)) {
        const first = page.locator(selector).first()
        const rect = await first.count() ? await first.boundingBox() : null
        if (rect) rects[name] = Object.fromEntries(['x','y','width','height'].map(key=>[key,Math.round(rect[key])]))
      }
      // One outlined shell for each input: no nested shape or pseudo-element.
      const surfaceAudit = await page.evaluate(() => {
        const form = document.querySelector('.social-chat-layout .media-composer')
        const field = form?.querySelector('textarea[aria-label="Tin nhắn"]')
        if (!form || !field) throw new Error('Chat composer input not found')
        const sty = el => getComputedStyle(el)
        const borderFree = el => parseFloat(sty(el).borderTopWidth) === 0 &&
          parseFloat(sty(el).borderRightWidth) === 0 &&
          parseFloat(sty(el).borderBottomWidth) === 0 &&
          parseFloat(sty(el).borderLeftWidth) === 0
        const clearBackground = el => ['transparent', 'rgba(0, 0, 0, 0)'].includes(sty(el).backgroundColor)
        const values = {
          composerBorder: sty(form).borderTopWidth,
          inputBorderFree: borderFree(field),
          inputTransparent: clearBackground(field),
          pseudoContent: getComputedStyle(form, '::before').content,
         }
        const classes = [
          'appbar-search', 'social-chat-list-search', 'communication-hub-search',
          'friend-search-input-wrap', 'connect-search-input', 'nearby-search',
          'locale-picker-search', 'translation-language-search',
          'profile-username-input', 'social-feed-checkin-field',
        ]
        const fixture = document.createElement('div')
        fixture.style.cssText = 'position:absolute;left:-2000px;top:0;width:280px'
        for (const cls of classes) {
          const wrap = document.createElement('div')
          wrap.className = cls
          wrap.appendChild(document.createElement('input'))
          fixture.appendChild(wrap)
        }
        const post = document.createElement('div')
        post.className = 'post-box'
        post.appendChild(document.createElement('textarea'))
        fixture.appendChild(post)
        document.body.appendChild(fixture)
        values.wrapped = [...fixture.children].map(el => ({
          name:el.className,
          borderFree:borderFree(el.firstElementChild),
          transparent:clearBackground(el.firstElementChild),
        }))
        fixture.remove()
        return values
      })
      assert.equal(surfaceAudit.composerBorder, '1px', 'Only the outside composer border is visible')
      assert.ok(surfaceAudit.inputBorderFree && surfaceAudit.inputTransparent,
        'Composer field must not draw its own rectangle')
      assert.equal(surfaceAudit.pseudoContent, 'none', 'Composer must not draw an inner pseudo-element')
      for (const item of surfaceAudit.wrapped) {
        assert.ok(item.borderFree && item.transparent,
          `Nested input style found in ${item.name}: ${JSON.stringify(item)}`)
      }
      const inputTypography = await page.locator('.media-composer textarea[aria-label="Tin nhắn"]').evaluate(
        input => parseFloat(getComputedStyle(input).fontSize))
      assert.ok(inputTypography >= (width > 760 ? 15 : 16),
        `Chat input font too small at ${width}px: ${inputTypography}px`)
      if (width > 760) {
        assert.ok(rects.composer.height <= (width <= 1024 ? 92 : 62), `Desktop composer too tall at ${width}px: ${rects.composer.height}px`)
      } else {
        assert.ok(rects.composer.height <= 60,
          `Mobile composer too tall at ${width}px: ${rects.composer.height}px`)
      }
      if (width === 1586) {
        const scroll = await page.locator('.social-chat-layout .messages').evaluate(el => { el.style.scrollBehavior = 'auto'; el.scrollTop = 0; return {top:el.scrollTop,height:el.clientHeight,total:el.scrollHeight} })
        assert.equal(scroll.top, 0, 'geometry measured from the start of the conversation')
        // Avatar-first navigation replaces the old fixed-width conversation list.
        // Check layout containment rather than pixel coordinates of hidden legacy DOM.
        const insideViewport = rect => rect && rect.width > 0 && rect.height > 0 &&
          rect.x >= -1 && rect.x + rect.width <= width + 1
        for (const name of ['stage', 'stageHeader', 'composer', 'composerSend']) {
          assert.ok(insideViewport(rects[name]),
            `Visible ${name} must fit within ${width}px: ${JSON.stringify(rects[name])}`)
        }
        assert.ok(rects.composer.y >= rects.stage.y &&
          rects.composer.y + rects.composer.height <= rects.stage.y + rects.stage.height + 2,
          'Composer stays inside the conversation panel')
        assert.ok(insideViewport(rects.details), 'Conversation details panel stays inside viewport')
        console.log('content', JSON.stringify({firstBubble:rects.firstBubble,translationAction:rects.translationAction,photo:rects.photo,photoTime:rects.photoTime,composerImage:rects.composerImage,composerMic:rects.composerMic}))
        assert.ok(rects.avatar, 'incoming message avatar visible')
        if (!rects.translationAction) {
          const translatedMessage = page.locator('[data-message-id="3"] .message-content')
          await translatedMessage.hover()
          const toolbarAction = translatedMessage.locator('.chat-message-hover-toolbar button[aria-label="Dịch tin nhắn"]')
          assert.ok(await toolbarAction.boundingBox(),
            'manual translation is available in the desktop hover toolbar')
        } else {
          assert.ok(rects.translationAction, 'manual translation icon is available on touch layouts')
        }
        assert.ok(rects.photo && rects.photo.width >= 200 && rects.photo.width <= 258 &&
          rects.photo.height >= 120 && rects.photo.height <= 150,
        'Photo must retain a readable size when the translation banner is removed')
        assert.ok(rects.photoTime, 'photo time chip visible')
      } else console.log(`${width}px:`, JSON.stringify(rects))
      if (width > 760) {
        const headerButtons = page.locator('.chat-head .translate-controls button:visible')
        assert.equal(await headerButtons.count(), 5, 'header contains call, video, search, translation and info')
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
      if (width === 1586) {
        assert.equal(await page.locator('.conversation-pin-menu-trigger').count(), 0, 'no ellipsis beside conversations')
        await page.locator('.desktop-conversation-rail-row button:visible').first().click({button:'right'})
        await page.getByRole('button', {name:'Ghim cuộc trò chuyện'}).waitFor({state:'visible'})
        await page.keyboard.press('Escape')
        await page.locator('[data-message-id="1"] .bubble').click({button:'right'})
        await page.getByRole('button', {name:'Ghim tin nhắn'}).waitFor({state:'visible'})
        await page.locator('.message-context-cancel').click()
      }
      if (width === 390) {
        await page.getByRole('button', {name:'Quay lại danh sách'}).click()
        await page.locator('.conversation-avatar-rail-item:visible').nth(1).click()
        // The group uses a channel picker on mobile; the translation toolbar
        // is intentionally hidden until a channel is selected. Test the picker.
        const picker = page.locator('.social-chat-layout.group-channel-workspace.mobile-rail-picker-view')
        await picker.waitFor({state:'visible'})
        const noOverflow = await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)
        assert.ok(noOverflow, 'Mobile group channel picker must fit the viewport')
        assert.equal(await page.locator('.group-mobile-actions .translation-toolbar-toggle:visible').count(), 0,
          'Group translation toolbar is hidden until a channel is selected')
      }
      assert.deepEqual(jsErrors, [], `browser errors at ${width}px`)
      await ctx.close()
    }
    console.log('PASS: chat avatar-rail layout containment and translation controls at 1586/1200/768/390')
  }
} finally {
  await browser?.close()
  vite.kill()
}