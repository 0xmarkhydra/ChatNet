'use strict'

// Unit fixtures only; real OS permission prompts still require packaged UAT.
const test = require('node:test')
const assert = require('node:assert/strict')
const { createMediaPermissions, registerMediaIPC, kindForMediaType } = require('../src/media-permissions.cjs')

function fixture(platform = 'darwin') {
  const state = { scope: { sessionId: 'session-a' }, visible: true, focused: true, destroyed: false,
    status: 'not-determined', answer: 1, dialogs: 0, asks: 0 }
  const window = { isVisible: () => state.visible, isFocused: () => state.focused, isDestroyed: () => state.destroyed }
  const preferences = {
    getMediaAccessStatus: () => state.status,
    askForMediaAccess: async () => { state.asks++; state.status = 'granted'; return true },
  }
  const dialog = { showMessageBox: async () => { state.dialogs++; return { response: state.answer } } }
  const media = createMediaPermissions({ preferences, dialog, platform, getScope: () => state.scope, getWindow: () => window })
  return { state, preferences, dialog, media }
}

test('media kinds and status values are bounded', () => {
  const { media, state } = fixture()
  assert.equal(kindForMediaType('audio'), 'microphone')
  assert.equal(kindForMediaType('video'), 'camera')
  assert.equal(kindForMediaType('unknown'), null)
  assert.throws(() => media.status('filesystem'), /MEDIA_INVALID_KIND/)
  state.status = 'unexpected'
  assert.equal(media.status('microphone'), 'unknown')
})

test('unauthenticated and background requests cannot trigger OS prompts', async () => {
  for (const change of [{ scope: null }, { visible: false }, { focused: false }, { destroyed: true }]) {
    const { state, media } = fixture()
    Object.assign(state, change)
    await assert.rejects(media.request('microphone'), /MEDIA_(SESSION_REQUIRED|FOREGROUND_REQUIRED)/)
    assert.equal(state.dialogs, 0)
    assert.equal(state.asks, 0)
  }
})

test('one explicit grant is reused only by the same account session', async () => {
  const { media, state } = fixture()
  assert.equal((await media.request('microphone')).granted, true)
  assert.equal(media.hasGrant('microphone'), true)
  await media.request('microphone')
  assert.equal(state.dialogs, 1)
  assert.equal(state.asks, 1)
  state.scope = { sessionId: 'session-b' }
  assert.equal(media.hasGrant('microphone'), false)
  await media.request('microphone')
  assert.equal(state.dialogs, 2)
})

test('OS denied, restricted and unknown states fail closed without prompt loops', async () => {
  for (const status of ['denied', 'restricted', 'unknown']) {
    const { state, media } = fixture()
    state.status = status
    assert.equal((await media.request('camera')).granted, false, status)
    assert.equal(media.hasGrant('camera'), false)
    assert.equal(state.asks, 0)
    assert.equal(state.dialogs, 0)
  }
})

test('explicit decline does not invoke OS capture access', async () => {
  const { state, media } = fixture()
  state.answer = 0
  assert.equal((await media.request('microphone')).granted, false)
  assert.equal(state.asks, 0)
  assert.equal(media.hasGrant('microphone'), false)
})

test('concurrent requests share a prompt; reset rejects its late answer', async () => {
  const { dialog, state, media } = fixture()
  let answer
  dialog.showMessageBox = () => { state.dialogs++; return new Promise(resolve => { answer = resolve }) }
  const first = media.request('camera')
  const second = media.request('camera')
  assert.equal(state.dialogs, 1)
  media.reset()
  answer({ response: 1 })
  assert.equal((await first).granted, false)
  assert.equal((await second).granted, false)
  assert.equal(state.asks, 0)
  assert.equal(media.hasGrant('camera'), false)
})

test('account switch while OS prompt resolves cannot grant to a new session', async () => {
  const { preferences, state, media } = fixture()
  preferences.askForMediaAccess = async () => { state.scope = { sessionId: 'session-b' }; state.status = 'granted'; return true }
  assert.equal((await media.request('camera')).granted, false)
  assert.equal(media.hasGrant('camera'), false)
})

test('Windows uses current OS access plus explicit consent, not macOS ask API', async () => {
  const { state, media } = fixture('win32')
  state.status = 'granted'
  assert.equal((await media.request('microphone')).granted, true)
  assert.equal(state.dialogs, 1)
  assert.equal(state.asks, 0)
  state.status = 'denied'
  assert.equal(media.hasGrant('microphone'), false)
})

test('permission IPC rejects foreign frames, extra arguments and invalid kinds', async () => {
  const handlers = new Map()
  const { media } = fixture()
  registerMediaIPC({ handle: (channel, handler) => handlers.set(channel, handler) }, media, event => event.trusted === true)
  const request = handlers.get('soco:media:request')
  await assert.rejects(request({}, 'camera'), /Forbidden IPC origin/)
  for (const args of [[], ['camera', 'extra'], [['camera']], ['screen'], ['filesystem']]) {
    await assert.rejects(request({ trusted: true }, ...args), /MEDIA_INVALID_KIND/)
  }
})
