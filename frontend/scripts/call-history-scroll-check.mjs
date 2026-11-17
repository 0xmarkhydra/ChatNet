import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { chromium } from 'playwright'

const css = readFileSync(new URL('../src/features/calls/styles/call-center.css', import.meta.url), 'utf8')
const historyRows = Array.from({ length: 45 }, (_, i) =>
  `<button class="call-history-item">Cuộc gọi ${i + 1}</button>`).join('')
const detailRows = Array.from({ length: 45 }, (_, i) =>
  `<div><dt>Mục ${i + 1}</dt><dd>Thông tin cuộc gọi</dd></div>`).join('')
const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">
  <style>html,body{height:100%;margin:0}</style></head><body>
  <div class="call-center"><div class="call-center-workspace">
    <header class="call-center-header"><div class="call-center-heading"><h1>Lịch sử cuộc gọi</h1></div></header>
    <main class="call-center-content call-center-history">
      <section class="call-center-stats"><div><strong>45</strong><span>Cuộc gọi</span></div></section>
      <div class="call-center-filters"><button>Gọi nhỡ</button></div>
      <div class="call-history-layout">
        <section class="call-history-list call-center-card"><h2>Cuộc gọi gần đây</h2>${historyRows}</section>
        <aside class="call-history-details call-center-card is-open">
          <div class="call-detail-heading"><h2>Chi tiết cuộc gọi</h2></div>
          <div class="call-detail-body"><dl>${detailRows}</dl></div>
        </aside>
      </div>
    </main>
  </div></div></body></html>`

const browser = await chromium.launch({ headless: true })
try {
  for (const [width, height] of [[1440, 900], [900, 800], [390, 844]]) {
    const page = await browser.newPage({ viewport: { width, height } })
    await page.setContent(html)
    await page.addStyleTag({ content: css })
    const details = page.locator('.call-history-details')
    const list = page.locator('.call-history-list')
    const initial = await page.evaluate(() => {
      const panel = document.querySelector('.call-history-details')
      const list = document.querySelector('.call-history-list')
      const root = document.querySelector('.call-center-history')
      return {
        detailsOverflow: getComputedStyle(panel).overflowY,
        listOverflow: getComputedStyle(list).overflowY,
        detailsHeight: panel.clientHeight,
        detailsScrollHeight: panel.scrollHeight,
        listHeight: list.clientHeight,
        listScrollHeight: list.scrollHeight,
        contentScrollTop: root.scrollTop,
        detailsBottom: panel.getBoundingClientRect().bottom,
      }
    })
    assert.equal(initial.detailsOverflow, 'auto', `detail scrolling missing at ${width}`)
    assert.ok(initial.detailsScrollHeight > initial.detailsHeight, `detail not independently scrollable at ${width}`)
    assert.ok(initial.detailsBottom <= height + 1, `detail extends beyond viewport at ${width}`)
    await details.hover()
    await page.mouse.wheel(0, 500)
    await page.waitForTimeout(75)
    const detailTop = await details.evaluate((panel) => panel.scrollTop)
    assert.ok(detailTop > 0, `wheel did not scroll details at ${width}`)
    assert.equal(await page.evaluate(() => window.scrollY), 0, `window scrolled with details at ${width}`)
    assert.equal(await page.locator('.call-center-history').evaluate((el) => el.scrollTop), initial.contentScrollTop,
      `history container scrolled with details at ${width}`)
    if (width > 760) {
      assert.equal(initial.listOverflow, 'auto', `list scrolling missing at ${width}`)
      assert.ok(initial.listScrollHeight > initial.listHeight, `list does not overflow at ${width}`)
      await list.hover()
      await page.mouse.wheel(0, 500)
      await page.waitForTimeout(75)
      assert.ok(await list.evaluate((el) => el.scrollTop) > 0, `list did not scroll at ${width}`)
      assert.equal(await details.evaluate((panel) => panel.scrollTop), detailTop,
        `list scrolling moved details at ${width}`)
    }
    console.log(`PASS ${width}x${height}: details scroll independently of list and window`)
    await page.close()
  }
} finally {
  await browser.close()
}
