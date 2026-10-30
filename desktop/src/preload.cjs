'use strict'

const { contextBridge, ipcRenderer } = require('electron')

// Explicit, narrow bridge. Never expose ipcRenderer, Node, filesystem or refresh credentials.
contextBridge.exposeInMainWorld('socoDesktop', Object.freeze({
  getPlatformInfo: () => ipcRenderer.invoke('soco:platform-info'),
  openExternal: (url) => ipcRenderer.invoke('soco:open-external', url),
  auth: Object.freeze({
    restore: () => ipcRenderer.invoke('soco:auth:restore'),
    verifyEmail: (input) => ipcRenderer.invoke('soco:auth:verify-email', input),
    refresh: (sessionId) => ipcRenderer.invoke('soco:auth:refresh', sessionId),
    logout: (input) => ipcRenderer.invoke('soco:auth:logout', input),
    listSessions: (sessionId) => ipcRenderer.invoke('soco:auth:list-sessions', sessionId),
    revokeSession: (sessionId, deviceId) => ipcRenderer.invoke('soco:auth:revoke-session', sessionId, deviceId),
    revokeOthers: (sessionId) => ipcRenderer.invoke('soco:auth:revoke-others', sessionId),
    onExpired: (callback) => {
      if (typeof callback !== 'function') throw new TypeError('Callback required')
      const listener = (_event, sessionId, userId) => callback(sessionId, userId)
      ipcRenderer.on('soco:auth:expired', listener)
      return () => ipcRenderer.removeListener('soco:auth:expired', listener)
    },
  }),
}))
