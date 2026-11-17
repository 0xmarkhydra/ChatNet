import assert from 'node:assert/strict'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import { chromium } from 'playwright'

// Real sidebar, synthetic bridge. No OS clipboard or screen is read.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
let server, browser
try {
  server = await createServer({ root, mode: 'desktop', server: { host: '127.0.0.1', port: 43173, strictPort: false }, logLevel: 'error' })
  await server.listen()
  const address = server.httpServer.address()
  assert.ok(address && typeof address === 'object')
  for (const channel of [undefined, 'msedge', 'chrome']) {
    try { browser = await chromium.launch(channel ? { channel } : {}); break }
    catch (error) { if (!/doesn't exist|not found|Executable/.test(String(error))) throw error }
  }
  assert.ok(browser, 'No Chromium, Edge or Chrome available for Playwright')
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.route('**/api/**', route => {
    const url = new URL(route.request().url())
    if (url.pathname === '/api/users/tester/avatar') {
      return route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"/>' })
    }
    return ['fetch', 'xhr'].includes(route.request().resourceType()) ? route.abort() : route.continue()
  })
  page.on('console', event => { if (event.type() === 'error') errors.push(event.text()) })
  page.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`) })
  await page.goto('http://127.0.0.1:' + address.port + '/scripts/fixtures/desktop-screenshot-navigation.html')

  const rail = page.getByRole('navigation', { name: 'Các khu vực' })
  const utilities = page.getByRole('group', { name: 'Tiện ích', exact: true })
  const capture = utilities.getByRole('button', { name: 'Chụp màn hình không kèm cửa sổ SocCO', exact: true })
  await capture.waitFor({ timeout: 15000 })
  for (const label of ['Thông báo', 'Đã lưu', 'Cài đặt']) {
    assert.equal(await utilities.getByRole('button', { name: label, exact: true }).isVisible(), true)
  }
  assert.equal(await rail.getByRole('button', { name: 'Chụp màn hình không kèm cửa sổ SocCO', exact: true }).count(), 0)
  assert.equal(await rail.getByRole('button', { name: 'Bảng tin' }).getAttribute('aria-current'), 'page')
  assert.equal(await capture.getAttribute('aria-current'), null)
  assert.match(await capture.getAttribute('title'), /Ctrl\+Alt\+A/)
  await capture.click()
  await page.waitForFunction(() => window.qa.notices.length === 1)
  assert.deepEqual(await page.evaluate(() => window.qa.calls), ['exclude'])
  assert.match(await page.evaluate(() => window.qa.notices[0].message), /Ctrl\+V/)
  assert.deepEqual(await page.evaluate(() => window.qa.navigations), [])

  await page.evaluate(() => { window.qa.hold = true })
  await capture.click()
  await page.waitForFunction(() => typeof window.qa.release === 'function')
  assert.equal(await capture.isDisabled(), true)
  await page.evaluate(() => window.qa.release(null))
  await page.waitForFunction(() => !document.querySelector('button[aria-keyshortcuts]').disabled)
  assert.equal(await page.evaluate(() => window.qa.notices.length), 1)

  await page.evaluate(() => { window.qa.hold = false; window.qa.shortcut('include') })
  await page.waitForFunction(() => window.qa.notices.length === 2)
  assert.deepEqual(await page.evaluate(() => window.qa.calls), ['exclude', 'exclude', 'include'])
  assert.deepEqual(errors, [])
  console.log('PASS: sidebar capture works outside chat; exclude default, shortcut, cancellation and navigation verified')
} finally {
  await browser?.close()
  await server?.close()
}
