// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Session } from '../../shared/types/session'
import { useAppSession } from './useAppSession'
import { clearChatPersistence } from '../../features/chat/lib/chatPersistence'
import { clearChatOutbox } from '../../features/chat/lib/chatOutbox'

const storageSession = vi.hoisted(() => ({ value: null as unknown }))

vi.mock('../../platform/desktop', () => ({ isDesktopBuild: false }))
vi.mock('../../features/auth/hooks/useAuthFlow', () => ({
  useAuthFlow: () => ({ resetRegistration: vi.fn(), setAuthMode: vi.fn() }),
}))
vi.mock('../../features/auth/lib/session', () => ({
  loadSession: () => storageSession.value,
  persistSession: (next: Session) => {
    try {
      const stored = { ...next }
      delete stored.refreshToken
      localStorage.setItem('chatnet-session', JSON.stringify(stored))
    } catch {
      try { localStorage.removeItem('chatnet-session') } catch { /* storage unavailable */ }
    }
  },
  clearPersistedSession: () => {
    try { localStorage.removeItem('chatnet-session') } catch { /* storage unavailable */ }
  },
  createSessionClient: () => ({ request: vi.fn(), refresh: vi.fn() }),
}))
vi.mock('../../features/chat/lib/chatPersistence', () => ({ clearChatPersistence: vi.fn() }))
vi.mock('../../features/chat/lib/chatOutbox', () => ({ clearChatOutbox: vi.fn() }))

const session = (id: string): Session => ({
  token: 'token-' + id, refreshToken: 'refresh-' + id, sessionId: 'session-' + id,
  user: { id: id === 'A' ? 1 : 2, email: id + '@example.test', username: id, displayName: id },
})

function deferred() {
  let reject!: (error: Error) => void
  const promise = new Promise<Response>((_resolve, fail) => { reject = fail })
  return { promise, reject }
}

function mountSession() {
  const previousAct = (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT
  ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  let latest!: ReturnType<typeof useAppSession>
  function Probe() { latest = useAppSession(); return null }
  act(() => root.render(<Probe />))
  return {
    get current() { return latest },
    close() {
      act(() => root.unmount())
      host.remove()
      ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = previousAct
    },
  }
}

afterEach(() => {
  storageSession.value = null
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe('async logout notifications belong to the logout visit', () => {
  it('does not warn after A → B → A when the first logout finishes late', async () => {
    const pending = deferred()
    const fetchMock = vi.fn(() => pending.promise)
    vi.stubGlobal('fetch', fetchMock)
    vi.stubGlobal('localStorage', { setItem: vi.fn(), removeItem: vi.fn(), getItem: vi.fn() })
    const hook = mountSession()
    const notice = vi.fn()
    try {
      act(() => hook.current.saveSession(session('A')))
      act(() => hook.current.endSession(true, true, notice))
      act(() => hook.current.saveSession(session('B')))
      act(() => hook.current.saveSession(session('A')))
      await act(async () => { pending.reject(new Error('network failure')); await Promise.resolve() })
      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(notice).not.toHaveBeenCalled()
      expect(hook.current.session?.sessionId).toBe('session-A')
    } finally {
      hook.close()
    }
  })

  it('still warns on logout failure when no newer session has started', async () => {
    const pending = deferred()
    vi.stubGlobal('fetch', vi.fn(() => pending.promise))
    vi.stubGlobal('localStorage', { setItem: vi.fn(), removeItem: vi.fn(), getItem: vi.fn() })
    const hook = mountSession()
    const notice = vi.fn()
    try {
      act(() => hook.current.saveSession(session('A')))
      act(() => hook.current.endSession(true, true, notice))
      await act(async () => { pending.reject(new Error('network failure')); await Promise.resolve() })
      expect(notice).toHaveBeenCalledOnce()
      expect(notice).toHaveBeenCalledWith(
        'Đã đăng xuất trên máy này. Không kết nối được server để thu hồi phiên.', 'warning',
      )
    } finally {
      hook.close()
    }
  })
  it('does not warn after the app shell unmounts while logout is pending', async () => {
    const pending = deferred()
    vi.stubGlobal('fetch', vi.fn(() => pending.promise))
    vi.stubGlobal('localStorage', { setItem: vi.fn(), removeItem: vi.fn(), getItem: vi.fn() })
    const hook = mountSession()
    const notice = vi.fn()
    act(() => hook.current.saveSession(session('A')))
    act(() => hook.current.endSession(true, true, notice))
    hook.close()
    await act(async () => { pending.reject(new Error('network failure')); await Promise.resolve() })
    expect(notice).not.toHaveBeenCalled()
  })

  it('cleans previous account data if another tab swaps users under the same session ID', () => {
    vi.stubGlobal('localStorage', { setItem: vi.fn(), removeItem: vi.fn(), getItem: vi.fn() })
    const hook = mountSession()
    const accountA = session('A')
    const accountB = { ...session('B'), sessionId: accountA.sessionId }
    try {
      act(() => hook.current.saveSession(accountA))
      storageSession.value = accountB
      act(() => window.dispatchEvent(new StorageEvent('storage', { key: 'chatnet-session' })))
      expect(clearChatPersistence).toHaveBeenCalledWith(accountA.user.id)
      expect(clearChatOutbox).toHaveBeenCalledWith(accountA.user.id)
      expect(hook.current.session?.user.id).toBe(accountB.user.id)
    } finally {
      hook.close()
    }
  })

  it('does not copy refresh credentials into app memory after storage synchronization', () => {
    vi.stubGlobal('localStorage', { setItem: vi.fn(), removeItem: vi.fn(), getItem: vi.fn() })
    const hook = mountSession()
    const accountA = session('A')
    try {
      act(() => hook.current.saveSession(accountA))
      storageSession.value = { ...accountA, token: 'new-access-token', refreshToken: undefined }
      act(() => window.dispatchEvent(new StorageEvent('storage', { key: 'chatnet-session' })))
      expect(clearChatPersistence).not.toHaveBeenCalled()
      expect(clearChatOutbox).not.toHaveBeenCalled()
      expect(hook.current.session?.token).toBe('new-access-token')
      expect(hook.current.session?.refreshToken).toBeUndefined()
    } finally {
      hook.close()
    }
  })

  it('does not retain refresh credentials in memory when browser storage fails', () => {
    vi.stubGlobal('localStorage', {
      setItem: vi.fn(() => { throw new Error('storage denied') }),
      removeItem: vi.fn(),
      getItem: vi.fn(),
    })
    const hook = mountSession()
    try {
      act(() => hook.current.saveSession(session('A')))
      expect(hook.current.session).toEqual({ ...session('A'), refreshToken: undefined })
      expect(hook.current.session?.refreshToken).toBeUndefined()
    } finally {
      hook.close()
    }
  })

  it('persists access session without refresh credentials', () => {
    const setItem = vi.fn()
    vi.stubGlobal('localStorage', { setItem, removeItem: vi.fn(), getItem: vi.fn() })
    const hook = mountSession()
    try {
      act(() => hook.current.saveSession(session('A')))
      expect(JSON.parse(setItem.mock.calls[0][1])).toEqual({
        token: 'token-A',
        sessionId: 'session-A',
        user: session('A').user,
      })
    } finally {
      hook.close()
    }
  })

  it('logs out when browser storage removal fails', () => {
    vi.stubGlobal('localStorage', {
      setItem: vi.fn(),
      removeItem: vi.fn(() => { throw new Error('storage denied') }),
      getItem: vi.fn(),
    })
    const hook = mountSession()
    try {
      act(() => hook.current.saveSession(session('A')))
      act(() => hook.current.endSession(false))
      expect(hook.current.session).toBeNull()
    } finally {
      hook.close()
    }
  })

})
