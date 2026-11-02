import assert from 'node:assert/strict'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import { chromium } from 'playwright'

// Actual React hook in Chromium with explicit API/native fixtures. Not live OS/API acceptance.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
let server, browser
try {
  server = await createServer({ root, mode: 'desktop', server: { host: '127.0.0.1', port: 0, strictPort: false }, logLevel: 'error' })
  await server.listen()
  const address = server.httpServer.address()
  assert.ok(address && typeof address === 'object')
  browser = await chromium.launch()
  const page = await browser.newPage()
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto(`http://127.0.0.1:${address.port}/scripts/fixtures/desktop-notifications.html`)
  await page.waitForFunction(() => window.qa?.syncs.at(-1)?.unreadCount === 12)
  await page.getByRole('button', { name: 'Disable', exact: true }).click()
  await page.waitForFunction(() => window.qa.syncs.at(-1)?.enabled === false)
  await page.getByRole('button', { name: 'Enable', exact: true }).click()

  await page.evaluate(() => window.qa.click({ sessionId: 'wrong-session' }))
  assert.equal(await page.evaluate(() => window.qa.checks), 0)
  await page.evaluate(() => { window.qa.check = false; window.qa.click() })
  await page.waitForFunction(() => window.qa.checks === 1)
  assert.deepEqual(await page.evaluate(() => window.qa.opened), [])
  assert.equal(await page.evaluate(() => window.qa.paths.some(path => path.includes('?limit=1&id='))), false)

  await page.evaluate(() => { window.qa.check = true; window.qa.allowed = false; window.qa.click() })
  await page.waitForFunction(() => window.qa.errors.length === 1)
  assert.deepEqual(await page.evaluate(() => window.qa.opened), [])
  await page.evaluate(() => { window.qa.allowed = true; window.qa.click() })
  await page.waitForFunction(() => window.qa.opened.length === 1)
  assert.deepEqual(await page.evaluate(() => window.qa.opened), [91])

  await page.evaluate(() => { window.qa.status = 404; window.qa.refresh() })
  await page.waitForFunction(() => window.qa.syncs.at(-1)?.unreadCount === null)
  assert.match(await page.getByRole('status').textContent(), /Backend chưa hỗ trợ/)

  await page.evaluate(() => { window.qa.hold = true; window.qa.click() })
  await page.waitForFunction(() => typeof window.qa.release === 'function')
  await page.evaluate(() => {
    window.dispatchEvent(new Event('soco:notification-invalidated'))
    window.qa.release()
  })
  await page.waitForTimeout(100)
  assert.deepEqual(await page.evaluate(() => window.qa.opened), [91], 'privacy change must invalidate pending click')
  await page.evaluate(() => { window.qa.release = null; window.qa.click() })
  await page.waitForFunction(() => typeof window.qa.release === 'function')
  await page.evaluate(() => {
    window.qa.status = 200; window.qa.unread = 4
    window.qa.setSession({ ...window.qa.session, sessionId: 'b7ce5309-8fb5-4f57-861c-ef54c75db291', user: { ...window.qa.session.user, id: 9 } })
  })
  await page.waitForFunction(() => window.qa.syncs.at(-1)?.sessionId.startsWith('b7ce') && window.qa.syncs.at(-1)?.unreadCount === 4)
  await page.evaluate(() => window.qa.release())
  await page.waitForTimeout(100)
  assert.deepEqual(await page.evaluate(() => window.qa.opened), [91], 'late result must not open another account conversation')
  assert.equal(await page.evaluate(() => window.qa.syncs.filter(s => s.sessionId.startsWith('b7ce')).some(s => s.unreadCount === 12)), false)
  assert.deepEqual(errors, [])
  console.log('PASS: Desktop notification React contract fixtures — scoped badge/settings, missing backend, revoked/foreign click, membership denial and stale account race. Live OS/backend delivery NOT RUN.')
} finally {
  await browser?.close()
  await server?.close()
}
