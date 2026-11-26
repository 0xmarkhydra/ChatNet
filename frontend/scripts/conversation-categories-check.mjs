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

  const failures=[]
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
   // Assignment is exercised on a direct chat: group headers hide the category button on narrow layouts (group-channel-sidebar.css).
   Object.assign(conversations[0],{type:'direct',otherUserId:900,otherUsername:'category_friend'})
   conversations.push({id:200,type:'group',name:'Hội thoại chưa phân loại',memberCount:2,unreadCount:0,lastMessage:'Xin chào',createdAt:'2026-01-01'})
   await page.route(url => url.pathname.startsWith('/api/'),async route=>{
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
     await delay(150)
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
   // The chat list is the folding rail: avatar rail on phones, desktop rail from 768px.
   // The legacy .conversation-list stays mounted but hidden, so only visible elements count.
   const rows=page.locator('.desktop-conversation-rail-row:visible, .conversation-avatar-rail-item:visible')
   const rail=page.locator('.desktop-conversation-rail:visible, .conversation-avatar-rail:visible')
   const filter=page.getByLabel('Lọc hội thoại theo phân loại',{exact:true}).filter({visible:true})
   const popup=page.locator('.category-popover:popover-open')
   const manager=page.locator('dialog.category-manager[open]')
   const option=name=>page.locator('.conversation-categories .category-option').filter({hasText:name}).first()
   const waitRows=async(expected,what)=>{
    for(let i=0;i<100;i++){if(await rows.count()===expected)return;await delay(100)}
    assert.equal(await rows.count(),expected,what+' at '+width+'px')
   }
   const ensureList=async()=>{
    // A selected conversation can hide the rail on narrow screens.
    if(!(await rail.count())){await page.goto(origin);await rail.first().waitFor()}
   }
   const openRow=async()=>{
    await ensureList()
    // The rail menu stays open behind the category manager; dismiss it like a user would.
    if(await page.locator('.conversation-rail-menu-popover:popover-open').count())await page.keyboard.press('Escape')
    await rows.first().click()
    await page.getByRole('button',{name:'Phân loại hội thoại',exact:true}).filter({visible:true}).waitFor()
   }
   const openFilterTrigger=async()=>{
    await ensureList()
    if(!(await filter.count()))await page.getByRole('button',{name:'Menu hội thoại'}).filter({visible:true}).click()
    await filter.waitFor()
   }
   const openFilter=async()=>{await openFilterTrigger();await filter.click();await popup.waitFor()}
   const openManager=async()=>{
    // Same outside-scroll dismissal as the assignment popover: reopen a bounded number of times.
    for(let attempt=1;;attempt++){
     await openFilter()
     try{await popup.getByRole('button',{name:'Quản lý thẻ phân loại',exact:true}).click({timeout:2000});return}catch(error){if(attempt===3)throw error}
    }
   }
   const selectCategory=async value=>{await openFilter();await popup.locator('.category-option input[value="'+value+'"]').locator('..').click();await popup.waitFor({state:'hidden'})}
   await option('Gia đình').waitFor({state:'attached'})
   await openFilter()
   const bounds=await popup.boundingBox()
   assert.ok(bounds.x>=0 && bounds.x+bounds.width<=width,'Popover must fit viewport')
   await filter.click()
   await popup.waitFor({state:'hidden'})
   await filter.click()
   await popup.waitFor()
   await page.keyboard.press('Escape')
   await popup.waitFor({state:'hidden'})
   await selectCategory('1')
   await waitRows(25,'First page of the category')
   await rows.last().evaluate(row=>{let node=row.parentElement;while(node&&node.scrollHeight<=node.clientHeight)node=node.parentElement;node.scrollTop=node.scrollHeight}) // the rail loads the next page near the bottom
   await waitRows(28,'Second page of the category')
   await selectCategory('0')
   await waitRows(1,'Uncategorized filter')
   assert.match(await rows.first().evaluate(el=>el.textContent+' '+[el,...el.querySelectorAll('[aria-label],[title]')].map(n=>(n.getAttribute('aria-label')||'')+' '+(n.getAttribute('title')||'')).join(' ')),/Hội thoại chưa phân loại/)
   await selectCategory('all')
   await openManager()
   await manager.getByLabel('Tên phân loại',{exact:true}).fill('Đồng nghiệp')
   await page.getByRole('radio',{name:'Màu Xanh lá',exact:true}).locator('..').click()
   await page.getByRole('button',{name:'Thêm thẻ',exact:true}).click()
   await option('Đồng nghiệp').waitFor({state:'attached'})
   await page.getByRole('button',{name:'Sửa phân loại Đồng nghiệp',exact:true}).click()
   await manager.getByLabel('Tên phân loại',{exact:true}).fill('Công việc')
   await page.getByRole('button',{name:'Lưu thay đổi',exact:true}).click()
   await option('Công việc').waitFor({state:'attached'})
   await page.getByRole('button',{name:'Đóng quản lý thẻ',exact:true}).click()
   await openRow()
   const assignment=page.getByRole('button',{name:'Phân loại hội thoại',exact:true}).filter({visible:true})
   await assignment.waitFor()
   // The popover closes on any outside scroll, so a late message-list scroll can dismiss it; reopen a bounded number of times.
   const chooseAssignment=async value=>{
    const choice=page.locator('.category-assignment-popover:popover-open input[value="'+(value||'0')+'"]').locator('..')
    for(let attempt=1;;attempt++){
     if(!(await choice.count()))await assignment.click()
     try{await choice.click({timeout:2000});return}catch(error){if(attempt===3)throw error}
    }
   }
   const assignCategory=async value=>{await chooseAssignment(value);await delay(40);assert.equal(await page.locator('.request-progress').count(),0,'Assigning a category must not show global progress')}
   const friendReads=counts.get('/api/friends'),feedReads=counts.get('/api/posts')
   await assignCategory('2')
   await page.waitForFunction(()=>document.querySelector('[aria-label="Phân loại hội thoại"]').dataset.categoryId==='2')
   await assignCategory('')
   await page.waitForFunction(()=>document.querySelector('[aria-label="Phân loại hội thoại"]').dataset.categoryId==='')
   assert.equal(counts.get('/api/friends'),friendReads,'Assignment must not reload friends')
   assert.equal(counts.get('/api/posts'),feedReads,'Assignment must not reload feed')
   if(width<768) await page.getByRole('button',{name:'Quay lại danh sách',exact:true}).click()
   await selectCategory('2')
   await waitRows(0,'Empty category')
   // A change made on another device must refresh the private category list.
   categories.push({id:3,name:'Khách hàng',color:'orange'})
   await page.evaluate(()=>window.__events.dispatchEvent(new MessageEvent('update',{data:JSON.stringify({type:'category.updated',conversationId:0})})))
   await option('Khách hàng').waitFor({state:'attached'})
   fail=true
   await selectCategory('3')
   // A failed filtered load must be visible with a retry. Recorded so the remaining steps still run.
   const retry=rail.getByRole('button',{name:/Thử/}).or(rail.getByRole('alert').getByRole('button'))
   if(await retry.first().waitFor({timeout:4000}).then(()=>true,()=>false)){
    fail=false
    await retry.first().click()
    await retry.first().waitFor({state:'detached'})
   }else{
    fail=false
    failures.push(width+'px: a failed category load shows no error or retry in the visible conversation rail')
   }
   await selectCategory('all')
   await openRow()
   await page.waitForLoadState('networkidle')
   const beforeAssignmentReads=counts.get('/api/conversations')
   const beforeCategoryReads=counts.get('/api/conversation-categories')
   conversations.find(c=>c.id===100).categoryId=3
   await page.evaluate(()=>window.__events.dispatchEvent(new MessageEvent('update',{data:JSON.stringify({type:'category.updated',conversationId:100,categoryId:3})})))
   await page.waitForFunction(()=>document.querySelector('[aria-label="Phân loại hội thoại"]').dataset.categoryId==='3')
   assert.equal(counts.get('/api/conversations'),beforeAssignmentReads,'Realtime assignment updates local state without reloading the list')
   assert.equal(counts.get('/api/conversation-categories'),beforeCategoryReads,'Realtime assignment keeps category definitions cached')
   if(width<768) await page.getByRole('button',{name:'Quay lại danh sách',exact:true}).click()
   await openManager()
   await page.getByRole('button',{name:'Xóa phân loại Công việc',exact:true}).click()
   await page.getByRole('button',{name:'Xác nhận xóa',exact:true}).click()
   await page.waitForFunction(()=>![...document.querySelectorAll('.conversation-categories .category-option')].some(el=>el.textContent.includes('Công việc')))
   await manager.getByLabel('Tên phân loại',{exact:true}).fill('Gia đình')
   await page.getByRole('button',{name:'Thêm thẻ',exact:true}).click()
   await page.locator('.category-manager .category-error').filter({visible:true}).getByText('Tên phân loại đã tồn tại.',{exact:false}).waitFor()
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Horizontal overflow')
   await page.setViewportSize({width,height:420})
   const saveButton=page.getByRole('button',{name:'Thêm thẻ',exact:true})
   await saveButton.scrollIntoViewIfNeeded()
   const saveBounds=await saveButton.boundingBox()
   assert.ok(saveBounds.y>=0 && saveBounds.y+saveBounds.height<=420,'Dialog actions stay reachable on a short screen')
   await page.keyboard.press('Escape')
   await page.getByRole('dialog',{name:'Thẻ phân loại',exact:true}).waitFor({state:'hidden'})
   assert.deepEqual(errors,[])
   await context.close()
  }
  assert.deepEqual(failures,[],'Known gaps in the current layout')
  console.log('PASS: category CRUD, assignment/removal, server-filtered paging, private realtime refresh, errors/retry and viewports 390/768/1024/1440')
 }
}finally{await browser?.close();vite.kill()}