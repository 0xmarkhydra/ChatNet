import assert from 'node:assert/strict'
import { access } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { resolve, dirname } from 'node:path'
import { _electron } from 'playwright'

const scriptsDir = dirname(fileURLToPath(import.meta.url))
const executablePath = resolve(scriptsDir, '../../desktop/release/mac-arm64/SOCO.app/Contents/MacOS/SOCO')
await access(executablePath)
let app
try {
  app = await _electron.launch({ executablePath, timeout: 30_000 })
  const page = await app.firstWindow({ timeout: 25_000 })
  await page.waitForLoadState('domcontentloaded')
  await page.locator('#root').waitFor({ timeout: 20_000 })
  await page.waitForFunction(() => document.getElementById('root')?.textContent?.trim().length > 20, { timeout: 20_000 })
  const result = await page.evaluate(async () => ({
    href: location.href,
    origin: location.origin,
    title: document.title,
    platform: await window.socoDesktop?.getPlatformInfo(),
    shell: document.documentElement.dataset.desktopShell,
    hasNode: typeof window.require === 'function',
    rejectedExternal: await window.socoDesktop?.openExternal('javascript:alert(1)'),
  }))
  assert.equal(new URL(result.href).protocol, 'app:')
  assert.equal(result.origin, 'app://soco')
  assert.equal(result.platform?.platform, 'darwin')
  assert.equal(result.platform?.packaged, true)
  assert.equal(result.shell, 'ready')
  assert.equal(result.hasNode, false)
  assert.equal(result.rejectedExternal, false)
  assert.match(result.title, /SOCO/)
  console.log('PASS: packaged macOS SOCO Electron window, preload IPC, sandbox boundary, internal app://')
} finally {
  await app?.close()
}