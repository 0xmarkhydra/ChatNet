// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Session } from '../../shared/types/session'
import { useAppSession } from './useAppSession'

vi.mock('../../platform/desktop', () => ({ isDesktopBuild: false }))
vi.mock('../../features/auth/hooks/useAuthFlow', () => ({
  useAuthFlow: () => ({ resetRegistration: vi.fn(), setAuthMode: vi.fn() }),
}))
vi.mock('../../features/auth/lib/session', () => ({
  loadSession: () => null,
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

afterEach(() => vi.unstubAllGlobals())

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

})
