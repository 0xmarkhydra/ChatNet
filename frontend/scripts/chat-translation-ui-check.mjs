import assert from 'node:assert/strict'
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { createServer } from 'node:net'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'

process.chdir(fileURLToPath(new URL('..', import.meta.url)))
const port = await new Promise(resolvePort => {
  const server = createServer()
  server.listen(0, '127.0.0.1', () => {
    const number = server.address().port
    server.close(() => resolvePort(number))
  })
})
const origin = `http://127.0.0.1:${port}`
const vite = spawn(process.execPath, [resolve('node_modules/vite/bin/vite.js'),
  '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { stdio: 'ignore' })
let browser
try {
  let started = false
  for (let i = 0; i < 80; i++) {
    try { started = (await fetch(origin)).ok; if (started) break } catch {}
    await sleep(100)
  }
  assert.ok(started, 'Vite must start')
  for (const channel of [undefined, 'msedge', 'chrome']) {
    try { browser = await chromium.launch({ headless: true, ...(channel ? { channel } : {}) }); break }
    catch (error) { if (!String(error).includes("doesn't exist") && !String(error).includes('not found')) throw error }
  }
  assert.ok(browser, 'Chromium browser must be available')
  const short99 = 'a'.repeat(99)
  const short100 = 'b'.repeat(100)
  const long101 = 'c'.repeat(101)
  const textById = { 11: short99, 12: short100, 13: long101 }

  for (const autoTranslate of [true, false]) {
    const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 }, serviceWorkers: 'block' })
    const session = {
      token: 'mock.' + Buffer.from(JSON.stringify({exp:4102444800})).toString('base64url') + '.signed',
      refreshToken: 'r'.repeat(43), sessionId: 'translation-ui-'+String(autoTranslate),
      user: { id: 1, username: 'viewer', displayName: 'Người xem', email: 'viewer@example.invalid' },
    }
    await ctx.addInitScript(data => {
      localStorage.setItem('chatnet-session', JSON.stringify(data))
      class Events extends EventTarget { constructor(){super();setTimeout(()=>this.onopen?.(),50)} close(){} }
      window.EventSource = Events
    }, session)
    const now = new Date().toISOString()
    const conversation = { id: 21, type: 'direct', name: 'Linh Anh', otherUserId: 2,
      otherUsername: 'linhanh', memberCount: 2, lastMessage: 'hello', lastMessageAt: now,
      unreadCount: 0, online: true, createdAt: now }
    const messages = Object.entries(textById).map(([id,text]) => ({
      id:Number(id),conversationId:21,senderId:2,sender:'linhanh',
      senderDisplayName:'Linh Anh',text,createdAt:now,attachments:[],readByUserIds:[],
    }))
    messages.push({ id:14,conversationId:21,senderId:1,sender:'viewer',
      senderDisplayName:'Người xem',text:long101,translatedText:'Own translated output',
      translationLanguage:'en',createdAt:now,attachments:[],readByUserIds:[] })
    const requests = []
    await ctx.route('**/api/**', async route => {
      const req = route.request(), p = new URL(req.url()).pathname
      const json = (data, status=200) => route.fulfill({status, contentType:'application/json',
        headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*'},body:JSON.stringify(data)})
      if (req.method() === 'OPTIONS') return route.fulfill({status:204,
        headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'GET,POST,OPTIONS'}})
      if (p === '/api/translate') {
        const body = JSON.parse(req.postData() || '{}')
        requests.push(body.messageId)
        await sleep(650)
        return json({ translatedText: 'DỊCH ' + String(body.text).slice(0, 20) })
      }
      if (p === '/api/conversations') return json([conversation])
      if (p === '/api/conversations/memberships') return json({ids:[21],nextAfter:null})
      if (p === '/api/conversations/21/messages') return json(messages)
      if (p === '/api/conversation-categories') return json([])
      if (p === '/api/preferences/translation') return json({ targetLanguage:'en',autoTranslate })
      if (p === '/api/preferences') return json({targetLanguage:'en',autoTranslate,appLocale:'vi'})
      if (p === '/api/friends') return json([{id:2,username:'linhanh',displayName:'Linh Anh',online:true,status:'accepted',updatedAt:now}])
      if (p === '/api/push/config') return json({configured:false})
      return json([])
    })
    const page = await ctx.newPage()
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto(origin)
    await page.locator('.zalo-conversation-list .conversation-item').first().click()
    const row = id => page.locator(`[data-message-id="${id}"]`)
    await row(11).locator('.bubble').waitFor({state:'visible'})
    if (autoTranslate) {
      await row(11).locator('.chat-translation-loading').waitFor({state:'visible'})
    } else {
      assert.equal(requests.length, 0, 'Do not translate automatically when disabled')
      assert.equal(await row(11).locator('.chat-translation-dual').count(), 0)
      await row(11).getByRole('button', {name:'Dịch',exact:true}).click()
      await row(11).locator('.chat-translation-loading').waitFor({state:'visible'})
    }
    await row(11).locator('.chat-translation-dual').waitFor({state:'visible'})
    const topText = await row(11).locator('.chat-translation-dual > .translation-flip-content').boundingBox()
    const originalText = await row(11).locator('.chat-translation-original').boundingBox()
    assert.ok(topText && originalText && topText.y + topText.height <= originalText.y,
      'Translation must be physically above the original message')
    assert.ok((await row(11).locator('.chat-translation-dual > .translation-flip-content').innerText()).startsWith('DỊCH'))
    assert.equal(await row(11).locator('.chat-translation-original').innerText(), short99)
    assert.ok(!(await row(11).locator('.bubble').innerText()).includes('Bản dịch:'))

    if (!autoTranslate) {
      await row(12).getByRole('button', {name:'Dịch',exact:true}).click()
    }
    await row(12).locator('.chat-translation-dual').waitFor({state:'visible'})
    assert.equal(await row(12).locator('.chat-translation-original').innerText(), short100)
    if (!autoTranslate) {
      await row(13).getByRole('button', {name:'Dịch',exact:true}).click()
      await row(13).locator('.chat-translation-loading').waitFor({state:'visible'})
    }
    await row(13).locator('.translation-flip-pill').waitFor({state:'visible'})
    const longBubble = await row(13).locator('.bubble').boundingBox()
    const longToggle = await row(13).locator('.translation-flip-pill').boundingBox()
    assert.ok(longBubble && longToggle && longToggle.y >= longBubble.y + longBubble.height,
      'The original-text switch belongs below the long message')
    assert.equal(await row(13).locator('.chat-translation-original').count(),0, 'Long messages show one text at a time')
    assert.ok((await row(13).locator('.bubble').innerText()).startsWith('DỊCH'))
    await row(13).getByRole('button', {name:'Hiện tin nhắn gốc'}).click()
    assert.equal(await row(13).locator('.bubble').innerText(), long101)
    await row(13).getByRole('button', {name:'Hiện nội dung đã dịch'}).click()
    assert.ok((await row(13).locator('.bubble').innerText()).startsWith('DỊCH'))
    if (autoTranslate) {
      await row(14).locator('.translation-flip-pill').waitFor({state:'visible'})
      assert.equal(await row(14).locator('.bubble').innerText(), 'Own translated output')
      await row(14).getByRole('button', {name:'Hiện tin nhắn gốc'}).click()
      assert.equal(await row(14).locator('.bubble').innerText(), long101)
      assert.deepEqual([...requests].sort((a,b)=>a-b), [11,12,13],
        'Automatic translation must not re-request already translated outgoing messages')
    } else {
      await row(11).getByRole('button', {name:'Ẩn dịch'}).click()
      assert.equal(await row(11).locator('.chat-translation-dual').count(),0, 'Manual translation can be hidden')
      assert.equal(await row(11).getByRole('button', {name:'Dịch',exact:true}).count(),1)
      await row(14).getByRole('button', {name:'Dịch',exact:true}).click()
      await row(14).locator('.translation-flip-pill').waitFor({state:'visible'})
      assert.equal(await row(14).locator('.bubble').innerText(), 'Own translated output')
      assert.equal(requests.length,3, 'Manual toggle must reuse an existing outgoing translation')
    }
    assert.deepEqual(errors, [], 'No uncaught browser exceptions')
    await ctx.close()
    console.log(`PASS ${autoTranslate ? 'automatic' : 'manual'}: loading, 99/100/101 characters, order and toggle`)
  }
} finally {
  await browser?.close()
  vite.kill()
}
