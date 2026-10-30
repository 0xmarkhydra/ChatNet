'use strict'

const { app, BrowserWindow, ipcMain, protocol, net, session, shell, safeStorage } = require('electron')
const { createCredentialVault } = require('./auth-vault.cjs')
const { createAuthBroker } = require('./auth-broker.cjs')
const { registerAuthIPC } = require('./auth-ipc.cjs')
const { createWindowLifecycle } = require('./window-lifecycle.cjs')
const { join, isAbsolute } = require('node:path')

// Explicit launcher-only profile selection lets QA run without touching the user's account or queue.
const profile = app.commandLine.getSwitchValue('user-data-dir')
if (profile) {
  if (!isAbsolute(profile)) throw new Error('SOCO profile path must be absolute')
  app.setPath('userData', profile)
}
const { pathToFileURL } = require('node:url')
const { trustedRendererURL, safeExternalURL, isSafeAssetPath } = require('./ipc-policy.cjs')

const dev = !app.isPackaged && process.argv.includes('--dev')
const DEV_URL = 'http://127.0.0.1:5173/'
const APP_URL = 'app://soco/index.html'
const API_ORIGIN = dev ? 'http://localhost:8080' : 'https://api-chat.codelocal.cloud'
const CSP = [
  "default-src 'self'", "base-uri 'none'", "object-src 'none'", "frame-ancestors 'none'",
  "form-action 'self'", "script-src 'self'", "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:", "font-src 'self' data:",
  "media-src 'self' blob: https:", "connect-src 'self' https: wss:", "worker-src 'self' blob:"
].join('; ')

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } }
])

let mainWindow
let windowLifecycle
const hasLock = app.requestSingleInstanceLock()
if (!hasLock) app.quit()

function showMainWindow() {
  if (!mainWindow) createMainWindow()
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.show()
  mainWindow.focus()
}

function isTrustedFrame(event) {
  if (!mainWindow || mainWindow.isDestroyed() || event.sender !== mainWindow.webContents ||
      !event.senderFrame || event.senderFrame !== mainWindow.webContents.mainFrame) return false
  return trustedRendererURL(event.senderFrame.url, dev)
}

function attachHandlers() {
  const vault = createCredentialVault(join(app.getPath('userData'), 'credentials'), safeStorage)
  const broker = createAuthBroker({
    vault, baseURL: API_ORIGIN, userAgent: `SOCO Desktop/${app.getVersion()} (${process.platform})`,
    onExpired: (sessionId, userId) => {
      if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('soco:auth:expired', sessionId, userId)
    },
  })
  registerAuthIPC(ipcMain, broker, isTrustedFrame)
  ipcMain.handle('soco:platform-info', (event) => {
    if (!isTrustedFrame(event)) throw new Error('Forbidden IPC origin')
    return { platform: process.platform, version: app.getVersion(), packaged: app.isPackaged, apiOrigin: API_ORIGIN }
  })
  ipcMain.handle('soco:open-external', async (event, url) => {
    if (!isTrustedFrame(event)) throw new Error('Forbidden IPC origin')
    const safeURL = safeExternalURL(url)
    if (!safeURL) return false
    await shell.openExternal(safeURL)
    return true
  })
}

async function registerAppProtocol() {
  const assetsRoot = join(__dirname, '..', 'dist', 'renderer')
  protocol.handle('app', async (request) => {
    const url = new URL(request.url)
    if (url.hostname !== 'soco' || url.username || url.password || url.port ||
        (request.method !== 'GET' && request.method !== 'HEAD')) return new Response('Not found', { status: 404 })
    const file = isSafeAssetPath(assetsRoot, url.pathname === '/' ? '/index.html' : url.pathname)
    if (!file) return new Response('Invalid asset path', { status: 403 })
    try {
      const result = await net.fetch(pathToFileURL(file).toString())
      if (!result.ok) return new Response('Not found', { status: 404 })
      const headers = new Headers(result.headers)
      headers.set('Content-Security-Policy', CSP)
      headers.set('X-Content-Type-Options', 'nosniff')
      return new Response(request.method === 'HEAD' ? null : result.body, { status: result.status, headers })
    } catch { return new Response('Not found', { status: 404 }) }
  })
}

function configureSecurity() {
  const trusted = (contents) => Boolean(contents && mainWindow && contents === mainWindow.webContents &&
    trustedRendererURL(contents.getURL(), dev))
  session.defaultSession.setPermissionRequestHandler((contents, permission, callback, details) => {
    const kinds = details.mediaTypes || []
    callback(Boolean(trusted(contents) && details.isMainFrame && permission === 'media' &&
      kinds.length > 0 && kinds.every((kind) => kind === 'audio' || kind === 'video')))
  })
  session.defaultSession.setPermissionCheckHandler((contents, permission, requestingOrigin) =>
    Boolean(trusted(contents) && trustedRendererURL(requestingOrigin, dev) && permission === 'media'))
  // Main uses Node fetch, outside Chromium. Renderer must never receive a refresh credential via HTTP.
  const publicAuthPaths = new Set(['/api/auth/email/start', '/api/auth/email/resend', '/api/auth/session/status'])
  session.defaultSession.webRequest.onBeforeRequest({ urls: ['http://*/*', 'https://*/*'] }, (details, callback) => {
    let blocked = false
    try {
      const path = decodeURIComponent(new URL(details.url).pathname)
      blocked = /^\/api\/auth(?:\/|$)/.test(path) && !publicAuthPaths.has(path)
    } catch { blocked = true }
    callback({ cancel: blocked })
  })
  app.on('web-contents-created', (_event, contents) => {
    contents.on('will-attach-webview', (event) => event.preventDefault())
  })
}

function createMainWindow() {
  const bounds = windowLifecycle.visibleBounds()
  mainWindow = new BrowserWindow({
    ...bounds, minWidth: Math.min(880, bounds.width), minHeight: Math.min(580, bounds.height),
    backgroundColor: '#F8FAFF', title: 'SOCO — Understand. Connect. Together.', autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, 'preload.cjs'), contextIsolation: true, sandbox: true,
      nodeIntegration: false, webSecurity: true, allowRunningInsecureContent: false,
      webviewTag: false, devTools: dev, backgroundThrottling: false,
    },
  })
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (url !== (dev ? DEV_URL : APP_URL)) event.preventDefault()
  })
  mainWindow.webContents.on('will-redirect', (event) => event.preventDefault())
  windowLifecycle.attach(mainWindow)
  mainWindow.on('closed', () => { mainWindow = undefined })
  void mainWindow.loadURL(dev ? DEV_URL : APP_URL)
}

if (hasLock) {
  app.on('second-instance', () => { if (mainWindow) showMainWindow() })
  app.whenReady().then(async () => {
    await registerAppProtocol()
    configureSecurity()
    attachHandlers()
    windowLifecycle = createWindowLifecycle(() => mainWindow, showMainWindow)
    createMainWindow()
    app.on('activate', showMainWindow)
  }).catch(() => {
    console.error('SOCO desktop startup failed')
    app.quit()
  })
}
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
