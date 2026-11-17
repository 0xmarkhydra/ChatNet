import assert from 'node:assert/strict'
import { access, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { _electron } from 'playwright'

// Anonymous packaged Windows fixture. Never invokes OS capture with an authenticated session.
assert.equal(process.platform, 'win32', 'Run this packaged smoke on Windows')
const executablePath = process.env.SOCO_TEST_EXECUTABLE
  || fileURLToPath(new URL('../../desktop/release/win-unpacked/SocCO.exe', import.meta.url))
await access(executablePath)
const profile = await mkdtemp(join(tmpdir(), 'soco-screenshot-shell-'))
let application
try {
  application = await _electron.launch({ executablePath, args: ['--user-data-dir=' + profile], timeout: 60_000 })
  const shell = await application.evaluate(({ app }) => ({ profile: app.getPath('userData'), packaged: app.isPackaged }))
  assert.equal(resolve(shell.profile), resolve(profile), 'This fixture must not touch the normal application profile')
  assert.equal(shell.packaged, true)
  const page = await application.firstWindow()
  await page.waitForFunction(() => document.documentElement.dataset.desktopShell === 'ready')
  const result = await page.evaluate(async () => {
    const bridge = window.socoDesktop.screenshot
    if (!bridge) return { available: false }
    function attempt(mode) {
      return Promise.resolve().then(() => bridge.capture(mode)).then(
        () => 'Unexpected success',
        error => error?.message ?? String(error),
      )
    }
    const unsubscribe = bridge.onShortcut(() => {})
    unsubscribe()
    return { available: true, invalid: await attempt('unexpected-mode'), unauthenticated: await attempt('include') }
  })
  assert.equal(result.available, true, 'The Windows artifact must contain the screenshot preload bridge')
  assert.match(result.invalid, /SCREENSHOT_INVALID_MODE/)
  assert.match(result.unauthenticated, /SCREENSHOT_INACTIVE_WINDOW/)
  const urls = await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().map(window => window.webContents.getURL()))
  assert.equal(urls.length, 1, 'Invalid and unauthenticated requests must not create a capture overlay')
  console.log('PASS: packaged Windows screenshot bridge loaded, rejects invalid and anonymous requests, never opens selection UI')
} finally {
  await application?.close()
  await rm(profile, { force: true, recursive: true, maxRetries: 3, retryDelay: 150 })
}
