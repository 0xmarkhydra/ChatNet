'use strict'

const { randomUUID } = require('node:crypto')

function registerScreenCapture({ ses, ipcMain, desktopCapturer, getWindow, getScope, trusted, trustedURL }) {
  let pending
  function current(record) {
    const window = getWindow()
    try {
      return window === record.window && !window.isDestroyed() && window.isVisible() && window.isFocused() &&
        getScope()?.sessionId === record.sessionId &&
        window.webContents.mainFrame === record.frame && trustedURL(record.frame.url)
    } catch { return false } // A destroyed/navigated WebFrameMain cannot authorize capture.
  }
  function finish(record, source) {
    if (pending !== record) return false
    pending = undefined
    clearTimeout(record.timer)
    let authorized = Boolean(source && current(record))
    try { record.callback(authorized ? { video: source } : {}) } catch { authorized = false }
    if (!record.window.isDestroyed()) record.window.webContents.send('soco:screen:picker', null)
    return authorized
  }
  ses.setDisplayMediaRequestHandler((request, callback) => {
    const window = getWindow(), scope = getScope()
    if (pending || !scope || !window || window.isDestroyed() || !window.isVisible() || !window.isFocused() ||
        !request.userGesture || !request.videoRequested || !request.frame || request.frame !== window.webContents.mainFrame ||
        !trustedURL(request.securityOrigin) || !trustedURL(request.frame.url)) {
      callback({}); return
    }
    const record = { id: randomUUID(), window, frame: request.frame, sessionId: scope.sessionId, callback, sources: [] }
    pending = record
    record.timer = setTimeout(() => finish(record), 60000)
    record.timer.unref?.()
    void desktopCapturer.getSources({ types: ['screen', 'window'], thumbnailSize: { width: 160, height: 90 }, fetchWindowIcons: false }).then((sources) => {
      if (pending !== record) return
      if (!current(record)) { finish(record); return }
      record.sources = sources.slice(0, 80)
      if (!record.sources.length) { finish(record); return }
      window.webContents.send('soco:screen:picker', { requestId: record.id,
        sources: record.sources.map((source, index) => ({ index, name: String(source.name).slice(0, 160), thumbnail: source.thumbnail.toDataURL() })),
      })
    }).catch(() => finish(record))
  }, { useSystemPicker: false })
  ipcMain.handle('soco:screen:select', (event, ...args) => {
    if (!trusted(event)) throw new Error('Forbidden IPC origin')
    if (args.length !== 2 || typeof args[0] !== 'string' || args[0].length > 64 ||
        (args[1] !== null && (!Number.isSafeInteger(args[1]) || args[1] < 0 || args[1] >= 80))) throw new Error('SCREEN_INVALID_SELECTION')
    const record = pending
    if (!record || args[0] !== record.id) throw new Error('SCREEN_REQUEST_EXPIRED')
    if (args[1] === null) { finish(record); return false }
    const source = record.sources[args[1]]
    if (!source || !current(record)) { finish(record); throw new Error('SCREEN_REQUEST_EXPIRED') }
    // Video only; the renderer never chooses a raw OS source ID or loopback audio.
    return finish(record, source)
  })
  return { reset: () => { if (pending) finish(pending) } }
}

module.exports = { registerScreenCapture }
