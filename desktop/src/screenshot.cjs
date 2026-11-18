'use strict'

const { setTimeout: wait } = require('node:timers/promises')
const { selectScreenshotRegion } = require('./screenshot-overlay.cjs')

const CAPTURE_CHANNEL = 'soco:screenshot:capture'
const SHORTCUT_CHANNEL = 'soco:screenshot:shortcut'
const MODES = { KeyS: 'include', KeyA: 'exclude' }
const MAX_CAPTURE_EDGE = 4096
const MAX_CAPTURE_PIXELS = 3840 * 2160
const MAX_PNG_BYTES = 20 * 1024 * 1024 // Existing chat image limit.

function captureSize({ bounds, scaleFactor }) {
  const width = Math.round(bounds.width * scaleFactor), height = Math.round(bounds.height * scaleFactor)
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 2 || height < 2) {
    throw new Error('SCREENSHOT_DISPLAY_UNAVAILABLE')
  }
  const scale = Math.min(1, MAX_CAPTURE_EDGE / Math.max(width, height), Math.sqrt(MAX_CAPTURE_PIXELS / (width * height)))
  return { width: Math.floor(width * scale), height: Math.floor(height * scale) }
}

function validRegion(region, { width, height }) {
  return region && [region.x, region.y, region.width, region.height].every(Number.isSafeInteger) &&
    region.x >= 0 && region.y >= 0 && region.width >= 2 && region.height >= 2 &&
    region.x + region.width <= width && region.y + region.height <= height
}

async function waitForSources(sources, signal) {
  if (signal.aborted) return null
  let timeout, cancel
  const waitForEnd = new Promise((resolve, reject) => {
    cancel = () => resolve(null)
    timeout = setTimeout(() => reject(new Error('SCREENSHOT_CAPTURE_UNAVAILABLE')), 7000)
    timeout.unref?.()
    signal.addEventListener('abort', cancel, { once: true })
  })
  try {
    return await Promise.race([sources, waitForEnd])
  } finally {
    clearTimeout(timeout)
    signal.removeEventListener('abort', cancel)
  }
}

function registerScreenshotCapture({ app, ipcMain, BrowserWindow, desktopCapturer, screen, platform, clipboard,
  getWindow, getScope, trusted, trustedURL, readScreen, selectRegion = selectScreenshotRegion,
  settleWindow = (signal) => wait(120, undefined, { signal }),
}) {
  let pending, nativeCapture, quitting = false
  const alive = (window) => Boolean(window && !window.isDestroyed())
  function current(record, foreground = false) {
    try {
      const { window, frame, sessionId, userId } = record
      const scope = getScope()
      return !quitting && alive(window) && window === getWindow() && scope?.sessionId === sessionId && scope?.userId === userId &&
        frame === window.webContents.mainFrame && trustedURL(frame.url) &&
        (!foreground || (window.isVisible() && window.isFocused() && !window.isMinimized()))
    } catch { return false }
  }
  function reset() { pending?.controller.abort() }
  app.on('before-quit', () => { quitting = true; reset() })

  ipcMain.handle(CAPTURE_CHANNEL, async (event, ...args) => {
    if (!trusted(event)) throw new Error('Forbidden IPC origin')
    if (platform !== 'win32') throw new Error('SCREENSHOT_UNSUPPORTED')
    const [mode] = args
    if (args.length !== 1 || (mode !== 'include' && mode !== 'exclude')) throw new Error('SCREENSHOT_INVALID_INPUT')
    if (pending || nativeCapture) throw new Error('SCREENSHOT_BUSY')
    const window = getWindow(), scope = getScope()
    const record = { window, frame: event.senderFrame, sessionId: scope?.sessionId, userId: scope?.userId, controller: new AbortController() }
    if (!scope || !current(record, true)) throw new Error('SCREENSHOT_INACTIVE_WINDOW')
    pending = record
    const { signal } = record.controller
    let hidden = false, selecting = false, previousOpacity
    try {
      const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint())
      const thumbnailSize = captureSize(display)
      if (mode === 'exclude') {
        // Windows must repaint the newly exposed desktop before the native grab.
        if (readScreen && typeof window.getOpacity === 'function' && typeof window.setOpacity === 'function') {
          // A hidden Windows window can remain in the compositor's fade-out animation.
          previousOpacity = window.getOpacity()
          window.setOpacity(0)
        }
        window.hide()
        hidden = !window.isVisible()
        if (!hidden) throw new Error('SCREENSHOT_CAPTURE_UNAVAILABLE')
      }
      // The Windows helper captures the selected display directly after the compositor presents.
      // Keep Electron's slower path for machines where the native grab is unavailable.
      let screenshot
      if (readScreen && !signal.aborted && current(record, mode === 'include')) {
        try { screenshot = await readScreen(display, thumbnailSize, signal) } catch { /* Use Electron if the helper fails. */ }
      }
      if (signal.aborted || !current(record, mode === 'include') || (hidden && window.isVisible())) return null
      if (!screenshot || screenshot.isEmpty()) {
        if (hidden) await settleWindow(signal)
        if (signal.aborted || !current(record, mode === 'include') || (hidden && window.isVisible())) return null
        const sourceRequest = desktopCapturer.getSources({ types: ['screen'], thumbnailSize, fetchWindowIcons: false })
        // Electron can share identical overlapping getSources() promises. Never reuse an aborted mode's frame.
        nativeCapture = sourceRequest
        const releaseSources = () => { nativeCapture = undefined }
        void sourceRequest.then(releaseSources, releaseSources)
        const sources = await waitForSources(sourceRequest, signal)
        if (signal.aborted || !current(record, mode === 'include') || (hidden && window.isVisible())) return null
        screenshot = sources?.find(source => source.display_id === String(display.id))?.thumbnail
      }
      if (!screenshot || screenshot.isEmpty()) throw new Error('SCREENSHOT_DISPLAY_UNAVAILABLE')
      const size = screenshot.getSize(1)
      selecting = true
      const region = await selectRegion({ BrowserWindow, ipcMain, display, screenshot, signal })
      if (!region || signal.aborted || !current(record)) return null
      if (!validRegion(region, size)) throw new Error('SCREENSHOT_INVALID_REGION')
      const cropped = screenshot.crop(region)
      if (cropped.isEmpty()) throw new Error('SCREENSHOT_INVALID_REGION')
      const png = cropped.toPNG({ scaleFactor: 1 })
      if (!png.length || png.length > MAX_PNG_BYTES) throw new Error('SCREENSHOT_SIZE_LIMIT')
      clipboard.writeImage(cropped)
      return true
    } catch (error) {
      if (signal.aborted || !current(record)) return null
      const known = ['SCREENSHOT_CAPTURE_UNAVAILABLE', 'SCREENSHOT_DISPLAY_UNAVAILABLE', 'SCREENSHOT_SELECTOR_UNAVAILABLE',
        'SCREENSHOT_INVALID_REGION', 'SCREENSHOT_SIZE_LIMIT']
      throw new Error(error instanceof Error && known.includes(error.message) ? error.message : 'SCREENSHOT_CAPTURE_UNAVAILABLE')
    } finally {
      try {
        if (!quitting && window === getWindow() && alive(window)) {
          if (previousOpacity !== undefined) window.setOpacity(previousOpacity)
          if (hidden && !window.isVisible()) window.showInactive()
          if ((hidden || selecting) && !signal.aborted && current(record) && window.isVisible()) window.focus()
        }
      } finally { pending = undefined }
    }
  })

  function attach(window) {
    if (platform !== 'win32') return
    window.webContents.on('before-input-event', (event, input) => {
      const mode = Object.hasOwn(MODES, input.code) ? MODES[input.code] : undefined
      if (!mode || input.type !== 'keyDown' || !input.control || !input.alt || input.shift || input.meta || input.isComposing) return
      const frame = window.webContents.mainFrame, scope = getScope()
      if (!scope || !current({ window, frame, sessionId: scope.sessionId, userId: scope.userId }, true)) return
      event.preventDefault()
      if (!input.isAutoRepeat && !pending && !nativeCapture) window.webContents.send(SHORTCUT_CHANNEL, mode)
    })
  }
  return { attach, reset }
}

module.exports = { registerScreenshotCapture }
