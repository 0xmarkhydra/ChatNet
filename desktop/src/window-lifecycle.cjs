'use strict'

const { app, screen, Tray, Menu, nativeImage, dialog } = require('electron')
const { join } = require('node:path')
const { normalizeWindowState, readWindowState, writeWindowState } = require('./window-state.cjs')
const trayIcon = require('./tray-icon.cjs')

function createWindowLifecycle(getWindow, showWindow) {
  const file = join(app.getPath('userData'), 'settings', 'window.json')
  const areas = () => [screen.getPrimaryDisplay(), ...screen.getAllDisplays().filter((d) => d.id !== screen.getPrimaryDisplay().id)].map((d) => d.workArea)
  let state = readWindowState(file, areas())
  let tray
  let timer
  let quitting = false
  let unreadCount = 0

  function setUnread(count) {
    unreadCount = count
    const label = count === null ? '' : count > 99 ? '99+' : count > 0 ? String(count) : ''
    app.dock?.setBadge(label)
    const window = getWindow()
    if (process.platform === 'win32' && window && !window.isDestroyed()) {
      window.setOverlayIcon(label ? nativeImage.createFromDataURL(trayIcon).resize({ width: 32, height: 32 }) : null,
        label ? `${label} tin nhắn chưa đọc` : '')
    }
    tray?.setToolTip(count === null ? 'SOCO — chưa đồng bộ số tin chưa đọc' : label ? `SOCO — ${label} tin chưa đọc` : 'SOCO')
    if (process.platform === 'darwin') tray?.setTitle(label)
  }

  function save() {
    clearTimeout(timer)
    const window = getWindow()
    if (window && !window.isDestroyed()) {
      state = normalizeWindowState({ ...state, bounds: window.getNormalBounds(), maximized: window.isMaximized() }, areas())
    }
    try { writeWindowState(file, state) } catch { console.warn('SOCO could not save window settings') }
  }
  function quit() { quitting = true; save(); app.quit() }
  function refreshTrayMenu() {
    tray?.setContextMenu(Menu.buildFromTemplate([
      { label: 'Mở SOCO', click: showWindow },
      { label: 'Thu nhỏ', click: () => getWindow()?.minimize() },
      { label: 'Đóng cửa sổ xuống khay', type: 'checkbox', checked: state.closeToTray === true,
        click: (item) => { state.closeToTray = item.checked; save(); refreshTrayMenu() } },
      { type: 'separator' },
      { label: 'Thoát SOCO', click: quit },
    ]))
  }
  try {
    const image = nativeImage.createFromDataURL(trayIcon).resize({ width: 18, height: 18 })
    if (!image.isEmpty()) {
      tray = new Tray(image)
      tray.setToolTip('SOCO')
      tray.on('click', showWindow)
      tray.on('double-click', showWindow)
      refreshTrayMenu()
    }
  } catch { console.warn('SOCO tray unavailable; close-to-tray disabled') }

  Menu.setApplicationMenu(Menu.buildFromTemplate([
    ...(process.platform === 'darwin' ? [{ role: 'appMenu' }] : [{ label: 'SOCO', submenu: [{ label: 'Thoát SOCO', accelerator: 'CmdOrCtrl+Q', click: quit }] }]),
    { role: 'editMenu' },
    { label: 'Cửa sổ', submenu: [{ role: 'minimize' }, { role: 'zoom' }, { label: 'Mở SOCO', click: showWindow }, { role: 'close' }] },
  ]))

  function visibleBounds() {
    state = normalizeWindowState(state, areas())
    return state.bounds
  }
  function attach(window) {
    setUnread(unreadCount)
    if (state.maximized) window.maximize()
    const scheduleSave = () => { clearTimeout(timer); timer = setTimeout(save, 300) }
    for (const event of ['resize', 'move', 'maximize', 'unmaximize']) window.on(event, scheduleSave)
    window.on('close', (event) => {
      save()
      if (quitting) return
      if (tray && state.closeToTray === null) {
        const answer = dialog.showMessageBoxSync(window, {
          type: 'question', title: 'Đóng SOCO',
          message: 'Thu nhỏ SOCO xuống khay để tiếp tục nhận tin và cuộc gọi?',
          detail: 'Thoát hẳn sẽ dừng nhận tin realtime. Có thể đổi lựa chọn từ menu biểu tượng SOCO ở khay hệ thống.',
          buttons: ['Thu nhỏ xuống khay', 'Thoát SOCO'], defaultId: 0, cancelId: 1,
        })
        state.closeToTray = answer === 0
        save(); refreshTrayMenu()
      }
      if (tray && state.closeToTray) { event.preventDefault(); window.hide(); return }
      quitting = true
      app.quit()
    })
  }
  const restoreVisibleBounds = () => {
    const window = getWindow()
    if (!window || window.isDestroyed()) return
    const maximized = window.isMaximized()
    state = normalizeWindowState({ ...state, bounds: window.getNormalBounds() }, areas())
    if (maximized) window.unmaximize()
    window.setBounds(state.bounds)
    if (maximized) window.maximize()
  }
  screen.on('display-removed', restoreVisibleBounds)
  screen.on('display-metrics-changed', restoreVisibleBounds)
  app.on('before-quit', () => { quitting = true; save() })
  app.on('will-quit', () => {
    clearTimeout(timer)
    screen.removeListener('display-removed', restoreVisibleBounds)
    screen.removeListener('display-metrics-changed', restoreVisibleBounds)
    tray?.destroy()
  })
  return { visibleBounds, attach, quit, setUnread, hasTray: () => Boolean(tray) }
}

module.exports = { createWindowLifecycle }
