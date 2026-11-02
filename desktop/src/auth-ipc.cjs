'use strict'

// Endpoint selection and credentials stay in Main. Never accept a URL, header or token from renderer.
function registerAuthIPC(ipcMain, broker, trusted) {
  const handlers = {
    'soco:auth:restore': { count: 0, run: () => broker.restore() },
    'soco:auth:verify-email': { count: 1, run: (input) => broker.verifyEmail(input) },
    'soco:auth:refresh': { count: 1, run: (sessionId) => broker.refresh(sessionId) },
    'soco:auth:logout': { count: 1, run: (input) => broker.logout(input) },
    'soco:auth:list-sessions': { count: 1, run: (sessionId) => broker.manage(sessionId, 'list') },
    'soco:auth:revoke-session': { count: 2, run: (sessionId, deviceId) => broker.manage(sessionId, 'revoke', deviceId) },
    'soco:auth:revoke-others': { count: 1, run: (sessionId) => broker.manage(sessionId, 'revoke-others') },
  }
  for (const [channel, handler] of Object.entries(handlers)) {
    ipcMain.handle(channel, async (event, ...args) => {
      if (!trusted(event)) throw new Error('Forbidden IPC origin')
      if (args.length !== handler.count) throw new Error('AUTH_INVALID_REQUEST')
      try { return await handler.run(...args) } catch (error) {
        // Electron serializes errors across IPC; never include upstream body, filesystem paths or secrets.
        const code = error instanceof Error && /^(AUTH|VAULT)_[A-Z_]+$/.test(error.message)
          ? error.message : 'AUTH_UNAVAILABLE'
        throw new Error(code)
      }
    })
  }
}

module.exports = { registerAuthIPC }
