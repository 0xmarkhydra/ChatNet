'use strict'

const { contextBridge, ipcRenderer } = require('electron')

// Explicit, narrow bridge. Never expose ipcRenderer, Node, filesystem or credentials.
contextBridge.exposeInMainWorld('socoDesktop', Object.freeze({
  getPlatformInfo: () => ipcRenderer.invoke('soco:platform-info'),
  openExternal: (url) => ipcRenderer.invoke('soco:open-external', url),
}))
