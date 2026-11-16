'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const { EventEmitter } = require('node:events')
const { createNativeNotifications, registerNotificationIPC } = require('../src/notifications.cjs')
const sessionId = 'a7ce5309-8fb5-4f57-861c-ef54c75db291'

// Native event fixtures test policy and failure semantics, not real OS delivery.
function fixture(t) {
  const state = { scope: { sessionId, userId: 7 }, now: 1000, wallTime: Date.parse('2026-10-31T00:00:00Z'),
    focused: false, visible: true, supported: true, fail: false, soundFail: false,
    shown: [], badges: [], events: [], opens: 0, sounds: 0 }
  class Notification extends EventEmitter {
    static isSupported() { return state.supported }
    constructor(options) { super(); this.options = options; state.shown.push(this) }
    show() { this.emit(state.fail ? 'failed' : 'show') }
    close() { this.emit('close') }
  }
  const window = { isDestroyed: () => false, isVisible: () => state.visible, isFocused: () => state.focused,
    webContents: { send: (_channel, value) => state.events.push(value) } }
  const notifications = createNativeNotifications({ Notification, getScope: () => state.scope,
    getWindow: () => window, now: () => state.now, showWindow: () => { state.opens++ },
    setBadge: count => state.badges.push(count),
    playSound: () => { if (state.soundFail) throw new Error('audio unavailable'); state.sounds++ } })
  t.after(() => notifications.reset())
  const sync = overrides => notifications.sync({ sessionId, conversationId: 3, unreadCount: 5, enabled: true, sound: true, ...overrides })
  const message = overrides => ({ sessionId, conversationId: 9, eventId: '123', kind: 'message', senderId: 8,
    createdAt: new Date(state.wallTime).toISOString(), ...overrides })
  sync()
  return { state, notifications, sync, message }
}

test('notification payloads cannot introduce previews, paths, credentials or invalid IDs', async t => {
  const f = fixture(t)
  for (const extra of [{ text: 'private message' }, { token: 'secret' }, { conversationId: -1 }, { senderId: 0 },
    { eventId: '../../path' }, { kind: 'download' }, { createdAt: {} }]) {
    await assert.rejects(f.notifications.show(f.message(extra)), /NOTIFICATION_INVALID_INPUT/)
  }
  assert.equal(f.state.shown.length, 0)
})

test('message notification uses generic text and correct session-bound click', async t => {
  const f = fixture(t)
  assert.deepEqual(await f.notifications.show(f.message()), { shown: true })
  assert.deepEqual(f.state.shown[0].options, { title: 'SocCO', body: 'Bạn có tin nhắn mới. Mở SocCO để xem.', silent: true })
  assert.equal(f.state.sounds, 1, 'Desktop Main plays a sound, so OS toast stays silent')
  f.state.shown[0].emit('click')
  assert.equal(f.state.opens, 1)
  assert.deepEqual(f.state.events, [{ sessionId, conversationId: 9, kind: 'message' }])
})

test('focus, own messages and independent sound/toast settings', async t => {
  const f = fixture(t)
  f.state.focused = true
  assert.equal((await f.notifications.show(f.message({ conversationId: 3 }))).reason, 'focused')
  assert.equal(f.state.sounds, 1, 'sound is required even while reading the active chat')
  f.state.focused = false
  assert.equal((await f.notifications.show(f.message({ eventId: 'own', senderId: 7 }))).reason, 'suppressed')
  assert.equal(f.state.sounds, 1, 'own messages do not ring')
  f.state.now += 1000
  f.sync({ enabled: false, sound: true })
  assert.equal((await f.notifications.show(f.message({ eventId: 'muted-toast' }))).reason, 'suppressed')
  assert.equal(f.state.sounds, 2, 'disabling OS toasts must not disable the enabled message sound')
  f.sync({ enabled: false, sound: false })
  f.state.now += 1000
  assert.equal((await f.notifications.show(f.message({ eventId: 'muted-all' }))).reason, 'suppressed')
  assert.equal(f.state.sounds, 2, 'disabled sound never rings')
  assert.equal(f.state.shown.length, 0)
})

test('server/device time skew never suppresses valid live SSE messages', async t => {
  const f = fixture(t)
  assert.equal((await f.notifications.show(f.message({ createdAt: '2020-01-01' }))).shown, true)
  f.state.now += 1000
  assert.equal((await f.notifications.show(f.message({ eventId: 'future', createdAt: '2099-01-01' }))).shown, true)
  assert.equal(f.state.sounds, 2)
  f.state.now += 100
  f.state.wallTime += 365 * 24 * 60 * 60 * 1000
  assert.equal((await f.notifications.show(f.message({ eventId: 'clock-shift' }))).reason, 'rate-limited')
  assert.equal(f.state.sounds, 2, 'wall-clock changes cannot bypass monotonic throttling')
})

test('SSE replay deduplicates and bursts are bounded', async t => {
  const f = fixture(t)
  await f.notifications.show(f.message())
  assert.equal((await f.notifications.show(f.message())).reason, 'duplicate')
  assert.equal((await f.notifications.show(f.message({ eventId: 'next' }))).reason, 'rate-limited')
  assert.equal(f.state.shown.length, 1)
  assert.equal(f.state.sounds, 1, 'duplicate SSE or burst does not play twice')
})

test('OS failure/unsupported is reported as unavailable, not shown', async t => {
  const f = fixture(t)
  f.state.supported = false
  assert.deepEqual(await f.notifications.show(f.message()), { shown: false, reason: 'unavailable' })
  assert.equal(f.state.sounds, 1, 'sound still plays when Windows toast is unavailable')
  f.state.now += 1000
  f.state.supported = true; f.state.fail = true
  assert.deepEqual(await f.notifications.show(f.message({ eventId: 'failed' })), { shown: false, reason: 'unavailable' })
  assert.equal(f.state.sounds, 2, 'sound also plays when OS toast delivery fails')
})

test('foreground other-chat and background toasts never double-play the Main chime', async t => {
  const f = fixture(t)
  f.state.focused = true
  assert.equal((await f.notifications.show(f.message())).shown, true)
  assert.equal(f.state.shown[0].options.silent, true)
  assert.equal(f.state.sounds, 1)
  f.state.focused = false
  f.state.visible = false
  f.state.now += 1000
  assert.equal((await f.notifications.show(f.message({ eventId: 'background' }))).shown, true)
  assert.equal(f.state.shown[1].options.silent, true)
  assert.equal(f.state.sounds, 2, 'hidden-to-tray app actively chimes without OS toast sound')
})

test('when native sound fails, OS notification audio is a fallback', async t => {
  const f = fixture(t)
  f.state.soundFail = true
  assert.deepEqual(await f.notifications.show(f.message()), { shown: true })
  assert.equal(f.state.shown[0].options.silent, false)
  f.state.now += 1000
  f.state.focused = true
  assert.equal((await f.notifications.show(f.message({ eventId: 'focused', conversationId: 3 }))).reason, 'unavailable')
})

test('logout/reset and privacy invalidation prevent stale native clicks', async t => {
  for (const reset of ['logout', 'privacy']) {
    const f = fixture(t)
    await f.notifications.show(f.message())
    const notification = f.state.shown[0]
    if (reset === 'logout') { f.notifications.reset(); f.state.scope = null }
    else f.notifications.clear(sessionId)
    notification.emit('click')
    assert.equal(f.state.opens, 0, reset)
    assert.deepEqual(f.state.events, [])
  }
})

test('badge follows complete server snapshots, clears on logout and rejects cross-account writes', t => {
  const f = fixture(t)
  f.sync({ unreadCount: 42 }); f.sync({ unreadCount: 42 }); f.sync({ unreadCount: null })
  assert.deepEqual(f.state.badges.slice(-3), [42, 42, null])
  assert.throws(() => f.sync({ unreadCount: -1 }), /NOTIFICATION_INVALID_INPUT/)
  assert.throws(() => f.sync({ unreadCount: 1.5 }), /NOTIFICATION_INVALID_INPUT/)
  f.state.scope = { sessionId: 'b7ce5309-8fb5-4f57-861c-ef54c75db291', userId: 9 }
  assert.throws(() => f.sync(), /NOTIFICATION_SESSION_CHANGED/)
  f.notifications.reset()
  assert.equal(f.state.badges.at(-1), 0)
})

test('call notification bypasses message throttle; ending it cannot dismiss chat notifications', async t => {
  const f = fixture(t)
  await f.notifications.show(f.message())
  assert.equal((await f.notifications.show(f.message({ kind: 'call', eventId: 'call-123' }))).shown, true)
  const call = f.state.shown[1]
  assert.equal(call.options.silent, true, 'renderer ringtone remains the only call sound')
  assert.equal(f.state.sounds, 1, 'call does not play an extra message chime')
  f.notifications.dismiss({ sessionId, kind: 'call', eventId: 'call-123' })
  call.emit('click')
  assert.equal(f.state.opens, 0)
  f.state.shown[0].emit('click')
  assert.equal(f.state.opens, 1, 'message notification remains active')
  assert.throws(() => f.notifications.dismiss({ sessionId, kind: 'call', eventId: '../bad' }), /NOTIFICATION_INVALID_INPUT/)
})

test('Settings preview uses the same native sound and respects session isolation', t => {
  const f = fixture(t)
  assert.equal(f.notifications.preview(sessionId), true)
  assert.equal(f.state.sounds, 1)
  f.state.soundFail = true
  assert.throws(() => f.notifications.preview(sessionId), /NOTIFICATION_SOUND_UNAVAILABLE/)
  assert.throws(() => f.notifications.preview('b7ce5309-8fb5-4f57-861c-ef54c75db291'), /NOTIFICATION_SESSION_CHANGED/)
})

test('all notification IPC handlers reject foreign frames and extra arguments', async t => {
  const f = fixture(t), handlers = new Map()
  registerNotificationIPC({ handle: (key, value) => handlers.set(key, value) }, f.notifications, event => event.trusted === true)
  for (const handler of handlers.values()) {
    await assert.rejects(handler({}, {}), /Forbidden IPC origin/)
    await assert.rejects(handler({ trusted: true }, {}, {}), /NOTIFICATION_INVALID_INPUT/)
  }
})
