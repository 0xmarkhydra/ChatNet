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
    if(path.endsWith('/group-settings')&&method==='GET')return route.fulfill(json(groupSettings))
    if(path.endsWith('/group-settings')&&method==='PATCH')return route.fulfill(json({...groupSettings,...JSON.parse(req.postData()||'{}')}))
    if(path.endsWith('/join-requests')&&method==='GET')return route.fulfill(json([]))
    if(path.endsWith('/invites')&&method==='GET')return route.fulfill(json([]))
    if(path.endsWith('/admin-audit')&&method==='GET')return route.fulfill(json([]))
    if(path==='/api/conversations/91/members/3'&&method==='PATCH')return route.fulfill(json({}))
    if(path==='/api/conversations/91/members'&&method==='POST')return route.fulfill(json({}))
    if(path.includes('/messages')&&method==='GET')return route.fulfill(json(url.searchParams.get('channelId')&&url.searchParams.get('channelId')!=='0'?[]:path.includes('/91/')?[sampleMsg]:[]))
    if(path.includes('/messages')&&method==='POST'){const body=JSON.parse(req.postData()||'{}');payloads.push(body);return route.fulfill(json({...sampleMsg,id:65,senderId:1,sender:'tester',channelId:body.channelId||0,text:body.text}))}
    const data=path==='/api/conversations'?groups:
      path==='/api/friends'?friends:
      path==='/api/friends/requests'||path==='/api/stories'||path==='/api/posts'||path==='/api/conversation-categories'||path==='/api/calls/current'||path==='/api/contacts'?[]:
      path==='/api/users/suggestions'||path==='/api/users/search'?friends:
      path==='/api/profile'?{username:'tester',displayName:'Tài khoản của tôi',avatarSet:false,coverSet:false,updatedAt:'2026-11-06'}:{}
    await route.fulfill(json(data))
  })
  const page=await context.newPage()
  const errors=[];page.on('pageerror',e=>errors.push(e.message))
  await page.goto(origin,{waitUntil:'domcontentloaded'})
  await page.locator('.app-sidebar').getByRole('button',{name:'Nhóm & cộng đồng'}).click()
  await page.getByRole('heading',{name:'Nhóm của bạn'}).waitFor()
  // Group navigation must behave like every other desktop sidebar item.
  for (const width of [768, 1024, 1478]) {
    await page.setViewportSize({ width, height: 850 })
    await page.mouse.move(width - 4, 200)
    await page.waitForFunction(() => Math.round(document.querySelector('.app-sidebar')?.getBoundingClientRect().width || 0) === 76)
    const sidebar = page.locator('.app-sidebar')
    await sidebar.getByRole('button', { name: 'Nhóm & cộng đồng' }).hover()
    await page.waitForFunction(() => Math.round(document.querySelector('.app-sidebar')?.getBoundingClientRect().width || 0) === 250)
    await sidebar.getByRole('button', { name: 'Nhóm & cộng đồng' }).click()
    await page.mouse.move(width - 4, 200)
    await page.waitForFunction(() => Math.round(document.querySelector('.app-sidebar')?.getBoundingClientRect().width || 0) === 76)
    assert.ok(await page.getByRole('heading', { name: 'Nhóm của bạn' }).isVisible())
    console.log('PASS Groups sidebar hover-expand and mouseleave-collapse at ' + width + 'px')
  }
  assert.match(await page.locator('.cg-group-list').innerText(),/Team ChatNet/)
  await Promise.all([page.waitForResponse(r=>r.url().includes('/api/groups/150/join')&&r.request().method()==='POST'),page.getByRole('button',{name:'Tham gia',exact:true}).click()])
  assert.ok(calls.includes('POST /api/groups/150/join'))
  const dir=resolve(root,'output','groups-redesign');await mkdir(dir,{recursive:true})
  await page.screenshot({path:resolve(dir,'groups-list.png'),fullPage:true})

  await page.getByRole('button',{name:'Quản trị'}).first().click()
  await page.getByRole('heading',{name:'Thành viên',exact:true}).waitFor()
  await page.getByText('Linh Anh').first().waitFor()
  assert.ok(calls.includes('GET /api/conversations/91/members'))
  await page.screenshot({path:resolve(dir,'groups-manage.png'),fullPage:true})
  await page.getByRole('button',{name:'Mời thành viên'}).click()
  await page.getByRole('checkbox').first().check()
  await Promise.all([
    page.waitForResponse(response=>response.url().endsWith('/api/conversations/91/members') && response.request().method()==='POST'),
    page.getByRole('button',{name:'Mời (1)',exact:true}).click(),
  ])
  assert.ok(calls.includes('POST /api/conversations/91/members'))
  console.log('PASS invite existing friend through group member API')
  await page.getByRole('button',{name:'Thông tin cộng đồng'}).click()
  await page.getByRole('textbox',{name:'Mô tả cộng đồng'}).fill('Nội dung cập nhật qua API')
  await page.getByRole('combobox',{name:'Quyền truy cập cộng đồng'}).selectOption('public')
  await Promise.all([page.waitForResponse(r=>r.url().endsWith('/api/conversations/91/community')&&r.request().method()==='PATCH'),page.getByRole('button',{name:'Lưu thông tin'}).click()])
  await page.getByRole('button',{name:'Nội quy nhóm'}).click()
  await page.getByRole('textbox',{name:'Nội quy cộng đồng'}).fill('Không spam và tôn trọng thành viên')
  await Promise.all([page.waitForResponse(r=>r.url().endsWith('/api/conversations/91/community')&&r.request().method()==='PATCH'),page.getByRole('button',{name:'Lưu nội quy'}).click()])
  await page.getByRole('button',{name:'Thông báo',exact:true}).last().click()
  await page.getByRole('checkbox',{name:'Thông báo tin nhắn nhóm'}).uncheck()
  await Promise.all([page.waitForResponse(r=>r.url().endsWith('/api/conversations/91/notification-settings')&&r.request().method()==='PUT'),page.getByRole('button',{name:'Lưu thông báo'}).click()])
  assert.ok(calls.includes('PATCH /api/conversations/91/community'))
  assert.ok(calls.includes('PUT /api/conversations/91/notification-settings'))
  assert.equal(profile.rules,'Không spam và tôn trọng thành viên')
  assert.equal(profile.visibility,'public')
  assert.equal(prefs.messageNotifications,false)
  console.log('PASS public visibility, metadata, rules and notification preferences')
  await page.getByRole('button',{name:'Quyền quản trị'}).first().click()
  await page.getByText('Thiết lập & quyền nhóm').waitFor()
  assert.ok(calls.includes('GET /api/conversations/91/group-settings'))
  await page.getByRole('button',{name:'Vào trò chuyện'}).click()
  await page.getByRole('heading',{name:/Thảo luận chung/}).waitFor()
  await page.getByText('Chào mọi người, đây là nhóm ChatNet.').waitFor()
  await page.screenshot({path:resolve(dir,'groups-channel.png'),fullPage:true})
  await page.getByRole('textbox',{name:'Nhắn tin cho # Thảo luận chung'}).fill('Tin nhắn mới từ kênh chung')
  await Promise.all([
    page.waitForResponse(response=>response.url().includes('/api/conversations/91/messages') && response.request().method()==='POST'),
    page.getByRole('button',{name:'Gửi',exact:true}).click(),
  ])
  assert.ok(calls.includes('POST /api/conversations/91/messages'))
  console.log('PASS group messages use existing offline-safe send handler')
  await page.getByRole('textbox',{name:'Tên kênh mới'}).fill('Backend API')
  await page.getByRole('textbox',{name:'Mô tả kênh mới'}).fill('Tài liệu backend')
  await page.getByRole('button',{name:'Tạo kênh'}).click()
  await page.getByRole('heading',{name:/Backend API/}).waitFor()
  await page.getByRole('textbox',{name:'Nhắn tin cho # Backend API'}).fill('Tin nhắn trong kênh riêng')
  await Promise.all([
    page.waitForResponse(r=>r.url().includes('/api/conversations/91/messages')&&r.request().method()==='POST'),
    page.getByRole('button',{name:'Gửi',exact:true}).click(),
  ])
  await page.locator('.cg-chat-messages').getByText('Tin nhắn trong kênh riêng').waitFor()
  assert.equal(payloads.find(v=>v.channelId===201)?.text,'Tin nhắn trong kênh riêng',JSON.stringify(payloads))
  assert.ok(calls.includes('GET /api/conversations/91/channels'))
  assert.ok(calls.includes('POST /api/conversations/91/channels'))
  console.log('PASS independent channel creation, scoped messages and send')
  await page.getByRole('button',{name:'Quản lý nhóm'}).click()
  await page.getByRole('button',{name:'Danh sách'}).click()

  await page.getByRole('button',{name:'Tạo cộng đồng mới'}).first().click()
  await page.getByRole('textbox',{name:'Tên nhóm'}).fill('SocCo Product Community')
  await page.getByRole('textbox',{name:'Mô tả'}).fill('Chia sẻ ý tưởng và sản phẩm')
  await page.screenshot({path:resolve(dir,'groups-create-info.png'),fullPage:true})
  await page.getByRole('button',{name:/Tiếp: Mời thành viên/}).click()
  await page.getByRole('button',{name:'Linh Anh'}).first().click()
  await page.getByRole('button',{name:'David Chen'}).first().click()
  assert.match(await page.locator('.cg-selected-members h3').innerText(),/2/)
  await page.screenshot({path:resolve(dir,'groups-create-members.png'),fullPage:true})
  for (const width of [390,768,1024,1478]) {
    await page.setViewportSize({width,height:850})
    const state=await page.evaluate(()=>({viewport:innerWidth,width:document.documentElement.scrollWidth}))
    assert.ok(state.width<=state.viewport+3,'Wizard overflow at '+width+'px')
  }
  await page.getByRole('button',{name:/Tiếp: Xác nhận/}).click()
  await page.getByRole('button',{name:'Tạo nhóm',exact:true}).click()
  await page.locator('.cg-channel-grid').waitFor()
  assert.match(await page.locator('.cg-channel-heading').innerText(),/SocCo Product Community/)
  assert.ok(calls.includes('POST /api/conversations/groups'))
  assert.equal(payloads.find(v=>v.name==='SocCo Product Community')?.description,'Chia sẻ ý tưởng và sản phẩm')
  console.log('PASS group create wizard with persisted community metadata and channels')

  for(const width of [390,768,1024,1478]){
    await page.setViewportSize({width,height:850})
    const state=await page.evaluate(()=>({viewport:innerWidth,scrollWidth:document.documentElement.scrollWidth}))
    assert.ok(state.scrollWidth<=state.viewport+3,'Overflow at '+width+'px '+JSON.stringify(state))
    console.log('PASS responsive '+width+'px')
  }
  assert.deepEqual(errors,[])
  console.log('PASS all groups and communities browser checks')
  await context.close()
} finally {await browser?.close();await vite.close()}
