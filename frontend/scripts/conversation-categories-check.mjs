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

  for(const width of [390,768,1024,1440]){
   const context=await browser.newContext({viewport:{width,height:740},serviceWorkers:'block'})
   const session={token:'mock.'+Buffer.from(JSON.stringify({exp:4102444800})).toString('base64url')+'.signed',refreshToken:'r'.repeat(43),sessionId:'category-fixture',user:{id:1,email:'viewer@example.invalid',username:'viewer',displayName:'Người xem'}}
   await context.addInitScript(session=>{
    localStorage.setItem('chatnet-session',JSON.stringify(session))
    class Events extends EventTarget{
     constructor(){super();window.__events=this;setTimeout(()=>this.onopen?.(),100)}
     close(){}
    }
    window.EventSource=Events
   },session)
   const page=await context.newPage(), errors=[], counts=new Map()
   page.on('pageerror',e=>errors.push(e.message))
   let categories=[{id:1,name:'Gia đình',color:'indigo'}], nextId=2, fail=false
   const conversations=Array.from({length:28},(_,i)=>({id:100+i,type:'group',name:'Hội thoại '+i,memberCount:3,unreadCount:0,lastMessage:'Tin nhắn',createdAt:'2026-01-01',categoryId:1}))
   conversations.push({id:200,type:'group',name:'Hội thoại chưa phân loại',memberCount:2,unreadCount:0,lastMessage:'Xin chào',createdAt:'2026-01-01'})
   await page.route('http://localhost:8080/**',route=>{
    const req=route.request(),u=new URL(req.url()),p=u.pathname,method=req.method()
    if(method==='GET') counts.set(p,(counts.get(p)||0)+1)
    const json=(data,status=200)=>route.fulfill({status,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*'},contentType:'application/json',body:JSON.stringify(data)})
    if(method==='OPTIONS')return route.fulfill({status:204,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'GET,POST,PUT,DELETE,OPTIONS'}})
    if(p==='/api/conversation-categories'){
     if(method==='GET')return json(categories)
     const data=req.postDataJSON()
     if(categories.some(c=>c.name===data.name))return json({error:'Tên phân loại đã tồn tại.'},409)
     const item={id:nextId++,...data};categories.push(item);return json(item,201)
    }
    if(p.startsWith('/api/conversation-categories/')){
     const id=Number(p.split('/').at(-1))
     if(method==='DELETE'){categories=categories.filter(c=>c.id!==id);conversations.forEach(c=>{if(c.categoryId===id)delete c.categoryId});return json({ok:true})}
     const item={id,...req.postDataJSON()};categories=categories.map(c=>c.id===id?item:c);return json(item)
    }
    if(p.endsWith('/category')){
     const id=Number(p.split('/')[3]),data=req.postDataJSON()
     const item=conversations.find(c=>c.id===id);item.categoryId=data.categoryId||undefined
     return json({conversationId:id,categoryId:data.categoryId})
    }
    if(p==='/api/conversations'){
     if(fail && u.searchParams.has('category'))return json({error:'offline'},503)
     const category=u.searchParams.get('category')
     const items=category===null?conversations:conversations.filter(c=>Number(category)===0?!c.categoryId:c.categoryId===Number(category))
     const offset=Number(u.searchParams.get('offset')||0)
     return json(items.slice(offset,offset+Number(u.searchParams.get('limit')||25)))
    }
    if(p==='/api/conversations/memberships')return json({ids:conversations.map(c=>c.id),nextAfter:null})
    if(p==='/api/preferences'||p==='/api/preferences/translation')return json({appLocale:'vi',autoTranslate:false,targetLanguage:'vi'})
    if(p==='/api/push/config')return json({configured:false})
    return json([])
   })
   await page.goto(origin)
   const filter=page.getByLabel('Lọc hội thoại theo phân loại',{exact:true})
   await filter.locator('option',{hasText:'Gia đình'}).waitFor({state:'attached'})
   await filter.selectOption('1')
   await page.waitForFunction(()=>document.querySelectorAll('.conversation-list .conversation-item').length===25)
   await page.getByRole('button',{name:'Tải thêm hội thoại',exact:true}).click()
   await page.waitForFunction(()=>document.querySelectorAll('.conversation-list .conversation-item').length===28)
   await filter.selectOption('0')
   await page.getByRole('button',{name:/Hội thoại chưa phân loại/}).waitFor()
   assert.equal(await page.locator('.conversation-list .conversation-item').count(),1)
   await filter.selectOption('all')
   await page.locator('.category-manager summary').click()
   await page.getByLabel('Tên phân loại',{exact:true}).fill('Đồng nghiệp')
   await page.getByLabel('Màu phân loại',{exact:true}).selectOption('green')
   await page.getByRole('button',{name:'Thêm thẻ',exact:true}).click()
   await filter.locator('option',{hasText:'Đồng nghiệp'}).waitFor({state:'attached'})
   await page.getByRole('button',{name:'Sửa phân loại Đồng nghiệp',exact:true}).click()
   await page.getByLabel('Tên phân loại',{exact:true}).fill('Công việc')
   await page.getByRole('button',{name:'Lưu thay đổi',exact:true}).click()
   await filter.locator('option',{hasText:'Công việc'}).waitFor({state:'attached'})
   await page.locator('.category-manager summary').click()
   await page.locator('.conversation-list .conversation-item').first().click()
   const assignment=page.getByLabel('Phân loại hội thoại',{exact:true})
   await assignment.waitFor()
   const friendReads=counts.get('/api/friends'),feedReads=counts.get('/api/posts')
   await assignment.selectOption('2')
   await page.waitForFunction(()=>document.querySelector('[aria-label="Phân loại hội thoại"]').value==='2')
   await assignment.selectOption('')
   await page.waitForFunction(()=>document.querySelector('[aria-label="Phân loại hội thoại"]').value==='')
   assert.equal(counts.get('/api/friends'),friendReads,'Assignment must not reload friends')
   assert.equal(counts.get('/api/posts'),feedReads,'Assignment must not reload feed')
   if(width<768) await page.getByRole('button',{name:'Quay lại danh sách',exact:true}).click()
   await filter.selectOption('2')
   await page.getByText('Đang tải phân loại…',{exact:true}).waitFor({state:'detached'})
   assert.equal(await page.locator('.conversation-list .conversation-item').count(),0)
   // A change made on another device must refresh the private category list.
   categories.push({id:3,name:'Khách hàng',color:'orange'})
   await page.evaluate(()=>window.__events.dispatchEvent(new MessageEvent('update',{data:JSON.stringify({type:'category.updated',conversationId:0})})))
   await filter.locator('option',{hasText:'Khách hàng'}).waitFor({state:'attached'})
   fail=true
   await filter.selectOption('3')
   await page.locator('.conversation-list [role="alert"]').waitFor()
   fail=false
   await page.getByRole('button',{name:'Thử lại',exact:true}).click()
   await page.locator('.conversation-list [role="alert"]').waitFor({state:'detached'})
   await filter.selectOption('all')
   await page.locator('.conversation-list .conversation-item').first().click()
   const beforeAssignmentReads=counts.get('/api/conversations')
   const beforeCategoryReads=counts.get('/api/conversation-categories')
   conversations.find(c=>c.id===100).categoryId=3
   await page.evaluate(()=>window.__events.dispatchEvent(new MessageEvent('update',{data:JSON.stringify({type:'category.updated',conversationId:100,categoryId:3})})))
   await page.waitForFunction(()=>document.querySelector('[aria-label="Phân loại hội thoại"]').value==='3')
   assert.equal(counts.get('/api/conversations'),beforeAssignmentReads,'Realtime assignment updates local state without reloading the list')
   assert.equal(counts.get('/api/conversation-categories'),beforeCategoryReads,'Realtime assignment keeps category definitions cached')
   if(width<768) await page.getByRole('button',{name:'Quay lại danh sách',exact:true}).click()
   await page.locator('.category-manager summary').click()
   await page.getByRole('button',{name:'Xóa phân loại Công việc',exact:true}).click()
   await page.getByRole('button',{name:'Xác nhận xóa',exact:true}).click()
   await filter.locator('option',{hasText:'Công việc'}).waitFor({state:'detached'})
   await page.getByLabel('Tên phân loại',{exact:true}).fill('Gia đình')
   await page.getByRole('button',{name:'Thêm thẻ',exact:true}).click()
   await page.locator('.category-error').getByText('Tên phân loại đã tồn tại.',{exact:false}).waitFor()
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Horizontal overflow')
   assert.deepEqual(errors,[])
   await context.close()
  }
  console.log('PASS: category CRUD, assignment/removal, server-filtered paging, private realtime refresh, errors/retry and viewports 390/768/1024/1440')
 }
}finally{await browser?.close();vite.kill()}