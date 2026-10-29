'use strict'

const { app, BrowserWindow, ipcMain, protocol, net, session, shell } = require('electron')
const { join } = require('node:path')
const { pathToFileURL } = require('node:url')
const { trustedRendererURL, safeExternalURL, isSafeAssetPath } = require('./ipc-policy.cjs')

const dev = !app.isPackaged && process.argv.includes('--dev')
const DEV_URL = 'http://127.0.0.1:5173/'
const APP_URL = 'app://soco/index.html'
const CSP = [
  "default-src 'self'",
  "base-uri 'none'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "media-src 'self' blob: https:",
  "connect-src 'self' https: wss:",
  "worker-src 'self' blob:"
].join('; ')

// Register a standard, secure scheme before Electron becomes ready.
// Service workers are intentionally not enabled for the desktop protocol.
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } }
])

let mainWindow
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => mainWindow?.show())
}

function isTrustedFrame(event) {
  if (!mainWindow || event.sender !== mainWindow.webContents ||
      event.senderFrame !== mainWindow.webContents.mainFrame) return false
  return trustedRendererURL(event.senderFrame.url, dev)
}

function attachHandlers() {
  ipcMain.handle('soco:platform-info', (event) => {
    if (!isTrustedFrame(event)) throw new Error('Forbidden IPC origin')
    return { platform: process.platform, version: app.getVersion(), packaged: app.isPackaged }
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
    if (url.hostname !== 'soco' || (request.method !== 'GET' && request.method !== 'HEAD')) {
      return new Response('Not found', { status: 404 })
    }
    const pathName = url.pathname === '/' ? '/index.html' : url.pathname
    const file = isSafeAssetPath(assetsRoot, pathName)
    if (!file) return new Response('Invalid asset path', { status: 403 })
    try {
      const result = await net.fetch(pathToFileURL(file).toString())
      if (!result.ok) return new Response('Not found', { status: 404 })
      const headers = new Headers(result.headers)
      headers.set('Content-Security-Policy', CSP)
      headers.set('X-Content-Type-Options', 'nosniff')
      return new Response(request.method === 'HEAD' ? null : result.body, { status: result.status, headers })
    } catch {
      return new Response('Not found', { status: 404 })
    }
  })
}

function configureSecurity() {
  const trusted = (contents) => trustedRendererURL(contents.getURL(), dev)
  session.defaultSession.setPermissionRequestHandler((contents, permission, callback, details) => {
    // Mic/camera are needed by LiveKit; other privileged capabilities are denied.
    const allowed = trusted(contents) && permission === 'media' &&
      (details.mediaTypes || []).every((kind) => kind === 'audio' || kind === 'video')
    callback(Boolean(allowed))
  })
  session.defaultSession.setPermissionCheckHandler((contents, permission) =>
    Boolean(contents && trusted(contents) && permission === 'media'))
  app.on('web-contents-created', (_event, contents) => {
    contents.on('will-attach-webview', (event) => event.preventDefault())
  })
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1240,
    height: 800,
    minWidth: 880,
    minHeight: 580,
    backgroundColor: '#F8FAFF',
    title: 'SOCO — Understand. Connect. Together.',
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true,
      allowRunningInsecureContent: false,
      webviewTag: false,
      devTools: dev,
    },
  })
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  mainWindow.webContents.on('will-navigate', (event, url) => {
    // Renderer is immutable packaged JS in release. Do not navigate into remote websites.
    if (url !== (dev ? DEV_URL : APP_URL)) event.preventDefault()
  })
  mainWindow.on('closed', () => { mainWindow = undefined })
  void mainWindow.loadURL(dev ? DEV_URL : APP_URL)
}

app.whenReady().then(async () => {
  await registerAppProtocol()
  configureSecurity()
  attachHandlers()
  createMainWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
  })
}).catch((error) => {
  console.error('SOCO desktop startup failed:', error.message)
  app.quit()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})