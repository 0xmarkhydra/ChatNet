'use strict'

const { randomUUID } = require('node:crypto')
const { UUID } = require('./auth-vault.cjs')

function exactObject(value, keys) {
  return value && typeof value === 'object' && !Array.isArray(value) &&
    Object.keys(value).sort().join(',') === [...keys].sort().join(',')
}
function publicSession(data, sessionId) {
  const user = data?.user
  if (typeof data?.token !== 'string' || !data.token || data.token.length > 16384 ||
      typeof data.refreshToken !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(data.refreshToken) ||
      !Number.isSafeInteger(user?.id) || user.id <= 0 ||
      !['email', 'username', 'displayName'].every((key) => typeof user[key] === 'string' && user[key].length <= 512)) {
    throw new Error('AUTH_INVALID_RESPONSE')
  }
  return { token: data.token, sessionId, user: {
    id: user.id, email: user.email, username: user.username, displayName: user.displayName,
  } }
}
async function boundedJSON(response) {
  if (!response.body) throw new Error('AUTH_INVALID_RESPONSE')
  const reader = response.body.getReader()
  const chunks = []
  let size = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > 65536) throw new Error('AUTH_INVALID_RESPONSE')
      chunks.push(Buffer.from(value))
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    throw new Error('AUTH_INVALID_RESPONSE')
  } finally {
    await reader.cancel().catch(() => undefined)
    reader.releaseLock()
  }
}

function createAuthBroker({ vault, baseURL, fetchImpl = fetch, userAgent = 'SOCO Desktop', onExpired = () => {} }) {
  if (!['https://api-chat.codelocal.cloud', 'http://localhost:8080'].includes(baseURL)) {
    throw new Error('AUTH_UNTRUSTED_ENDPOINT')
  }
  let credential = null
  let loaded = false
  let generation = 0
  let pendingRefresh
  let loggingIn = false
  let verified = false

  // Main-only authorization context for native integrations; never expose credentials over IPC.
  function currentScope() {
    return verified && credential ? { sessionId: credential.sessionId, userId: credential.userId } : null
  }

  function load() {
    if (!loaded) { credential = vault.read(); loaded = true }
    return credential
  }
  function forget() {
    const previous = credential
    ++generation
    credential = null
    verified = false
    loaded = true
    try { vault.clear() } finally {
      if (previous) onExpired(previous.sessionId, previous.userId)
    }
  }
  async function post(path, body) {
    let response
    try {
      response = await fetchImpl(`${baseURL}/api/auth/${path}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'User-Agent': userAgent },
        body: JSON.stringify(body), cache: 'no-store', credentials: 'omit', redirect: 'error',
        signal: AbortSignal.timeout(15000),
      })
    } catch { throw new Error('AUTH_UNAVAILABLE') }
    return response
  }
  async function revokeCredential(refreshToken) {
    try {
      const response = await post('logout', { refreshToken })
      await response.body?.cancel()
      return response.ok || response.status === 401
    } catch { return false }
  }
  function requireSession(sessionId) {
    if (typeof sessionId !== 'string' || !UUID.test(sessionId)) throw new Error('AUTH_INVALID_REQUEST')
    const current = load()
    if (!current || current.sessionId !== sessionId) throw new Error('AUTH_SESSION_CHANGED')
    return current
  }
  async function verifyEmail(input) {
    if (!exactObject(input, ['token', 'code']) || typeof input.token !== 'string' ||
        !/^[A-Za-z0-9_-]{16,256}$/.test(input.token) || typeof input.code !== 'string' || !/^\d{6}$/.test(input.code)) {
      throw new Error('AUTH_INVALID_REQUEST')
    }
    if (load() || loggingIn) throw new Error('AUTH_SESSION_CHANGED')
    vault.available()
    const revision = ++generation
    loggingIn = true
    try {
      const response = await post('email/verify', input)
      if (!response.ok) {
        await response.body?.cancel()
        throw new Error(response.status < 500 ? 'AUTH_REJECTED' : 'AUTH_UNAVAILABLE')
      }
      const data = await boundedJSON(response)
      const session = publicSession(data, randomUUID())
      if (revision !== generation) {
        await revokeCredential(data.refreshToken)
        throw new Error('AUTH_CANCELLED')
      }
      const next = { version: 1, sessionId: session.sessionId, userId: session.user.id, refreshToken: data.refreshToken }
      try { vault.write(next) } catch (error) {
        await revokeCredential(data.refreshToken)
        throw error
      }
      credential = next
      verified = true
      return session
    } finally { loggingIn = false }
  }
  function refresh(sessionId) {
    const previous = requireSession(sessionId)
    if (pendingRefresh?.sessionId === sessionId) return pendingRefresh.promise
    const revision = generation
    const operation = { sessionId, promise: (async () => {
      const response = await post('refresh', { refreshToken: previous.refreshToken })
      if (revision !== generation) { await response.body?.cancel(); return null }
      if (response.status === 401) { await response.body?.cancel(); forget(); return null }
      if (!response.ok) { await response.body?.cancel(); throw new Error('AUTH_UNAVAILABLE') }
      const data = await boundedJSON(response)
      if (revision !== generation) return null
      const session = publicSession(data, previous.sessionId)
      if (session.user.id !== previous.userId) throw new Error('AUTH_INVALID_RESPONSE')
      const next = { ...previous, refreshToken: data.refreshToken }
      vault.write(next)
      credential = next
      verified = true
      return session
    })() }
    pendingRefresh = operation
    void operation.promise.finally(() => {
      if (pendingRefresh === operation) pendingRefresh = undefined
    }).catch(() => undefined)
    return operation.promise
  }
  function restore() {
    const previous = load()
    return previous ? refresh(previous.sessionId) : Promise.resolve(null)
  }
  async function logout(input) {
    if (!exactObject(input, ['sessionId', 'revoke']) || typeof input.revoke !== 'boolean' ||
        (input.sessionId !== null && (typeof input.sessionId !== 'string' || !UUID.test(input.sessionId)))) {
      throw new Error('AUTH_INVALID_REQUEST')
    }
    const previous = load()
    if (previous && previous.sessionId !== input.sessionId) throw new Error('AUTH_SESSION_CHANGED')
    // Still revoke remotely if local deletion fails; never report local logout as durable then.
    let clearError
    try { forget() } catch (error) { clearError = error }
    const revoked = !input.revoke || !previous || await revokeCredential(previous.refreshToken)
    if (clearError) throw clearError
    return { revoked }
  }
  async function manage(sessionId, action, deviceId) {
    const previous = requireSession(sessionId)
    if (!['list', 'revoke', 'revoke-others'].includes(action) ||
        (action === 'revoke' ? typeof deviceId !== 'string' || !UUID.test(deviceId) : deviceId !== undefined)) {
      throw new Error('AUTH_INVALID_REQUEST')
    }
    const revision = generation
    const response = await post(`sessions/${action}`, {
      refreshToken: previous.refreshToken, ...(deviceId ? { sessionId: deviceId } : {}),
    })
    if (revision !== generation) { await response.body?.cancel(); throw new Error('AUTH_SESSION_CHANGED') }
    if (response.status === 401) { await response.body?.cancel(); forget(); throw new Error('AUTH_EXPIRED') }
    if (!response.ok) { await response.body?.cancel(); throw new Error('AUTH_UNAVAILABLE') }
    if (action !== 'list') { await response.body?.cancel(); return true }
    const data = await boundedJSON(response)
    if (revision !== generation) throw new Error('AUTH_SESSION_CHANGED')
    if (!Array.isArray(data) || data.length > 100) throw new Error('AUTH_INVALID_RESPONSE')
    return data.map((item) => {
      if (!item || typeof item.id !== 'string' || !UUID.test(item.id) || typeof item.current !== 'boolean' ||
          !['userAgent', 'createdAt', 'lastSeenAt', 'expiresAt'].every((key) => typeof item[key] === 'string' && item[key].length <= 512)) {
        throw new Error('AUTH_INVALID_RESPONSE')
      }
      const { id, userAgent, createdAt, lastSeenAt, expiresAt, current } = item
      return { id, userAgent, createdAt, lastSeenAt, expiresAt, current }
    })
  }
  return { verifyEmail, refresh, restore, logout, manage, currentScope }
}

module.exports = { createAuthBroker, publicSession, exactObject }
