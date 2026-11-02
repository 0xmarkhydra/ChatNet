'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const { EventEmitter } = require('node:events')
const { createNativeNotifications, registerNotificationIPC } = require('../src/notifications.cjs')
const sessionId = 'a7ce5309-8fb5-4f57-861c-ef54c75db291'

// Native event fixtures test policy and failure semantics, not real OS delivery.
function fixture(t) {
  const state = { scope: { sessionId, userId: 7 }, now: Date.parse('2026-10-31T00:00:00Z'),
    focused: false, visible: true, supported: true, fail: false, shown: [], badges: [], events: [], opens: 0 }
  class Notification extends EventEmitter {
    static isSupported() { return state.supported }
    constructor(options) { super(); this.options = options; state.shown.push(this) }
    show() { this.emit(state.fail ? 'failed' : 'show') }
    close() { this.emit('close') }
  }
  const window = { isDestroyed: () => false, isVisible: () => state.visible, isFocused: () => state.focused,
    webContents: { send: (_channel, value) => state.events.push(value) } }
  const notifications = createNativeNotifications({ Notification, getScope: () => state.scope,
    getWindow: () => window, now: () => state.now, showWindow: () => { state.opens++ }, setBadge: count => state.badges.push(count) })
  t.after(() => notifications.reset())
  const sync = overrides => notifications.sync({ sessionId, conversationId: 3, unreadCount: 5, enabled: true, sound: true, ...overrides })
  const message = overrides => ({ sessionId, conversationId: 9, eventId: '123', kind: 'message', senderId: 8,
    createdAt: new Date(state.now).toISOString(), ...overrides })
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
  assert.deepEqual(f.state.shown[0].options, { title: 'SOCO', body: 'Bạn có tin nhắn mới. Mở SOCO để xem.', silent: false })
  f.state.shown[0].emit('click')
  assert.equal(f.state.opens, 1)
  assert.deepEqual(f.state.events, [{ sessionId, conversationId: 9, kind: 'message' }])
})

test('focus, own sends, disabled setting and stale history never notify', async t => {
  const f = fixture(t)
  f.state.focused = true
  assert.equal((await f.notifications.show(f.message({ conversationId: 3 }))).reason, 'focused')
  f.state.focused = false
  assert.equal((await f.notifications.show(f.message({ eventId: 'own', senderId: 7 }))).reason, 'suppressed')
  f.sync({ enabled: false })
  assert.equal((await f.notifications.show(f.message({ eventId: 'disabled' }))).reason, 'suppressed')
  f.sync()
  assert.equal((await f.notifications.show(f.message({ eventId: 'old', createdAt: '2020-01-01' }))).reason, 'stale')
  assert.equal((await f.notifications.show(f.message({ eventId: 'future', createdAt: '2099-01-01' }))).reason, 'stale')
  assert.equal(f.state.shown.length, 0)
})

test('SSE replay deduplicates and bursts are bounded', async t => {
  const f = fixture(t)
  await f.notifications.show(f.message())
  assert.equal((await f.notifications.show(f.message())).reason, 'duplicate')
  assert.equal((await f.notifications.show(f.message({ eventId: 'next' }))).reason, 'rate-limited')
  assert.equal(f.state.shown.length, 1)
})

test('OS failure/unsupported is reported as unavailable, not shown', async t => {
  const f = fixture(t)
  f.state.supported = false
  assert.deepEqual(await f.notifications.show(f.message()), { shown: false, reason: 'unavailable' })
  f.state.supported = true; f.state.fail = true
  assert.deepEqual(await f.notifications.show(f.message({ eventId: 'failed' })), { shown: false, reason: 'unavailable' })
})

test('foreground other-chat notice is silent to avoid duplicating renderer sound', async t => {
  const f = fixture(t)
  f.state.focused = true
  assert.equal((await f.notifications.show(f.message())).shown, true)
  assert.equal(f.state.shown[0].options.silent, true)
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
  f.notifications.dismiss({ sessionId, kind: 'call', eventId: 'call-123' })
  call.emit('click')
  assert.equal(f.state.opens, 0)
  f.state.shown[0].emit('click')
  assert.equal(f.state.opens, 1, 'message notification remains active')
  assert.throws(() => f.notifications.dismiss({ sessionId, kind: 'call', eventId: '../bad' }), /NOTIFICATION_INVALID_INPUT/)
})

test('all notification IPC handlers reject foreign frames and extra arguments', async t => {
  const f = fixture(t), handlers = new Map()
  registerNotificationIPC({ handle: (key, value) => handlers.set(key, value) }, f.notifications, event => event.trusted === true)
  for (const handler of handlers.values()) {
    await assert.rejects(handler({}, {}), /Forbidden IPC origin/)
    await assert.rejects(handler({ trusted: true }, {}, {}), /NOTIFICATION_INVALID_INPUT/)
  }
})
