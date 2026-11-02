'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const { join } = require('node:path')
const { createHash } = require('node:crypto')
const { normalizeWindowState, readWindowState, writeWindowState } = require('../src/window-state.cjs')
const area = { x: 0, y: 24, width: 1440, height: 876 }

test('window defaults remain visible and close-to-tray is not silently enabled', () => {
  const state = normalizeWindowState(null, [area])
  assert.deepEqual(state.bounds, { x: 100, y: 62, width: 1240, height: 800 })
  assert.equal(state.closeToTray, null)
  assert.equal(state.maximized, false)
})
test('restores normal bounds on a secondary display', () => {
  const bounds = { x: -1200, y: 80, width: 1000, height: 700 }
  const state = normalizeWindowState({ bounds, maximized: true, closeToTray: true }, [area, { x: -1440, y: 0, width: 1440, height: 900 }])
  assert.deepEqual(state.bounds, bounds)
  assert.equal(state.maximized, true)
  assert.equal(state.closeToTray, true)
})
test('removed monitor and oversized window cannot leave UI offscreen', () => {
  const state = normalizeWindowState({ bounds: { x: -1600, y: -500, width: 2200, height: 1500 } }, [area])
  assert.deepEqual(state.bounds, { x: 0, y: 24, width: 1440, height: 876 })
})
test('invalid numbers and small displays are bounded', () => {
  for (const bounds of [{ x: NaN, y: 2, width: 800, height: 600 }, { x: 9e9, y: 0, width: Infinity, height: -1 }, { x: '1', y: 0, width: 900, height: 600 }]) {
    const state = normalizeWindowState({ bounds, maximized: 'yes', closeToTray: 'yes' }, [{ x: 0, y: 0, width: 640, height: 480 }])
    assert.deepEqual(state.bounds, { x: 0, y: 0, width: 640, height: 480 })
    assert.equal(state.maximized, false)
    assert.equal(state.closeToTray, null)
  }
})
test('window preference roundtrip is atomic and corrupt settings use defaults', (t) => {
  const directory = fs.mkdtempSync(join(os.tmpdir(), 'soco-window-unit-'))
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }))
  const file = join(directory, 'window.json')
  const state = normalizeWindowState({ closeToTray: true }, [area])
  writeWindowState(file, state)
  assert.deepEqual(readWindowState(file, [area]), state)
  assert.deepEqual(fs.readdirSync(directory), ['window.json'])
  fs.writeFileSync(file, '{bad')
  assert.equal(readWindowState(file, [area]).closeToTray, null)
})
test('tray raster matches the reviewed SOCO asset', () => {
  const png = Buffer.from(require('../src/tray-icon.cjs').split(',')[1], 'base64')
  assert.equal(createHash('sha256').update(png).digest('hex'), '7521ecd180f6f7962575080e5436957e4a295fc35d0cf76c83032a6331944970')
  assert.equal(png.readUInt32BE(16), 32)
  assert.equal(png.readUInt32BE(20), 32)
})
