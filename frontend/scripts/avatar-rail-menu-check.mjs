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
  refreshToken:'r'.repeat(43),sessionId:'avatar-menu-regression',
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
  for (const width of (process.env.CHATNET_ONLY_320 ? [320] : [320,390,430,900,1366])) {
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
    const hamburger=rail.getByRole('button',{name:'Menu hội thoại'})
    await hamburger.waitFor({state:'visible'})
    const initial=await hamburger.boundingBox()
    assert.equal(await rail.locator('.conversation-avatar-rail-expand-toggle, .desktop-conversation-rail-expand-toggle').count(),0,
      width+'px old blue arrow completely removed')
    assert.equal(await rail.locator('.conversation-avatar-rail-create, .desktop-conversation-rail-plus').count(),0,
      width+'px old plus completely removed')
    assert.equal(await rail.locator('.conversation-avatar-rail-top-category, .desktop-conversation-rail-top-category').count(),0,
      width+'px classification tag no longer occupies outside header')
    assert.ok(await rail.getByRole('searchbox',{name:'Tìm trong danh sách hội thoại'}).isVisible(),
      width+'px conversation name search remains')
    const initialGeometry=await rail.evaluate(isMobile => {
      const field=document.querySelector(isMobile?'.conversation-avatar-rail-search-field':'.desktop-conversation-rail-search-field')
      const f=field?.getBoundingClientRect()
      const area=field?.closest(isMobile?'.conversation-avatar-rail-search-area':'.desktop-conversation-rail-search-area')
      const line=field?.closest(isMobile?'.conversation-avatar-rail-search-line':'.desktop-conversation-rail-search-line')
      const ar=area?.getBoundingClientRect(),li=line?.getBoundingClientRect()
      return f && {x:f.x,width:f.width,right:f.right,
        area:ar && {width:ar.width, x:ar.x},line:li && {width:li.width,x:li.x},
        style:{boxSizing:getComputedStyle(field).boxSizing,padding:getComputedStyle(field).padding,
          margin:getComputedStyle(field).margin},
        areaStyle:{padding:area&&getComputedStyle(area).padding}}

    },isMobile)
    console.log('INITIAL_SEARCH_GEOMETRY',width,JSON.stringify(initialGeometry))

    await hamburger.click()
    const popover=page.locator('.conversation-rail-menu-popover:popover-open')
    await popover.waitFor({state:'visible'})
    const bounds=await popover.boundingBox()
    assert.ok(bounds && bounds.x >= 0 && bounds.x+bounds.width <= width+1 &&
      bounds.width > 220, width+'px hamburger popup should not be clipped by the rail: '+JSON.stringify(bounds))
    assert.ok(await popover.getByRole('button',{name:'Tạo cuộc trò chuyện'}).isVisible())
    const classification = popover.getByRole('button',{name:'Lọc hội thoại theo phân loại'})
    await classification.click()
    const categories=page.locator('.category-popover:popover-open')
    await categories.waitFor({state:'visible',timeout:2000})
    await categories.getByText('Công việc',{exact:true}).click()
    await page.waitForTimeout(200)
    assert.equal(await item.count(),1,width+'px classification menu still filters the avatar rail')
    assert.equal(await item.first().getAttribute('title'),'Linh Anh')
    // The hamburger lives in the former arrow slot and stays visible even
    // after a group opens the joined avatar/channel picker.
    if (!(await popover.isVisible())) await hamburger.click()
    await popover.waitFor({state:'visible'})
    await popover.getByRole('button',{name:'Lọc hội thoại theo phân loại'}).click()
    await page.locator('.category-popover:popover-open').getByText('Tất cả hội thoại',{exact:true}).click()
    await page.waitForTimeout(150)
    assert.equal(await item.count(),2)
    // Managing/creating tags still works when its trigger is nested inside the
    // new top-layer hamburger instead of the old top-bar tag icon.
    if (!(await popover.isVisible())) await hamburger.click()
    await popover.getByRole('button',{name:'Lọc hội thoại theo phân loại'}).click()
    await page.locator('.category-popover:popover-open')
      .getByRole('button',{name:/Quản lý thẻ phân loại/}).click()
    await page.locator('.category-manager[open]').waitFor({state:'visible',timeout:2000})
    await page.getByRole('button',{name:'Đóng quản lý thẻ'}).click()
    if (await popover.isVisible()) await hamburger.click()
    await item.filter({hasText:'Nhóm Sản phẩm'}).first().click()
    await page.locator('.group-channel-sidebar').waitFor({state:'visible',timeout:2000})
    const compact=await hamburger.boundingBox()
    assert.ok(compact && initial && Math.abs(compact.x-initial.x)<=2,
      width+'px hamburger must remain anchored where the former arrow was: '+JSON.stringify({initial,compact}))
    await hamburger.click()
    await popover.waitFor({state:'visible'})
    await popover.getByRole('button',{name:'Tìm hội thoại'}).click()
    await page.waitForFunction(() =>
      document.activeElement?.getAttribute('aria-label') === 'Tìm trong danh sách hội thoại',
      null,{timeout:1500})
    await page.waitForTimeout(430)
    const search=rail.getByRole('searchbox',{name:'Tìm trong danh sách hội thoại'})
    const channelSearch=page.getByRole('searchbox',{name:'Tìm kênh hội thoại'})
    const geometry=await page.evaluate(isMobile => {
      const container=document.querySelector(isMobile?'.conversation-avatar-rail':'.desktop-conversation-rail')
      const a=container?.querySelector(isMobile?'.conversation-avatar-rail-search-field':'.desktop-conversation-rail-search-field')
      const b=document.querySelector('.group-channel-sidebar-search')
      const input=container?.querySelector('input[aria-label="Tìm trong danh sách hội thoại"]')
      const rect=el => el?.getBoundingClientRect()
      const ar=rect(a), br=rect(b)
      return {conversation:ar && {x:ar.x,y:ar.y,width:ar.width,right:ar.right},
        channel:br && {x:br.x,y:br.y,width:br.width,right:br.right},
        railWidth:rect(container)?.width, visible:input && getComputedStyle(input).visibility,
        split:document.querySelector('.social-chat-layout')?.dataset.splitExpanded,
        hit:ar && document.elementFromPoint(ar.x+ar.width/2,ar.y+ar.height/2)?.tagName}
    },isMobile)
    console.log('GROUP_SEARCH_GEOMETRY',width,JSON.stringify(geometry))
    assert.equal(geometry.split,'true',width+'px group picker avatar column is expanded')
    assert.equal(geometry.visible,'visible',width+'px conversation search input is visible')
    assert.equal(geometry.hit,'INPUT',width+'px conversation search remains directly clickable')
    assert.ok(geometry.conversation && geometry.channel &&
      Math.abs(geometry.conversation.width-geometry.channel.width)<1,
      width+'px conversation/channel search fields must have equal widths: '+JSON.stringify(geometry))
    if (isMobile) assert.ok(initialGeometry &&
      Math.abs(initialGeometry.width-geometry.channel.width)<1,
      width+'px conversation search must keep its channel-matched width when switching from list to group: '+JSON.stringify({initialGeometry,geometry}))
    await search.fill('Linh')
    assert.equal(await search.inputValue(),'Linh',width+'px group picker avatar search accepts typing')
    await page.waitForFunction(selector => document.querySelectorAll(selector).length === 1,
      rowSelector,{timeout:2500})
    assert.equal(await item.count(),1,width+'px group picker search filters by conversation NAME')
    assert.equal(await item.first().getAttribute('title'),'Linh Anh')
    await search.fill('hello')
    await page.waitForTimeout(650)
    assert.equal(await item.count(),0,
      width+'px conversation search must not match message previews (name only)')
    await search.fill('')
    await page.waitForFunction(selector => document.querySelectorAll(selector).length===2,
      rowSelector,{timeout:2000})
    await channelSearch.fill('Hỏi đáp')
    assert.equal(await channelSearch.inputValue(),'Hỏi đáp')
    const measureSearchDuringSplit = () => page.evaluate(isMobile => {
      const selector = isMobile ? '.conversation-avatar-rail' : '.desktop-conversation-rail'
      const host = document.querySelector(selector)
      const area = host?.querySelector(isMobile ? '.conversation-avatar-rail-search-area' : '.desktop-conversation-rail-search-area')
      const field = host?.querySelector(isMobile ? '.conversation-avatar-rail-search-field' : '.desktop-conversation-rail-search-field')
      const input = host?.querySelector('input[aria-label="Tìm trong danh sách hội thoại"]')
      return {
        fieldWidth: field?.getBoundingClientRect().width,
        inputWidth: input?.getBoundingClientRect().width,
        areaDisplay: area && getComputedStyle(area).display,
        hostWidth: host?.getBoundingClientRect().width,
        split: document.querySelector('.social-chat-layout')?.dataset.splitExpanded,
      }
    },isMobile)
    const beforeCollapse = await measureSearchDuringSplit()
    await hamburger.click()
    await page.locator('.conversation-rail-menu-popover:popover-open')
      .getByRole('button',{name:/Thu gọn cột avatar|Mở rộng cột avatar/}).click()
    // The rail moves, but the same field and inner input stay full-width.
    await page.waitForTimeout(170)
    const duringCollapse = await measureSearchDuringSplit()
    await page.waitForTimeout(260)
    const afterCollapse = await measureSearchDuringSplit()
    console.log('GROUP_SEARCH_COLLAPSE',width,JSON.stringify({beforeCollapse,duringCollapse,afterCollapse}))
    for (const [phase, measured] of [['during',duringCollapse],['after',afterCollapse]]) {
      assert.ok(measured.areaDisplay !== 'none' && measured.fieldWidth > 100 && measured.inputWidth > 60,
        width+'px search must stay mounted and sized '+phase+' collapse: '+JSON.stringify(measured))
      assert.ok(Math.abs(measured.fieldWidth-beforeCollapse.fieldWidth)<1 &&
        Math.abs(measured.inputWidth-beforeCollapse.inputWidth)<1,
        width+'px search must never resize '+phase+' collapse: '+JSON.stringify({beforeCollapse,measured}))
    }
    assert.ok(afterCollapse.hostWidth < beforeCollapse.hostWidth-20,
      width+'px only the avatar rail viewport should shrink')
    await hamburger.click()
    await page.locator('.conversation-rail-menu-popover:popover-open')
      .getByRole('button',{name:/Thu gọn cột avatar|Mở rộng cột avatar/}).click()
    await page.waitForTimeout(430)
    const afterReopen = await measureSearchDuringSplit()
    assert.ok(Math.abs(afterReopen.fieldWidth-beforeCollapse.fieldWidth)<1 &&
      Math.abs(afterReopen.inputWidth-beforeCollapse.inputWidth)<1,
      width+'px search must stay same size after reopening: '+JSON.stringify({beforeCollapse,afterReopen}))
    assert.ok(await rail.locator('.conversation-rail-menu-classification .category-filter-trigger').count()===1)
    if (!isMobile) {
      // Direct chats also support collapsing the web avatar dock. The search
      // must retain its actual DOM width, not disappear or resize to 0.
      await item.filter({hasText:'Linh Anh'}).first().click()
      await page.waitForTimeout(200)
      const directBefore = await measureSearchDuringSplit()
      await hamburger.click()
      await page.locator('.conversation-rail-menu-popover:popover-open')
        .getByRole('button',{name:/Thu gọn cột avatar|Mở rộng cột avatar/}).click()
      await page.waitForTimeout(100)
      const directDuring = await measureSearchDuringSplit()
      await page.waitForTimeout(430)
      const directAfter = await measureSearchDuringSplit()
      console.log('DIRECT_SEARCH_COLLAPSE',width,JSON.stringify({directBefore,directDuring,directAfter}))
      assert.ok(directBefore.fieldWidth > 100 && directAfter.fieldWidth > 100 &&
        Math.abs(directBefore.fieldWidth-directDuring.fieldWidth)<1 &&
        Math.abs(directBefore.fieldWidth-directAfter.fieldWidth)<1,
        width+'px direct-chat search must remain constant when web dock collapses')
    }
    assert.deepEqual(errors,[],width+'px runtime errors')
    await context.close()
    console.log('PASS avatar hamburger / classification / group picker '+width+'px')
  }
} finally {
  await browser?.close()
  vite.kill('SIGTERM')
}
