'use strict'

const MEDIA_KINDS = new Set(['microphone', 'camera', 'screen'])
const knownStatuses = new Set(['not-determined', 'granted', 'denied', 'restricted', 'unknown'])
const kindForMediaType = (type) => type === 'audio' ? 'microphone' : type === 'video' ? 'camera' : null

function createMediaPermissions({ preferences, dialog, platform, getScope, getWindow }) {
  const grants = new Set()
  const pending = new Map()
  let epoch = 0
  function status(kind) {
    if (!MEDIA_KINDS.has(kind)) throw new Error('MEDIA_INVALID_KIND')
    if (platform !== 'darwin' && platform !== 'win32') return 'unknown'
    const value = preferences.getMediaAccessStatus(kind)
    return knownStatuses.has(value) ? value : 'unknown'
  }
  function hasGrant(kind) {
    const scope = getScope()
    return Boolean(scope && grants.has(`${scope.sessionId}:${kind}`) && status(kind) === 'granted')
  }
  async function request(kind) {
    if (kind !== 'microphone' && kind !== 'camera') throw new Error('MEDIA_INVALID_KIND')
    const scope = getScope(), window = getWindow()
    if (!scope || !window || window.isDestroyed()) throw new Error('MEDIA_SESSION_REQUIRED')
    if (hasGrant(kind)) return { granted: true, status: status(kind) }
    if (!window.isVisible() || !window.isFocused()) throw new Error('MEDIA_FOREGROUND_REQUIRED')
    const key = `${scope.sessionId}:${kind}`
    if (pending.has(key)) return pending.get(key)
    const revision = epoch
    const operation = (async () => {
      const initial = status(kind)
      if (initial !== 'granted' && initial !== 'not-determined') return { granted: false, status: initial }
      const answer = await dialog.showMessageBox(window, {
        type: 'question', title: 'Quyền thiết bị SOCO',
        message: kind === 'microphone' ? 'Cho phép SOCO sử dụng microphone?' : 'Cho phép SOCO sử dụng camera?',
        detail: 'Chỉ bật khi bạn ghi âm, quét mã hoặc tham gia cuộc gọi. Quyền này không cho phép AI dịch giọng nói; dịch cần sự đồng ý riêng trong cuộc gọi.',
        buttons: ['Không cho phép', 'Cho phép'], defaultId: 0, cancelId: 0, noLink: true,
      })
      if (answer.response !== 1 || revision !== epoch || getScope()?.sessionId !== scope.sessionId || window.isDestroyed()) {
        return { granted: false, status: 'denied' }
      }
      let granted = true
      if (platform === 'darwin' && initial === 'not-determined') granted = await preferences.askForMediaAccess(kind)
      const current = status(kind)
      granted = granted && current === 'granted' && revision === epoch &&
        getScope()?.sessionId === scope.sessionId && !window.isDestroyed()
      if (granted) grants.add(key)
      return { granted, status: current }
    })()
    pending.set(key, operation)
    try { return await operation } finally { if (pending.get(key) === operation) pending.delete(key) }
  }
  function reset() { epoch++; grants.clear(); pending.clear() }
  return { status, request, hasGrant, reset }
}

function registerMediaIPC(ipcMain, media, trusted) {
  for (const [channel, operation] of [['soco:media:status', media.status], ['soco:media:request', media.request]]) {
    ipcMain.handle(channel, async (event, ...args) => {
      if (!trusted(event)) throw new Error('Forbidden IPC origin')
      if (args.length !== 1 || typeof args[0] !== 'string' || !MEDIA_KINDS.has(args[0])) throw new Error('MEDIA_INVALID_KIND')
      try { return await operation(args[0]) } catch (error) {
        throw new Error(error instanceof Error && /^MEDIA_[A-Z_]+$/.test(error.message) ? error.message : 'MEDIA_UNAVAILABLE')
      }
    })
  }
}

module.exports = { createMediaPermissions, registerMediaIPC, kindForMediaType }
