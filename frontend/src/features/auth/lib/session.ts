import type { Session } from '../../../shared/types/session'

export type { Session }

const SESSION_STORAGE_KEY = 'chatnet-session'

function sessionIdFromToken(token: string): string {
  try {
    const encoded = token.split('.')[1]
    if (!encoded) return token
    const payload = JSON.parse(atob(encoded.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(encoded.length / 4) * 4, '='))) as { sid?: unknown }
    return typeof payload.sid === 'string' && payload.sid ? payload.sid : token
  } catch {
    return token
  }
}

function accessSession(session: Session): Session {
  const safe = { ...session }
  delete safe.refreshToken
  if (safe.sessionId === session.refreshToken) safe.sessionId = sessionIdFromToken(session.token)
  return safe
}

export function persistSession(session: Session): void {
  try {
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(accessSession(session)))
  } catch {
    // Storage is optional. Remove stale credentials when a write fails.
    try { localStorage.removeItem(SESSION_STORAGE_KEY) } catch { /* private mode */ }
  }
}

export function clearPersistedSession(): void {
  try { localStorage.removeItem(SESSION_STORAGE_KEY) } catch { /* private mode */ }
}

export function parseSession(value: unknown): Session | null {
  if (!value || typeof value !== 'object') return null
  const candidate = value as Session
  if (
    typeof candidate.token !== 'string' || !candidate.token ||
    !Number.isSafeInteger(candidate.user?.id) || candidate.user.id <= 0 ||
    !['email', 'username', 'displayName'].every((key) => typeof candidate.user[key as keyof Session['user']] === 'string') ||
    (candidate.refreshToken !== undefined && (typeof candidate.refreshToken !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(candidate.refreshToken))) ||
    (candidate.sessionId !== undefined && (typeof candidate.sessionId !== 'string' || !candidate.sessionId))
  ) return null
  return {
    ...candidate,
    sessionId: candidate.sessionId && candidate.sessionId !== candidate.refreshToken
      ? candidate.sessionId
      : sessionIdFromToken(candidate.token),
  }
}

export function loadSession(): Session | null {
  try {
    const session = parseSession(JSON.parse(localStorage.getItem(SESSION_STORAGE_KEY) || 'null'))
    if (!session) return null
    if (session.refreshToken !== undefined) persistSession(session)
    return accessSession(session)
  } catch {
    return null
  }
}

function expiresSoon(token: string) {
  try {
    const encoded = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    const { exp } = JSON.parse(atob(encoded))
    return typeof exp !== 'number' || exp * 1000 <= Date.now() + 5 * 60_000
  } catch {
    return true
  }
}

export function createSessionClient(baseURL: string, state: {
  get: () => Session | null
  save: (session: Session) => void
  expire: () => void
}, nativeAuth?: { refresh: (sessionId: string) => Promise<Session | null> }) {
  let pending: { sessionId: string; promise: Promise<Session | null> } | undefined
  let checking: { sessionId: string; promise: Promise<boolean> } | undefined
  const unchanged = (previous: Session) => {
    const current = state.get()
    return current?.sessionId === previous.sessionId && current.token === previous.token
  }

  async function renew(previous: Session): Promise<Session | null> {
    if (nativeAuth) {
      const result = await nativeAuth.refresh(previous.sessionId)
      if (!unchanged(previous)) return state.get()
      if (!result) { state.expire(); return null }
      const next = parseSession(result)
      if (!next || next.refreshToken !== undefined || next.sessionId !== previous.sessionId || next.user.id !== previous.user.id) {
        throw new Error('Phản hồi gia hạn phiên không hợp lệ.')
      }
      state.save(next)
      return next
    }
    const response = await fetch(`${baseURL}/api/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
      credentials: 'include',
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000),
    })
    if (!unchanged(previous)) return state.get()
    if (response.status === 401) {
      state.expire()
      return null
    }
    if (!response.ok) throw new Error('Không thể gia hạn phiên. Vui lòng thử lại.')
    const next = parseSession(await response.json())
    if (!next || next.refreshToken !== undefined || next.user.id !== previous.user.id) {
      throw new Error('Phản hồi gia hạn phiên không hợp lệ.')
    }
    if (!unchanged(previous)) return state.get()
    const renewed = { ...next, sessionId: previous.sessionId }
    state.save(renewed)
    return renewed
  }

  function refresh(force = false): Promise<Session | null> {
    const current = state.get()
    if (!current) return Promise.resolve(null)
    if (pending?.sessionId === current.sessionId) return pending.promise
    if (!force && !expiresSoon(current.token)) return Promise.resolve(current)
    const operation = { sessionId: current.sessionId, promise: renew(current) }
    pending = operation
    void operation.promise.finally(() => {
      if (pending === operation) pending = undefined
    }).catch(() => undefined)
    return operation.promise
  }

  // Verify the session-bound access JWT through the lightweight Redis-backed
  // Auth endpoint. No refresh rotation or extra PostgreSQL write per mutation.
  function check(): Promise<boolean> {
    const current = state.get()
    if (!current) return Promise.resolve(false)
    if (checking?.sessionId === current.sessionId) return checking.promise
    const operation = { sessionId: current.sessionId, promise: verify(current) }
    checking = operation
    void operation.promise.finally(() => {
      if (checking === operation) checking = undefined
    }).catch(() => undefined)
    return operation.promise
  }

  async function verify(previous: Session): Promise<boolean> {
    const response = await fetch(`${baseURL}/api/auth/session/status`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${previous.token}` },
      credentials: 'include',
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000),
    })
    if (!unchanged(previous)) return false
    if (response.status === 401) {
      state.expire()
      return false
    }
    if (!response.ok) throw new Error('Không xác minh được phiên đăng nhập.')
    return true
  }

  async function request(path: string, init: RequestInit = {}, sessionId?: string) {
    const original = state.get()
    if (!original || original.sessionId !== sessionId) throw new Error('Phiên đăng nhập đã thay đổi.')
    const send = (current: Session) => {
      if (state.get()?.sessionId !== sessionId) throw new Error('Phiên đăng nhập đã thay đổi.')
      const headers = new Headers(init.headers)
      headers.set('Authorization', `Bearer ${current.token}`)
      return fetch(`${baseURL}${path}`, { ...init, headers })
    }
    const ready = await refresh()
    if (!ready || ready.sessionId !== sessionId) throw new Error('Phiên đăng nhập đã hết hạn.')
    const method = (init.method || 'GET').toUpperCase()
    if (method !== 'GET' && method !== 'HEAD' && !await check()) {
      throw new Error('Phiên đăng nhập đã hết hạn.')
    }
    let response = await send(state.get() || ready)
    if (response.status === 401) {
      const current = state.get()
      if (!current || current.sessionId !== sessionId) return response
      const next = current.token !== ready.token ? current : await refresh(true)
      if (next && next.sessionId === sessionId) response = await send(next)
    }
    return response
  }

  return { refresh, check, request }
}
