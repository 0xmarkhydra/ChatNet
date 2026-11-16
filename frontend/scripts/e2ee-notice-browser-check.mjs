import assert from 'node:assert/strict'
import { chromium } from 'playwright'

// The running local Vite app uses sample API data only inside this browser context.
const origin = 'http://127.0.0.1:5173'
const preview = process.argv.includes('--preview')
const viewports = preview ? [1440] : [1440, 768, 390, 320]
const noticeTitle = 'Hội thoại chưa mã hóa đầu cuối'
const channels = [undefined, 'msedge', 'chrome']
let browser
for (const channel of channels) {
  try {
    browser = await chromium.launch({headless:!preview, ...(channel ? {channel} : {})})
    break
  } catch (error) {
    if (!/doesn't exist|not found/.test(String(error))) throw error
  }
}
assert.ok(browser, 'A supported browser is required')

try {
  const session = {
    token: 'mock.' + Buffer.from(JSON.stringify({exp:4102444800})).toString('base64url') + '.signed',
    refreshToken: 'r'.repeat(43), sessionId: 'chat-e2ee-notice-qa',
    user: {id:1,email:'viewer@example.invalid',username:'viewer',displayName:'Người xem'},
  }
  const today = new Date().toISOString()
  const conversations = [
    {id:101,type:'direct',name:'Linh Anh',otherUserId:2,otherUsername:'linhanh',memberCount:2,
      lastMessage:'Chiều nay mình gặp ở quán cũ nhé',lastMessageAt:today,unreadCount:0,online:true,createdAt:today},
  ]
  const messages = [
    {id:1,conversationId:101,senderId:2,sender:'linhanh',senderDisplayName:'Linh Anh',text:'Chào bạn! Lâu rồi chúng ta chưa\nđi uống cà phê với nhau ☕',createdAt:today,attachments:[],readByUserIds:[]},
    {id:2,conversationId:101,senderId:1,sender:'viewer',senderDisplayName:'Người xem',text:'Đúng rồi, thứ Bảy đi nhé!\nMình cũng muốn gặp mọi người.',createdAt:today,attachments:[],readByUserIds:[2]},
  ]
  for (const width of viewports) {
    console.log(`Checking encryption notice at ${width}px`)
    const ctx = await browser.newContext({viewport:{width,height:780},serviceWorkers:'block'})
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
      if (p === '/api/conversations/101/e2ee/status') return json({mode:'legacy',pilotEnabled:false})
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
    const openRoom = async (id, name) => {
      await page.goto(`${origin}/chat`)
      const row = page.getByRole('button', {name:new RegExp(`^Mở (tin nhắn|cuộc trò chuyện) ${name}$`)})
      await row.click({timeout:12000})
      await page.waitForURL(`**/chat/${id}`, {timeout:12000})
      await page.locator('.conversation-panel .chat-head').getByText(name, {exact:true}).waitFor({state:'visible'})
    }
    await openRoom(101, 'Linh Anh')
    const banner = page.getByRole('status').filter({hasText:'mã hóa đầu cuối'})
    try {
      await banner.getByText(noticeTitle, {exact:true}).waitFor({state:'visible', timeout:12000})
    } catch (error) {
      console.error(JSON.stringify({
        width, url:page.url(), jsErrors,
        bannerText:await page.locator('[role="status"]').allTextContents(),
        roomText:(await page.locator('.conversation-panel').first().innerText()).slice(0,380),
      }))
      throw error
    }
    assert.match(await banner.innerText(), /Hội thoại chưa mã hóa đầu cuối\s+Tin nhắn mới vẫn có thể được lưu trên máy chủ\./)
    const geometry = await banner.evaluate(el => {
      const box = el.getBoundingClientRect()
      const panel = el.closest('.conversation-panel').getBoundingClientRect()
      const header = el.closest('.conversation-panel').querySelector('.chat-head').getBoundingClientRect()
      const timeline = el.closest('.conversation-panel').querySelector('.messages').getBoundingClientRect()
      const style = getComputedStyle(el)
      const tolerance = 1
      return {
        inset: Math.min(box.left - panel.left, panel.right - box.right),
        inside: box.width > 0 && box.bottom <= timeline.top + tolerance && box.top >= header.bottom - tolerance,
        noOverflow: el.scrollWidth <= el.clientWidth,
        styled: style.display === 'flex' && Number.parseFloat(style.borderTopLeftRadius) > 0 &&
          style.backgroundColor !== 'rgba(0, 0, 0, 0)',
        icon: el.querySelector('svg')?.getAttribute('aria-hidden') === 'true',
        height: box.height,
      }
    })
    assert.ok(geometry.inset >= 8 && geometry.inside && geometry.noOverflow && geometry.styled && geometry.icon,
      `Banner fits between the chat header and messages at ${width}px: ${JSON.stringify(geometry)}`)
    if (preview) {
      console.log('Preview open on local ChatNet with sample data. Close the browser to end.')
      await new Promise(resolve => browser.once('disconnected', resolve))
      break
    }
    assert.deepEqual(jsErrors, [], `browser errors at ${width}px`)
    console.log(`PASS: encryption notice at ${width}px (${geometry.height}px high)`)
    await ctx.close()
  }
} finally {
  await browser.close()
}
