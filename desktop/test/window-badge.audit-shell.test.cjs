'use strict'

const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { createRequire } = require('node:module')
const { resolve } = require('node:path')
const test = require('node:test')
const { runInNewContext } = require('node:vm')

const lifecyclePath = resolve(__dirname, '../src/window-lifecycle.cjs')
const requireLifecycleDependency = createRequire(lifecyclePath)
const trayLogo = requireLifecycleDependency('./tray-icon.cjs')

function badgeHarness(platform = 'win32') {
  const overlayCalls = []
  const flashes = []
  const events = new Map()
  const state = { minimized: false, focused: false, visible: true, destroyed: false }
  const tooltips = []
  const trayIcons = []
  const dockBadges = []
  const trayTitles = []
  const display = { id: 1, workArea: { x: 0, y: 0, width: 1440, height: 900 } }
  const electron = {
    app: { getPath: () => '/unused-electron-user-data', on() {}, dock: platform === 'darwin' ? { setBadge: label => dockBadges.push(label) } : undefined },
    screen: { getPrimaryDisplay: () => display, getAllDisplays: () => [display], on() {} },
    Menu: { buildFromTemplate: items => items, setApplicationMenu() {} },
    Tray: class {
      constructor(icon) { trayIcons.push(icon) }
      setTitle(title) { trayTitles.push(title) }
      setToolTip(text) { tooltips.push(text) }
      on() {}
      setContextMenu() {}
    },
    nativeImage: {
      createFromDataURL(source) { return image(source) },
      createFromBitmap(source, size) { return { source, size } },
    },
  }
  function image(source) {
    return { source, resize: () => image(source), isEmpty: () => false }
  }
  const module = { exports: {} }
  runInNewContext(readFileSync(lifecyclePath, 'utf8'), {
    module,
    require: id => id === 'electron' ? electron : id === './window-state.cjs' ? { readWindowState: () => ({}) } : requireLifecycleDependency(id),
    process: { platform },
  }, { filename: lifecyclePath })
  const window = {
    isDestroyed: () => state.destroyed,
    isFocused: () => state.focused,
    isVisible: () => state.visible,
    isMinimized: () => state.minimized,
    flashFrame(flag) { flashes.push(flag) },
    on(event, listener) { events.set(event, listener) },
    setOverlayIcon(icon, description) { overlayCalls.push({ icon, description }) },
  }
  return { ...module.exports.createWindowLifecycle(() => window, () => {}), overlayCalls, tooltips, trayIcons, dockBadges, trayTitles, state, window, events, flashes }
}

test('Windows taskbar badge caps the unread label and clears on zero or unavailable', () => {
  const lifecycle = badgeHarness()
  for (const count of [0, 1, 99, 100, null, 2, 0]) lifecycle.setUnread(count)
  assert.deepEqual(lifecycle.overlayCalls.map(call => [Boolean(call.icon), call.description]), [
    [false, ''],
    [true, '1 tin nhắn chưa đọc'],
    [true, '99 tin nhắn chưa đọc'],
    [true, '99+ tin nhắn chưa đọc'],
    [false, ''],
    [true, '2 tin nhắn chưa đọc'],
    [false, ''],
  ])
  assert.ok(lifecycle.tooltips.includes('SocCO — chưa đồng bộ số tin chưa đọc'))
  assert.equal(lifecycle.tooltips.at(-1), 'SocCO')
})

test('Windows unread indication uses a dedicated 16×16 overlay without changing the tray logo', () => {
  const lifecycle = badgeHarness()
  lifecycle.setUnread(3)
  const { icon, description } = lifecycle.overlayCalls.at(-1)
  assert.ok(icon, 'Unread messages should continue to have an indicator')
  assert.equal(description, '3 tin nhắn chưa đọc')
  assert.notEqual(icon.source, trayLogo, 'The app icon already represents SocCO; the overlay must not reuse the tray logo')
  assert.deepEqual(lifecycle.trayIcons.map(image => image.source), [trayLogo])
  assert.deepEqual([icon.size.width, icon.size.height], [16, 16])
  assert.equal(icon.source.length, 16 * 16 * 4)
  lifecycle.setUnread(12)
  assert.notDeepEqual(lifecycle.overlayCalls.at(-1).icon.source, icon.source)
  lifecycle.setUnread(99)
  const ninetyNine = lifecycle.overlayCalls.at(-1).icon.source
  lifecycle.setUnread(100)
  const capped = lifecycle.overlayCalls.at(-1).icon.source
  assert.notDeepEqual(capped, ninetyNine, 'the plus glyph is visible at 100')
  lifecycle.setUnread(1200)
  assert.deepEqual(lifecycle.overlayCalls.at(-1).icon.source, capped)
})

for (const platform of ['darwin', 'linux']) {
  test(`Unread updates leave the tray icon unchanged and skip Windows overlays on ${platform}`, () => {
    const lifecycle = badgeHarness(platform)
    for (const count of [100, 0]) lifecycle.setUnread(count)
    lifecycle.requestAttention()
    assert.deepEqual(lifecycle.overlayCalls, [])
    assert.deepEqual(lifecycle.flashes, [])
    assert.deepEqual(lifecycle.trayIcons.map(image => image.source), [trayLogo])
    if (platform === 'darwin') {
      assert.deepEqual(lifecycle.dockBadges, ['99+', ''])
      assert.deepEqual(lifecycle.trayTitles, ['99+', ''])
    }
  })
}

test('a background or minimized window flashes once and reads back the red marker', () => {
  const lifecycle = badgeHarness()
  lifecycle.attach(lifecycle.window)
  lifecycle.setUnread(1)
  assert.deepEqual(lifecycle.flashes, [], 'sync alone must not flash')
  const markerPixel = (15 * 16 + 8) * 4
  assert.equal(lifecycle.overlayCalls.at(-1).icon.source[markerPixel + 3], 0)
  lifecycle.state.minimized = true
  lifecycle.state.visible = false
  lifecycle.requestAttention()
  lifecycle.requestAttention()
  assert.deepEqual(lifecycle.flashes, [true], 'coalesce repeated requests')
  const bitmap = lifecycle.overlayCalls.at(-1).icon.source
  assert.ok(bitmap[markerPixel + 3] > 0 && bitmap[markerPixel + 2] > bitmap[markerPixel + 1])

  lifecycle.state.minimized = false
  lifecycle.state.visible = true
  lifecycle.state.focused = true
  lifecycle.events.get('focus')()
  assert.deepEqual(lifecycle.flashes, [true, false])
  assert.equal(lifecycle.overlayCalls.at(-1).description, '1 tin nhắn chưa đọc')
  assert.equal(lifecycle.overlayCalls.at(-1).icon.source[markerPixel + 3], 0)
  lifecycle.requestAttention()
  assert.deepEqual(lifecycle.flashes, [true, false], 'never flash a focused window')

  lifecycle.state.focused = false
  lifecycle.state.visible = false
  lifecycle.requestAttention()
  assert.deepEqual(lifecycle.flashes, [true, false], 'do not reopen a window hidden to the tray')
  lifecycle.state.visible = true
  lifecycle.requestAttention()
  lifecycle.setUnread(2, false)
  assert.deepEqual(lifecycle.flashes, [true, false, true, false], 'turning notifications off stops attention')
  assert.ok(lifecycle.overlayCalls.at(-1).icon, 'turning notifications off leaves the count')
  lifecycle.requestAttention()
  lifecycle.setUnread(0)
  assert.deepEqual(lifecycle.flashes, [true, false, true, false, true, false])
  assert.equal(lifecycle.overlayCalls.at(-1).icon, null)
})

test('every count uses the same round silhouette with a smooth transparent edge', () => {
  const { drawTaskbarBadge } = requireLifecycleDependency('./taskbar-badge.cjs')
  const alpha = (image, x, y) => image[(y * 16 + x) * 4 + 3]
  const single = drawTaskbarBadge('3', false)
  const double = drawTaskbarBadge('12', false)
  const capped = drawTaskbarBadge('99+', false)
  assert.equal(alpha(single, 2, 1), 0, 'the corner outside the circle must be transparent')
  assert.ok(single.some((value, i) => i % 4 === 3 && value > 0 && value < 255), 'smooth the circle edge')
  assert.deepEqual([...single.subarray((16 + 8) * 4, (16 + 9) * 4)], [13, 0, 235, 255], 'keep the circle red without a white ring')
  assert.equal(alpha(single, 8, 7), 255)
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      assert.equal(alpha(single, x, y), alpha(double, x, y))
      assert.equal(alpha(single, x, y), alpha(capped, x, y))
    }
  }
})
