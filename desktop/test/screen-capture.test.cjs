'use strict'

// Policy/IPC unit fixtures, not evidence of real screen capture or LiveKit transmission.
const test = require('node:test')
const assert = require('node:assert/strict')
const { registerScreenCapture } = require('../src/screen-capture.cjs')

function fixture(t) {
  const state = { scope: { sessionId: 'a' }, visible: true, focused: true, destroyed: false, sent: [], results: [] }
  const frame = { url: 'app://soco/index.html' }
  const window = { isDestroyed: () => state.destroyed, isVisible: () => state.visible, isFocused: () => state.focused,
    webContents: { mainFrame: frame, send: (_channel, value) => state.sent.push(value) } }
  let handler, select
  const sources = [0, 1].map(index => ({ id: `private-os-source-${index}`, name: `Source ${index}`,
    thumbnail: { toDataURL: () => 'data:image/png;base64,dGVzdA==' } }))
  const capturer = { getSources: async () => sources }
  const capture = registerScreenCapture({
    ses: { setDisplayMediaRequestHandler: (value, options) => { handler = value; assert.equal(options.useSystemPicker, false) } },
    ipcMain: { handle: (_channel, value) => { select = value } }, desktopCapturer: capturer,
    getWindow: () => window, getScope: () => state.scope, trusted: event => event.trusted === true,
    trustedURL: url => typeof url === 'string' && /^app:\/\/soco(?:\/|$)/.test(url),
  })
  t.after(() => capture.reset())
  const request = overrides => handler({ frame, securityOrigin: 'app://soco', videoRequested: true,
    audioRequested: true, userGesture: true, ...overrides }, streams => state.results.push(streams))
  const flush = () => new Promise(resolve => setImmediate(resolve))
  return { state, window, frame, sources, capturer, capture, request, flush, select: (...args) => select(...args) }
}

test('capture requires authenticated foreground main frame and a user gesture', async t => {
  const f = fixture(t)
  for (const overrides of [{ userGesture: false }, { videoRequested: false }, { frame: null },
    { frame: { url: f.frame.url } }, { securityOrigin: 'https://evil.test' }]) {
    f.request(overrides)
    assert.deepEqual(f.state.results.pop(), {})
  }
  f.state.scope = null
  f.request({})
  assert.deepEqual(f.state.results.pop(), {})
  assert.deepEqual(f.state.sent, [])
})

test('picker exposes bounded display metadata, never raw source IDs, and grants video only', async t => {
  const f = fixture(t)
  f.request({})
  await f.flush()
  const picker = f.state.sent.at(-1)
  assert.equal(picker.sources.length, 2)
  assert.equal(JSON.stringify(picker).includes('private-os-source'), false)
  assert.equal(f.select({ trusted: true }, picker.requestId, 1), true)
  assert.deepEqual(f.state.results, [{ video: f.sources[1] }])
  assert.equal(f.state.sent.at(-1), null)
  assert.throws(() => f.select({ trusted: true }, picker.requestId, 1), /SCREEN_REQUEST_EXPIRED/)
})

test('cancel is a denial and resolves once', async t => {
  const f = fixture(t)
  f.request({})
  await f.flush()
  assert.equal(f.select({ trusted: true }, f.state.sent.at(-1).requestId, null), false)
  f.capture.reset()
  assert.deepEqual(f.state.results, [{}])
})

test('foreign frames and malformed selection cannot choose a source', async t => {
  const f = fixture(t)
  f.request({})
  await f.flush()
  const id = f.state.sent.at(-1).requestId
  assert.throws(() => f.select({}, id, 0), /Forbidden IPC origin/)
  for (const value of ['0', -1, 80, 0.5, {}, undefined]) {
    assert.throws(() => f.select({ trusted: true }, id, value), /SCREEN_INVALID_SELECTION/)
  }
  assert.throws(() => f.select({ trusted: true }, id, 0, 'extra'), /SCREEN_INVALID_SELECTION/)
  assert.deepEqual(f.state.results, [])
})

test('logout/account switch before selection cannot capture', async t => {
  const f = fixture(t)
  f.request({})
  await f.flush()
  const id = f.state.sent.at(-1).requestId
  f.state.scope = { sessionId: 'b' }
  assert.throws(() => f.select({ trusted: true }, id, 0), /SCREEN_REQUEST_EXPIRED/)
  assert.deepEqual(f.state.results, [{}])
})

test('frame navigation and hidden windows invalidate selection', async t => {
  for (const invalidate of [f => { f.window.webContents.mainFrame = {} }, f => { f.state.visible = false },
    f => { f.state.focused = false }, f => { f.state.destroyed = true }]) {
    const f = fixture(t)
    f.request({})
    await f.flush()
    const id = f.state.sent.at(-1).requestId
    invalidate(f)
    assert.throws(() => f.select({ trusted: true }, id, 0), /SCREEN_REQUEST_EXPIRED/)
    assert.deepEqual(f.state.results, [{}])
  }
})

test('OS enumeration failure denies cleanly; late result after reset cannot reopen picker', async t => {
  const f = fixture(t)
  f.capturer.getSources = async () => { throw new Error('OS denied') }
  f.request({})
  await f.flush()
  assert.deepEqual(f.state.results, [{}])
  let resolve
  f.capturer.getSources = () => new Promise(done => { resolve = done })
  f.request({})
  f.capture.reset()
  resolve(f.sources)
  await f.flush()
  assert.deepEqual(f.state.results, [{}, {}])
  assert.equal(f.state.sent.some(Boolean), false)
})

test('simultaneous requests do not replace the active picker', async t => {
  const f = fixture(t)
  f.request({})
  f.request({})
  await f.flush()
  assert.deepEqual(f.state.results, [{}])
  f.select({ trusted: true }, f.state.sent.at(-1).requestId, 0)
  assert.deepEqual(f.state.results, [{}, { video: f.sources[0] }])
})
