// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createSessionClient, loadSession, parseSession, persistSession, type Session } from './session'

const token = `header.${btoa(JSON.stringify({ sid: 'session-1' })).replace(/=+$/, '')}.signature`
const session = {
  token,
  sessionId: 'session-1',
  refreshToken: 'r'.repeat(43),
  user: { id: 1, email: 'test@example.com', username: 'tester', displayName: 'Test' },
}

afterEach(() => vi.unstubAllGlobals())

describe('browser session persistence', () => {
  it('removes refresh credentials from existing stored sessions', () => {
    const setItem = vi.fn()
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => JSON.stringify(session)),
      setItem,
      removeItem: vi.fn(),
    })

    expect(loadSession()).toEqual({ token, sessionId: 'session-1', user: session.user })
    expect(JSON.parse(setItem.mock.calls[0][1])).toEqual({ token, sessionId: 'session-1', user: session.user })
  })

  it('does not throw when storage rejects session writes', () => {
    vi.stubGlobal('localStorage', {
      setItem: vi.fn(() => { throw new Error('storage denied') }),
      removeItem: vi.fn(),
      getItem: vi.fn(),
    })

    expect(() => persistSession(session)).not.toThrow()
  })

  it('does not write refresh credentials copied into session identity', () => {
    const setItem = vi.fn()
    vi.stubGlobal('localStorage', { setItem, removeItem: vi.fn(), getItem: vi.fn() })

    persistSession({ ...session, sessionId: session.refreshToken })

    const stored = JSON.stringify(setItem.mock.calls[0][1])
    expect(stored).not.toContain(session.refreshToken)
  })

  it('does not use refresh credentials as persisted session identity', () => {
    const parsed = parseSession({ ...session, sessionId: session.refreshToken })
    expect(parsed?.sessionId).toBe('session-1')
  })

  it('renews a reloaded access-only session with the HttpOnly refresh cookie', async () => {
    const expiredToken = `header.${btoa(JSON.stringify({ sid: 'session-1', exp: 0 })).replace(/=+$/, '')}.signature`
    const nextToken = `header.${btoa(JSON.stringify({ sid: 'session-1', exp: Math.floor(Date.now() / 1000) + 3600 })).replace(/=+$/, '')}.signature`
    let current: Session | null = { ...session, token: expiredToken, refreshToken: undefined }
    const expire = vi.fn(() => { current = null })
    const save = vi.fn((next: Session) => {
      current = next
      persistSession(next)
    })
    const fetchMock = vi.fn(async () => Response.json({ token: nextToken, user: session.user }))
    vi.stubGlobal('fetch', fetchMock)
    localStorage.removeItem('chatnet-session')
    const client = createSessionClient('https://chatnet.test', {
      get: () => current,
      save,
      expire,
    })

    const renewed = await client.refresh()

    expect(fetchMock).toHaveBeenCalledWith('https://chatnet.test/api/auth/refresh', expect.objectContaining({
      credentials: 'include',
      body: '{}',
    }))
    expect(renewed?.sessionId).toBe('session-1')
    expect(renewed?.refreshToken).toBeUndefined()
    expect(expire).not.toHaveBeenCalled()
    expect(loadSession()?.refreshToken).toBeUndefined()
  })
})
