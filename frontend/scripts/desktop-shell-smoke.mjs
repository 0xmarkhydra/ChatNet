import assert from 'node:assert/strict'
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { resolve, dirname, join } from 'node:path'
import { _electron } from 'playwright'

// Native shell/OS storage smoke only. No accounts, mock login or live messaging are used.
const scriptsDir = dirname(fileURLToPath(import.meta.url))
const release = resolve(scriptsDir, '../../desktop/release')
const executablePath = process.env.SOCO_TEST_EXECUTABLE || (process.platform === 'darwin'
  ? join(release, process.arch === 'arm64' ? 'mac-arm64' : 'mac', 'SOCO.app/Contents/MacOS/SOCO')
  : join(release, 'win-unpacked/SOCO.exe'))
await access(executablePath)
const output = resolve(scriptsDir, '../output/desktop-smoke')
await mkdir(output, { recursive: true })
const profile = await mkdtemp(join(output, 'profile-'))
await mkdir(join(profile, 'settings'))
await writeFile(join(profile, 'settings/window.json'), JSON.stringify({ closeToTray: true }))
let application
let expectedBounds
const evidence = { platform: process.platform, arch: process.arch, checks: [], measurements: {} }
async function launch() {
  const start = performance.now()
  application = await _electron.launch({ executablePath, args: [`--user-data-dir=${profile}`], timeout: 60_000 })
  const info = await application.evaluate(({ app, BrowserWindow }) => ({
    profile: app.getPath('userData'), packaged: app.isPackaged,
    electron: process.versions.electron,
    prefs: (() => { const p = BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences(); return {
      sandbox: p.sandbox, contextIsolation: p.contextIsolation, nodeIntegration: p.nodeIntegration, webSecurity: p.webSecurity,
    } })(),
  }))
  assert.equal(resolve(info.profile), profile, 'QA must never touch the normal application profile')
  assert.equal(info.packaged, true)
  assert.deepEqual(info.prefs, { sandbox: true, contextIsolation: true, nodeIntegration: false, webSecurity: true })
  evidence.electron = info.electron
  const page = await application.firstWindow({ timeout: 30_000 })
  await page.waitForFunction(() => document.documentElement.dataset.desktopShell === 'ready')
  await page.locator('input[type="email"]').waitFor({ timeout: 30_000 })
  evidence.measurements.lastLaunchToLoginMs = Math.round(performance.now() - start)
  return page
}
try {
  let page = await launch()
  const state = await page.evaluate(async () => {
    const bridge = window.socoDesktop
    let invalidRejected = false, rendererAuthBlocked = false
    try { await bridge.auth.verifyEmail({ token: 'bad', code: '0' }) } catch { invalidRejected = true }
    try {
      await fetch('https://api-chat.codelocal.cloud/api/auth/refresh', { method: 'POST', body: '{}' })
    } catch { rendererAuthBlocked = true }
    return {
      href: location.href, origin: location.origin, title: document.title,
      node: typeof window.require, refresh: await bridge.auth.restore(),
      storedSession: localStorage.getItem('chatnet-session'),
      externalDenied: await bridge.openExternal('javascript:alert(1)'),
      invalidRejected, rendererAuthBlocked,
      popup: window.open('https://chat.codelocal.cloud') === null,
    }
  })
  assert.equal(state.origin, 'app://soco')
  assert.equal(new URL(state.href).protocol, 'app:')
  assert.equal(state.node, 'undefined')
  assert.equal(state.refresh, null)
  assert.equal(state.storedSession, null)
  assert.equal(state.externalDenied, false)
  assert.equal(state.invalidRejected, true)
  assert.equal(state.rendererAuthBlocked, true)
  assert.equal(state.popup, true)
  assert.match(state.title, /SOCO/)
  evidence.checks.push('packaged UI, sandbox, native auth bridge, no plaintext session, blocked renderer auth HTTP, unsafe URL and popup denial')

  const mediaBoundary = await page.evaluate(async () => {
    const denied = async (operation) => { try { await operation(); return false } catch { return true } }
    return {
      microphone: await denied(() => window.socoDesktop.media.request('microphone')),
      camera: await denied(() => window.socoDesktop.media.request('camera')),
      invalidKind: await denied(() => window.socoDesktop.media.request('filesystem')),
      screen: await denied(() => window.socoDesktop.screen.select('expired-qa-request', 0)),
    }
  })
  assert.deepEqual(mediaBoundary, { microphone: true, camera: true, invalidKind: true, screen: true })
  evidence.checks.push('actual packaged media IPC denies unauthenticated mic/camera and invalid/expired requests; no devices activated')
  if (process.platform === 'darwin') {
    const plist = await readFile(resolve(dirname(executablePath), '../Info.plist'), 'utf8')
    assert.match(plist, /NSMicrophoneUsageDescription/)
    assert.match(plist, /NSCameraUsageDescription/)
    evidence.checks.push('packaged macOS microphone/camera privacy descriptions present')
  }
  // UI fixture only: no OS source capture. An expired selection must remain dismissible.
  await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.send('soco:screen:picker', {
    requestId: 'expired-qa-request', sources: [{ index: 0, name: 'QA fixture — not an actual screen', thumbnail: '' }],
  }))
  await page.getByRole('dialog', { name: 'Chọn nguồn chia sẻ' }).waitFor()
  await page.getByRole('button', { name: 'QA fixture — not an actual screen' }).click()
  await page.getByRole('alert').filter({ hasText: 'Yêu cầu chia sẻ đã hết hạn' }).waitFor()
  await page.getByRole('button', { name: 'Hủy chia sẻ' }).click()
  await page.getByRole('dialog', { name: 'Chọn nguồn chia sẻ' }).waitFor({ state: 'detached' })
  evidence.checks.push('screen-picker UI fixture: expired selection shows error and cancel closes modal; real capture NOT RUN')

  const vault = await application.evaluate(({ app, safeStorage }, profile) => {
    const require = process.getBuiltinModule('module').createRequire(app.getAppPath() + '/package.json')
    const fs = require('node:fs'), path = require('node:path')
    if (path.resolve(app.getPath('userData')) !== profile) throw new Error('Wrong QA profile')
    const { createCredentialVault } = require(path.join(app.getAppPath(), 'src/auth-vault.cjs'))
    const directory = path.join(profile, 'qa-vault')
    const record = { version: 1, sessionId: 'a7ce5309-8fb5-4f57-861c-ef54c75db291', userId: 7, refreshToken: 'q'.repeat(43) }
    const store = createCredentialVault(directory, safeStorage)
    store.write(record)
    const raw = fs.readFileSync(path.join(directory, 'session.bin'))
    const restored = createCredentialVault(directory, safeStorage).read()
    store.clear()
    return { available: safeStorage.isEncryptionAvailable(), noPlaintext: !raw.includes(record.refreshToken),
      restored: JSON.stringify(restored) === JSON.stringify(record), deleted: store.read() === null }
  }, profile)
  assert.deepEqual(vault, { available: true, noPlaintext: true, restored: true, deleted: true })
  evidence.checks.push('real OS safeStorage + vault file encrypt/read/delete using a synthetic credential, no API login')

  expectedBounds = await application.evaluate(({ BrowserWindow, screen }) => {
    const window = BrowserWindow.getAllWindows()[0], area = screen.getPrimaryDisplay().workArea
    if (window.isMaximized()) window.unmaximize()
    window.setBounds({ x: area.x + 20, y: area.y + 20, width: Math.min(1024, area.width - 40), height: Math.min(768, area.height - 40) })
    return window.getNormalBounds()
  })
  await page.waitForTimeout(600)
  await page.screenshot({ path: join(output, 'login-desktop.png') })
  await page.evaluate(() => localStorage.setItem('soco:qa:persistence', 'survives-process-restart'))
  const lifecycle = await application.evaluate(async ({ app, BrowserWindow }) => {
    const window = BrowserWindow.getAllWindows()[0]
    window.close()
    const hidden = !window.isDestroyed() && !window.isVisible()
    app.emit('activate')
    await new Promise((resolve) => setTimeout(resolve, 100))
    const reopened = window.isVisible()
    window.minimize()
    app.emit('activate')
    await new Promise((resolve) => setTimeout(resolve, 100))
    return { hidden, reopened, restored: !window.isMinimized(), windows: BrowserWindow.getAllWindows().length }
  })
  assert.deepEqual(lifecycle, { hidden: true, reopened: true, restored: true, windows: 1 })
  evidence.checks.push('actual native close-to-tray, activation, minimize/restore, one window')
  evidence.measurements.processes = await application.evaluate(({ app }) => app.getAppMetrics().map((p) => ({
    type: p.type, cpuPercent: p.cpu.percentCPUUsage, workingSetKB: p.memory.workingSetSize,
  })))
  await application.close(); application = undefined
  const settings = JSON.parse(await readFile(join(profile, 'settings/window.json'), 'utf8'))
  assert.deepEqual(settings.bounds, expectedBounds)
  page = await launch()
  assert.deepEqual(await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].getNormalBounds()), expectedBounds)
  assert.equal(await page.evaluate(() => localStorage.getItem('soco:qa:persistence')), 'survives-process-restart')
  evidence.checks.push('process quit/reopen preserves window bounds and packaged-origin persistent storage')
  console.log('PASS: packaged Desktop native/storage/security smoke; account/chat/call/UAT NOT RUN')
  console.log(JSON.stringify(evidence, null, 2))
  await writeFile(join(output, 'evidence.json'), JSON.stringify(evidence, null, 2))
} finally {
  await application?.close()
  // Only delete the fresh synthetic QA profile created by this script.
  await rm(profile, { recursive: true, force: true })
}
