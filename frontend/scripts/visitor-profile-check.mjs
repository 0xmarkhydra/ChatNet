import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { createServer } from 'node:net'
import { setTimeout as delay } from 'node:timers/promises'
import assert from 'node:assert/strict'
process.chdir(fileURLToPath(new URL('..',import.meta.url)))
const port=await new Promise(resolvePort=>{const server=createServer();server.listen(0,'127.0.0.1',()=>{const port=server.address().port;server.close(()=>resolvePort(port))})})
const origin='http://127.0.0.1:'+port
const vite=spawn(process.execPath,[resolve('node_modules/vite/bin/vite.js'),'--host','127.0.0.1','--port',String(port),'--strictPort'],{stdio:'ignore'})
let browser
try{
 for(let i=0;i<60;i++){try{if((await fetch(origin)).ok)break}catch{};await delay(100)}
 for(const channel of [undefined,'msedge','chrome']){
  try{browser=await chromium.launch({headless:true,...(channel?{channel}:{})});break}catch(error){if(!String(error).includes("doesn't exist")&&!String(error).includes('not found'))throw error}
 }
 if(!browser){console.log('BLOCKED: no Playwright Chromium, Edge or Chrome installed');process.exitCode=2}
 else{
  for(const width of [390,768,1440]){
   const context=await browser.newContext({viewport:{width,height:640},serviceWorkers:'block'})
   const session={token:'mock.'+Buffer.from(JSON.stringify({exp:4102444800})).toString('base64url')+'.signed',refreshToken:'r'.repeat(43),sessionId:'visitor-fixture',user:{id:1,email:'viewer@example.invalid',username:'viewer',displayName:'Người xem'}}
   await context.addInitScript(session=>localStorage.setItem('chatnet-session',JSON.stringify(session)),session)
   const page=await context.newPage()
   const counts=new Map()
   const errors=[];page.on('pageerror',error=>errors.push(error.message))
   const allPosts=Array.from({length:16},(_,i)=>({id:100-i,author:'peer_user',authorDisplayName:'Tên người dùng có dấu',content:'Bài viết '+i,visibility:'public',createdAt:'2026-01-01T00:00:00Z',comments:[],liked:false,likes:0}))
   await page.route('http://localhost:8080/**',route=>{
    const u=new URL(route.request().url())
    if(route.request().method()==='GET'){const key=u.pathname+(u.pathname==='/api/posts'?'?author='+u.searchParams.get('author'):'');counts.set(key,(counts.get(key)||0)+1)}
    const json=(data,status=200)=>route.fulfill({status,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*'},contentType:'application/json',body:JSON.stringify(data)})
    if(route.request().method()==='OPTIONS')return route.fulfill({status:204,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'GET,POST,PUT,OPTIONS'}})
    if(u.pathname==='/api/events')return route.fulfill({headers:{'access-control-allow-origin':'*'},contentType:'text/event-stream',body:': ready\n\n'})
    if(u.pathname==='/api/friends/2'){
     if(route.request().method()==='DELETE')return json({status:'removed'})
     return json({id:2,username:'peer_user',displayName:'Tên người dùng có dấu',online:false,status:'pending',direction:'outgoing',updatedAt:new Date().toISOString()})
    }
    if(u.pathname==='/api/users/search')return json([{id:2,username:'peer_user',displayName:'Tên người dùng có dấu',online:false}])
    if(u.pathname==='/api/users/peer_user/profile')return json({id:2,username:'peer_user',displayName:'Tên người dùng có dấu',avatarSet:false,coverSet:false,allowFriendRequests:true,updatedAt:'2026-01-01'})
    if(u.pathname==='/api/users/blocked/profile')return json({error:'profile not found'},404)
    if(u.pathname==='/api/posts'){
     const before=Number(u.searchParams.get('before')||0)
     return json(u.searchParams.get('author')==='peer_user'?allPosts.filter(post=>!before||post.id<before).slice(0,15):[])
    }
    if(u.pathname==='/api/preferences'||u.pathname==='/api/preferences/translation')return json({appLocale:'vi',autoTranslate:false,targetLanguage:'vi'})
    if(u.pathname==='/api/push/config')return json({configured:false})
    return json([])
   })
   await page.goto(origin+'/?connect=peer_user')
   const profile=page.getByRole('dialog',{name:'Trang cá nhân người dùng'})
   await profile.getByRole('heading',{name:'Tên người dùng có dấu'}).waitFor()
   await profile.locator('.post').nth(14).waitFor()
   assert.equal(await profile.locator('.post').count(),15)
   await profile.getByRole('button',{name:'Xem bài viết cũ hơn'}).click()
   await profile.getByText('Bài viết 15',{exact:true}).waitFor()
   assert.equal(await profile.locator('.post').count(),16)
   assert.ok(await profile.getByRole('button',{name:'Kết bạn',exact:true}).isEnabled())
   const cachedProfileReads=counts.get('/api/users/peer_user/profile')
   const cachedTimelineReads=counts.get('/api/posts?author=peer_user')
   await profile.getByRole('button',{name:'Quay lại',exact:true}).click()
   await page.getByRole('navigation',{name:'Điều hướng chính'}).getByRole('button',{name:'Danh bạ'}).click()
   await page.locator('.appbar-search input').fill('peer_user')
   await page.getByRole('button',{name:'Tên người dùng có dấu',exact:true}).click()
   await profile.locator('.post').nth(14).waitFor()
   await profile.getByRole('button',{name:'Xem bài viết cũ hơn'}).click()
   await profile.getByText('Bài viết 15',{exact:true}).waitFor()
   assert.equal(counts.get('/api/users/peer_user/profile'),cachedProfileReads,'Reopening a fresh profile must use cached data')
   assert.equal(counts.get('/api/posts?author=peer_user'),cachedTimelineReads,'Previously loaded timeline pages must use cache')
   await delay(200)
   const before=new Map(counts)
   await profile.getByRole('button',{name:'Kết bạn',exact:true}).click()
   const cancel=profile.getByRole('button',{name:'Hủy lời mời',exact:true})
   await cancel.waitFor()
   assert.equal(await cancel.locator('svg.lucide-user-minus').count(),1)
   await cancel.click()
   await profile.getByRole('button',{name:'Kết bạn',exact:true}).waitFor()
   await delay(200)
   for(const key of ['/api/users/peer_user/profile','/api/posts?author=peer_user','/api/friends','/api/friends/requests','/api/contacts']){
    assert.equal(counts.get(key),before.get(key),'Unnecessary GET after send/cancel: '+key)
   }
   assert.equal(await profile.locator('.post').count(),16,'Send/cancel must preserve loaded pages')
   const reloads=counts.get('/api/users/peer_user/profile')
   await profile.getByRole('button',{name:'Tải lại hồ sơ'}).click()
   await profile.locator('.post').nth(14).waitFor()
   assert.equal(counts.get('/api/users/peer_user/profile'),reloads+1,'Explicit refresh must bypass cache')
   await profile.locator('.post').first().getByRole('button',{name:'Bình luận',exact:true}).click()
   const detail=page.getByRole('dialog',{name:'Chi tiết bài viết của Tên người dùng có dấu'})
   await detail.waitFor()
   await detail.getByRole('button',{name:'Đóng chi tiết bài viết'}).click()
   await detail.waitFor({state:'detached'})
   assert.ok(await profile.isVisible())
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1))
   await profile.getByRole('button',{name:'Quay lại',exact:true}).click()
   await profile.waitFor({state:'detached'})
   await page.goto(origin+'/?connect=blocked')
   await page.getByRole('dialog',{name:'Trang cá nhân người dùng'}).getByRole('alert').waitFor()
   assert.equal(await page.locator('.visitor-profile .post').count(),0)
   assert.deepEqual(errors,[])
   await context.close()
  }
  console.log('PASS: QR visitor profile, paging, blocked state, back navigation and widths 390/768/1440')
 }
}finally{await browser?.close();vite.kill()}