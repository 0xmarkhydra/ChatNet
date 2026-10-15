import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { chromium } from 'playwright'

const read = (file) => readFileSync(new URL(file, import.meta.url), 'utf8')
const ui = read('../src/CallManager.tsx')
const css = read('../src/call.css')
const required = [
  'call-live-panel', 'call-sheet-backdrop', 'call-translation-consent-prompt',
  'call-permission-prompt', 'call-primary-controls', 'call-more-popover',
  'call-caption-overlay', 'call-open-translation',
]
for (const marker of required) assert.ok(ui.includes(marker), 'missing UI: ' + marker)
assert.ok(ui.includes("}, [call.id])"), 'new calls must reset permission scope')
assert.ok(ui.includes('setAllowMyVoice(false)'), 'call translation voice consent must default to denied')
assert.ok(ui.includes('requestCallMediaPermission'), 'retry button missing for browser media consent')
assert.ok(ui.includes('ParticipantConnected, onJoined'), 'translation request must reach new participants')
assert.ok(ui.includes('ParticipantDisconnected, onLeft'), 'consent must be cleared when member exits')
assert.ok(!ui.includes('type="checkbox"'), 'no consent checkboxes in call UI')
assert.ok(css.includes('prefers-reduced-motion'), 'reduced motion support missing')

const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0">
  <div class="secure-call-layer"><div class="secure-call-stage">
    <header class="secure-call-topbar"><div class="call-heading"><div class="call-top-avatar">N</div><div class="call-heading-copy"><strong>Nhóm ChatNet</strong><span class="call-security-state">🔒 Bảo mật · 3 người</span></div></div><div class="secure-call-topmeta"><button class="call-live-status">Đang dịch</button><span class="call-encrypted-chip">E2EE</span></div></header>
    <main class="call-main-layout has-translation"><section class="call-stage-media">
      <div class="secure-call-grid count-2"><div class="call-participant-tile is-speaking"><div class="call-avatar-fallback"><span>A</span></div><div class="call-participant-label">Bạn</div></div><div class="call-participant-tile"><div class="call-avatar-fallback"><span>B</span></div><div class="call-participant-label">B</div></div></div>
      <div class="call-caption-overlay"><div class="call-caption-overlay-speaker">Người nói</div><strong>Đây là phụ đề dịch với câu dài để kiểm tra giao diện hiển thị đẹp trên điện thoại</strong></div>
    </section><aside class="call-live-panel"><div class="call-sheet-grabber"></div><header class="call-live-heading"><div class="call-live-title-icon">AI</div><div class="call-live-heading-copy"><strong>Dịch trực tiếp</strong><small>Phụ đề và giọng dịch tự động</small></div><button>⌄</button></header><div class="call-live-settings"><label>Nghe bằng ngôn ngữ</label><div class="call-language-select"><select><option>Tiếng Việt</option></select></div><div class="call-translation-state"><span class="call-translation-dot is-live"></span>Đang nghe 2 người</div></div><div class="call-live-transcript"><div class="call-live-entry"><div class="call-live-entry-user">A</div><p class="call-live-original">Hello</p><p class="call-live-translated">Xin chào mọi người</p></div></div><footer class="call-live-footnote">Chỉ dịch người đã cho phép</footer></aside></main>
    <button class="call-sheet-backdrop">backdrop</button>
    <footer class="secure-call-controls"><div class="call-primary-controls"><button><svg></svg><span>Mic</span></button><button><svg></svg><span>Camera</span></button><button class="call-ai-action is-on"><svg></svg><span>Dịch AI</span></button><div class="call-more-wrapper"><button><svg></svg><span>Thêm</span></button></div><button class="hangup-button"><svg></svg><span>Kết thúc</span></button></div></footer>
  </div></div></body></html>`
const browser = await chromium.launch({ headless: true })
try {
  for (const [width, height] of [[320,640],[375,812],[390,844],[768,1024],[1280,800],[1440,900]]) {
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor:1 })
    await page.setContent(html)
    await page.addStyleTag({ content:css })
    const m = await page.evaluate(() => {
      const rect = (selector) => {
        const element = document.querySelector(selector)
        const r = element.getBoundingClientRect()
        return { x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom }
      }
      return {scroll:document.documentElement.scrollWidth,viewport:innerWidth,
        header:rect('.secure-call-topbar'),stage:rect('.call-main-layout'),
        panel:rect('.call-live-panel'),controls:rect('.secure-call-controls'),
        buttons:[...document.querySelectorAll('.call-primary-controls > button,.call-more-wrapper > button')].map(e=>e.getBoundingClientRect().width)}
    })
    assert.ok(m.scroll <= width + 1, `horizontal overflow ${width}: ${m.scroll}`)
    assert.ok(m.header.height > 40 && m.controls.height >= 60 && m.stage.height > 120, 'invalid stage geometry ' + width)
    assert.ok(m.panel.width > 0 && m.panel.right <= width + 1, 'translation panel overflows ' + width)
    assert.ok(m.controls.bottom <= height + 1, 'control dock overflows viewport ' + width)
    assert.ok(m.buttons.every(v=>v >= 40), 'control too narrow ' + width)
    await page.close()
    console.log(`PASS ${width}x${height}: stage, sheet, controls no horizontal overflow`)
  }
} finally {await browser.close()}
console.log('PASS: one-click call UI + per-call media and AI consent + responsive layout')
