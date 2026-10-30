'use strict'

const { exactObject } = require('./auth-broker.cjs')
const validID = (value) => Number.isSafeInteger(value) && value > 0
const validSession = (value) => typeof value === 'string' && /^[a-f0-9-]{36}$/i.test(value)

// No message text, names, avatars, credentials or external URLs enter the OS notification store.
function createNativeNotifications({ Notification, getScope, getWindow, showWindow, setBadge, now = Date.now }) {
  let context = null
  let lastShown = -Infinity
  const seen = new Set()
  const active = new Map()
  const same = (sessionId) => validSession(sessionId) && getScope()?.sessionId === sessionId
  function closeAll() {
    for (const entry of active.values()) { clearTimeout(entry.timer); entry.notification.close(); entry.resolve({ shown: false, reason: 'cancelled' }) }
    active.clear()
  }
  function reset() { closeAll(); seen.clear(); context = null; lastShown = -Infinity; setBadge(0) }
  function sync(input) {
    if (!exactObject(input, ['sessionId', 'conversationId', 'unreadCount', 'enabled', 'sound']) || !validSession(input.sessionId) ||
        (input.conversationId !== null && !validID(input.conversationId)) ||
        (input.unreadCount !== null && (!Number.isSafeInteger(input.unreadCount) || input.unreadCount < 0)) ||
        typeof input.enabled !== 'boolean' || typeof input.sound !== 'boolean') throw new Error('NOTIFICATION_INVALID_INPUT')
    if (!same(input.sessionId)) throw new Error('NOTIFICATION_SESSION_CHANGED')
    if (context?.sessionId !== input.sessionId) reset()
    context = { ...input }
    if (!context.enabled) closeAll()
    setBadge(input.unreadCount)
    return true
  }
  function clear(sessionId) {
    if (!same(sessionId)) throw new Error('NOTIFICATION_SESSION_CHANGED')
    closeAll()
    return true
  }
  function dismiss(input) {
    if (!exactObject(input, ['sessionId', 'kind', 'eventId']) || !validSession(input.sessionId) ||
        !['message', 'call'].includes(input.kind) || typeof input.eventId !== 'string' ||
        !/^[A-Za-z0-9_-]{1,100}$/.test(input.eventId)) throw new Error('NOTIFICATION_INVALID_INPUT')
    if (!same(input.sessionId)) throw new Error('NOTIFICATION_SESSION_CHANGED')
    const key = `${input.kind}:${input.eventId}`, entry = active.get(key)
    if (entry) {
      active.delete(key); clearTimeout(entry.timer); entry.notification.close()
      entry.resolve({ shown: false, reason: 'cancelled' })
    }
    return true
  }
  async function show(input) {
    if (!exactObject(input, ['sessionId', 'conversationId', 'eventId', 'kind', 'senderId', 'createdAt']) ||
        !validSession(input.sessionId) || !validID(input.conversationId) || !validID(input.senderId) ||
        !['message', 'call'].includes(input.kind) || typeof input.eventId !== 'string' ||
        !/^[A-Za-z0-9_-]{1,100}$/.test(input.eventId) || typeof input.createdAt !== 'string' || input.createdAt.length > 40) {
      throw new Error('NOTIFICATION_INVALID_INPUT')
    }
    const scope = getScope(), window = getWindow(), timestamp = Date.parse(input.createdAt)
    if (!same(input.sessionId) || context?.sessionId !== input.sessionId) return { shown: false, reason: 'session' }
    if (!context.enabled || input.senderId === scope.userId) return { shown: false, reason: 'suppressed' }
    if (!Number.isFinite(timestamp) || now() - timestamp > 120000 || timestamp - now() > 60000) return { shown: false, reason: 'stale' }
    const key = `${input.kind}:${input.eventId}`
    if (seen.has(key)) return { shown: false, reason: 'duplicate' }
    seen.add(key)
    if (seen.size > 512) seen.delete(seen.values().next().value)
    if (window && !window.isDestroyed() && window.isVisible() && window.isFocused() &&
        (input.kind === 'call' || context.conversationId === input.conversationId)) return { shown: false, reason: 'focused' }
    if (input.kind === 'message' && now() - lastShown < 900) return { shown: false, reason: 'rate-limited' }
    if (!Notification.isSupported()) return { shown: false, reason: 'unavailable' }
    if (active.size >= 8) {
      const oldest = active.values().next().value
      clearTimeout(oldest.timer); oldest.notification.close(); oldest.resolve({ shown: false, reason: 'cancelled' })
      active.delete(oldest.key)
    }
    lastShown = now()
    return new Promise((resolve) => {
      let notification
      try {
        notification = new Notification({ title: 'SOCO',
          body: input.kind === 'call' ? 'Bạn có cuộc gọi đến. Mở SOCO để xem và trả lời.' : 'Bạn có tin nhắn mới. Mở SOCO để xem.',
          silent: !context.sound || input.kind === 'call' || Boolean(window && !window.isDestroyed() && window.isVisible() && window.isFocused()),
        })
      } catch { resolve({ shown: false, reason: 'unavailable' }); return }
      const entry = { key, notification, resolve, timer: undefined }
      active.set(key, entry)
      const failed = () => {
        clearTimeout(entry.timer)
        if (active.get(key) === entry) active.delete(key)
        resolve({ shown: false, reason: 'unavailable' })
        notification.close()
      }
      notification.once('failed', failed)
      notification.once('show', () => {
        clearTimeout(entry.timer)
        if (active.get(key) !== entry || !same(input.sessionId)) { notification.close(); resolve({ shown: false, reason: 'cancelled' }); return }
        resolve({ shown: true })
      })
      notification.once('close', () => {
        clearTimeout(entry.timer)
        if (active.get(key) === entry) active.delete(key)
        resolve({ shown: false, reason: 'closed' })
      })
      notification.once('click', () => {
        if (active.get(key) !== entry || !same(input.sessionId) || context?.sessionId !== input.sessionId) return
        clearTimeout(entry.timer); active.delete(key)
        showWindow()
        const target = getWindow()
        if (target && !target.isDestroyed()) target.webContents.send('soco:notification:clicked', {
          sessionId: input.sessionId, conversationId: input.conversationId, kind: input.kind,
        })
      })
      entry.timer = setTimeout(failed, 5000)
      entry.timer.unref?.()
      try { notification.show() } catch { failed() }
    })
  }
  return { sync, show, clear, dismiss, reset }
}

function registerNotificationIPC(ipcMain, notifications, trusted) {
  for (const action of ['sync', 'show', 'clear', 'dismiss']) ipcMain.handle(`soco:notification:${action}`, async (event, ...args) => {
    if (!trusted(event)) throw new Error('Forbidden IPC origin')
    if (args.length !== 1) throw new Error('NOTIFICATION_INVALID_INPUT')
    try { return await notifications[action](args[0]) } catch (error) {
      throw new Error(error instanceof Error && /^NOTIFICATION_[A-Z_]+$/.test(error.message) ? error.message : 'NOTIFICATION_UNAVAILABLE')
    }
  })
}

module.exports = { createNativeNotifications, registerNotificationIPC }
