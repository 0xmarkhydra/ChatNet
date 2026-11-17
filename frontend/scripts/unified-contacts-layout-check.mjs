import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { chromium } from 'playwright'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const callSource = read('../src/features/calls/components/CallCenter.tsx')
const overviewSource = read('../src/features/contacts/components/ContactsOverview.tsx')
const callCss = read('../src/features/calls/styles/call-center.css')
const overviewCss = read('../src/features/contacts/styles/contacts-overview.css')

const callLeft = callSource.indexOf('className="call-history-main-column"')
const callStats = callSource.indexOf('className="call-center-stats"', callLeft)
const callList = callSource.indexOf('className="call-history-list call-center-card"', callStats)
const callDetail = callSource.indexOf("className={'call-history-details call-center-card'", callList)
assert.ok(callLeft >= 0 && callStats > callLeft && callList > callStats && callDetail > callList, 'Calls: left stats/list and right detail structure')

const overviewLayout = overviewSource.indexOf('className="co-layout"')
const overviewLeft = overviewSource.indexOf('className="co-main"', overviewLayout)
const overviewStats = overviewSource.indexOf('className="co-stats"', overviewLeft)
const overviewRequest = overviewSource.indexOf('className="co-request-card"', overviewStats)
const overviewRight = overviewSource.indexOf('className="co-side"', overviewRequest)
assert.ok(overviewLayout >= 0 && overviewLeft > overviewLayout && overviewStats > overviewLeft && overviewRequest > overviewStats && overviewRight > overviewRequest, 'Discover friends: left stats/request and right QR structure')

const callHtml = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0">
<div class="call-center" style="height:820px"><div class="call-center-workspace">
<main class="call-center-content call-center-history">
<div class="call-history-layout">
  <div class="call-history-main-column">
    <section class="call-center-stats"><div><strong>18</strong><span>Cuộc gọi tháng này</span></div><div><strong>3</strong><span>Cuộc gọi nhỡ</span></div><div><strong>00:14</strong><span>Gần nhất</span></div></section>
    <div class="call-center-filters"><button>Tất cả</button><button>Gọi nhỡ</button><button>Đã gọi</button></div>
    <section class="call-history-list call-center-card"><h2>Cuộc gọi gần đây</h2><div style="height:1450px">Danh sách nhiều cuộc gọi</div></section>
  </div>
  <aside class="call-history-details call-center-card"><h2>Chi tiết cuộc gọi</h2><div style="height:1400px">Chi tiết dài</div></aside>
</div></main></div></div></body></html>`

const overviewHtml = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0">
<div class="contacts-overview" style="height:820px"><div class="co-layout">
  <div class="co-main">
    <section class="co-stats">
      <button class="co-stat"><span class="co-stat-icon">☺</span><span><strong>25</strong><small>Bạn bè</small></span></button>
      <button class="co-stat"><span class="co-stat-icon">+</span><span><strong>5</strong><small>Lời mời đến</small></span></button>
      <button class="co-stat"><span class="co-stat-icon">✦</span><span><strong>20</strong><small>Gợi ý kết nối hiện có</small></span></button>
    </section>
    <section class="co-section"><div class="co-section-heading"><h2>Lời mời kết bạn</h2></div><div class="co-request-card" style="min-height:220px">Lời mời</div></section>
    <section class="co-section"><div class="co-section-heading"><h2>Bạn bè có thể quen</h2></div><div class="co-request-card" style="min-height:250px">Gợi ý</div></section>
  </div>
  <aside class="co-side"><section class="co-qr-wrap" style="min-height:230px">Kết nối bằng QR</section><section class="co-privacy">Quyền riêng tư</section></aside>
</div></div></body></html>`

const browser = await chromium.launch({ headless: true })
try {
  for (const width of [390, 768, 980, 1180, 1440]) {
    const page = await browser.newPage({viewport:{width,height:900}})
    await page.emulateMedia({reducedMotion:'reduce'})
    await page.setContent(callHtml)
    await page.addStyleTag({content:callCss})
    const calls = await page.evaluate(() => {
      const r = selector => { const b = document.querySelector(selector).getBoundingClientRect(); return {x:b.x,top:b.top,width:b.width,right:b.right,bottom:b.bottom} }
      const list = document.querySelector('.call-history-list')
      const detail = document.querySelector('.call-history-details')
      return {scroll:document.documentElement.scrollWidth,stats:r('.call-center-stats'),list:r('.call-history-list'),details:r('.call-history-details'),listScroll:list.scrollHeight>list.clientHeight+1,detailScroll:detail.scrollHeight>detail.clientHeight+1,detailDisplay:getComputedStyle(detail).display}
    })
    assert.ok(calls.scroll <= width+1,`Call history overflow at ${width}`)
    assert.ok(Math.abs(calls.stats.width-calls.list.width)<=1,`Call stats not same width as recent calls at ${width}`)
    if(width>1000){
      assert.ok(Math.abs(calls.stats.top-calls.details.top)<=1,`Call detail must be raised to top at ${width}`)
      assert.ok(calls.details.x>=calls.list.right,`Call detail overlaps list at ${width}`)
      assert.ok(calls.listScroll&&calls.detailScroll,`Call list/detail must scroll independently at ${width}`)
    }
    if(width<=760) assert.equal(calls.detailDisplay,'none',`Mobile call detail must remain modal at ${width}`)
    await page.setContent(overviewHtml)
    await page.addStyleTag({content:overviewCss})
    const contacts = await page.evaluate(() => {
      const r = selector => {const b=document.querySelector(selector).getBoundingClientRect();return {x:b.x,top:b.top,width:b.width,right:b.right,bottom:b.bottom}}
      return {scroll:document.documentElement.scrollWidth,stats:r('.co-stats'),requests:r('.co-request-card'),right:r('.co-qr-wrap'),left:r('.co-main')}
    })
    assert.ok(contacts.scroll<=width+1,`Friends discovery overflow at ${width}`)
    assert.ok(Math.abs(contacts.stats.width-contacts.requests.width)<=1,`Friends stats and requests width must match at ${width}`)
    if(width>1080){
      assert.ok(Math.abs(contacts.stats.top-contacts.right.top)<=1,`Friend QR must begin at stats level at ${width}`)
      assert.ok(contacts.right.x>=contacts.requests.right,`Friend QR overlaps left column at ${width}`)
    }else{
      assert.ok(contacts.right.top>=contacts.left.bottom,`Friend QR must stack below left on small screens at ${width}`)
    }
    console.log(`PASS ${width}px: calls/history scroll and friend discovery layout`)
    await page.close()
  }
} finally{await browser.close()}
