'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const { EventEmitter } = require('node:events')
const { createDesktopUpdates } = require('../src/updates.cjs')
const { checkReleaseTag } = require('../scripts/check-release-tag.cjs')
const pkg = require('../package.json')

function fixture({ packaged = true, hasFeed = true, confirm = 1 } = {}) {
  const handles = new Map()
  const sent = []
  const emitter = new EventEmitter()
  const calls = { checks: 0, downloads: 0, installs: 0 }
  const window = {
    isDestroyed: () => false,
    isVisible: () => true,
    webContents: { send: (...args) => sent.push(args) },
  }
  const app = { isPackaged: packaged, getVersion: () => '0.1.0' }
  const updater = Object.assign(emitter, {
    checkForUpdates: async () => {
      calls.checks++
      emitter.emit('update-available', { version: '0.4.0' })
    },
    downloadUpdate: async () => {
      calls.downloads++
      emitter.emit('download-progress', { percent: 42.9 })
      emitter.emit('update-downloaded', { version: '0.4.0' })
    },
    quitAndInstall: () => { calls.installs++ },
  })
  let pendingStartup, pendingInterval
  const updates = createDesktopUpdates({
    app, ipcMain: { handle: (name, handler) => handles.set(name, handler) },
    dialog: { showMessageBox: async () => ({ response: confirm }) },
    getWindow: () => window, trusted: (event) => event?.trusted === true,
    getUpdater: () => updater, platform: 'win32', resourcesPath: 'resources',
    fileExists: () => hasFeed,
    schedule: (fn) => { pendingStartup = fn; return 1 },
    repeat: (fn) => { pendingInterval = fn; return 2 },
    cancelSchedule: () => { pendingStartup = undefined },
    cancelRepeat: () => { pendingInterval = undefined },
  })
  const invoke = (channel, input, trusted = true) => handles.get(channel)({ trusted }, input)
  return { calls, updates, updater, invoke, sent, triggerStartup: () => pendingStartup?.(),
    hasInterval: () => Boolean(pendingInterval) }
}

test('unsigned and unconfigured installations fail closed, no updater initialized', async () => {
  for (const options of [{ packaged: false }, { hasFeed: false }]) {
    const f = fixture(options)
    assert.equal(f.updates.snapshot().status, 'disabled')
    assert.equal((await f.invoke('soco:update:check')).status, 'disabled')
    assert.equal((await f.invoke('soco:update:download')).status, 'disabled')
    assert.equal(await f.invoke('soco:update:install', { hasPendingWork: false }), false)
    f.updates.start()
    assert.equal(f.hasInterval(), false)
    assert.equal(f.calls.checks, 0)
    assert.equal(f.calls.installs, 0)
  }
})

test('only the authenticated, trusted main frame can invoke update IPC', async () => {
  const f = fixture()
  for (const name of ['state', 'check', 'download', 'install']) {
    await assert.rejects(async () => f.invoke('soco:update:' + name, { hasPendingWork: false }, false), /Forbidden IPC origin/)
  }
  assert.equal((await f.invoke('soco:update:state')).status, 'idle')
})

test('checks and downloads are user controlled, never restart automatically', async () => {
  const f = fixture()
  f.updates.start()
  assert.equal(f.hasInterval(), true)
  assert.equal(f.calls.checks, 0)
  f.triggerStartup()
  await new Promise((resolve) => setImmediate(resolve))
  assert.equal(f.calls.checks, 1)
  assert.equal(f.updates.snapshot().status, 'available')
  assert.equal(f.updates.snapshot().version, '0.4.0')
  assert.equal(f.calls.downloads, 0)
  assert.equal(f.calls.installs, 0)
  await f.invoke('soco:update:download')
  assert.equal(f.calls.downloads, 1)
  assert.equal(f.calls.installs, 0)
  assert.equal(f.updates.snapshot().status, 'downloaded')
  assert.equal(f.updates.snapshot().progress, 100)
  assert.ok(f.sent.some(([channel]) => channel === 'soco:update:status'))
  assert.equal(await f.invoke('soco:update:install', { hasPendingWork: true }), false)
  assert.equal(f.calls.installs, 0)
  assert.equal(await f.invoke('soco:update:install', { hasPendingWork: false }), true)
  assert.equal(f.calls.installs, 1)
  f.updates.stop()
  assert.equal(f.hasInterval(), false)
})

test('native confirmation can defer install; download failure keeps current version running', async () => {
  const f = fixture({ confirm: 0 })
  await f.invoke('soco:update:check')
  assert.equal(await f.invoke('soco:update:install', { hasPendingWork: false }), false)
  f.updater.downloadUpdate = async () => { throw Error('offline') }
  assert.equal((await f.invoke('soco:update:download')).status, 'error')
  assert.equal(f.calls.installs, 0)
  await f.invoke('soco:update:check')
  f.updater.emit('update-downloaded', { version: '0.4.0' })
  assert.equal(await f.invoke('soco:update:install', { hasPendingWork: false }), false)
  assert.equal(f.calls.installs, 0)
})

test('release tags must match Desktop version, not a Web tag or another branch version', () => {
  assert.equal(checkReleaseTag(`v${pkg.version}`), `v${pkg.version}`)
  for (const tag of ['', 'v0.3.1', 'v0.4.1', '0.4.0', 'v0.4.0-beta', 'v00.4.0', 'v0.4.0;echo hi']) {
    assert.throws(() => checkReleaseTag(tag))
  }
})

test('signed releases use the public GitHub update feed; internal packages stay disabled', () => {
  const config = require('../electron-builder.release.cjs')
  assert.equal(pkg.build.publish, null)
  assert.equal(pkg.build.win.verifyUpdateCodeSignature, undefined)
  assert.equal(pkg.dependencies['electron-updater'], '6.8.11')
  assert.deepEqual(config.publish, [{
    provider: 'github', owner: '0xmarkhydra', repo: 'ChatNet',
    releaseType: 'draft', channel: 'latest',
  }])
  assert.equal(config.win.verifyUpdateCodeSignature, true)
  assert.equal(config.mac.notarize, true)
  assert.equal(config.appId, pkg.build.appId)
  assert.equal(config.nsis.deleteAppDataOnUninstall, false)
  for (const cmd of ['dist:mac', 'dist:win']) {
    assert.match(pkg.scripts[cmd], /electron-builder\.release\.cjs/)
    assert.match(pkg.scripts[cmd], /--config\.forceCodeSigning=true/)
    assert.match(pkg.scripts[cmd], /--publish never/)
  }
})
