import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

// Isolated layout test of the *real* mobile CSS rules. No account or backend
// is required; browser geometry verifies inner scroll instead of page scroll.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'src')
const readCss = path => readFileSync(resolve(root, path), 'utf8')
const css = [
  readCss('styles/bottom-nav-glass.css'),
  readCss('styles/mobile-shared-header.css'),
  readCss('features/discover/styles/explore-page.css'),
].join('\n')
const browser = await chromium.launch({ headless: true })
try {
  for (const width of [320, 375, 430]) {
    const page = await browser.newPage({ viewport: { width, height: 760 }, isMobile: true, hasTouch: true })
    const cards = Array.from({ length: 9 }, (_, i) =>
      '<article class="explore-step">Mục khám phá ' + i + '</article>').join('')
    const tabs = Array.from({ length: 8 }, (_, i) =>
      '<button type="button">Danh mục ' + i + '</button>').join('')
    await page.setContent(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>
      *, *::before, *::after { box-sizing:border-box }
      html, body { margin:0; height:100%; overflow:hidden }
      .modern-shell.app-layout { display:flex; flex-direction:column; height:100dvh; overflow:hidden }
      .modern-shell.app-layout > .chatnet-appbar { height:52px; flex:0 0 auto; background:white }
      .modern-shell.app-layout > .mobile-search-dock { height:60px; flex:0 0 auto; background:white }
      .modern-shell.app-layout > .modern-frame { flex:1 1 auto; min-height:0; width:100%; }
      ${css}
      </style></head><body>
      <main class="modern-shell app-layout">
        <header class="chatnet-appbar app-unified-header"><span class="appbar-brand">SocCO</span></header>
        <div class="mobile-search-dock"><input aria-label="Tìm kiếm" /></div>
        <section class="modern-frame" data-route-page="discover">
          <div class="explore-shell">
            <nav class="explore-tabs" aria-label="Danh mục khám phá">${tabs}</nav>
            <main class="explore-page">
              <div class="explore-content-layout explore-content-layout-single">
                <div class="explore-main-column">${cards}</div>
              </div>
            </main>
          </div>
        </section>
        <nav class="bottom-navigation"><button>Chat</button></nav>
      </main>
      </body></html>`)
    const start = await page.evaluate(() => {
      const content = document.querySelector('.explore-page')
      const frame = document.querySelector('.modern-frame')
      return {
        overflow: getComputedStyle(content).overflowY,
        client: content.clientHeight,
        scroll: content.scrollHeight,
        padding: getComputedStyle(frame).paddingBottom,
        headerY: document.querySelector('.chatnet-appbar').getBoundingClientRect().top,
        dockY: document.querySelector('.mobile-search-dock').getBoundingClientRect().top,
        navY: document.querySelector('.bottom-navigation').getBoundingClientRect().top,
      }
    })
    assert.equal(start.overflow, 'auto', width + ': Explore content must scroll vertically')
    assert.ok(start.scroll > start.client, width + ': content should exceed its viewport')
    assert.equal(start.padding, '0px', width + ': no blank frame gap behind footer')
    const after = await page.evaluate(() => {
      const content = document.querySelector('.explore-page')
      content.scrollTop = 180
      const tabs = document.querySelector('.explore-tabs')
      tabs.scrollLeft = 120
      return {
        top: content.scrollTop,
        documentTop: document.documentElement.scrollTop,
        headerY: document.querySelector('.chatnet-appbar').getBoundingClientRect().top,
        dockY: document.querySelector('.mobile-search-dock').getBoundingClientRect().top,
        navY: document.querySelector('.bottom-navigation').getBoundingClientRect().top,
        tabsScrollLeft: tabs.scrollLeft,
        tabsPosition: getComputedStyle(tabs).position,
        tabsTop: tabs.getBoundingClientRect().top,
        tabsBottom: tabs.getBoundingClientRect().bottom,
        frameTop: document.querySelector('.modern-frame').getBoundingClientRect().top,
        dockBottom: document.querySelector('.mobile-search-dock').getBoundingClientRect().bottom,
        tabsClickable: (() => {
          const rect = tabs.getBoundingClientRect()
          const hit = document.elementFromPoint(rect.left + 20, rect.top + 20)
          return hit === tabs || tabs.contains(hit)
        })(),
      }
    })
    assert.equal(after.tabsPosition, 'relative', width + ': category navigation must be in its own fixed flex row')
    assert.ok(after.tabsTop >= after.frameTop - 1 && after.tabsTop >= after.dockBottom - 1, width + ': tabs cannot be covered by the header/search dock')
    assert.ok(after.tabsClickable, width + ': tabs should be visible and clickable after scrolling')
    assert.ok(after.top > 60, width + ': touch viewport can scroll')
    assert.equal(after.documentTop, 0, width + ': document remains stationary')
    assert.equal(after.headerY, start.headerY, width + ': header not pulled with content')
    assert.equal(after.dockY, start.dockY, width + ': search not pulled with content')
    assert.equal(after.navY, start.navY, width + ': footer not pulled with content')
    assert.ok(after.tabsScrollLeft > 0, width + ': horizontal tabs remain independently scrollable')
    const collapsed = await page.evaluate(() => {
      const shell = document.querySelector('.modern-shell')
      const content = document.querySelector('.explore-page')
      const tabs = document.querySelector('.explore-tabs')
      content.scrollTop = content.scrollHeight
      shell.classList.add('mobile-chrome-hidden')
      const bounds = tabs.getBoundingClientRect()
      const hit = document.elementFromPoint(bounds.left + 22, bounds.top + 22)
      return {
        scrollTop: content.scrollTop,
        tabsTop: bounds.top,
        frameTop: document.querySelector('.modern-frame').getBoundingClientRect().top,
        clickable: hit === tabs || tabs.contains(hit),
      }
    })
    assert.ok(collapsed.scrollTop > 100, width + ': content scrolls to its end')
    assert.ok(collapsed.tabsTop >= collapsed.frameTop - 1, width + ': tabs remain above scrolling content at the end')
    assert.ok(collapsed.clickable, width + ': tabs remain clickable when header/footer are hidden')
    console.log('PASS ' + width + 'px Explore: vertical scroll, horizontal tabs, stable chrome, no footer gap')
    await page.close()
  }
} finally {
  await browser.close()
}
