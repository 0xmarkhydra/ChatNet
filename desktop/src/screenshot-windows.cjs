'use strict'

const { execFile } = require('node:child_process')
const { join } = require('node:path')

function createWindowsScreenReader({ app, nativeImage, screen }) {
  const helper = app.isPackaged
    ? join(process.resourcesPath, 'native', 'soco-screenshot.exe')
    : join(__dirname, '..', 'native', 'build', 'soco-screenshot.exe')

  return async function readScreen(display, target, signal) {
    const { x, y, width, height } = screen.dipToScreenRect(null, display.bounds)
    const pixels = width * height
    if (!Number.isSafeInteger(pixels) || width < 2 || height < 2 || pixels > 40 * 1024 * 1024) return null
    const bitmap = await new Promise((resolve, reject) => {
      execFile(helper, [x, y, width, height].map(String), {
        encoding: 'buffer', windowsHide: true, timeout: 2000, maxBuffer: pixels * 4, signal,
      }, (error, stdout) => error ? reject(error) : resolve(stdout))
    })
    if (signal.aborted || bitmap.length !== pixels * 4) return null
    const image = nativeImage.createFromBitmap(bitmap, { width, height })
    return width > target.width || height > target.height
      ? image.resize({ width: target.width, height: target.height })
      : image
  }
}
module.exports = { createWindowsScreenReader }
