import assert from 'node:assert/strict'
import { chromium } from 'playwright'
import { createServer } from 'vite'

const server = await createServer({ server: { host: '127.0.0.1', port: 0 } })
let browser
try {
  await server.listen()
  browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  const url = `http://127.0.0.1:${server.httpServer.address().port}`
  for (const width of [390, 768, 1024, 1440, 1920]) {
    await page.setViewportSize({ width, height: 800 })
    await page.goto(url)
    for (const tab of ['Đăng ký', 'Đăng nhập']) {
      await page.getByRole('button', { name: tab, exact: true }).first().click()
      const box = await page.locator('.auth-card').boundingBox()
      assert.ok(box && box.width <= 480, `${width}px ${tab}: form width ${box?.width}`)
      assert.ok(box.x >= 0 && box.x + box.width <= width, `${width}px ${tab}: form outside viewport`)
      assert.ok(Math.abs(box.x + box.width / 2 - width / 2) < 2, `${width}px ${tab}: form not centered`)
      const copy = await page.locator('.auth-copy').boundingBox()
      assert.ok(copy && Math.abs(copy.x + copy.width / 2 - width / 2) < 2, `${width}px ${tab}: copy not centered`)
      for (const selector of ['.auth-copy h1', '.auth-copy p']) {
        const heading = await page.locator(selector).boundingBox()
        assert.ok(heading && Math.abs(heading.x + heading.width / 2 - width / 2) < 2, `${width}px ${tab}: ${selector} not centered`)
      }
    }
  }
  console.log('PASS: auth form width and alignment')
} finally {
  await browser?.close()
  await server.close()
}
