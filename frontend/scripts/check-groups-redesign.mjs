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
  const groups=[group(91,'Team ChatNet'), group(92,'Nhóm thiết kế',5),
    {id:93,type:'direct',name:'Linh Anh',otherUsername:'linhanh',otherUserId:2,
      memberCount:2,unreadCount:0,lastMessage:'Chào bạn',lastMessageAt:'2026-11-06T09:15:00Z',
      online:true,createdAt:'2026-11-01T09:30:00Z'}]
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
  const channels=[
    {id:0,conversationId:91,name:'Thảo luận chung',description:'Kênh mặc định',unreadCount:2,lastMessage:'Tin nhắn trong thảo luận chung',lastMessageAt:'2026-11-11T09:08:00Z'},
    {id:202,conversationId:91,name:'Thiết kế giao diện',description:'Trao đổi về UI/UX',unreadCount:3,lastMessage:'Cập nhật bản thiết kế mới',lastMessageAt:'2026-11-11T09:09:00Z'},
  ]
  groups[0].unreadCount=channels.reduce((count,channel)=>count+channel.unreadCount,0)
  let channelUnreadMetricsEnabled = true
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
    if(path==='/api/conversations/91/channels'&&method==='GET')return route.fulfill(json(channelUnreadMetricsEnabled
      ? channels : channels.map(({unreadCount, ...channel})=>channel)))
    if(path==='/api/conversations/91/channels'&&method==='POST'){const body=JSON.parse(req.postData()||'{}');const c={id:201,conversationId:91,...body,unreadCount:0,lastMessage:''};channels.push(c);return route.fulfill(json(c))}
    if(path==='/api/conversations/91/channel-read'&&method==='POST'){
      const body=JSON.parse(req.postData()||'{}')
      const ch=channels.find(value=>value.id===body.channelId)
      if(ch)ch.unreadCount=0
      groups[0].unreadCount=channels.reduce((count,channel)=>count+channel.unreadCount,0)
      return route.fulfill(json({conversationId:91,channelId:body.channelId,lastReadMessageId:999}))
    }
    if(path==='/api/conversations/120/channels'&&method==='GET')return route.fulfill(json([{id:0,conversationId:120,name:'Thảo luận chung',description:'Kênh mặc định'}]))
    if(path==='/api/conversations/92/channels'&&method==='GET')return route.fulfill(json([{id:0,conversationId:92,name:'Thảo luận chung',description:'Kênh mặc định',unreadCount:0,lastMessage:''}]))
    if(path==='/api/conversations/92/channel-read'&&method==='POST')return route.fulfill(json({conversationId:92,channelId:0,lastReadMessageId:0}))
    if(path==='/api/conversations/91/channels/201'&&method==='PATCH'){Object.assign(channels[1],JSON.parse(req.postData()||'{}'));return route.fulfill(json(channels[1]))}
    if(path==='/api/conversations/91/channels/201'&&method==='DELETE'){channels.pop();return route.fulfill(json({ok:true}))}
    if(path==='/api/conversations/91/members'&&method==='GET')return route.fulfill(json(members))
    if(path==='/api/conversations/120/members'&&method==='GET')return route.fulfill(json([{id:1,username:'tester',displayName:'Tài khoản của tôi',role:'owner',online:true}]))
    if(path==='/api/conversations/92/members'&&method==='GET')return route.fulfill(json(members))
    if(path.endsWith('/pins')&&method==='GET')return route.fulfill(json([]))
    if(path.endsWith('/activities')&&method==='GET')return route.fulfill(json([]))
    if(path.endsWith('/group-settings')&&method==='GET')return route.fulfill(json(groupSettings))
    if(path.endsWith('/group-settings')&&method==='PATCH')return route.fulfill(json({...groupSettings,...JSON.parse(req.postData()||'{}')}))
    if(path.endsWith('/join-requests')&&method==='GET')return route.fulfill(json([]))
    if(path.endsWith('/invites')&&method==='GET')return route.fulfill(json([]))
    if(path.endsWith('/admin-audit')&&method==='GET')return route.fulfill(json([]))
    if(path==='/api/conversations/91/members/3'&&method==='PATCH')return route.fulfill(json({}))
    if(path==='/api/conversations/91/members'&&method==='POST')return route.fulfill(json({}))
    if(path.includes('/messages')&&method==='GET')return route.fulfill(json(url.searchParams.get('channelId')==='201'?channelMessages:url.searchParams.get('channelId')==='202'?[{...sampleMsg,id:47,channelId:202,text:'Cập nhật bản thiết kế mới'}]:path.includes('/91/')?[sampleMsg]:[]))
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

  // Switching a direct conversation to a group must reuse the same chat frame,
  // with the channel navigator occupying exactly the previous sidebar slot.
  await page.locator('.social-chat-list-filters').getByRole('button',{name:'Tất cả'}).click()
  for (const width of [768,1024,1478]) {
    await page.setViewportSize({width,height:850})
    await page.locator('.conversation-item').filter({hasText:'Linh Anh'}).click()
    await page.locator('.chat-head').waitFor()
    const before=await page.evaluate(()=>{
      const box=selector=>document.querySelector(selector)?.getBoundingClientRect().toJSON()
      window.__chatnetStableFrame=document.querySelector('.social-chat-layout')
      window.__chatnetStableChat=document.querySelector('.conversation-panel')
      return {frame:box('.social-chat-layout'),
        sidebar:box('.conversation-sidebar'),chat:box('.conversation-panel')}
    })
    await page.locator('.conversation-item').filter({hasText:'Team ChatNet'}).click()
    await page.locator('.group-channel-sidebar').getByRole('searchbox',{name:'Tìm kênh hội thoại'}).waitFor()
    const after=await page.evaluate(()=>{
      const box=selector=>document.querySelector(selector)?.getBoundingClientRect().toJSON()
      return {frame:box('.social-chat-layout'),sidebar:box('.group-channel-sidebar'),
        chat:box('.conversation-panel'),
        sameFrame:window.__chatnetStableFrame===document.querySelector('.social-chat-layout'),
        sameChat:window.__chatnetStableChat===document.querySelector('.conversation-panel')}
    })
    assert.ok(after.sameFrame && after.sameChat,'Direct → group must reuse the same frame and chat panel at '+width+'px')
    for (const [label,a,b] of [['frame',before.frame,after.frame],
      ['sidebar',before.sidebar,after.sidebar],['chat',before.chat,after.chat]]) {
      assert.ok(a && b && ['x','y','width','height'].every(key=>Math.abs(a[key]-b[key])<=2),
        label+' must retain its geometry while changing conversations at '+width+'px: '+
        JSON.stringify({before:a,after:b}))
    }
    assert.equal(await page.locator('.conversation-sidebar').isVisible(),false)
    await page.locator('.group-channel-sidebar').getByRole('button',{name:'Quay lại danh sách hội thoại'}).click()
    assert.ok(await page.locator('.conversation-sidebar').isVisible(),
      'Back to conversations restores the original sidebar in place at '+width+'px')
    console.log('PASS seamless direct/group frame and sidebar geometry at '+width+'px')
  }
  await page.setViewportSize({width:1478,height:850})
  await page.locator('.social-chat-list-filters').getByRole('button',{name:'Nhóm'}).click()

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
  assert.equal(await page.locator('.group-avatar-rail').count(),0,
    'Opening a group must not show the additional group-avatar rail')
  assert.equal(await page.locator('#conversation-details-panel').count(),0,
    'Group information must stay closed until the information button is clicked')
  console.log('PASS group opens with channels and messages, while conversation info stays closed')
  const channelSidebar=page.locator('.group-channel-sidebar')
  await channelSidebar.getByRole('searchbox',{name:'Tìm kênh hội thoại'}).waitFor()
  assert.ok(await channelSidebar.isVisible(),'Group channel navigation must remain visible on desktop')
  const designChannel=channelSidebar.getByRole('button',{name:/Mở kênh Thiết kế giao diện/})
  assert.match((await designChannel.innerText()),/3/,'Unread count of another channel must remain visible')
  await channelSidebar.getByRole('searchbox',{name:'Tìm kênh hội thoại'}).fill('thiết kế')
  assert.equal(await channelSidebar.locator('.group-channel-sidebar-row').count(),1,
    'Sidebar search must filter by channel name')
  await channelSidebar.getByRole('searchbox',{name:'Tìm kênh hội thoại'}).fill('')
  assert.equal(await channelSidebar.locator('.group-channel-sidebar-row').count(),2)
  await Promise.all([
    page.waitForResponse(response=>response.url().endsWith('/api/conversations/91/channel-read')&&
      response.request().method()==='POST'&&response.request().postDataJSON().channelId===202),
    designChannel.click(),
  ])
  await page.locator('.messages').getByText('Cập nhật bản thiết kế mới').waitFor()
  await page.waitForFunction(()=>!document.querySelector('.group-channel-sidebar-row.selected .group-channel-unread'))
  assert.equal(channels.find(channel=>channel.id===202)?.unreadCount,0,
    'Opening channel 202 should mark only channel 202 as read')
  await channelSidebar.getByRole('button',{name:/Mở kênh Thảo luận chung/}).click()
  await page.locator('.messages').getByText('Chào mọi người, đây là nhóm ChatNet.').waitFor()
  const design=channels.find(item=>item.id===202)
  design.unreadCount=1
  groups[0].unreadCount=channels.reduce((count,channel)=>count+channel.unreadCount,0)
  design.lastMessage='Tin mới từ kênh thiết kế'
  design.lastMessageAt=new Date().toISOString()
  await page.evaluate(message=>window.__chatnetTestSSE.emit('update',{
    type:'message',conversationId:91,message,
  }),{...sampleMsg,id:999,channelId:202,senderId:2,text:'Tin mới từ kênh thiết kế',createdAt:design.lastMessageAt})
  await channelSidebar.locator('.group-channel-sidebar-row').filter({hasText:'Thiết kế giao diện'})
    .locator('.group-channel-unread').getByText('1').waitFor()
  assert.ok(await page.locator('.messages').getByText('Chào mọi người, đây là nhóm ChatNet.').isVisible(),
    'Receiving a message in another channel must not change the current chat')
  console.log('PASS inactive-channel realtime unread badge without leaving the active channel')
  console.log('PASS light channel sidebar, channel search, independent unread badges and read acknowledgement')

  for(const width of [320,390]) {
    await page.setViewportSize({width,height:850})
    const toggle=page.getByRole('button',{name:'Mở danh sách kênh hội thoại'})
    assert.ok(await toggle.isVisible(),'Channel drawer toggle should be visible at '+width+'px')
    await toggle.click()
    assert.ok(await channelSidebar.isVisible(),'Mobile/tablet channel drawer opens at '+width+'px')
    await channelSidebar.getByRole('searchbox',{name:'Tìm kênh hội thoại'}).fill('thiết')
    assert.equal(await channelSidebar.locator('.group-channel-sidebar-row').count(),1)
    await channelSidebar.getByRole('button',{name:'Đóng danh sách kênh'}).click()
    await channelSidebar.getByRole('searchbox',{name:'Tìm kênh hội thoại'}).fill('')
    console.log('PASS compact channel drawer and search at '+width+'px')
  }
  for(const width of [768,1024,1478]) {
    await page.setViewportSize({width,height:850})
    await channelSidebar.waitFor({state:'visible'})
    assert.ok(await page.locator('.group-channel-sidebar-row').first().isVisible(),'Desktop persistent channel list at '+width+'px')
    assert.equal(await page.locator('.social-chat-layout.group-channel-workspace > .conversation-sidebar').isVisible(),false,'Group channels must replace the regular conversation sidebar at '+width+'px')
    const cols=await page.evaluate(()=>{
      const nav=document.querySelector('.group-channel-sidebar').getBoundingClientRect()
      const chat=document.querySelector('.group-chat-panel .chat-head').getBoundingClientRect()
      return {navLeft:nav.left,navRight:nav.right,chatLeft:chat.left,chatRight:chat.right}
    })
    assert.ok(cols.navRight<=cols.chatLeft+2,
      'Channels must precede chat at '+width+'px: '+JSON.stringify(cols))
    assert.equal(await page.locator('#conversation-details-panel').count(),0,
      'Group information must stay closed at '+width+'px')
    console.log('PASS channel and chat columns without permanently open info at '+width+'px')
  }
  await page.screenshot({path:resolve(dir,'group-channels-desktop.png'),fullPage:true})
  for (const width of [320, 375, 390, 768, 1024, 1478]) {
    await page.setViewportSize({width, height:850})
    assert.equal(await page.locator('.group-channel-selector').count(),0,
      'Group header must not contain a channel dropdown at '+width+'px')
    assert.equal(await page.locator('.group-channel-picker').count(),0,
      'Obsolete header channel picker must be removed at '+width+'px')
    assert.ok(await page.locator('.group-room-title').getByText('Team ChatNet').isVisible())
    console.log('PASS group header has no channel dropdown at '+width+'px')
  }
  await page.locator('.translate-controls').getByRole('button',{name:'Thông tin hội thoại'}).click()
  const details=page.locator('#conversation-details-panel')
  await details.getByRole('heading',{name:'Thông tin hội thoại'}).waitFor()
  for (const width of [1478, 1024, 390]) {
    await page.setViewportSize({width,height:850})
    assert.ok(await details.isVisible(),'Conversation information sidebar stays accessible at '+width+'px')
    const layout = await page.evaluate(() => {
      const group = document.querySelector('.group-chat-panel')?.getBoundingClientRect()
      const nav = document.querySelector('.group-channel-sidebar')?.getBoundingClientRect()
      const chat = document.querySelector('.group-chat-panel .chat-head')?.getBoundingClientRect()
      const info = document.querySelector('.conversation-info-panel.social-chat-details')?.getBoundingClientRect()
      return { group:group?.toJSON(),nav:nav?.toJSON(),chat:chat?.toJSON(),info:info?.toJSON(),
        width: document.documentElement.scrollWidth,viewport:innerWidth }
    })
    assert.ok(layout.info && layout.info.width>225,'Conversation information panel must have usable width: '+JSON.stringify(layout))
    assert.ok(layout.width<=layout.viewport+3,'Info sidebar cannot cause horizontal scrolling at '+width+'px')
    if (width >= 1420) {
      assert.ok(layout.nav.right<=layout.chat.left+2,'Channels precede the chat: '+JSON.stringify(layout))
      assert.ok(layout.chat.right<=layout.info.left+2,
        'Conversation info must be on the right of the messages: '+JSON.stringify(layout))
      assert.ok(layout.info.right<=layout.viewport+1,'Conversation info stays within viewport')
    } else {
      assert.ok(layout.info.right<=layout.viewport+1,
        'Conversation info uses the existing overlay at '+width+'px: '+JSON.stringify(layout))
    }
    console.log('PASS original right-side conversation info at '+width+'px')
  }
  await page.setViewportSize({width:1478,height:850})
  await page.screenshot({path:resolve(dir,'group-channels-with-conversation-info.png'),fullPage:true})
  await details.getByRole('button',{name:'Đóng thông tin hội thoại'}).click()
  assert.equal(await page.locator('#conversation-details-panel').count(),0,
    'Closing conversation info must restore the wider chat')
  await page.locator('.translate-controls').getByRole('button',{name:'Thông tin hội thoại'}).click()
  await details.getByRole('heading',{name:'Thông tin hội thoại'}).waitFor()
  assert.ok(await details.getByRole('button',{name:'Tùy chọn nhóm'}).isVisible(),'Original group information menu must remain')
  assert.ok(await details.getByRole('button',{name:'Ảnh & video'}).isVisible(),'Shared content menu must remain')
  assert.ok(await details.getByRole('button',{name:'Tìm tin nhắn'}).isVisible(),'Search menu must remain')
  const groupChannelList=details.locator('.conversation-channel-list')
  assert.ok(await groupChannelList.getByRole('button',{name:'Thảo luận chung'}).isVisible(),'Info menu must list channels')
  assert.equal(await details.getByRole('button',{name:'Tạo kênh hội thoại'}).count(),0,'Creation is inside Group options, not on the header')
  const groupOptions=details.getByRole('button',{name:'Tùy chọn nhóm'})
  await groupOptions.click()
  const createTrigger=details.getByRole('button',{name:'Tạo kênh hội thoại'})
  assert.ok(await createTrigger.isVisible(),'Only group owner can create from Conversation Info menu')

  for (const width of [390, 1478]) {
    await page.setViewportSize({width,height:850})
    const styles=await details.evaluate(root=>{
      const controls=[...root.querySelectorAll('.conversation-group-options-list > button')]
      const standard=controls.find(element=>element.textContent?.includes('Bình chọn'))
      const create=controls.find(element=>element.textContent?.includes('Tạo kênh hội thoại'))
      if (!standard || !create) return null
      const inspect=el=>{
        const style=getComputedStyle(el)
        const icon=el.querySelector('svg')
        return {
          height:el.getBoundingClientRect().height,
          padding:style.padding,
          background:style.backgroundColor,
          color:style.color,
          radius:style.borderRadius,
          fontSize:style.fontSize,
          fontWeight:style.fontWeight,
          gap:style.gap,
          iconWidth:icon?.getBoundingClientRect().width,
          iconColor:icon ? getComputedStyle(icon).color : null,
        }
      }
      return {standard:inspect(standard),create:inspect(create)}
    })
    assert.ok(styles,'Both group option buttons must be present')
    assert.deepEqual(styles.create,styles.standard,'Create channel action must match other options at '+width+'px')
    console.log('PASS create channel matches sibling option styles at '+width+'px')
  }
  await page.setViewportSize({width:1478,height:850})
  await createTrigger.click()
  const createForm=details.locator('.conversation-info-create-channel')
  assert.ok(await createForm.getByText('Chỉ trưởng nhóm có quyền tạo kênh.').isVisible())
  assert.ok(await createForm.getByRole('button',{name:'Hủy'}).isVisible())
  assert.ok(await createForm.getByRole('textbox',{name:'Mô tả kênh mới'}).isVisible())
  await page.screenshot({path:resolve(dir,'create-channel-form-info-menu.png'),fullPage:true})
  await createForm.getByRole('textbox',{name:'Tên kênh mới'}).fill('Backend API')
  await createForm.getByRole('textbox',{name:'Mô tả kênh mới'}).fill('Tài liệu backend')
  await Promise.all([
    page.waitForResponse(response=>response.url().endsWith('/api/conversations/91/channels')&&response.request().method()==='POST'),
    createForm.getByRole('button',{name:'Tạo kênh',exact:true}).click(),
  ])
  const backendChannel=channelSidebar.getByRole('button',{name:/Mở kênh Backend API/})
  await backendChannel.waitFor()
  assert.equal(await backendChannel.getAttribute('aria-current'),'page','New channel is automatically selected')
  assert.ok(calls.includes('POST /api/conversations/91/channels'))
  assert.equal(await page.locator('.messages').getByText('Chào mọi người, đây là nhóm ChatNet.').count(),0,'General chat messages cannot leak into a private channel')
  await page.getByRole('textbox',{name:'Tin nhắn',exact:true}).fill('Tin nhắn trong kênh riêng')
  await Promise.all([
    page.waitForResponse(response=>response.url().includes('/api/conversations/91/messages')&&response.request().method()==='POST'),
    page.getByRole('button',{name:'Gửi tin nhắn',exact:true}).click(),
  ])
  assert.equal(payloads.find(item=>item.channelId===201)?.text,'Tin nhắn trong kênh riêng')
  await page.locator('.messages').getByText('Tin nhắn trong kênh riêng').waitFor()
  const ownAvatar=page.locator('.messages .message.channel-message.mine .chat-message-sender-avatar')
  await ownAvatar.waitFor({state:'visible'})
  await groupChannelList.getByRole('button',{name:'Thảo luận chung'}).click()
  await page.locator('.messages').getByText('Chào mọi người, đây là nhóm ChatNet.').waitFor()
  assert.equal(await page.locator('.messages').getByText('Tin nhắn trong kênh riêng').count(),0)
  console.log('PASS owner creates channels inside group information options, no header dropdown')

  await page.locator('.translate-controls').getByRole('button',{name:'Thông tin hội thoại'}).click()
  await details.getByRole('button',{name:'Backend API'}).click()
  await page.locator('.messages').getByText('Tin nhắn trong kênh riêng').waitFor()
  const realtimeMessage={...sampleMsg,id:991,channelId:201,senderId:2,text:'Realtime trong kênh Backend API',createdAt:new Date().toISOString()}
  channelMessages.push(realtimeMessage)
  await page.evaluate(message=>window.__chatnetTestSSE.emit('update',{type:'message',conversationId:91,message:message}),realtimeMessage)
  await page.locator('.messages').getByText('Realtime trong kênh Backend API').waitFor()
  const otherAvatar=page.locator('.messages .message.channel-message:not(.mine) .chat-message-sender-avatar')
  for (const width of [320, 390, 768, 1478]) {
    await page.setViewportSize({width,height:850})
    assert.ok(await ownAvatar.isVisible(),'Own message avatar should be visible in channel at '+width+'px')
    assert.ok(await otherAvatar.isVisible(),'Member avatar should be visible in channel at '+width+'px')
    const measures=await page.evaluate(() => {
      const entries=[...document.querySelectorAll('.message.channel-message .chat-message-sender-avatar')]
      return entries.map(el=>({display:getComputedStyle(el).display,width:el.getBoundingClientRect().width}))
    })
    assert.ok(measures.length>=2 && measures.every(m=>m.display!=='none' && m.width>=25),
      'Avatar size/visibility must match Telegram style at '+width+'px: '+JSON.stringify(measures))
    console.log('PASS channel message avatars (self and others) at '+width+'px')
  }
  await page.setViewportSize({width:1478,height:850})
  console.log('PASS realtime message is rendered with its sender avatar in the active channel')

  console.log('PASS three-dot info menu lists channels and switches the full chat timeline')

  await page.locator('.translate-controls').getByRole('button',{name:'Thông tin hội thoại'}).click()
  await details.getByRole('button',{name:'Thảo luận chung'}).click()
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
  await page.waitForFunction(() => document.querySelector('.group-avatar-rail') ||
    [...document.querySelectorAll('.conversation-item')].some(el => el.textContent?.includes('Team ChatNet')))
  if (await page.locator('.group-avatar-rail').isVisible()) {
    const target=page.locator('.group-avatar-rail').getByRole('button',{name:/Mở nhóm Team ChatNet/})
    if (await target.getAttribute('aria-current')!=='page') await target.click()
  } else {
    await page.locator('.conversation-item').getByText('Team ChatNet').first().click()
  }
  await page.locator('.translate-controls').getByRole('button',{name:'Thông tin hội thoại'}).click()
  await page.locator('#conversation-details-panel').getByRole('button',{name:'Tùy chọn nhóm'}).click()
  assert.equal(await page.locator('#conversation-details-panel').getByRole('button',{name:'Tạo kênh hội thoại'}).count(),0,
    'Admin must not see owner-only create channel in Conversation Info')
  assert.ok(await page.locator('#conversation-details-panel').isVisible(),
    'Conversation information remains available on the right when requested')
  await page.locator('#conversation-details-panel').getByRole('button',{name:'Đóng thông tin hội thoại'}).click()
  assert.equal(await page.locator('#conversation-details-panel').count(),0,
    'Conversation information closes when requested')
  console.log('PASS only the group owner can see the create-channel action')
  await page.setViewportSize({width:1478,height:850})
  await page.getByRole('button',{name:'Quay lại danh sách hội thoại'}).click()
  assert.equal(await page.locator('.social-chat-layout.group-channel-workspace').count(),0,
    'Back button must exit the group channel workspace')
  assert.ok(await page.locator('.social-chat-layout > .conversation-sidebar').isVisible(),
    'Back button must restore the conversation list')
  console.log('PASS back navigation from group channels to regular conversation list')
  const listRow=page.locator('.conversation-item').filter({hasText:'Team ChatNet'})
  await page.waitForFunction(() => {
    const row=[...document.querySelectorAll('.conversation-item')].find(el=>el.textContent.includes('Team ChatNet'))
    return row?.querySelector('.conversation-copy b')?.textContent==='1'
  })
  assert.equal((await listRow.locator('.conversation-copy b').innerText()),'1',
    'Conversation sidebar badge must match the remaining unread count from inactive channels')
  await listRow.click()
  await page.locator('.group-channel-sidebar').getByRole('button',{name:/Mở kênh Thiết kế giao diện/}).click()
  await page.waitForFunction(() => !document.querySelector('.group-channel-sidebar-row.selected .group-channel-unread'))
  await page.getByRole('button',{name:'Quay lại danh sách hội thoại'}).click()
  await page.waitForFunction(() => {
    const row=[...document.querySelectorAll('.conversation-item')].find(el=>el.textContent.includes('Team ChatNet'))
    return row && !row.querySelector('.conversation-copy b')
  })
  assert.equal(groups[0].unreadCount,0,'Reading the remaining channel must clear the group sidebar unread')
  console.log('PASS group sidebar unread badge decreases to zero after reading the remaining channel')
  channelUnreadMetricsEnabled = false
  await listRow.click()
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('chatnet:group-community-updated',{detail:{conversationId:91}})))
  await page.locator('.group-channel-sidebar').getByText('Số tin chưa đọc theo kênh chưa khả dụng. Cần cập nhật backend.').waitFor()
  console.log('PASS old backend without per-channel unread metadata is clearly identified instead of showing false badges')
  assert.deepEqual(errors,[])
  console.log('PASS all revised Feed communities and Chat group menu checks')
  await context.close()
} finally {await browser?.close();await vite.close()}