import { chromium } from 'playwright'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const browser = await chromium.launch({ headless: true, channel: 'chrome' })
const cases = [[1600, 900], [1450, 650], [1200, 700], [1110, 600], [1050, 700], [390, 780]]
const markup = `
<style>
html,body{height:100%;margin:0}body{background:#101727}svg{width:21px;height:21px;flex:none}
</style>
<div class="story-screen-backdrop">
 <div class="story-screen">
  <div class="story-screen-topbar"><div class="story-screen-brand"><strong>SocCo</strong><span>Khoảnh khắc</span></div><button class="story-screen-close">Đóng</button></div>
  <aside class="story-screen-people"><header><h2>Khoảnh khắc mới</h2><p>2 người vừa đăng tin</p></header><div class="story-screen-people-list"></div></aside>
  <section class="story-screen-stage"><div class="story-screen-media"></div></section>
  <aside class="story-screen-insights" aria-label="Thông tin Story">
    <h2>Thông tin Story</h2>
    <p class="story-screen-expiry">Khả dụng trong 24 giờ</p>
    <div class="story-screen-insights-divider"></div>
    <p class="story-screen-action-label">Những hành động có thể làm</p>
    <div class="story-screen-actions">
      <button><svg></svg>Trả lời</button>
      <button><svg></svg>Xem hồ sơ</button>
      <button><svg></svg>Chia sẻ</button>
      <button><svg></svg>Báo cáo</button>
    </div>
    <div class="story-screen-privacy"><div><svg></svg><strong>Quyền xem tin</strong></div><p>Hiển thị theo quyền riêng tư của tác giả.</p></div>
  </aside>
 </div>
</div>`
try {
  for (const [width, height] of cases) {
    const page = await browser.newPage({ viewport: { width, height } })
    await page.setContent(markup)
    await page.addStyleTag({ path: resolve(root, 'src/features/feed/styles/story-viewer.css') })
    const result = await page.evaluate(() => {
      const panel = document.querySelector('.story-screen-insights')
      const privacy = document.querySelector('.story-screen-privacy')
      const panelRect = panel.getBoundingClientRect()
      const privacyRect = privacy.getBoundingClientRect()
      const css = getComputedStyle(panel)
      const visible = css.display !== 'none'
      panel.scrollTop = panel.scrollHeight
      const privacyAfterScroll = privacy.getBoundingClientRect()
      const reachable = !visible || privacyAfterScroll.bottom <= panelRect.bottom + 1
      return { visible, overflow: css.overflowY,
        panelHeight: Math.round(panelRect.height), contentHeight: panel.scrollHeight,
        scrollTop: panel.scrollTop,
        privacyTop: Math.round(privacyRect.top), privacyBottom: Math.round(privacyRect.bottom),
        panelBottom: Math.round(panelRect.bottom),
        clipped: visible && privacyRect.bottom > panelRect.bottom + 1,
        reachable, horizontalOverflow: visible && panel.scrollWidth > panel.clientWidth + 1 }
    })
    console.log(`${width}x${height}: ${JSON.stringify(result)}`)
    if (!result.reachable || result.horizontalOverflow) {
      throw new Error(`Story privacy is inaccessible at ${width}x${height}`)
    }
    await page.close()
  }
} finally {
  await browser.close()
}
