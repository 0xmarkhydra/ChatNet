'use strict'

// Policy/workflow fixtures only. No OS display is captured or inspected by these tests.
const test = require('node:test')
const assert = require('node:assert/strict')
const { EventEmitter } = require('node:events')
const { registerScreenshotCapture } = require('../src/screenshot.cjs')
const { normalizeScreenshotRegion, selectScreenshotRegion } = require('../src/screenshot-overlay.cjs')

const frameURL = 'app://soco/index.html'
const imageSize = { width: 1920, height: 1200 }
const region = { x: 4, y: 8, width: 50, height: 60 }
const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])

function fixture(t, platform = 'win32', useFastPath = false) {
  const trace = [], sent = [], requests = [], copied = []
  const state = { scope: { sessionId: 'a', userId: 1 }, visible: true, focused: true, destroyed: false, opacity: 1 }
  const app = new EventEmitter()
  const window = new EventEmitter()
  const webContents = new EventEmitter()
  const frame = { url: frameURL }
  Object.assign(webContents, { mainFrame: frame, send: (...args) => sent.push(args), isDestroyed: () => state.destroyed, getURL: () => frame.url })
  Object.assign(window, { webContents, isDestroyed: () => state.destroyed, isVisible: () => state.visible,
    isFocused: () => state.focused, isMinimized: () => false,
    getOpacity: () => state.opacity,
    setOpacity: opacity => { state.opacity = opacity; trace.push('opacity:' + opacity) },
    hide: () => { state.visible = false; trace.push('hide') },
    show: () => { state.visible = true; trace.push('show') },
    showInactive: () => { state.visible = true; trace.push('showInactive') },
    focus: () => { state.focused = true; trace.push('focus') },
  })
  const display = { id: 7, bounds: { x: -1280, y: 20, width: 1280, height: 800 }, scaleFactor: 1.5 }
  const cursor = { x: -70, y: 50 }
  const image = {
    isEmpty: () => false, getSize: () => imageSize,
    crop: rectangle => {
      trace.push('crop')
      assert.deepEqual(rectangle, region)
      return { isEmpty: () => false, getSize: () => ({ width: region.width, height: region.height }), toPNG: () => png }
    },
  }
  const otherImage = { isEmpty: () => false, getSize: () => imageSize }
  const screen = { getCursorScreenPoint: () => cursor, getDisplayNearestPoint: point => { assert.deepEqual(point, cursor); return display },
    getAllDisplays: () => [display, { id: 2, bounds: { x: 0, y: 0, width: 1920, height: 1200 }, scaleFactor: 1 }],
  }
  const sources = [{ display_id: '2', thumbnail: otherImage }, { display_id: '7', thumbnail: image }]
  state.getSources = async () => sources
  state.select = async () => region
  let handler
  const capture = registerScreenshotCapture({
    app, platform, clipboard: { writeImage: image => copied.push(image) }, BrowserWindow: class {}, ipcMain: { handle: (channel, fn) => { assert.equal(channel, 'soco:screenshot:capture'); handler = fn } },
    desktopCapturer: { getSources: async options => { trace.push('source'); requests.push(options); return state.getSources(options) } },
    screen, getWindow: () => window, getScope: () => state.scope,
    readScreen: useFastPath ? async () => { trace.push('fast'); return state.readScreen ? state.readScreen() : image } : undefined,
    trusted: event => event?.trusted === true && event.senderFrame === frame,
    trustedURL: url => url === frameURL,
    selectRegion: async options => {
      trace.push('select')
      assert.equal(options.display, display)
      assert.equal(options.screenshot, image)
      return state.select(options)
    },
    settleWindow: async () => { trace.push('settle') },
  })
  const event = { trusted: true, sender: webContents, senderFrame: frame }
  t.after(() => capture.reset())
  return { capture, state, trace, sent, requests, copied, window, frame, event, sources,
    invoke: (...args) => Promise.resolve().then(() => handler(...args)),
    run: (...args) => Promise.resolve().then(() => handler(event, ...args)) }
}

test('capture requires exact mode, trusted main frame, foreground window and signed-in Windows session', async t => {
  const f = fixture(t)
  for (const args of [[], [null], ['INCLUDE'], [{ mode: 'include' }], ['include', 'extra']]) {
    await assert.rejects(f.run(...args), /SCREENSHOT_/)
  }
  await assert.rejects(f.invoke({ ...f.event, senderFrame: {} }, 'include'), /Forbidden IPC origin|SCREENSHOT_/)
  f.state.focused = false
  await assert.rejects(f.run('include'), /SCREENSHOT_/)
  f.state.focused = true
  f.state.scope = null
  await assert.rejects(f.run('include'), /SCREENSHOT_/)
  assert.deepEqual(f.trace, [])
  assert.deepEqual(f.copied, [])

  const mac = fixture(t, 'darwin')
  await assert.rejects(mac.run('include'), /SCREENSHOT_/)
  assert.deepEqual(mac.trace, [])
})

test('include selects the exact cursor display and copies only the cropped image', async t => {
  const f = fixture(t)
  const result = await f.run('include')
  assert.deepEqual(f.trace, ['source', 'select', 'crop', 'focus'])
  assert.deepEqual(f.requests[0].types, ['screen'])
  assert.deepEqual(f.requests[0].thumbnailSize, imageSize)
  assert.equal(f.requests[0].fetchWindowIcons, false)
  assert.equal(f.state.visible, true)
  assert.equal(result, true)
  assert.equal(f.copied.length, 1)
  assert.deepEqual(f.copied[0].getSize(), { width: region.width, height: region.height })
  assert.deepEqual(f.copied[0].toPNG(), png)
})

test('exclude hides ChatNet before capturing and restores it after a cancellation', async t => {
  const f = fixture(t)
  f.state.select = async () => { assert.equal(f.state.visible, false); return null }
  assert.equal(await f.run('exclude'), null)
  assert.deepEqual(f.copied, [])
  assert.deepEqual(f.trace.slice(0, 4), ['hide', 'settle', 'source', 'select'])
  assert.deepEqual(f.trace.slice(4), ['showInactive', 'focus'])
  assert.equal(f.state.visible, true)
})

test('fast Windows path samples only after hiding SocCO and skips Electron enumeration', async t => {
  const f = fixture(t, 'win32', true)
  assert.equal(await f.run('exclude'), true)
  assert.deepEqual(f.trace, ['opacity:0', 'hide', 'fast', 'select', 'crop', 'opacity:1', 'showInactive', 'focus'])
  assert.deepEqual(f.requests, [])
})

test('a failed fast Windows path falls back to Electron and keeps exclusion intact', async t => {
  const f = fixture(t, 'win32', true)
  f.state.readScreen = () => { throw new Error('native reader unavailable') }
  assert.equal(await f.run('exclude'), true)
  assert.deepEqual(f.trace, ['opacity:0', 'hide', 'fast', 'settle', 'source', 'select', 'crop', 'opacity:1', 'showInactive', 'focus'])
})

test('exclude restores ChatNet after source errors and does not fall back to a different screen', async t => {
  const f = fixture(t)
  f.state.getSources = async () => { throw new Error('private platform diagnostic') }
  await assert.rejects(f.run('exclude'), error => /SCREENSHOT_/.test(error.message) && !/private platform diagnostic/.test(error.message))
  assert.equal(f.trace.includes('select'), false)
  assert.equal(f.state.visible, true)

  f.state.getSources = async () => [f.sources[0]]
  await assert.rejects(f.run('include'), /SCREENSHOT_/)
  assert.equal(f.trace.includes('select'), false)
})

test('one capture runs at a time and an account switch suppresses the stale image', async t => {
  const f = fixture(t)
  let release
  f.state.select = () => new Promise(resolve => { release = resolve })
  const inflight = f.run('exclude')
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(typeof release, 'function')
  await assert.rejects(f.run('include'), /SCREENSHOT_/)
  f.state.scope = { sessionId: 'b', userId: 2 }
  f.capture.reset()
  release(region)
  assert.equal(await inflight, null)
  assert.equal(f.trace.includes('crop'), false)
  assert.equal(f.state.visible, true)
})

test('a cancelled native grab blocks the opposite mode until Electron releases its capture', async t => {
  const f = fixture(t)
  let finishNative
  f.state.getSources = () => new Promise(resolve => { finishNative = resolve })
  const first = f.run('include')
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(typeof finishNative, 'function')
  f.capture.reset()
  assert.equal(await first, null)
  await assert.rejects(f.run('exclude'), /SCREENSHOT_BUSY/)
  assert.deepEqual(f.trace, ['source'])
  finishNative(f.sources)
  await new Promise(resolve => setImmediate(resolve))

  f.state.getSources = async () => f.sources
  f.state.select = async () => null
  assert.equal(await f.run('exclude'), null)
  assert.deepEqual(f.trace.slice(1, 5), ['hide', 'settle', 'source', 'select'])
})

test('app shortcuts target the active signed-in window and reject repeat, compose and extra modifiers', t => {
  const f = fixture(t)
  f.capture.attach(f.window)
  const key = (overrides = {}) => {
    let prevented = false
    f.window.webContents.emit('before-input-event', { preventDefault: () => { prevented = true } },
      { type: 'keyDown', code: 'KeyS', key: 's', control: true, alt: true, shift: false,
        meta: false, isAutoRepeat: false, isComposing: false, ...overrides })
    return prevented
  }
  assert.equal(key(), true)
  assert.equal(key({ code: 'KeyA', key: 'a' }), true)
  assert.equal(key({ isAutoRepeat: true }), true) // Suppressed so the native menu does not see it either.
  for (const overrides of [{ type: 'keyUp' }, { isComposing: true }, { shift: true },
    { meta: true }, { alt: false }, { code: 'KeyZ', key: 'z' }]) assert.equal(key(overrides), false)
  f.state.focused = false
  assert.equal(key(), false)
  assert.deepEqual(f.sent, [['soco:screenshot:shortcut', 'include'], ['soco:screenshot:shortcut', 'exclude']])
})

test('normalized coordinates crop correctly at fractional Windows DPI without losing edge pixels', () => {
  assert.deepEqual(normalizeScreenshotRegion({ left: 0.25, top: 0.1, right: 0.75, bottom: 0.9 }, imageSize),
    { x: 480, y: 120, width: 960, height: 960 })
  assert.deepEqual(normalizeScreenshotRegion({ left: 0.015, top: 0.025, right: 1, bottom: 1 }, { width: 101, height: 103 }),
    { x: 1, y: 2, width: 100, height: 101 })
  for (const selection of [null, {}, { left: -0.1, top: 0, right: 1, bottom: 1 },
    { left: 0, top: 0, right: 1.1, bottom: 1 }, { left: 0, top: NaN, right: 1, bottom: 1 },
    { left: 0.75, top: 0, right: 0.5, bottom: 1 }, { left: 0, top: 0.1, right: 1, bottom: 0.1 },
    { left: 0, top: 0, right: 0.0001, bottom: 1 }]) assert.equal(normalizeScreenshotRegion(selection, imageSize), null)
})

test('selector only accepts its own local main frame and disposes listeners/window after selection', async () => {
  const f = pickerFixture()
  await new Promise(resolve => setImmediate(resolve))
  const frame = f.window.webContents.mainFrame
  const event = { sender: f.window.webContents, senderFrame: frame }
  const bounds = { left: 0, top: 0, right: 0.5, bottom: 0.5 }
  const foreignFrame = { url: frame.url }

  assert.equal(f.window.options.webPreferences.sandbox, true)
  assert.equal(f.window.options.webPreferences.contextIsolation, true)
  assert.equal(f.window.options.webPreferences.nodeIntegration, false)
  assert.deepEqual(f.window.webContents.open(), { action: 'deny' })
  assert.equal(f.window.webContents.checkPermission(), false)
  f.ipcMain.emit('soco:screenshot-overlay:ready', { ...event, senderFrame: foreignFrame }, true)
  assert.equal(f.window.visible, false)
  f.ipcMain.emit('soco:screenshot-overlay:ready', event, true)
  assert.equal(f.window.visible, true)
  f.ipcMain.emit('soco:screenshot-overlay:result', { ...event, sender: {} }, bounds)
  assert.equal(f.window.isDestroyed(), false)
  const trustedURL = frame.url
  frame.url = 'https://example.test'
  f.ipcMain.emit('soco:screenshot-overlay:result', event, bounds)
  assert.equal(f.window.isDestroyed(), false)
  frame.url = trustedURL
  f.ipcMain.emit('soco:screenshot-overlay:result', event, bounds)
  assert.deepEqual(await f.result, { x: 0, y: 0, width: 960, height: 600 })
  assert.equal(f.window.isDestroyed(), true)
  assert.deepEqual(f.ipcMain.eventNames(), [])
})

test('selector abort removes its window and makes later bitmap/result events inert', async () => {
  const f = pickerFixture()
  f.abort.abort()
  assert.equal(await f.result, null)
  assert.equal(f.window.isDestroyed(), true)
  assert.deepEqual(f.ipcMain.eventNames(), [])
  assert.deepEqual(f.window.webContents.sent, [])
})

function pickerFixture() {
  const ipcMain = new EventEmitter(), abort = new AbortController()
  let window
  class BrowserWindow extends EventEmitter {
    constructor(options) {
      super()
      window = this
      this.options = options
      this.visible = false
      this.destroyed = false
      this.webContents = Object.assign(new EventEmitter(), {
        mainFrame: {}, sent: [],
        session: {
          setPermissionRequestHandler() {},
          setPermissionCheckHandler: handler => { this.webContents.checkPermission = handler },
        },
        setWindowOpenHandler: handler => { this.webContents.open = handler },
        send: (...args) => this.webContents.sent.push(args),
      })
    }
    setAlwaysOnTop() {}
    isDestroyed() { return this.destroyed }
    show() { this.visible = true }
    focus() {}
    destroy() { this.destroyed = true; this.emit('closed') }
    async loadURL(url) { this.webContents.mainFrame.url = url }
  }
  const screenshot = { getSize: () => imageSize, toJPEG: () => Buffer.from([255, 216, 255, 217]) }
  const result = selectScreenshotRegion({ BrowserWindow, ipcMain, display: { bounds: { x: -1280, y: 0, width: 1280, height: 800 } },
    screenshot, signal: abort.signal })
  return { ipcMain, abort, window, result }
}
