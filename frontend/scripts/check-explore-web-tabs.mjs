import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { chromium } from 'playwright'
const css = readFileSync(new URL('../src/features/discover/styles/explore-page.css', import.meta.url), 'utf8')
const browser = await chromium.launch({headless:true})
try {
  for (const width of [1024, 1440]) {
    const page = await browser.newPage({viewport:{width,height:760}})
    const tabs = Array.from({length:9}, (_,i) => '<button>Danh mục '+i+'</button>').join('')
    const content = Array.from({length:18},(_,i) => '<article class="explore-step">Mục '+i+'</article>').join('')
    await page.setContent(`<style>*,*:before,*:after{box-sizing:border-box}body{margin:0}.app-layout{display:flex;flex-direction:column;height:100vh;overflow:hidden}.chatnet-appbar{flex:0 0 64px;background:white}.modern-frame{display:flex;flex:1;min-height:0;overflow:hidden}${css}</style><main class="modern-shell app-layout"><header class="chatnet-appbar">SocCO</header><section class="modern-frame" data-route-page="discover"><div class="explore-shell"><nav class="explore-tabs" aria-label="Danh mục khám phá">${tabs}</nav><main class="explore-page"><div class="explore-content-layout"><div class="explore-main-column">${content}</div></div></main></div></section></main>`)
    const state = await page.evaluate(() => {
      const el = document.querySelector('.explore-page'), nav = document.querySelector('.explore-tabs')
      const scrollable = el.scrollHeight > el.clientHeight
      const horizontal = nav.scrollWidth > nav.clientWidth
      el.scrollTop=300;nav.scrollLeft=100
      const a=nav.getBoundingClientRect(), f=document.querySelector('.modern-frame').getBoundingClientRect()
      const h=document.querySelector('.chatnet-appbar').getBoundingClientRect()
      const hit=document.elementFromPoint(a.left+20,a.top+20)
      return {scrollable,horizontal,scrollTop:el.scrollTop,navTop:a.top,frameTop:f.top,headerBottom:h.bottom,hit:hit===nav||nav.contains(hit),tabScroll:nav.scrollLeft,position:getComputedStyle(nav).position}
    })
    assert.ok(state.scrollable && state.scrollTop>100,width+' content scrolls')
    assert.equal(state.position,'relative')
    assert.ok(state.navTop>=state.frameTop-1 && state.navTop>=state.headerBottom-1,width+' tabs not hidden')
    assert.ok(state.hit,width+' tabs clickable')
    assert.ok(!state.horizontal || state.tabScroll>0,width+' horizontal scroll works when tabs overflow')
    console.log('PASS desktop '+width+'px: Explore tabs visible, clickable and scrollable')
    await page.close()
  }
} finally {await browser.close()}
