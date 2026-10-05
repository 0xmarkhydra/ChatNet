export type Session = {
  token: string
  refreshToken?: string
  sessionId: string
  user: { id: number; email: string; username: string; displayName: string }
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
  return { ...candidate, sessionId: candidate.sessionId || candidate.refreshToken || candidate.token }
}

export function loadSession(): Session | null {
  try {
    return parseSession(JSON.parse(localStorage.getItem('chatnet-session') || 'null'))
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
}) {
  let pending: { sessionId: string; promise: Promise<Session | null> } | undefined
  const unchanged = (previous: Session) => {
    const current = state.get()
    return current?.sessionId === previous.sessionId && current.token === previous.token
  }

  async function renew(previous: Session): Promise<Session | null> {
    const response = await fetch(`${baseURL}/api/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(previous.refreshToken ? {} : { Authorization: `Bearer ${previous.token}` }),
      },
      body: JSON.stringify({ refreshToken: previous.refreshToken || '' }),
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
    if (!next?.refreshToken || next.user.id !== previous.user.id) {
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
    if (!force && current.refreshToken && !expiresSoon(current.token)) return Promise.resolve(current)
    const operation = { sessionId: current.sessionId, promise: renew(current) }
    pending = operation
    void operation.promise.finally(() => {
      if (pending === operation) pending = undefined
    }).catch(() => undefined)
    return operation.promise
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
    let response = await send(ready)
    if (response.status === 401) {
      const current = state.get()
      if (!current || current.sessionId !== sessionId) return response
      const next = current.token !== ready.token ? current : await refresh(true)
      if (next && next.sessionId === sessionId) response = await send(next)
    }
    return response
  }

  return { refresh, request }
}
