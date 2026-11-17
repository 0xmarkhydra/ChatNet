'use strict'

const { join } = require('node:path')
const { pathToFileURL } = require('node:url')

const PAGE_URL = pathToFileURL(join(__dirname, 'screenshot-overlay.html')).href
const BITMAP = 'soco:screenshot-overlay:bitmap'
const READY = 'soco:screenshot-overlay:ready'
const RESULT = 'soco:screenshot-overlay:result'

// Normalized viewport coordinates keep the selection independent of the display's DPI.
function normalizeScreenshotRegion(selection, imageSize) {
  if (!selection || typeof selection !== 'object' || Array.isArray(selection) ||
      !imageSize || !['width', 'height'].every((key) => Number.isSafeInteger(imageSize[key]) && imageSize[key] > 0)) return null
  const keys = ['left', 'top', 'right', 'bottom']
  if (Object.keys(selection).length !== keys.length ||
      !keys.every((key) => Object.hasOwn(selection, key) &&
        Number.isFinite(selection[key]) && selection[key] >= 0 && selection[key] <= 1)) return null
  const { left, top, right, bottom } = selection
  if (left >= right || top >= bottom) return null
  const x = Math.floor(left * imageSize.width), y = Math.floor(top * imageSize.height)
  const width = Math.ceil(right * imageSize.width) - x, height = Math.ceil(bottom * imageSize.height) - y
  return width >= 2 && height >= 2 ? { x, y, width, height } : null
}

function selectScreenshotRegion({ BrowserWindow, ipcMain, display, screenshot, signal, timeoutMs = 60000 }) {
  if (signal?.aborted) return Promise.resolve(null)
  return new Promise((resolve, reject) => {
    const imageSize = screenshot.getSize(1)
    // The preview can be compressed. The final crop still uses the original bitmap.
    const preview = 'data:image/jpeg;base64,' + screenshot.toJPEG(86).toString('base64')
    let window, timer, loaded = false, settled = false
    const trusted = (event) => {
      try {
        return !settled && window && !window.isDestroyed() && event.sender === window.webContents &&
          event.senderFrame && event.senderFrame === window.webContents.mainFrame && event.senderFrame.url === PAGE_URL
      } catch { return false }
    }
    function finish(region, failed = false) {
      if (settled) return
      settled = true
      clearTimeout(timer)
      signal?.removeEventListener('abort', cancel)
      ipcMain.removeListener(READY, onReady)
      ipcMain.removeListener(RESULT, onResult)
      if (window && !window.isDestroyed()) window.destroy()
      if (failed) reject(new Error('SCREENSHOT_SELECTOR_UNAVAILABLE'))
      else resolve(region)
    }
    function cancel() { finish(null) }
    function onReady(event, ok) {
      if (loaded || !trusted(event)) return
      if (ok !== true) { finish(null, true); return }
      loaded = true
      try { window.show(); window.focus() } catch { finish(null, true) }
    }
    function onResult(event, selection) {
      if (!loaded || !trusted(event)) return
      if (selection === null) { cancel(); return }
      const region = normalizeScreenshotRegion(selection, imageSize)
      if (region) finish(region)
    }
    try {
      window = new BrowserWindow({
        ...display.bounds, show: false, frame: false, skipTaskbar: true, resizable: false,
        movable: false, fullscreenable: false, backgroundColor: '#111827',
        webPreferences: {
          preload: join(__dirname, 'screenshot-overlay-preload.cjs'), contextIsolation: true, sandbox: true,
          partition: 'soco-screenshot-overlay', nodeIntegration: false, webSecurity: true,
          allowRunningInsecureContent: false, webviewTag: false, devTools: false, backgroundThrottling: false,
        },
      })
      // Keep the frozen bitmap out of any concurrent screen share when the OS supports it.
      window.setContentProtection?.(true)
      window.setAlwaysOnTop(true, 'screen-saver')
      const contents = window.webContents
      contents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false))
      contents.session.setPermissionCheckHandler(() => false)
      contents.setWindowOpenHandler(() => ({ action: 'deny' }))
      contents.on('will-navigate', (event) => event.preventDefault())
      contents.on('will-redirect', (event) => event.preventDefault())
      contents.on('render-process-gone', () => finish(null, true))
      window.on('closed', cancel)
      ipcMain.on(READY, onReady)
      ipcMain.on(RESULT, onResult)
      signal?.addEventListener('abort', cancel, { once: true })
      timer = setTimeout(cancel, timeoutMs)
      timer.unref?.()
      if (signal?.aborted) { cancel(); return }
      void window.loadURL(PAGE_URL).then(() => {
        if (!settled) contents.send(BITMAP, preview)
      }).catch(() => finish(null, true))
    } catch { finish(null, true) }
  })
}

module.exports = { normalizeScreenshotRegion, selectScreenshotRegion }
