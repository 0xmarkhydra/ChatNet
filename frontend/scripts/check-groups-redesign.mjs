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
  const group=(id,name,count=3)=>({id,type:'group',name,memberCount:count,avatarMembers:['linhanh','david','tester'],unreadCount:1,lastMessage:'Tin nhắn trước',lastMessageAt:'2026-11-06T09:30:00Z',online:true,createdAt:'2026-11-01T09:30:00Z'})
  const groups=[group(91,'Team ChatNet'), group(92,'Nhóm thiết kế',5),
    {id:93,type:'direct',name:'Linh Anh',otherUsername:'linhanh',otherUserId:2,
      memberCount:2,unreadCount:0,lastMessage:'Chào bạn',lastMessageAt:'2026-11-06T09:15:00Z',
      online:true,createdAt:'2026-11-01T09:30:00Z'}]
  groups[0].categoryId=5
  groups[2].categoryId=5
  const friends=[
    {id:2,username:'linhanh',displayName:'Linh Anh',status:'accepted',online:true,updatedAt:'2026-11-06'},
    {id:3,username:'david',displayName:'David Chen',status:'accepted',online:true,updatedAt:'2026-11-06'},
    {id:4,username:'phuong',displayName:'Phương Linh',status:'accepted',online:true,updatedAt:'2026-11-06'},
  ]
  const members=[{id:1,username:'tester',displayName:'Tài khoản của tôi',role:'owner',online:true},
    {id:2,username:'linhanh',displayName:'Linh Anh',role:'admin',online:true},
    {id:3,username:'david',displayName:'David Chen',role:'member',online:false}]
  const personalProfile={username:'tester',displayName:'Tài khoản của tôi',avatarSet:false,coverSet:false,updatedAt:'2026-11-06'}
  const personalPhotoUpdates=[]
  const groupSettings={requireApproval:true,adminCanInvite:true,adminCanApprove:true,adminCanEditInfo:true}
  const profile={id:91,name:'Team ChatNet',description:'Cộng đồng kỹ thuật',topic:'Công nghệ',rules:'Tôn trọng mọi thành viên',visibility:'private',memberCount:3}
  const groupPhotoUpdates=[]
  let groupPhotoCapabilityEnabled=true
  const mockAvatar='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL/nwAAAABJRU5ErkJggg=='
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
  let legacySharedResponse = false
  const channelMessages=[]
  const json=data=>({status:200,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*'},contentType:'application/json',body:JSON.stringify(data)})
  await context.route('http://localhost:8080/**',async route=>{
    const req=route.request();const url=new URL(req.url());const path=url.pathname;const method=req.method()
    calls.push(method+' '+path)
    if(method==='OPTIONS')return route.fulfill({status:204,headers:{'access-control-allow-origin':'*','access-control-allow-methods':'*','access-control-allow-headers':'*'}})
    if(path==='/api/events')return route.fulfill({status:200,headers:{'access-control-allow-origin':'*'},contentType:'text/event-stream',body:': ready\n\n'})
    if(path==='/api/media/presign'&&method==='POST'){
      const body=JSON.parse(req.postData()||'{}')
      assert.equal(body.scope,'profile')
      return route.fulfill(json({uploadUrl:'http://localhost:8080/_mock_upload_group_image',
        storageRef:'s3://mock/chatnet/profile/1/avatar.png',key:'avatar.png',
        kind:'image',expiresAt:'2099-01-01T00:00:00Z',downloadUrl:mockAvatar}))
    }
    if(path==='/_mock_upload_group_image'&&method==='PUT')return route.fulfill({
      status:200,headers:{'access-control-allow-origin':'*','access-control-allow-methods':'PUT','access-control-allow-headers':'*'},body:''
    })
    if(path==='/api/profile/media'&&method==='PUT'){
      const data=JSON.parse(req.postData()||'{}');personalPhotoUpdates.push(data)
      personalProfile[data.kind==='avatar'?'avatarSet':'coverSet']=!!data.attachment
      personalProfile.updatedAt=new Date(Date.now()+personalPhotoUpdates.length*1000).toISOString()
      return route.fulfill(json(personalProfile))
    }
    if(path==='/api/conversations/91/avatar'&&method==='GET'){
      return route.fulfill(groupPhotoCapabilityEnabled?json({canUpdateAvatar:true}):
        {status:404,contentType:'text/plain',body:'Not Found'})
    }
    if(path==='/api/conversations/91/avatar'&&method==='PUT'){
      const body=JSON.parse(req.postData()||'{}');groupPhotoUpdates.push(body)
      const photo=body.attachment ? mockAvatar : ''
      groups[0].avatarUrl=photo||undefined
      return route.fulfill(json({conversationId:91,avatarUrl:photo,avatarSet:!!photo}))
    }
    if(path==='/api/conversation-categories'&&method==='GET')return route.fulfill(json([{id:5,name:'Công việc',color:'orange'}]))
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
    if(path==='/api/conversations/91/shared'&&method==='GET') {
      if(legacySharedResponse)return route.fulfill(json({items:[]}))
      const kind=url.searchParams.get('kind')
      if(kind==='files')return route.fulfill(json({items:[{
        id:810,sender:'linhanh',createdAt:'2026-11-11T09:00:00Z',text:'',
        attachments:[{id:610,kind:'file',name:'Tài liệu nhóm.pdf',url:'https://example.com/file.pdf',
          storageRef:'mock-file',sizeBytes:12000,contentType:'application/pdf'}],
      }]}))
      if(kind==='links')return route.fulfill(json({items:[{
        id:811,sender:'linhanh',createdAt:'2026-11-11T09:00:00Z',text:'https://example.com/group',
        attachments:[],
      }]}))
      const media=Array.from({length:4},(_,index)=>({
        id:800+index,text:'',sender:'linhanh',createdAt:'2026-11-11T09:00:00Z',
        attachments:[{id:500+index,kind:'image',name:'Ảnh '+(index+1)+'.png',url:mockAvatar,
          storageRef:'mock-'+index,sizeBytes:68,contentType:'image/png'}],
      }))
      return route.fulfill(json({items:media}))
    }
    if(path.startsWith('/api/conversations/91/channels/')&&path.endsWith('/notifications')&&method==='GET'){
      const id=Number(path.split('/')[5]);return route.fulfill(json({muted:channels.find(ch=>ch.id===id)?.muted===true}))
    }
    if(path.startsWith('/api/conversations/91/channels/')&&path.endsWith('/notifications')&&method==='PUT'){
      const id=Number(path.split('/')[5]);const body=JSON.parse(req.postData()||'{}')
      const selected=channels.find(ch=>ch.id===id);if(selected)selected.muted=body.muted
      return route.fulfill(json({muted:body.muted}))
    }
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
    if(path==='/api/conversations/91/messages'&&method==='GET'&&url.searchParams.get('limit')==='200') {
      const legacyItems=[
        {id:815,sender:'linhanh',text:'https://example.com/group',createdAt:'2026-11-11T09:00:00Z',attachments:[]},
        {id:814,sender:'linhanh',text:'',createdAt:'2026-11-11T09:00:00Z',attachments:[
          {id:612,kind:'video',name:'Video trong nhóm.mp4',url:mockAvatar,storageRef:'mock-video',sizeBytes:99,contentType:'video/mp4'}]},
        {id:813,sender:'linhanh',text:'',createdAt:'2026-11-11T09:00:00Z',attachments:[
          {id:611,kind:'file',name:'Tài liệu nhóm.pdf',url:'https://example.com/file.pdf',storageRef:'mock-file',sizeBytes:12000,contentType:'application/pdf'}]},
        {id:812,sender:'linhanh',text:'',createdAt:'2026-11-11T09:00:00Z',attachments:[
          {id:610,kind:'image',name:'Ảnh cũ.png',url:mockAvatar,storageRef:'mock-image',sizeBytes:68,contentType:'image/png'}]},
      ]
      return route.fulfill(json(url.searchParams.has('before')?[]:legacyItems))
    }
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
      path==='/api/profile'?personalProfile:{}
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
  if (process.env.CHATNET_DESKTOP_RAIL_SMOKE === '1') {
    const rail = page.locator('.desktop-conversation-rail')
    await rail.waitFor({state:'visible'})
    const direct = rail.getByRole('button',{name:/Mở tin nhắn Linh Anh/})
    const group = rail.getByRole('button',{name:/Mở nhóm Team ChatNet/})
    await direct.waitFor()
    await group.waitFor()
    // Expanding the ONE rail changes width, not avatar coordinates or order.
    const railGeometry = () => page.evaluate(() => {
      const dock = document.querySelector('.desktop-conversation-rail')
      const rect = element => {
        const r = element.getBoundingClientRect()
        return {x:r.x,y:r.y,width:r.width,height:r.height}
      }
      return {dock:rect(dock),
        avatars:[...dock.querySelectorAll('.desktop-conversation-rail-avatar')].map(rect),
        scrollTop:dock.querySelector('.desktop-conversation-rail-scroller')?.scrollTop}
    })
    const assertStableRail = (before,after,label) => {
      const stable=(a,b)=>['x','y','width','height'].every(k=>Math.abs(a[k]-b[k])<1)
      assert.ok(before.avatars.length===after.avatars.length &&
        before.avatars.every((avatar,i)=>stable(avatar,after.avatars[i])) &&
        before.scrollTop===after.scrollTop,
        'Avatar coordinates must not change on '+label+': '+JSON.stringify({before,after}))
    }
    await page.waitForTimeout(350)
    assert.equal(await rail.getAttribute('data-expanded'),'true','Desktop Messages opens the details rail')
    assert.equal(await page.locator('.conversation-sidebar').isVisible(),false,'No separate conversation-list screen')
    const baseRailGeometry=await railGeometry()
    assert.equal(await rail.getByRole('button',{name:/Mở nhóm Team ChatNet/}).locator('.conversation-avatar-member').count(),3,
      'Missing group photo uses three participant avatars from the avatar branch')
    assert.equal(await rail.locator('.desktop-conversation-rail-home').count(),0,
      'Manual expand/collapse button is removed')
    const topCategory=rail.locator('.desktop-conversation-rail-top-category .category-filter-trigger')
    const topCreate=rail.locator('.desktop-conversation-rail-top-actions .desktop-conversation-rail-plus')
    const topToggle=rail.getByRole('button',{name:'Thu gọn cột avatar'})
    for(const button of [topToggle,topCategory,topCreate])await button.waitFor({state:'visible'})
    assert.equal(await rail.locator('.category-manage-trigger').count(),0,
      'Tag manager is available inside the tag filter menu, not on the rail')
    await topCategory.click()
    await page.locator('.category-popover:popover-open').getByRole('button',{name:'Quản lý thẻ phân loại'}).waitFor()
    await page.keyboard.press('Escape')
    const navLayer=await page.evaluate(() => {
      const sidebar=document.querySelector('.app-sidebar')
      const dock=document.querySelector('.desktop-conversation-rail')
      return {
        navZ:Number(getComputedStyle(sidebar).zIndex),
        railZ:Number(getComputedStyle(dock).zIndex),
        navLeft:sidebar.getBoundingClientRect().left,
        railLeft:dock.getBoundingClientRect().left,
      }
    })
    assert.ok(navLayer.navZ>navLayer.railZ && navLayer.navLeft===0 && navLayer.railLeft>=76,
      'Global navigation must stay above the avatar dock: '+JSON.stringify(navLayer))
    const expandedCategory=await topCategory.boundingBox()
    const expandedCreate=await topCreate.boundingBox()
    assert.ok(Math.abs(expandedCategory.y-expandedCreate.y)<2 &&
      expandedCategory.x<expandedCreate.x,
      'Expanded filter and create align in the first row')
    const searchField=rail.locator('.desktop-conversation-rail-search-field')
    const searchRect=await searchField.boundingBox()
    const firstAvatarRect=await rail.locator('.desktop-conversation-rail-avatar').first().boundingBox()
    assert.ok(Math.abs(expandedCategory.y-searchRect.y)<3 &&
      searchRect.x+searchRect.width<=expandedCategory.x+1 &&
      expandedCategory.x+expandedCategory.width<=expandedCreate.x+1 &&
      firstAvatarRect.y-(searchRect.y+searchRect.height)<30,
      'Search, filter and create must share one compact row in that order: '+
      JSON.stringify({expandedCategory,searchRect,expandedCreate,firstAvatarRect}))
    const filters = page.locator('.conversation-rail-floating-filters .conversation-rail-filter-options')
    assert.equal(await filters.count(),0,'Filters are hidden until the search field receives focus')
    await rail.getByRole('searchbox',{name:'Tìm trong danh sách hội thoại'}).click()
    await filters.getByRole('button',{name:'Nhóm'}).click()
    assert.equal(await filters.getByRole('button',{name:'Nhóm'}).getAttribute('aria-pressed'),'true',
      'Group filter from the original conversation list remains accessible after search focus')
    await filters.getByRole('button',{name:'Tất cả'}).click()
    assert.equal(await filters.getByRole('button',{name:'Tất cả'}).getAttribute('aria-pressed'),'true')
    await rail.getByRole('button',{name:'Mở tin nhắn Linh Anh'}).click()
    assert.equal(await filters.count(),0,'Filters hide when clicking outside the search field')
    await direct.click({button:'right'})
    await page.getByRole('dialog',{name:/Tùy chọn cuộc trò chuyện Linh Anh/}).waitFor()
    await page.getByRole('button',{name:'Ghim cuộc trò chuyện'}).waitFor()
    await page.keyboard.press('Escape')
    await direct.click()
    await page.locator('.chat-head').getByText('Linh Anh').waitFor()
    await page.waitForTimeout(340)
    assert.equal(await rail.getAttribute('data-expanded'),'true','Personal chat expands the conversation info like Telegram')
    assertStableRail(baseRailGeometry,await railGeometry(),'direct chat opened')
    assert.ok(await rail.isVisible(),'Direct chat keeps the conversation rail')
    const chatFrame = () => page.evaluate(() => {
      const panel=document.querySelector('.conversation-panel')
      const bounds=node => {
        if (!node) return null
        const r=node.getBoundingClientRect()
        return {x:r.x,y:r.y,width:r.width,height:r.height}
      }
      return {panel:bounds(panel),header:bounds(panel?.querySelector('.chat-head')),
        messages:bounds(panel?.querySelector('.messages')),
        composer:bounds(panel?.querySelector('.media-composer'))}
    })
    const directFrame=await chatFrame()
    const onlineBadge=await rail.getByRole('button',{name:/Mở tin nhắn Linh Anh/})
      .locator('.desktop-conversation-rail-avatar .presence-dot').evaluate(node=>{
        const avatar=node.parentElement
        const r=node.getBoundingClientRect()
        const a=avatar.getBoundingClientRect()
        return {width:r.width,height:r.height,visible:getComputedStyle(node).display!=='none',
          overflow:getComputedStyle(avatar).overflow,
          extendsPastPortrait:r.right>a.right-1}
      })
    assert.ok(onlineBadge.visible && onlineBadge.width>=12 && onlineBadge.height>=12 &&
      onlineBadge.overflow==='visible' && onlineBadge.extendsPastPortrait,
      'Online presence must be a clearly visible green dot outside avatar crop: '+JSON.stringify(onlineBadge))
    const directEntry=rail.getByRole('button',{name:/Mở tin nhắn Linh Anh/})
    const directStatus=directEntry.locator('.conversation-rail-notification-state')
    assert.equal(await directStatus.count(),0,
      'Enabled notifications must show no bell icon')
    const categoryLabel=directEntry.locator(
      '.conversation-rail-title-group > .conversation-rail-status > .conversation-category-badge.category-icon-only.category-plain')
    await categoryLabel.waitFor({state:'visible'})
    const labelLook=await categoryLabel.evaluate(node=>{
      const style=getComputedStyle(node)
      const tag=node.querySelector('svg').getBoundingClientRect()
      const name=node.closest('.conversation-rail-title-group').querySelector('strong').getBoundingClientRect()
      const rect=node.getBoundingClientRect()
      return {bg:style.backgroundColor,color:style.color,content:node.textContent.trim(),
        title:node.title,x:rect.x,nameRight:name.right,tagWidth:tag.width,fill:getComputedStyle(node.querySelector('svg')).fill}
    })
    assert.ok((labelLook.bg==='rgba(0, 0, 0, 0)' || labelLook.bg==='transparent') &&
      labelLook.content==='' && labelLook.title==='Công việc' &&
      labelLook.x>=labelLook.nameRight-1 && labelLook.x-labelLook.nameRight<15 &&
      labelLook.tagWidth>=10 && labelLook.color==='rgb(154, 52, 18)',
      'Only colored tag icon after conversation name, no label or background: '+JSON.stringify(labelLook))
    assert.equal(await rail.locator('.desktop-conversation-rail-mute').count(),0,
      'Notification toggle is no longer directly on avatar list')
    await page.locator('.chat-head').getByRole('button',{name:'Thông tin hội thoại'}).click()
    const info=page.locator('#conversation-details-panel')
    await info.getByRole('button',{name:'Tắt thông báo hội thoại'}).click()
    await info.getByRole('button',{name:'Bật thông báo hội thoại'}).waitFor()
    const mutedStatus=directEntry.locator('.conversation-rail-title-group > .conversation-rail-status > .conversation-rail-notification-state.is-muted')
    await mutedStatus.waitFor()
    const mutedPosition=await mutedStatus.boundingBox()
    const categoryPosition=await categoryLabel.boundingBox()
    assert.ok(mutedPosition.x>=categoryPosition.x+categoryPosition.width-1 &&
      mutedPosition.x-categoryPosition.x-categoryPosition.width<15,
      'Muted bell follows colored tag on the name line')
    await info.getByRole('button',{name:'Bật thông báo hội thoại'}).click()
    await info.getByRole('button',{name:'Tắt thông báo hội thoại'}).waitFor()
    assert.equal(await directStatus.count(),0,
      'Re-enabling notifications removes the bell entirely')
    await info.getByRole('button',{name:'Đóng thông tin hội thoại'}).click()
    assert.equal(await page.locator('.group-channel-sidebar:visible').count(),0)
    await group.click()
    const channelPanel = page.locator('.desktop-channel-panel-open .group-channel-sidebar')
    await channelPanel.waitFor({state:'visible'})
    await page.waitForTimeout(350)
    assert.equal(await rail.getAttribute('data-expanded'),'false','Selecting a group collapses the rail')
    assert.equal(await channelPanel.locator('.group-channel-sidebar-heading').count(),0,
      'The group-name header has been removed entirely')
    assert.equal(await channelPanel.locator('.group-channel-sidebar-caption').count(),0,
      'The redundant channel-list caption is removed')
    await channelPanel.locator('.group-channel-sidebar-topbar .group-channel-sidebar-search').waitFor()
    const groupFrame=await chatFrame()
    const equalFrame=(a,b)=>Math.abs(a-b)<1.5
    assert.ok(['panel','header','messages','composer'].every(section=>
      directFrame[section] && groupFrame[section] &&
      equalFrame(directFrame[section].width,groupFrame[section].width)) &&
      equalFrame(directFrame.panel.height,groupFrame.panel.height) &&
      equalFrame(directFrame.header.height,groupFrame.header.height),
      'Desktop group and direct chat share equal frames: '+
        JSON.stringify({direct:directFrame,group:groupFrame}))
    assert.equal(await rail.locator('.desktop-conversation-rail-selected-check').count(),1,
      'Selected group avatar has a visible check marker')
    const collapsedRailGeometry = await railGeometry()
    assert.ok(collapsedRailGeometry.dock.width < baseRailGeometry.dock.width)
    assert.equal(await topCategory.count(),0,'Compact avatar dock has no category filter')
    assert.equal(await topCreate.count(),0,'Compact avatar dock hides the create button')
    const compactToggle=rail.getByRole('button',{name:'Mở rộng cột avatar'})
    await compactToggle.waitFor({state:'visible'})
    assert.equal(await rail.locator('.category-filter-trigger').count(),0,
      'Tag filter is not rendered when avatar dock is compact')
    assert.equal(await rail.getByRole('searchbox',{name:'Tìm trong danh sách hội thoại'}).count(),0,
      'Compact dock has no inline search input')
    assertStableRail(baseRailGeometry,collapsedRailGeometry,'group channel drawer opened')
    assert.equal(await compactToggle.getAttribute('aria-expanded'),'false',
      'Right-pointing chevron indicates compact avatar rail')
    assert.equal(await rail.locator('.conversation-rail-compact-status').count()>0,true,
      'Compact avatar rail keeps classification and mute badges')
    await compactToggle.click()
    await rail.getByRole('searchbox',{name:'Tìm trong danh sách hội thoại'}).waitFor({state:'visible'})
    assert.equal(await rail.getAttribute('data-expanded'),'true',
      'Compact chevron expands the same conversation avatar rail')
    assert.equal(await rail.getByRole('button',{name:'Thu gọn cột avatar'}).getAttribute('aria-expanded'),'true',
      'Chevron reverses direction when the rail opens')
    await rail.getByRole('searchbox',{name:'Tìm trong danh sách hội thoại'}).click()
    await filters.waitFor({state:'visible'})
    await group.click()
    await channelPanel.waitFor({state:'visible'})
    await page.waitForTimeout(360)
    assert.equal(await rail.getAttribute('data-expanded'),'false','Reopening group returns to compact dock')
    assert.equal(await channelPanel.getByRole('button',{name:'Đóng danh sách kênh'}).count(),0,
      'Group header no longer has a close X')
    await group.click()
    await page.waitForTimeout(400)
    assert.equal(await rail.getAttribute('data-expanded'),'true',
      'Tapping the active group avatar returns to expanded conversation list')
    assert.equal(await page.locator('.group-channel-sidebar').count(),0,
      'Active group avatar exits channel picker')
    assertStableRail(baseRailGeometry,await railGeometry(),'active group avatar as back action')
    await group.click()
    await channelPanel.waitFor({state:'visible'})
    await page.waitForTimeout(400)
    assert.equal(await rail.getAttribute('data-expanded'),'false',
      'Reopening group from expanded avatar list returns to channel picker')
    assert.equal(await channelPanel.locator('.group-channel-sidebar-more').count(),0,
      'Group picker has no options button beside channel search')
    assert.equal(await channelPanel.locator('.group-channel-sidebar-row [aria-haspopup]').count(),0,
      'Channel rows have no inline options button')
    await channelPanel.getByRole('button',{name:/Mở kênh Thiết kế giao diện/}).click({button:'right'})
    assert.equal(await page.locator('.group-channel-context-menu').count(),0,
      'Right click on a channel must not open a channel management menu')
    const more=page.locator('.chat-head').getByRole('button',{name:'Thông tin hội thoại'})
    await more.click()
    const channelInfo=page.locator('#conversation-details-panel')
    await channelInfo.locator('.conversation-info-group-menu').waitFor({state:'visible'})
    await channelInfo.getByRole('button',{name:'Thành viên'}).waitFor()
    await channelInfo.getByRole('button',{name:'Tắt thông báo nhóm'}).waitFor()
    await channelInfo.getByRole('button',{name:'Tắt thông báo nhóm'}).click()
    await channelInfo.getByRole('button',{name:'Bật thông báo nhóm'}).waitFor()
    await channelInfo.getByRole('button',{name:'Bật thông báo nhóm'}).click()
    await channelInfo.getByRole('button',{name:'Tắt thông báo nhóm'}).waitFor()
    await channelInfo.getByRole('button',{name:'Đóng thông tin hội thoại'}).click()
    await channelPanel.getByRole('button',{name:/Mở kênh Thiết kế giao diện/}).click()
    await page.locator('.chat-head').getByText('Thiết kế giao diện').waitFor()
    await more.click()
    await channelInfo.getByRole('button',{name:'Đổi tên kênh'}).waitFor()
    await channelInfo.getByRole('button',{name:'Sửa chủ đề kênh'}).waitFor()
    await channelInfo.getByRole('button',{name:'Xóa kênh'}).waitFor()
    await channelInfo.getByRole('button',{name:'Tắt thông báo kênh'}).waitFor()
    await channelInfo.getByRole('button',{name:'Tắt thông báo kênh'}).click()
    await channelInfo.getByRole('button',{name:'Bật thông báo kênh'}).waitFor()
    await channelInfo.getByRole('button',{name:'Đóng thông tin hội thoại'}).click()
    assert.ok(await page.locator('.chat-head').isVisible(), 'Chat stays visible while group menu opens')
    const positions = await page.evaluate(() => {
      const selectors = ['.desktop-conversation-rail', '.group-channel-sidebar', '.conversation-panel']
      return selectors.map(s => {
        const r = document.querySelector(s).getBoundingClientRect()
        return {left:r.left, right:r.right}
      })
    })
    assert.ok(Math.abs(positions[0].right-positions[1].left)<2 &&
      positions[1].right < positions[2].left,
      'Avatar rail and channel picker join seamlessly while chat stays separate: '+JSON.stringify(positions))
    const joinedFrame=await page.evaluate(()=>{
      const rail=document.querySelector('.desktop-conversation-rail')
      const panel=document.querySelector('.group-channel-sidebar')
      const divider=rail.querySelector('.desktop-conversation-rail-divider').getBoundingClientRect()
      const toolbar=panel.querySelector('.group-channel-sidebar-topbar').getBoundingClientRect()
      const a=rail.getBoundingClientRect(), b=panel.getBoundingClientRect()
      const ra=getComputedStyle(rail), pb=getComputedStyle(panel)
      return {railTop:a.top,pickerTop:b.top,railRight:a.right,pickerLeft:b.left,
        railTopRightRadius:ra.borderTopRightRadius,pickerTopLeftRadius:pb.borderTopLeftRadius,
        railTopBorder:ra.borderTopColor,pickerTopBorder:pb.borderTopColor,
        separator:pb.borderLeftWidth, dividerY:divider.top, toolbarBorderY:toolbar.bottom-1}
    })
    assert.ok(Math.abs(joinedFrame.railTop-joinedFrame.pickerTop)<1 &&
      Math.abs(joinedFrame.railRight-joinedFrame.pickerLeft)<1 &&
      joinedFrame.railTopRightRadius==='0px' && joinedFrame.pickerTopLeftRadius==='0px' &&
      joinedFrame.railTopBorder===joinedFrame.pickerTopBorder &&
      joinedFrame.separator==='1px' &&
      Math.abs(joinedFrame.dividerY-joinedFrame.toolbarBorderY)<1.5,
      'Top and toolbar separator lines match across square joint: '+JSON.stringify(joinedFrame))
    await channelPanel.getByRole('button',{name:/Mở kênh Thiết kế giao diện/}).click()
    await page.locator('.chat-head').getByText('Thiết kế giao diện').waitFor()
    assertStableRail(baseRailGeometry, await railGeometry(), 'channel switched')
    assert.ok(await channelPanel.isVisible(), 'Desktop channel drawer stays open after channel selection')
    await group.click()
    await page.waitForTimeout(370)
    assert.equal(await rail.getAttribute('data-expanded'),'true',
      'Tapping the active group avatar expands the conversation rail on desktop')
    assert.equal(await page.locator('.group-channel-sidebar').count(),0,
      'Group avatar toggle exits the channel picker')
    assert.ok((await rail.locator('.desktop-conversation-rail-meta:visible').count())>0,
      'Group avatar toggle reveals conversation names and previews')
    assertStableRail(baseRailGeometry,await railGeometry(),'back from group to expanded avatars')
    await direct.click()
    await page.locator('.chat-head').getByText('Linh Anh').waitFor()
    await page.waitForTimeout(350)
    assert.equal(await rail.getAttribute('data-expanded'),'true','Returning from group to personal chat expands its info column')
    assertStableRail(baseRailGeometry,await railGeometry(),'reselecting personal chat')
    await direct.click()
    await page.waitForTimeout(350)
    assert.equal(await rail.getAttribute('data-expanded'),'true','Reopening the same person keeps the info column expanded')
    assertStableRail(baseRailGeometry,await railGeometry(),'same direct chat selected')
    assert.equal(await page.locator('.conversation-sidebar').isVisible(),false,'Legacy conversation screen remains hidden')
    assert.equal(await rail.locator('.desktop-conversation-rail-home').count(),0,
      'Manual expand/collapse control must not return')
    for (const width of [768,1024,1478]) {
      await page.setViewportSize({width,height:920})
      await page.waitForTimeout(100)
      const before = await railGeometry()
      await group.click()
      await page.waitForTimeout(370)
      const groupAtWidth=await chatFrame()
      assert.equal(await rail.getAttribute('data-expanded'),'false','Group selects compact mode')
      assert.equal(await rail.locator('.desktop-conversation-rail-search-field').count(),0,
        'Compact mode does not render search input or icon')
      assertStableRail(before,await railGeometry(),'desktop '+width+'px collapse')
      await direct.click()
      await page.waitForTimeout(370)
      const directAtWidth=await chatFrame()
      assert.ok(['panel','header','messages','composer'].every(part=>
        groupAtWidth[part] && directAtWidth[part] &&
        Math.abs(groupAtWidth[part].width-directAtWidth[part].width)<1.5) &&
        Math.abs(groupAtWidth.panel.height-directAtWidth.panel.height)<1.5 &&
        Math.abs(groupAtWidth.header.height-directAtWidth.header.height)<1.5,
        width+'px group/direct chat surfaces must have matching dimensions: '+
          JSON.stringify({group:groupAtWidth,direct:directAtWidth}))
      assert.equal(await rail.getAttribute('data-expanded'),'true','Direct chat expands rail')
      assertStableRail(before,await railGeometry(),'desktop '+width+'px expansion')
      const regions = await page.evaluate(() => {
        const bounds = selector => {
          const el=document.querySelector(selector)
          return el?.getBoundingClientRect().toJSON() || null
        }
        return {
          nav:bounds('.app-sidebar'),
          rail:bounds('.desktop-conversation-rail'),
          chat:bounds('.conversation-panel'),
        }
      })
      assert.ok(regions.rail && regions.chat && regions.rail.right <= regions.chat.left + 1 &&
        regions.chat.width > 190 && (!regions.nav || regions.nav.right <= regions.rail.left + 1),
        'Expanded rail must not cover personal messages or the main navigation: '+JSON.stringify(regions))
    }
    console.log('PASS desktop 768/1024/1478px: one expanding avatar rail and stable positions')
    await browser.close()
    await vite.close()
    process.exit(0)
  }
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

  assert.ok(await designChannel.locator('.group-channel-sidebar-topic-row').getByText('Trao đổi về UI/UX').isVisible(),
    'Channel topic must have its own line')
  assert.ok(await designChannel.locator('.group-channel-sidebar-meta-row').getByText('Cập nhật bản thiết kế mới').isVisible(),
    'Message preview must appear on a separate line below the topic')
  assert.equal(await designChannel.locator('img').count(),0,'Channel preview is generated from topic, not uploaded photos')
  assert.ok((await designChannel.locator('.group-channel-sidebar-avatar').innerText()).trim().length>0,
    'Channel initials preview must be generated from its topic')
  for(const width of [390, 768, 1478]) {
    await page.setViewportSize({width,height:850})
    if(width<760) {
      await page.getByRole('button',{name:'Mở danh sách kênh hội thoại'}).click()
    }
    const order = await designChannel.evaluate(row=>{
      const elements=['.group-channel-sidebar-name-row','.group-channel-sidebar-topic-row','.group-channel-sidebar-meta-row']
        .map(selector=>row.querySelector(selector))
      return elements.map(element=>element ? {top:element.getBoundingClientRect().top,
        bottom:element.getBoundingClientRect().bottom} : null)
    })
    assert.ok(order.every(Boolean) && order[0].bottom<=order[1].top+2 &&
      order[1].bottom<=order[2].top+2,
      'Channel must show name, topic, then latest message at '+width+'px: '+JSON.stringify(order))
    if(width<760) await channelSidebar.getByRole('button',{name:'Đóng danh sách kênh'}).click()
  }
  await page.setViewportSize({width:1478,height:850})
  console.log('PASS channel topic and message previews occupy separate lines at all widths')

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
  assert.equal(await designChannel.locator('.group-channel-sidebar-topic-row').innerText(),'Trao đổi về UI/UX',
    'Incoming messages must never replace channel topics')
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

  assert.equal(await details.getByRole('button',{name:/Đổi ảnh kênh/}).count(),0,
    'No channel photo editing controls should remain')
  assert.ok(await details.getByRole('button',{name:'Đổi ảnh nhóm'}).isVisible(),
    'Group owners can change the group avatar')
  await details.getByRole('button',{name:'Đổi ảnh nhóm'}).click()
  const photoModal=page.locator('.group-photo-modal')
  await photoModal.getByRole('heading',{name:'Đổi ảnh nhóm'}).count().then(count=>{
    assert.equal(count,0,'Group editor uses a compact title without changing the page')
  })
  assert.ok(await photoModal.getByText('Đổi ảnh nhóm').isVisible())
  const groupAvatarIcon=details.getByRole('button',{name:'Đổi ảnh nhóm'})
  assert.equal((await groupAvatarIcon.innerText()).trim(),'','Group photo action must be icon only')
  assert.equal(await groupAvatarIcon.locator('svg').count(),1,'Camera icon must be present')
  await photoModal.getByLabel('Tệp ảnh nhóm').setInputFiles({
    name:'large-photo.png',mimeType:'image/png',buffer:Buffer.alloc(13*1024*1024,1)
  })
  await photoModal.getByRole('alert').getByText(/vượt quá giới hạn 12 MB/).waitFor()
  assert.ok(await photoModal.getByRole('button',{name:'Lưu ảnh'}).isDisabled(),
    'Oversized images must never be uploaded')
  assert.equal(groupPhotoUpdates.length,0,'Oversized image must not reach the backend')
  await photoModal.getByLabel('Tệp ảnh nhóm').setInputFiles({
    name:'group-avatar.png',mimeType:'image/png',
    buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL/nwAAAABJRU5ErkJggg==','base64')
  })
  groupPhotoCapabilityEnabled=false
  const uploadsBefore=calls.filter(call=>call==='POST /api/media/presign').length
  await photoModal.getByRole('button',{name:'Lưu ảnh'}).click()
  await page.getByText(/Backend hiện tại chưa hỗ trợ lưu ảnh nhóm/).waitFor()
  assert.equal(groupPhotoUpdates.length,0,'The unsupported backend must not receive a photo update')
  assert.equal(calls.filter(call=>call==='POST /api/media/presign').length,uploadsBefore,
    'Do not upload an orphan image to S3 when the backend cannot save it')
  assert.ok(await photoModal.isVisible(),'Keep the selected photo when the backend is too old')
  groupPhotoCapabilityEnabled=true
  await Promise.all([
    page.waitForResponse(response=>response.url().endsWith('/api/conversations/91/avatar')&&response.request().method()==='PUT'),
    photoModal.getByRole('button',{name:'Lưu ảnh'}).click()
  ])
  assert.equal(groupPhotoUpdates.length,1,'Group avatar update should be persisted')
  assert.ok(groupPhotoUpdates[0].attachment?.storageRef,'Uploaded image reference should be sent to backend')
  assert.equal(await photoModal.count(),0,'Editor closes only after successful save')
  await channelSidebar.locator('.group-channel-sidebar-icon img').waitFor()
  assert.equal(await details.locator('.conversation-info-panel-avatar img').count(),1,'The group info avatar refreshes')
  await details.getByRole('button',{name:'Đổi ảnh nhóm'}).click()
  await photoModal.getByRole('button',{name:'Gỡ ảnh'}).click()
  await Promise.all([
    page.waitForResponse(response=>response.url().endsWith('/api/conversations/91/avatar')&&response.request().method()==='PUT'),
    photoModal.getByRole('button',{name:'Lưu ảnh'}).click()
  ])
  assert.equal(groupPhotoUpdates.length,2)
  assert.equal(groupPhotoUpdates[1].attachment,null,'Removing group image clears the saved reference')
  await channelSidebar.locator('.group-channel-sidebar-icon img').waitFor({state:'detached'})
  console.log('PASS group avatar upload, preview, remove, fallback and no channel photo editor')

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
  assert.ok(await details.getByRole('button',{name:/File phương tiện, liên kết/}).isVisible(),
    'Media, files and links must have one shared entry')
  await details.locator('.conversation-shared-preview-grid img').first().waitFor()
  assert.equal(await details.locator('.conversation-shared-preview-grid img').count(),4,
    'Show four actual shared images in Facebook-like thumbnails')
  const mediaCols=await details.locator('.conversation-shared-preview-grid').evaluate(el=>
    getComputedStyle(el).gridTemplateColumns.split(' ').length)
  assert.equal(mediaCols,2,'Facebook-like album preview shows 2 columns with 2 rows')
  assert.ok(await details.locator('.conversation-shared-preview-grid img').first().evaluate(img => img.complete && img.naturalWidth > 0),
    'Preview thumbnail must load an actual image')
  await details.locator('.conversation-shared-preview-grid button').first().click()
  await page.getByRole('dialog',{name:'Xem ảnh và video'}).waitFor()
  await page.getByRole('button',{name:'Đóng trình xem ảnh'}).click()
  assert.ok(await details.isVisible(),'Closing the image viewer returns to conversation details')
  assert.equal(await details.locator('.conversation-shared-preview-types').count(),0,
    'No extra image, file, or link shortcuts below the preview')
  const previewAboveTitle=await details.locator('.conversation-shared-preview').evaluate(el => {
    const preview=el.querySelector('.conversation-shared-preview-grid, .conversation-shared-preview-empty')
    const title=el.querySelector('.conversation-shared-preview-title')
    return Boolean(preview && title && preview.getBoundingClientRect().bottom <= title.getBoundingClientRect().top)
  })
  assert.ok(previewAboveTitle,'The media preview must be above the File phương tiện, liên kết row')
  await details.getByRole('button',{name:'File phương tiện, liên kết'}).click()
  const shared=page.getByRole('dialog',{name:'Nội dung đã chia sẻ'})
  await shared.getByRole('button',{name:'Tệp',exact:true}).click()
  await shared.getByText('Tài liệu nhóm.pdf').waitFor()
  await shared.getByRole('button',{name:'Liên kết',exact:true}).click()
  await shared.getByText('https://example.com/group').first().waitFor()
  await shared.getByRole('button',{name:'Đóng',exact:true}).click()
  assert.equal(await shared.count(),0,'Closing shared content dismisses only the media dialog')
  await details.getByRole('button',{name:'Tùy chọn nhóm'}).waitFor()
  console.log('PASS media preview above the single shared content entry, without extra shortcuts')
  // A deployed backend may return [] for older messages with a NULL channel_id.
  // Both thumbnail and dialog must recover actual chat attachments/links.
  legacySharedResponse = true
  await details.getByRole('button',{name:'Đóng thông tin hội thoại'}).click()
  await page.locator('.translate-controls').getByRole('button',{name:'Thông tin hội thoại'}).click()
  await details.locator('.conversation-shared-preview-grid img').first().waitFor()
  assert.equal(await details.locator('.conversation-shared-preview-grid img').count(),1,
    'Legacy shared-content fallback finds an image preview in chat history')
  assert.equal(await details.locator('.conversation-shared-preview-grid video').count(),1,
    'Legacy shared-content fallback finds a video preview in chat history')
  await details.getByRole('button',{name:'File phương tiện, liên kết'}).click()
  const recovered=page.getByRole('dialog',{name:'Nội dung đã chia sẻ'})
  await recovered.locator('.shared-media-card').first().waitFor()
  assert.equal(await recovered.locator('.shared-media-card').count(),2,
    'Legacy shared-content fallback restores image and video in the media dialog')
  await recovered.getByRole('button',{name:'Tệp',exact:true}).click()
  await recovered.getByText('Tài liệu nhóm.pdf').waitFor()
  await recovered.getByRole('button',{name:'Liên kết',exact:true}).click()
  await recovered.getByText('https://example.com/group').first().waitFor()
  await recovered.getByRole('button',{name:'Đóng',exact:true}).click()
  assert.ok(await details.isVisible(),'Close shared content to return to conversation info after fallback')
  legacySharedResponse = false
  console.log('PASS fallback to chat history restores older image, video, file and link')
  assert.equal(await details.locator('.conversation-channel-list').count(),0,
    'Channels must stay in the left channel sidebar and not in Conversation Info')
  for (const removed of ['Gọi thoại','Gọi video','Thông báo','Dịch AI','Ảnh & video','Tệp tin','Liên kết','Quản lý nhóm']) {
    assert.equal(await details.getByRole('button',{name:removed,exact:true}).count(),0,
      removed+' must not appear as a separate option in Conversation Info')
  }
  for (const required of ['Tìm tin nhắn','Thành viên','Thông tin cộng đồng','Quyền quản trị',
    'Yêu cầu tham gia','Nội quy nhóm','Nhật ký hoạt động','Tùy chọn nhóm']) {
    assert.ok(await details.getByRole('button',{name:required,exact:true}).isVisible(),
      required+' must be directly accessible from Conversation Info')
  }
  assert.ok(await details.getByRole('button',{name:'Tùy chọn nhóm'}).isVisible(),'Group options remain available')
  console.log('PASS compact group info management links and shared media preview')
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
  assert.equal(await ownAvatar.count(),0,'Own group messages must not render an avatar')
  await channelSidebar.getByRole('button',{name:/Mở kênh Thảo luận chung/}).click()
  await page.locator('.messages').getByText('Chào mọi người, đây là nhóm ChatNet.').waitFor()
  assert.equal(await page.locator('.messages').getByText('Tin nhắn trong kênh riêng').count(),0)
  console.log('PASS owner creates channels inside group information options, no header dropdown')

  await page.locator('.translate-controls').getByRole('button',{name:'Thông tin hội thoại'}).click()
  await channelSidebar.getByRole('button',{name:/Mở kênh Backend API/}).click()
  await page.locator('.messages').getByText('Tin nhắn trong kênh riêng').waitFor()
  const realtimeMessage={...sampleMsg,id:991,channelId:201,senderId:2,text:'Realtime trong kênh Backend API',createdAt:new Date().toISOString()}
  channelMessages.push(realtimeMessage)
  await page.evaluate(message=>window.__chatnetTestSSE.emit('update',{type:'message',conversationId:91,message:message}),realtimeMessage)
  await page.locator('.messages').getByText('Realtime trong kênh Backend API').waitFor()
  const otherAvatar=page.locator('.messages .message.channel-message:not(.mine) .chat-message-sender-avatar')
  for (const width of [320, 390, 768, 1478]) {
    await page.setViewportSize({width,height:850})
    assert.equal(await ownAvatar.count(),0,'Own message must not have an avatar at '+width+'px')
    assert.ok(await otherAvatar.isVisible(),'Member avatar should be visible in channel at '+width+'px')
    const measures=await page.evaluate(() => {
      const entries=[...document.querySelectorAll('.message.channel-message .chat-message-sender-avatar')]
      return entries.map(el=>({display:getComputedStyle(el).display,width:el.getBoundingClientRect().width}))
    })
    assert.ok(measures.length>=1 && measures.every(m=>m.display!=='none' && m.width>=25),
      'Incoming member avatar must remain visible at '+width+'px: '+JSON.stringify(measures))
    console.log('PASS sender avatars only on incoming group messages at '+width+'px')
  }
  await page.setViewportSize({width:1478,height:850})
  console.log('PASS realtime message is rendered with its sender avatar in the active channel')

  console.log('PASS channel sidebar switches timelines independently of information panel')

  await page.locator('.translate-controls').getByRole('button',{name:'Thông tin hội thoại'}).click()
  await channelSidebar.getByRole('button',{name:/Mở kênh Thảo luận chung/}).click()
  await page.locator('.translate-controls').getByRole('button',{name:'Thông tin hội thoại'}).click()
  await details.getByRole('button',{name:'Thành viên',exact:true}).click()
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
  // Photo picker shared with both personal avatar and cover. Canceling never uploads.
  await page.locator('.app-sidebar').getByRole('button',{name:'Cá nhân'}).click()
  await page.locator('.profile-page-avatar-action').waitFor()
  await page.locator('.profile-page-avatar-action').click()
  const personalPhotoModal=page.locator('.group-photo-modal')
  assert.ok(await personalPhotoModal.getByText('Đổi ảnh đại diện').isVisible())
  await personalPhotoModal.getByLabel('Tệp ảnh đại diện').setInputFiles({
    name:'oversized.png',mimeType:'image/png',buffer:Buffer.alloc(13*1024*1024,2)
  })
  await personalPhotoModal.getByRole('alert').getByText(/vượt quá giới hạn 12 MB/).waitFor()
  assert.ok(await personalPhotoModal.getByRole('button',{name:'Lưu ảnh'}).isDisabled())
  assert.equal(personalPhotoUpdates.length,0,'Oversized personal avatar must not upload')
  await personalPhotoModal.getByRole('button',{name:'Hủy'}).click()
  assert.equal(await personalPhotoModal.count(),0,'Cancel should close personal avatar editor')
  assert.equal(personalPhotoUpdates.length,0,'Cancel must never modify personal photos')
  await page.locator('.profile-page-cover-action').click()
  assert.ok(await personalPhotoModal.getByText('Đổi ảnh bìa').isVisible())
  assert.ok(await personalPhotoModal.locator('.group-photo-preview.cover').isVisible())
  await personalPhotoModal.getByLabel('Tệp ảnh bìa').setInputFiles({
    name:'cover.png',mimeType:'image/png',
    buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL/nwAAAABJRU5ErkJggg==','base64')
  })
  assert.equal(personalPhotoUpdates.length,0,'Selecting a file must not upload until Save')
  await Promise.all([
    page.waitForResponse(response=>response.url().endsWith('/api/profile/media')&&response.request().method()==='PUT'),
    personalPhotoModal.getByRole('button',{name:'Lưu ảnh'}).click()
  ])
  assert.equal(personalPhotoUpdates[0].kind,'cover')
  assert.ok(personalPhotoUpdates[0].attachment?.storageRef)
  await page.locator('.profile-page-avatar-action').click()
  await personalPhotoModal.getByLabel('Tệp ảnh đại diện').setInputFiles({
    name:'avatar.png',mimeType:'image/png',
    buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL/nwAAAABJRU5ErkJggg==','base64')
  })
  await Promise.all([
    page.waitForResponse(response=>response.url().endsWith('/api/profile/media')&&response.request().method()==='PUT'),
    personalPhotoModal.getByRole('button',{name:'Lưu ảnh'}).click()
  ])
  assert.equal(personalPhotoUpdates[1].kind,'avatar')
  await page.locator('.profile-page-avatar-action').click()
  await personalPhotoModal.getByRole('button',{name:'Gỡ ảnh'}).click()
  await Promise.all([
    page.waitForResponse(response=>response.url().endsWith('/api/profile/media')&&response.request().method()==='PUT'),
    personalPhotoModal.getByRole('button',{name:'Lưu ảnh'}).click()
  ])
  assert.equal(personalPhotoUpdates[2].attachment,null)
  assert.equal(personalProfile.avatarSet,false)
  console.log('PASS shared profile avatar/cover picker, oversized warning, cancel and remove')

  assert.deepEqual(errors,[])
  console.log('PASS all revised Feed communities and Chat group menu checks')
  await context.close()
} finally {await browser?.close();await vite.close()}