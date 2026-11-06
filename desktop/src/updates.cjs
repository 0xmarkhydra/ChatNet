'use strict'

const { existsSync } = require('node:fs')
const { join } = require('node:path')

const CHECK_EVERY_MS = 4 * 60 * 60 * 1000
const STARTUP_DELAY_MS = 15_000
const safeVersion = (value) => typeof value === 'string' && /^[0-9A-Za-z.+-]{1,48}$/.test(value) ? value : ''

// Update operations stay in Electron Main. The renderer only receives bounded status
// and can explicitly request check/download/install; it never controls feed or files.
function createDesktopUpdates({
  app, ipcMain, dialog, getWindow, trusted, getUpdater,
  platform = process.platform, resourcesPath = process.resourcesPath,
  fileExists = existsSync, schedule = setTimeout, repeat = setInterval,
  cancelSchedule = clearTimeout, cancelRepeat = clearInterval,
}) {
  const supported = platform === 'win32' || platform === 'darwin'
  // Internal/unapproved packages have no app-update.yml: fail closed.
  const enabled = Boolean(app.isPackaged && supported && fileExists(join(resourcesPath, 'app-update.yml')))
  const updater = enabled ? getUpdater() : null
  let state = { status: enabled ? 'idle' : 'disabled', version: '', progress: 0 }
  let checking = false
  let downloading = false
  let installing = false
  let lastCheck = 0
  let startupTimer
  let interval
  let started = false

  const snapshot = () => ({ ...state, currentVersion: app.getVersion() })
  const send = () => {
    const window = getWindow()
    if (window && !window.isDestroyed()) window.webContents.send('soco:update:status', snapshot())
  }
  const setState = (next) => { state = { ...state, ...next }; send(); return snapshot() }
  const authorized = (event) => {
    if (!trusted(event)) throw new Error('Forbidden IPC origin')
  }

  async function check(silent = false) {
    if (!enabled || checking || downloading || installing || state.status === 'downloaded') return snapshot()
    checking = true
    lastCheck = Date.now()
    setState({ status: 'checking', version: '', progress: 0 })
    try {
      await updater.checkForUpdates()
      // electron-updater normally emits update-available or update-not-available.
      if (state.status === 'checking') setState({ status: 'idle' })
    } catch {
      setState({ status: silent ? 'idle' : 'error' })
    } finally { checking = false }
    return snapshot()
  }

  async function download() {
    if (!enabled || installing || downloading || state.status !== 'available') return snapshot()
    downloading = true
    setState({ status: 'downloading', progress: 0 })
    try {
      await updater.downloadUpdate()
      // A 'downloaded' event will set the final version and state.
    } catch { setState({ status: 'error' }) }
    finally { downloading = false }
    return snapshot()
  }

  async function install(event, options) {
    authorized(event)
    if (!enabled || installing || state.status !== 'downloaded') return false
    // Do not trust renderer-reported safety on its own. Never install silently.
    // The UI blocks pending outbox items; the native confirmation also explicitly
    // warns about active calls, uploads and unsaved work.
    if (!options || options.hasPendingWork !== false) return false
    const window = getWindow()
    if (!window || window.isDestroyed() || !window.isVisible()) return false
    const answer = await dialog.showMessageBox(window, {
      type: 'question',
      title: 'Cài đặt cập nhật SocCO',
      message: 'Đã kết thúc cuộc gọi và lưu các công việc đang thực hiện?',
      detail: 'SocCO sẽ đóng để cài bản cập nhật. Tin nhắn chưa gửi và bản nháp đã lưu sẽ không bị xóa. Nếu đang gọi, tải file hoặc có tin chưa xác nhận, hãy chọn Để sau.',
      buttons: ['Để sau', 'Cài đặt và khởi động lại'], defaultId: 0, cancelId: 0, noLink: true,
    })
    if (answer.response !== 1 || state.status !== 'downloaded' || installing) return false
    installing = true
    try { updater.quitAndInstall(false, true); return true } catch {
      installing = false
      setState({ status: 'error' })
      return false
    }
  }

  function bind() {
    ipcMain.handle('soco:update:state', (event) => { authorized(event); return snapshot() })
    ipcMain.handle('soco:update:check', (event) => { authorized(event); return check() })
    ipcMain.handle('soco:update:download', (event) => { authorized(event); return download() })
    ipcMain.handle('soco:update:install', (event, options) => install(event, options))
    if (!enabled) return
    updater.autoDownload = false
    updater.autoInstallOnAppQuit = false
    updater.allowDowngrade = false
    updater.allowPrerelease = false
    updater.on('checking-for-update', () => { if (!downloading) setState({ status: 'checking' }) })
    updater.on('update-available', (info) => setState({ status: 'available', version: safeVersion(info?.version), progress: 0 }))
    updater.on('update-not-available', () => setState({ status: 'idle', version: '', progress: 0 }))
    updater.on('download-progress', (info) => {
      if (downloading) setState({ status: 'downloading', progress: Math.max(0, Math.min(100, Math.floor(info?.percent || 0))) })
    })
    updater.on('update-downloaded', (info) => setState({ status: 'downloaded', version: safeVersion(info?.version) || state.version, progress: 100 }))
    updater.on('error', () => setState({ status: 'error' }))
  }

  function start() {
    if (!enabled || started) return
    started = true
    lastCheck = Date.now()
    startupTimer = schedule(() => { void check(true) }, STARTUP_DELAY_MS)
    interval = repeat(() => { void check(true) }, CHECK_EVERY_MS)
  }
  function checkOnFocus() {
    if (enabled && Date.now() - lastCheck > 15 * 60_000) void check(true)
  }
  function stop() {
    cancelSchedule(startupTimer)
    cancelRepeat(interval)
    started = false
  }
  bind()
  return { start, check, checkOnFocus, stop, snapshot }
}

module.exports = { createDesktopUpdates }
