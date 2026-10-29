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
   const context=await browser.newContext({viewport:{width,height:740},serviceWorkers:'block'})
   const session={token:'mock.'+Buffer.from(JSON.stringify({exp:4102444800})).toString('base64url')+'.signed',refreshToken:'r'.repeat(43),sessionId:'note-fixture',user:{id:1,email:'viewer@example.invalid',username:'viewer',displayName:'Người xem'}}
   await context.addInitScript(session=>localStorage.setItem('chatnet-session',JSON.stringify(session)),session)
   const page=await context.newPage(),errors=[],counts=new Map()
   page.on('pageerror',e=>errors.push(e.message))
   let note=null,fail=false
   const foreign={content:'Chúc bạn một ngày tốt lành 🌿',visibility:'public',version:'foreign',createdAt:new Date().toISOString(),expiresAt:new Date(Date.now()+86400000).toISOString()}
   await page.route('http://localhost:8080/**',route=>{
    const req=route.request(),u=new URL(req.url()),p=u.pathname,method=req.method()
    if(method==='GET')counts.set(p,(counts.get(p)||0)+1)
    const json=(data,status=200)=>route.fulfill({status,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*'},contentType:'application/json',body:JSON.stringify(data)})
    if(method==='OPTIONS')return route.fulfill({status:204,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'GET,POST,PUT,DELETE,OPTIONS'}})
    if(p==='/api/events')return route.fulfill({headers:{'access-control-allow-origin':'*'},contentType:'text/event-stream',body:': ready\n\n'})
    if(p==='/api/profile/note'){
     if(method==='GET')return json({note})
     if(fail)return json({error:'Mạng không ổn định. Hãy tải lại để kiểm tra.'},503)
     if(method==='POST'){
      assert.equal(note,null,'Publishing must not edit an active note')
      const data=req.postDataJSON()
      note={...data,version:crypto.randomUUID(),createdAt:new Date().toISOString(),expiresAt:new Date(Date.now()+86400000).toISOString()}
     }else if(method==='DELETE')note=null
     else throw new Error('Unexpected note method '+method)
     return json({note})
    }
    if(p==='/api/users/peer_user/note')return json({note:foreign})
    if(p==='/api/profile')return json({username:'viewer',displayName:'Người xem',avatarSet:false,coverSet:false,updatedAt:new Date().toISOString()})
    if(p==='/api/users/peer_user/profile')return json({id:2,username:'peer_user',displayName:'Bạn của tôi',avatarSet:false,coverSet:false,allowFriendRequests:true,updatedAt:'2026-01-01'})
    if(p==='/api/preferences'||p==='/api/preferences/translation')return json({appLocale:'vi',autoTranslate:false,targetLanguage:'vi'})
    if(p==='/api/push/config')return json({configured:false})
    return json([])
   })
   await page.goto(origin)
   await page.getByRole('navigation',{name:'Điều hướng chính'}).getByRole('button').last().click()
   const publish=page.getByRole('button',{name:'Đăng ghi chú',exact:true})
   await publish.waitFor()
   const bubbleBounds=await publish.boundingBox(),heroBounds=await page.locator('.profile-hero').boundingBox()
   assert.ok(bubbleBounds.x>=heroBounds.x && bubbleBounds.x+bubbleBounds.width<=heroBounds.x+heroBounds.width,'Note bubble must fit the profile card')
   await publish.click()
   let dialog=page.getByRole('dialog',{name:'Đăng ghi chú',exact:true})
   await dialog.waitFor()
   assert.equal(await dialog.getByLabel('Ai có thể xem ghi chú').inputValue(),'friends')
   const input=dialog.getByLabel('Nội dung ghi chú')
   await input.fill('Chào')
   const shortBox=await input.boundingBox()
   await input.fill('Một ngày mới với thật nhiều niềm vui và những điều tốt đẹp nhé')
   const longBox=await input.boundingBox()
   assert.ok(longBox.height>shortBox.height,'Note bubble grows when text wraps')
   await input.fill('Chào')
   const restoredBox=await input.boundingBox()
   assert.ok(restoredBox.height<longBox.height,'Note bubble shrinks after deleting text')
   await dialog.getByLabel('Nội dung ghi chú').fill('😀'.repeat(61))
   assert.ok(await dialog.getByRole('button',{name:'Đăng ghi chú',exact:true}).isDisabled())
   await dialog.getByLabel('Nội dung ghi chú').fill('Một ngày thật đẹp 🌿')
   await dialog.getByLabel('Ai có thể xem ghi chú').selectOption('public')
   const before=new Map(counts)
   await dialog.getByRole('button',{name:'Đăng ghi chú',exact:true}).click()
   await dialog.waitFor({state:'hidden'})
   assert.equal(note.visibility,'public')
   await page.getByRole('button',{name:'Xem ghi chú',exact:true}).click()
   dialog=page.getByRole('dialog',{name:'Ghi chú',exact:true})
   await dialog.getByText('Một ngày thật đẹp 🌿',{exact:true}).waitFor()
   assert.equal(await dialog.getByRole('textbox').count(),0,'Existing note has no editor')
   assert.equal(await dialog.getByRole('button',{name:/Sửa/}).count(),0)
   await dialog.getByRole('button',{name:'Xóa ghi chú',exact:true}).click()
   await dialog.getByRole('button',{name:'Xác nhận xóa',exact:true}).click()
   await dialog.waitFor({state:'hidden'})
   for(const p of ['/api/posts','/api/friends','/api/conversations'])assert.equal(counts.get(p),before.get(p),'Note mutation must not reload '+p)
   await publish.click()
   dialog=page.getByRole('dialog',{name:'Đăng ghi chú',exact:true})
   await dialog.getByLabel('Nội dung ghi chú').fill('Giữ lại bản nháp')
   fail=true
   await dialog.getByRole('button',{name:'Đăng ghi chú',exact:true}).click()
   await dialog.getByRole('alert').waitFor()
   assert.equal(await dialog.getByLabel('Nội dung ghi chú').inputValue(),'Giữ lại bản nháp')
   fail=false
   await dialog.getByRole('button',{name:'Tải lại ghi chú',exact:true}).click()
   await dialog.getByRole('alert').waitFor({state:'detached'})
   await dialog.getByRole('button',{name:'Đóng ghi chú',exact:true}).click()
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1))
   await page.goto(origin+'/?connect=peer_user')
   const profile=page.getByRole('dialog',{name:'Trang cá nhân người dùng'})
   await profile.getByRole('heading',{name:'Bạn của tôi'}).waitFor()
   await profile.getByRole('button',{name:'Xem ghi chú',exact:true}).click()
   dialog=page.getByRole('dialog',{name:'Ghi chú',exact:true})
   await dialog.getByText(foreign.content,{exact:true}).waitFor()
   assert.equal(await dialog.getByRole('button',{name:'Xóa ghi chú',exact:true}).count(),0,'Visitors cannot delete another note')
   await page.keyboard.press('Escape')
   await dialog.waitFor({state:'hidden'})
   assert.ok(await profile.isVisible(),'Closing a note keeps the profile open')
   assert.deepEqual(errors,[])
   await context.close()
  }
  console.log('PASS: note publish/delete only, Unicode limit, visibility selection, draft recovery, selective requests, visitor read-only, Escape and widths 390/768/1440')
 }
}finally{await browser?.close();vite.kill()}