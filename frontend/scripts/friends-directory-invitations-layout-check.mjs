import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { chromium } from 'playwright'

const read = file => readFileSync(new URL(file, import.meta.url), 'utf8')
const contacts = read('../src/features/contacts/components/ContactsView.tsx')
const invites = read('../src/features/contacts/components/ContactInvitations.tsx')
const css = read('../src/features/contacts/styles/friends-design-v2.css')
assert.match(contacts, /fd-directory-layout[\s\S]*fd-directory-main[\s\S]*fd-searchbar[\s\S]*fd-list-card[\s\S]*fd-profile-panel/)
assert.match(invites, /fd-invitation-layout[\s\S]*fd-invitation-main[\s\S]*fd-invitation-tabs[\s\S]*fd-invitation-list[\s\S]*ContactQrPanel/)

const person = '<div class="fd-person-row"><button class="fd-person-identity"><div class="fd-avatar">A</div><span><strong>Người dùng thử nghiệm</strong><small>Đang hoạt động</small></span></button></div>'
const request = '<div class="fd-request-row"><div class="fd-avatar">A</div><div class="fd-request-copy"><strong>Người dùng thử nghiệm</strong><span>Đang chờ</span></div><button class="fd-primary">Chấp nhận</button><button class="fd-secondary">Từ chối</button></div>'
const directory = `<div class="friends-design-v2">
  <div class="fd-directory-layout">
    <div class="fd-directory-main">
      <section class="fd-searchbar"><label><span>⌕</span><input placeholder="Tìm theo tên, số điện thoại hoặc ID SocCo"></label><button class="fd-primary fd-add-new">Kết bạn mới</button></section>
      <section class="fd-card fd-list-card"><div class="fd-list-header"><h2>Tất cả bạn bè</h2></div>
      <div class="fd-filters"><button>A – Z</button><button>Đang online</button><button>Yêu thích</button></div>
      <div class="fd-person-list">${Array(18).fill(person).join('')}</div></section>
    </div>
    <section class="fd-card fd-profile-panel"><div class="fd-profile-cover"></div><div class="fd-profile-core"><h2>Thông tin bạn bè</h2></div><div style="height:650px">Chi tiết</div></section>
  </div></div>`
const invitations = `<div class="friends-design-v2"><div class="fd-invitation-layout">
  <div class="fd-invitation-main">
    <div class="fd-invitation-tabs"><button class="fd-back">←</button>
    <div role="tablist"><button role="tab">Lời mời đến</button><button role="tab">Đã gửi</button><button role="tab">Quét QR</button></div>
    <small>5 lời mời đến · 2 đã gửi</small></div>
    <section class="fd-card fd-invitation-list"><div class="fd-invitation-heading"><h2>Lời mời đến</h2></div>
    ${Array(8).fill(request).join('')}</section>
  </div>
  <aside class="fd-card fd-qr-panel"><h2>Kết bạn bằng QR</h2><div class="fd-qr-preview">QR</div></aside>
</div></div>`
const rect = el => {const r=el.getBoundingClientRect();return {x:r.x,top:r.top,right:r.right,bottom:r.bottom,width:r.width}}
const browser = await chromium.launch({headless:true})
try {
  for(const width of [360,390,768,980,1180,1440]){
    const page=await browser.newPage({viewport:{width,height:900}})
    await page.setContent('<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0">'+directory+'</body></html>')
    await page.addStyleTag({content:css})
    const dir=await page.evaluate(()=>{
      const r=sel=>{const x=document.querySelector(sel).getBoundingClientRect();return {x:x.x,top:x.top,right:x.right,bottom:x.bottom,width:x.width}}
      return {scroll:document.documentElement.scrollWidth,search:r('.fd-searchbar'),list:r('.fd-list-card'),panel:r('.fd-profile-panel'),main:r('.fd-directory-main'),display:getComputedStyle(document.querySelector('.fd-profile-panel')).display}
    })
    assert.ok(dir.scroll<=width+1,`Directory horizontal overflow at ${width}: ${dir.scroll}`)
    assert.ok(Math.abs(dir.search.width-dir.list.width)<=1,`Directory search and list differ at ${width}`)
    if(width>760){
      assert.ok(Math.abs(dir.search.top-dir.panel.top)<=1,`Directory profile panel not raised at ${width}`)
      assert.ok(dir.panel.x>=dir.list.right-1,`Directory columns overlap at ${width}`)
    }else assert.equal(dir.display,'none',`Directory mobile profile modal layout broken at ${width}`)

    await page.setContent('<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0">'+invitations+'</body></html>')
    await page.addStyleTag({content:css})
    const inv=await page.evaluate(()=>{
      const r=sel=>{const x=document.querySelector(sel).getBoundingClientRect();return {x:x.x,top:x.top,right:x.right,bottom:x.bottom,width:x.width}}
      return {scroll:document.documentElement.scrollWidth,tabs:r('.fd-invitation-tabs'),list:r('.fd-invitation-list'),qr:r('.fd-qr-panel'),main:r('.fd-invitation-main'),tabScroll:document.querySelector('.fd-invitation-tabs').scrollWidth,tabWidth:document.querySelector('.fd-invitation-tabs').clientWidth}
    })
    assert.ok(inv.scroll<=width+1,`Invitations horizontal overflow at ${width}: ${inv.scroll}`)
    assert.ok(Math.abs(inv.tabs.width-inv.list.width)<=1,`Invitation tabs and list differ at ${width}`)
    assert.ok(inv.tabScroll<=inv.tabWidth+1,`Invitation tabs overflow at ${width}: ${inv.tabScroll} > ${inv.tabWidth}`)
    if(width>760){
      assert.ok(Math.abs(inv.tabs.top-inv.qr.top)<=1,`QR panel not raised at ${width}`)
      assert.ok(inv.qr.x>=inv.list.right-1,`Invitation columns overlap at ${width}`)
    }else assert.ok(inv.qr.top>=inv.main.bottom-1,`Mobile QR must follow invitations at ${width}`)
    console.log(`PASS ${width}px: directory search/list and invitation tabs/list align, detail panels responsive`)
    await page.close()
  }
} finally{await browser.close()}
