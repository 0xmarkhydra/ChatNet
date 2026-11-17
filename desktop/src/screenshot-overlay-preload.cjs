'use strict'

const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('socoScreenshotSelector', {
  onBitmap: (listener) => {
    ipcRenderer.once('soco:screenshot-overlay:bitmap', (_event, bitmap) => listener(bitmap))
  },
  ready: (ok) => ipcRenderer.send('soco:screenshot-overlay:ready', ok === true),
  select: (selection) => ipcRenderer.send('soco:screenshot-overlay:result', selection),
})
