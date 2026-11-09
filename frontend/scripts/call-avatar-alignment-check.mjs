import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { chromium } from 'playwright'

const read = (file) => readFileSync(new URL(file, import.meta.url), 'utf8')
const styles = [
  read('../src/styles/styles.css'),
  read('../src/styles/zalo-inspired.css'),
  read('../src/features/calls/call-center.css'),
].join('\n')
const browser = await chromium.launch({ headless: true })
try {
  for (const width of [320, 390, 768, 1280]) {
    const page = await browser.newPage({ viewport: { width, height: 850 } })
    await page.setContent(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0">
      <div class="call-center"><main class="call-center-workspace"><div class="call-center-content">
        <div class="call-history-list call-center-card">
          <button class="call-history-item"><div class="call-history-avatar smart-avatar"><span class="avatar-initials">AB</span></div>
            <span class="call-history-main"><strong>Người dùng tên rất dài để kiểm tra responsive trong danh sách lịch sử cuộc gọi</strong><small>Cuộc gọi gần nhất</small></span></button>
        </div>
        <div class="call-detail-body"><div class="call-detail-avatar smart-avatar"><span class="avatar-initials">CD</span></div></div>
        <section class="call-people-list call-center-card"><div class="call-person-row"><div class="call-history-avatar smart-avatar group"><span class="avatar-initials">👥</span></div><div><strong>Nhóm kiểm thử</strong></div></div></section>
      </div></main></div></body></html>`)
    await page.addStyleTag({content:styles})
    const actual = await page.evaluate(() => {
      const selectors = ['.call-history-item .call-history-avatar', '.call-detail-avatar', '.call-person-row .call-history-avatar']
      return selectors.map(selector => {
        const avatar = document.querySelector(selector)
        const initials = avatar.querySelector('.avatar-initials')
        const a = avatar.getBoundingClientRect()
        const b = initials.getBoundingClientRect()
        const style = getComputedStyle(avatar)
        const inner = getComputedStyle(initials)
        return {
          avatarDisplay: style.display,
          initialsDisplay: inner.display,
          centerX: Math.abs((a.left + a.width / 2) - (b.left + b.width / 2)),
          centerY: Math.abs((a.top + a.height / 2) - (b.top + b.height / 2)),
          width: a.width,
          height: a.height,
        }
      })
    })
    for (const [index, data] of actual.entries()) {
      assert.equal(data.avatarDisplay, 'grid', `avatar ${index} not centered at ${width}px`)
      assert.equal(data.initialsDisplay, 'grid')
      assert.ok(data.centerX <= 1 && data.centerY <= 1, `avatar ${index} offset at ${width}px: ${JSON.stringify(data)}`)
      assert.equal(data.width, data.height, `avatar ${index} not circular`)
    }
    await page.close()
    console.log(`PASS avatar alignment ${width}px: history, details, group contact`)
  }
} finally {
  await browser.close()
}
