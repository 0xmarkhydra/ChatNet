import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { mkdir } from 'node:fs/promises'
import { chromium } from 'playwright'
import { createServer } from 'vite'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const vite = await createServer({ root, configFile: resolve(root,'vite.config.ts'), logLevel:'error', server:{host:'127.0.0.1',port:0} })
let browser
try {
  await vite.listen()
  const origin = 'http://127.0.0.1:' + vite.httpServer.address().port
  browser = await chromium.launch({channel:'chrome',headless:true})
  const context = await browser.newContext({viewport:{width:1478,height:920},serviceWorkers:'block'})
  const session = { token:'mock.'+Buffer.from(JSON.stringify({exp:4102444800})).toString('base64url')+'.signed',
    refreshToken:'r'.repeat(43),sessionId:'groups-redesign-test',
    user:{id:1,username:'tester',displayName:'Tài khoản của tôi',email:'test@example.invalid'} }
  await context.addInitScript(data=>localStorage.setItem('chatnet-session',JSON.stringify(data)),session)
  const group=(id,name,count=3)=>({id,type:'group',name,memberCount:count,unreadCount:1,lastMessage:'Tin nhắn trước',lastMessageAt:'2026-11-06T09:30:00Z',online:true,createdAt:'2026-11-01T09:30:00Z'})
  const groups=[group(91,'Team ChatNet')]
  const friends=[
    {id:2,username:'linhanh',displayName:'Linh Anh',status:'accepted',online:true,updatedAt:'2026-11-06'},
    {id:3,username:'david',displayName:'David Chen',status:'accepted',online:true,updatedAt:'2026-11-06'},
    {id:4,username:'phuong',displayName:'Phương Linh',status:'accepted',online:true,updatedAt:'2026-11-06'},
  ]
  const members=[{id:1,username:'tester',displayName:'Tài khoản của tôi',role:'owner',online:true},
    {id:2,username:'linhanh',displayName:'Linh Anh',role:'admin',online:true},
    {id:3,username:'david',displayName:'David Chen',role:'member',online:false}]
  const groupSettings={requireApproval:true,adminCanInvite:true,adminCanApprove:true,adminCanEditInfo:true}
  const profile={id:91,name:'Team ChatNet',description:'Cộng đồng kỹ thuật',topic:'Công nghệ',rules:'Tôn trọng mọi thành viên',visibility:'private',memberCount:3}
  const channels=[{id:0,conversationId:91,name:'Thảo luận chung',description:'Kênh mặc định'}]
  const prefs={messageNotifications:true,mentionNotifications:true}
  const payloads=[]
  const sampleMsg={id:44,conversationId:91,senderId:2,sender:'linhanh',senderDisplayName:'Linh Anh',
    text:'Chào mọi người, đây là nhóm ChatNet.',createdAt:'2026-11-06T09:30:00Z',attachments:[],reactions:[]}
  const calls=[]
  const channelMessages=[]
  const json=data=>({status:200,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*'},contentType:'application/json',body:JSON.stringify(data)})
  await context.route('http://localhost:8080/**',async route=>{
    const req=route.request();const url=new URL(req.url());const path=url.pathname;const method=req.method()
    calls.push(method+' '+path)
    if(method==='OPTIONS')return route.fulfill({status:204,headers:{'access-control-allow-origin':'*','access-control-allow-methods':'*','access-control-allow-headers':'*'}})
    if(path==='/api/events')return route.fulfill({status:200,headers:{'access-control-allow-origin':'*'},contentType:'text/event-stream',body:': ready\n\n'})
    if(path==='/api/conversations/groups'&&method==='POST'){
      const body=JSON.parse(req.postData()||'{}');payloads.push(body)
      const created=group(120,body.name,1+body.usernames.length);created.unreadCount=0
      groups.unshift(created)
      return route.fulfill(json(created))
    }
    if(path==='/api/groups/public'&&method==='GET')return route.fulfill(json([{id:150,name:'Cộng đồng công khai',description:'Cộng đồng mở',topic:'Thiết kế',visibility:'public',memberCount:12}]))
    if(path==='/api/groups/150/join'&&method==='POST')return route.fulfill(json({conversationId:150,status:'pending'}))
    if(path==='/api/conversations/91/community'&&method==='GET')return route.fulfill(json(profile))
    if(path==='/api/conversations/91/community'&&method==='PATCH'){Object.assign(profile,JSON.parse(req.postData()||'{}'));payloads.push({...profile});return route.fulfill(json(profile))}
    if(path==='/api/conversations/120/community'&&method==='GET')return route.fulfill(json({id:120,name:'SocCo Product Community',description:'Chia sẻ ý tưởng và sản phẩm',topic:'',rules:'',visibility:'public',memberCount:3}))
    if(path.endsWith('/notification-settings')&&method==='GET')return route.fulfill(json(prefs))
    if(path.endsWith('/notification-settings')&&method==='PUT'){Object.assign(prefs,JSON.parse(req.postData()||'{}'));return route.fulfill(json(prefs))}
    if(path==='/api/conversations/91/channels'&&method==='GET')return route.fulfill(json(channels))
    if(path==='/api/conversations/91/channels'&&method==='POST'){const body=JSON.parse(req.postData()||'{}');const c={id:201,conversationId:91,...body};channels.push(c);return route.fulfill(json(c))}
    if(path==='/api/conversations/120/channels'&&method==='GET')return route.fulfill(json([{id:0,conversationId:120,name:'Thảo luận chung',description:'Kênh mặc định'}]))
    if(path==='/api/conversations/91/channels/201'&&method==='PATCH'){Object.assign(channels[1],JSON.parse(req.postData()||'{}'));return route.fulfill(json(channels[1]))}
    if(path==='/api/conversations/91/channels/201'&&method==='DELETE'){channels.pop();return route.fulfill(json({ok:true}))}
    if(path==='/api/conversations/91/members'&&method==='GET')return route.fulfill(json(members))
    if(path==='/api/conversations/120/members'&&method==='GET')return route.fulfill(json([{id:1,username:'tester',displayName:'Tài khoản của tôi',role:'owner',online:true}]))
    if(path.endsWith('/pins')&&method==='GET')return route.fulfill(json([]))
    if(path.endsWith('/activities')&&method==='GET')return route.fulfill(json([]))
    if(path.endsWith('/group-settings')&&method==='GET')return route.fulfill(json(groupSettings))
    if(path.endsWith('/group-settings')&&method==='PATCH')return route.fulfill(json({...groupSettings,...JSON.parse(req.postData()||'{}')}))
    if(path.endsWith('/join-requests')&&method==='GET')return route.fulfill(json([]))
    if(path.endsWith('/invites')&&method==='GET')return route.fulfill(json([]))
    if(path.endsWith('/admin-audit')&&method==='GET')return route.fulfill(json([]))
    if(path==='/api/conversations/91/members/3'&&method==='PATCH')return route.fulfill(json({}))
    if(path==='/api/conversations/91/members'&&method==='POST')return route.fulfill(json({}))
    if(path.includes('/messages')&&method==='GET')return route.fulfill(json(url.searchParams.get('channelId')==='201'?channelMessages:path.includes('/91/')?[sampleMsg]:[]))
    if(path.includes('/messages')&&method==='POST'){
      const body=JSON.parse(req.postData()||'{}');payloads.push(body)
      const message={...sampleMsg,id:65+payloads.length,senderId:1,sender:'tester',channelId:body.channelId||0,clientId:body.clientId,text:body.text}
      if(body.channelId===201)channelMessages.push(message)
      return route.fulfill(json(message))
    }
    const data=path==='/api/conversations'?groups:
      path==='/api/friends'?friends:
      path==='/api/friends/requests'||path==='/api/stories'||path==='/api/posts'||path==='/api/conversation-categories'||path==='/api/calls/current'||path==='/api/contacts'?[]:
      path==='/api/users/suggestions'||path==='/api/users/search'?friends:
      path==='/api/profile'?{username:'tester',displayName:'Tài khoản của tôi',avatarSet:false,coverSet:false,updatedAt:'2026-11-06'}:{}
    await route.fulfill(json(data))
  })
  await context.addInitScript(() => {
    // Deliver controlled realtime events after the channel is selected.
    class MockEventSource {
      constructor() {
        this.listeners = new Map()
        this.closed = false
        window.__chatnetTestSSE = this
        queueMicrotask(() => { if (!this.closed && this.onopen) this.onopen() })
      }
      addEventListener(type, callback) {
        const callbacks = this.listeners.get(type) || []
        callbacks.push(callback)
        this.listeners.set(type, callbacks)
      }
      emit(type, data) {
        for (const callback of this.listeners.get(type) || []) callback({ data: JSON.stringify(data) })
      }
      close() { this.closed = true }
    }
    window.EventSource = MockEventSource
  })
  const page=await context.newPage()
  const errors=[]
  page.on('pageerror',error=>errors.push(error.message))
  await page.goto(origin,{waitUntil:'domcontentloaded'})
  assert.equal(await page.locator('.app-sidebar').getByRole('button',{name:'Nhóm & cộng đồng'}).count(),0)
  await page.locator('.social-chat-list-filters').getByRole('button',{name:'Nhóm'}).click()
  assert.equal(await page.locator('.social-chat-list-filters').getByRole('button',{name:'Nhóm'}).getAttribute('aria-pressed'),'true')
  await page.locator('.app-sidebar').getByRole('button',{name:'Bảng tin'}).click()
  const communityButton=page.locator('.chatnet-appbar').getByRole('button',{name:'Cộng đồng'})
  assert.ok(await communityButton.isVisible(),'Community icon must be in the Feed top toolbar')
  assert.equal(await page.locator('.chatnet-appbar').getByRole('button',{name:'Tạo bài viết'}).count(),0,'Replace the top compose-post icon')
  assert.equal(await page.locator('.social-feed-filter-options').getByRole('button',{name:'Cộng đồng'}).count(),0,'Remove the old desktop Community tab')
  assert.equal(await page.locator('.feed-filter-tabs').getByRole('button',{name:'Cộng đồng'}).count(),0,'Remove the old mobile Community tab')
  const topActions=await page.locator('.chatnet-appbar .appbar-actions').evaluate(root=>{
    const community=root.querySelector('.social-feed-header-community')
    const bell=root.querySelector('.notification-appbar')
    if(!community||!bell)return null
    const left=community.getBoundingClientRect(),right=bell.getBoundingClientRect()
    return {sameRow:Math.abs(left.top-right.top)<5,communityRight:left.right,bellLeft:right.left}
  })
  assert.ok(topActions?.sameRow && topActions.communityRight<=topActions.bellLeft+1,
    'Community icon must sit beside and before Notifications in the toolbar')
  assert.ok(await page.locator('.social-feed-filter-bar').isVisible(),'Regular Feed retains the desktop filter bar')
  await communityButton.click()
  await page.getByRole('heading',{name:'Cộng đồng',exact:true}).waitFor()
  assert.equal(await page.locator('.social-feed-filter-bar').count(),0,'Community page must hide the desktop post filter menu')
  assert.equal(await page.locator('.feed-filter-tabs').count(),0,'Community page must hide mobile post filters')
  assert.equal(await communityButton.getAttribute('aria-pressed'),'true')
  assert.match(await page.locator('.feed-community-list').innerText(),/Team ChatNet/)
  assert.equal(await page.locator('.cg-management').count(),0)
  assert.equal(await page.locator('.feed-communities-workspace').count(),0)
  const dir=resolve(root,'output','groups-redesign')
  await mkdir(dir,{recursive:true})
  await page.screenshot({path:resolve(dir,'feed-community-list.png'),fullPage:true})
  for (const width of [390,768,1024,1478]) {
    await page.setViewportSize({width,height:850})
    assert.ok(await communityButton.isVisible(),'Community toolbar icon must remain visible at '+width+'px')
    assert.equal(await communityButton.getAttribute('aria-pressed'),'true')
    assert.ok(await page.locator('.feed-community-list').isVisible(),'Community list at '+width+'px')
    assert.equal(await page.locator('.social-feed-filter-bar').count(),0,'No desktop post filter menu inside Community at '+width+'px')
    assert.equal(await page.locator('.feed-filter-tabs').count(),0,'No mobile post filter menu inside Community at '+width+'px')
    assert.equal(await page.locator('.feed-filter-tabs').getByRole('button',{name:'Cộng đồng'}).count(),0)
    const state=await page.evaluate(()=>({viewport:innerWidth,width:document.documentElement.scrollWidth}))
    assert.ok(state.width<=state.viewport+3,'Feed overflow at '+width+'px: '+JSON.stringify(state))
    console.log('PASS Feed Community toolbar icon and list at '+width+'px')
  }
  await communityButton.click()
  assert.equal(await communityButton.getAttribute('aria-pressed'),'false','Community icon toggles back to the regular Feed')
  assert.equal(await page.locator('.feed-community-list').count(),0,'Exit Community listing on second click')
  await page.setViewportSize({width:1478,height:850})
  assert.ok(await page.locator('.social-feed-filter-bar').isVisible(),'Regular Feed filter menu is restored after leaving Community')
  await communityButton.click()
  await page.getByRole('heading',{name:'Cộng đồng',exact:true}).waitFor()
  assert.equal(await communityButton.getAttribute('aria-pressed'),'true')
  console.log('PASS Community icon toggles between Community listing and regular Feed')
  await page.getByRole('button',{name:'Mở cuộc trò chuyện Team ChatNet'}).click()
  await page.locator('.group-chat-panel').waitFor()
  assert.ok(await page.locator('.chat-head').isVisible(),'Clicking community must open the Messages conversation')
  // Channel picker must stay visually separate from the group name, at desktop and phone sizes.
  for (const width of [320, 375, 390, 768, 1024, 1478]) {
    await page.setViewportSize({width, height:850})
    const metrics = await page.evaluate(() => {
      const title = document.querySelector('.group-room-title > strong')
      const picker = document.querySelector('.group-channel-picker')
      const trigger = document.querySelector('.group-channel-selector')
      if (!title || !picker || !trigger) return null
      const a = title.getBoundingClientRect()
      const b = picker.getBoundingClientRect()
      const style = getComputedStyle(trigger)
      const overlapWidth = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left))
      const overlapHeight = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top))
      return { titleWidth:a.width, pickerWidth:b.width, overlapWidth, overlapHeight,
        sameRow:overlapHeight > 0, spacing:b.left-a.right,
        border:style.borderTopWidth, fontSize:parseFloat(getComputedStyle(document.querySelector('.group-channel-current-name')).fontSize),
        scrollWidth:document.documentElement.scrollWidth, viewport:innerWidth }
    })
    assert.ok(metrics && metrics.titleWidth > 8 && metrics.pickerWidth > 30, 'Header title and picker visible at '+width+'px: '+JSON.stringify(metrics))
    assert.ok(metrics.overlapWidth === 0 || metrics.overlapHeight === 0, 'Channel selector must not overlap the group name at '+width+'px: '+JSON.stringify(metrics))
    if (metrics.sameRow) assert.ok(metrics.spacing >= 7, 'Channel selector needs spacing from group name at '+width+'px: '+JSON.stringify(metrics))
    assert.equal(metrics.border, '0px', 'Channel selector should have no border at '+width+'px')
    assert.ok(metrics.fontSize <= 11, 'Channel label should stay compact at '+width+'px')
    assert.ok(metrics.scrollWidth <= metrics.viewport+3, 'No horizontal overflow at '+width+'px')
    console.log('PASS channel selector spacing, no border and compact text at '+width+'px')
  }
  await page.locator('.translate-controls').getByRole('button',{name:'Thông tin hội thoại'}).click()
  const details=page.locator('#conversation-details-panel')
  await details.getByRole('heading',{name:'Thông tin hội thoại'}).waitFor()
  assert.ok(await details.getByRole('button',{name:'Tùy chọn nhóm'}).isVisible(),'Original group information menu must remain')
  assert.ok(await details.getByRole('button',{name:'Ảnh & video'}).isVisible(),'Shared content menu must remain')
  assert.ok(await details.getByRole('button',{name:'Tìm tin nhắn'}).isVisible(),'Search menu must remain')
  const groupChannelList=details.locator('.conversation-channel-list')
  assert.ok(await groupChannelList.getByRole('button',{name:'Thảo luận chung'}).isVisible(),'Info menu must list channels')
  assert.equal(await details.getByRole('button',{name:'Tạo kênh hội thoại'}).count(),0,'Info menu must not create channels')
  await details.getByRole('button',{name:'Đóng thông tin hội thoại'}).click()
  const picker=page.locator('.group-channel-picker')
  assert.equal(await page.locator('.group-room-edit').count(),0, 'Group rename must not be available from the header')
  assert.ok(await picker.getByRole('button',{name:/Chọn kênh hội thoại: Thảo luận chung/}).isVisible())
  await picker.locator('.group-channel-current-name').hover()
  const idleBackground=await picker.locator('.group-channel-selector').evaluate(el=>getComputedStyle(el).backgroundColor)
  await picker.locator('.group-channel-current-name').click()
  assert.equal(await picker.locator('.group-channel-selector').getAttribute('aria-expanded'),'false','Channel label must not toggle the dropdown')
  await picker.locator('.group-channel-selector').hover()
  await page.waitForTimeout(220)
  const hoverBackground=await picker.locator('.group-channel-selector').evaluate(el=>getComputedStyle(el).backgroundColor)
  assert.notEqual(hoverBackground,idleBackground,'Only dropdown arrow should highlight on hover')
  assert.equal(await picker.locator('.group-channel-current-name').evaluate(el=>getComputedStyle(el).cursor),'default','Channel name must have no hover action')
  assert.equal(await picker.locator('.group-channel-selector').evaluate(el=>getComputedStyle(el).cursor),'pointer','Only dropdown arrow should be interactive')
  console.log('PASS channel name is static and hover belongs to the dropdown arrow')
  assert.ok(await page.locator('.messages').getByText('Chào mọi người, đây là nhóm ChatNet.').isVisible())
  await picker.locator('.group-channel-selector').click()
  await picker.getByRole('button',{name:'Tạo kênh hội thoại'}).click()
  assert.ok(await picker.getByText('Chủ nhóm tạo kênh để thảo luận theo chủ đề.').isVisible())
  assert.ok(await picker.getByRole('button',{name:'Hủy',exact:true}).isVisible())
  assert.ok(await picker.getByRole('textbox',{name:'Mô tả kênh mới'}).isVisible())
  await page.screenshot({path:resolve(dir,'create-channel-form.png'),fullPage:true})
  await picker.getByRole('textbox',{name:'Tên kênh mới'}).fill('Backend API')
  await picker.getByRole('textbox',{name:'Mô tả kênh mới'}).fill('Tài liệu backend')
  await Promise.all([
    page.waitForResponse(response=>response.url().endsWith('/api/conversations/91/channels')&&response.request().method()==='POST'),
    picker.getByRole('button',{name:'Tạo kênh',exact:true}).click(),
  ])
  await picker.getByRole('button',{name:/Chọn kênh hội thoại: Backend API/}).waitFor()
  assert.ok(calls.includes('POST /api/conversations/91/channels'))
  assert.equal(await page.locator('.messages').getByText('Chào mọi người, đây là nhóm ChatNet.').count(),0,'Main chat messages must be hidden inside the channel')
  assert.ok(calls.some(item=>item==='GET /api/conversations/91/messages'))
  await page.getByRole('textbox',{name:'Tin nhắn',exact:true}).fill('Tin nhắn trong kênh riêng')
  await Promise.all([
    page.waitForResponse(response=>response.url().includes('/api/conversations/91/messages')&&response.request().method()==='POST'),
    page.getByRole('button',{name:'Gửi tin nhắn',exact:true}).click(),
  ])
  assert.equal(payloads.find(item=>item.channelId===201)?.text,'Tin nhắn trong kênh riêng')
  await page.locator('.messages').getByText('Tin nhắn trong kênh riêng').waitFor()
  await picker.locator('.group-channel-selector').click()
  await picker.getByRole('menuitemradio',{name:'Thảo luận chung'}).click()
  await page.locator('.messages').getByText('Chào mọi người, đây là nhóm ChatNet.').waitFor()
  assert.equal(await page.locator('.messages').getByText('Tin nhắn trong kênh riêng').count(),0)
  console.log('PASS owner creates a channel from group-title dropdown, full message UI stays scoped by channel')

  await page.locator('.translate-controls').getByRole('button',{name:'Thông tin hội thoại'}).click()
  await details.getByRole('button',{name:'Backend API'}).click()
  await picker.getByRole('button',{name:/Chọn kênh hội thoại: Backend API/}).waitFor()
  await page.locator('.messages').getByText('Tin nhắn trong kênh riêng').waitFor()
  const realtimeMessage={...sampleMsg,id:991,channelId:201,senderId:2,text:'Realtime trong kênh Backend API',createdAt:new Date().toISOString()}
  channelMessages.push(realtimeMessage)
  await page.evaluate(message=>window.__chatnetTestSSE.emit('update',{type:'message',conversationId:91,message:message}),realtimeMessage)
  await page.locator('.messages').getByText('Realtime trong kênh Backend API').waitFor()
  console.log('PASS realtime message is rendered in the active channel')

  console.log('PASS three-dot info menu lists channels and switches the full chat timeline')

  await picker.locator('.group-channel-selector').click()
  await picker.getByRole('menuitemradio',{name:'Thảo luận chung'}).click()
  await page.locator('.translate-controls').getByRole('button',{name:'Thông tin hội thoại'}).click()
  await details.getByRole('button',{name:'Quản lý nhóm'}).click()
  const sidebar=page.locator('.group-settings-sidebar')
  await sidebar.getByRole('button',{name:/Xem danh sách 3 thành viên nhóm/}).waitFor()
  assert.equal(await sidebar.locator('.group-settings-tabs').count(),0,'Original group management layout must remain unchanged')
  assert.equal(await sidebar.getByRole('button',{name:'Đổi tên nhóm'}).count(),0,'Rename must be removed from group settings')
  assert.ok(calls.includes('GET /api/conversations/91/members'))
  await sidebar.getByRole('button',{name:/Xem danh sách 3 thành viên nhóm/}).click()
  await sidebar.getByText('Linh Anh').first().waitFor()
  await sidebar.getByRole('button',{name:'Quay lại quản lý nhóm'}).click()
  await sidebar.locator('.group-invite-friend').first().click()
  await Promise.all([
    page.waitForResponse(response=>response.url().endsWith('/api/conversations/91/members')&&response.request().method()==='POST'),
    sidebar.locator('.group-invite-submit').click(),
  ])
  assert.ok(calls.includes('POST /api/conversations/91/members'))
  const navigation=sidebar.getByRole('navigation',{name:'Danh mục quản lý nhóm'})
  for (const label of ['Thành viên','Thông tin cộng đồng','Quyền quản trị','Yêu cầu tham gia','Nội quy nhóm','Thông báo','Tệp đã chia sẻ','Nhật ký hoạt động'])
    assert.ok(await navigation.getByRole('button',{name:label,exact:true}).isVisible(),label+' must be reachable in group management')
  assert.equal(await navigation.getByRole('button',{name:'Vào trò chuyện'}).count(),0,'Remove the redundant back-to-chat menu item')
  assert.ok(calls.includes('GET /api/conversations/91/group-settings'))

  await navigation.getByRole('button',{name:'Quyền quản trị',exact:true}).click()
  await sidebar.locator('.group-governance').getByText('Cho phép admin mời người và tạo link').waitFor()
  assert.equal(await sidebar.locator('.group-governance').getByText('Cho phép admin đổi tên nhóm').count(),0)
  await navigation.getByRole('button',{name:'Yêu cầu tham gia',exact:true}).click()
  await sidebar.locator('.group-governance').getByText('Chưa có yêu cầu đang chờ.').waitFor()
  await navigation.getByRole('button',{name:'Nhật ký hoạt động',exact:true}).click()
  await sidebar.locator('.group-governance').getByText('Chưa có hoạt động quản trị được ghi nhận.').waitFor()

  await navigation.getByRole('button',{name:'Thông tin cộng đồng',exact:true}).click()
  await sidebar.getByRole('textbox',{name:'Mô tả cộng đồng'}).fill('Cộng đồng ChatNet mới')
  await Promise.all([
    page.waitForResponse(response=>response.url().endsWith('/api/conversations/91/community')&&response.request().method()==='PATCH'),
    sidebar.getByRole('button',{name:'Lưu thông tin'}).click(),
  ])
  assert.equal(profile.description,'Cộng đồng ChatNet mới')
  await navigation.getByRole('button',{name:'Nội quy nhóm',exact:true}).click()
  await sidebar.getByRole('textbox',{name:'Nội quy cộng đồng'}).fill('Tôn trọng và chia sẻ tích cực')
  await Promise.all([
    page.waitForResponse(response=>response.url().endsWith('/api/conversations/91/community')&&response.request().method()==='PATCH'),
    sidebar.getByRole('button',{name:'Lưu nội quy'}).click(),
  ])
  assert.equal(profile.rules,'Tôn trọng và chia sẻ tích cực')
  await navigation.getByRole('button',{name:'Thông báo',exact:true}).click()
  await sidebar.getByRole('checkbox',{name:'Thông báo tin nhắn mới'}).uncheck()
  await Promise.all([
    page.waitForResponse(response=>response.url().endsWith('/api/conversations/91/notification-settings')&&response.request().method()==='PUT'),
    sidebar.getByRole('button',{name:'Lưu cài đặt'}).click(),
  ])
  assert.equal(prefs.messageNotifications,false)
  await navigation.getByRole('button',{name:'Tệp đã chia sẻ',exact:true}).click()
  await sidebar.getByRole('button',{name:'Xem kho nội dung chia sẻ'}).waitFor()
  console.log('PASS member directory, permissions, requests, community info, rules, notifications, files and audit in group management menu')

  for (const width of [390,768,1478]) {
    await page.setViewportSize({width,height:850})
    assert.ok(await navigation.isVisible(),'Group management navigation at '+width+'px')
    const layout=await navigation.evaluate(nav=>{
      const buttons=[...nav.querySelectorAll('button')]
      const rects=buttons.map(button=>button.getBoundingClientRect())
      return {columns:getComputedStyle(nav).gridTemplateColumns, rows:rects.map(r=>({top:r.top,bottom:r.bottom,width:r.width})), navWidth:nav.getBoundingClientRect().width}
    })
    assert.equal(layout.rows.length,8,'Only 8 group management actions must remain')
    assert.ok(layout.rows.every((row,index)=>row.width>layout.navWidth-35 && (index===0||row.top>=layout.rows[index-1].bottom-1)),'Group management menu must be a single vertical column at '+width+'px: '+JSON.stringify(layout))
    const measured=await page.evaluate(()=>({viewport:innerWidth,scrollWidth:document.documentElement.scrollWidth}))
    assert.ok(measured.scrollWidth<=measured.viewport+3,'Group management overflow at '+width+'px')
    await page.screenshot({path:resolve(dir,'group-management-'+width+'.png'),fullPage:true})
    console.log('PASS group management responsive '+width+'px')
  }
  await sidebar.getByRole('button',{name:'Đóng thanh quản lý nhóm'}).click()

  await page.getByRole('textbox',{name:'Tin nhắn',exact:true}).fill('Tin nhắn mới từ nhóm')
  await Promise.all([
    page.waitForResponse(response=>response.url().endsWith('/api/conversations/91/messages')&&response.request().method()==='POST'),
    page.getByRole('button',{name:'Gửi tin nhắn',exact:true}).click(),
  ])
  assert.ok(payloads.some(item=>item.text==='Tin nhắn mới từ nhóm'&& !item.channelId))
  console.log('PASS normal group messaging remains in Messages')

  for(const width of [320,375,390,768,1024,1478]){
    await page.setViewportSize({width,height:850})
    const state=await page.evaluate(()=>({viewport:innerWidth,scrollWidth:document.documentElement.scrollWidth}))
    assert.ok(state.scrollWidth<=state.viewport+3,'Chat overflow at '+width+'px '+JSON.stringify(state))
    console.log('PASS chat responsive '+width+'px')
  }
  members[0].role='admin'
  members[1].role='owner'
  await page.reload({waitUntil:'domcontentloaded'})
  await page.locator('.conversation-item').getByText('Team ChatNet').first().click()
  await page.locator('.group-channel-picker .group-channel-selector').click()
  await page.getByRole('menuitemradio',{name:'Backend API'}).waitFor()
  assert.equal(await page.locator('.group-channel-picker').getByRole('button',{name:'Tạo kênh hội thoại'}).count(),0,
    'Admin must not have the owner-only create channel control')
  console.log('PASS only the group owner can see the create-channel action')
  assert.deepEqual(errors,[])
  console.log('PASS all revised Feed communities and Chat group menu checks')
  await context.close()
} finally {await browser?.close();await vite.close()}