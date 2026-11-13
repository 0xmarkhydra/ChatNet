// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Session } from '../../features/auth/lib/session'
import { useAppSession } from './useAppSession'

const mocks = vi.hoisted(() => ({
  savedSession: null as Session | null,
  clearPersistence: vi.fn(),
  clearOutbox: vi.fn(),
  resetRegistration: vi.fn(),
}))

vi.mock('../../features/auth/lib/session', () => ({
  loadSession: () => mocks.savedSession,
  createSessionClient: () => ({}),
}))
vi.mock('../../features/auth/hooks/useAuthFlow', () => ({
  useAuthFlow: () => ({ resetRegistration: mocks.resetRegistration, setAuthMode: vi.fn() }),
}))
vi.mock('../../features/chat/lib/chatPersistence', () => ({
  clearChatPersistence: mocks.clearPersistence,
}))
vi.mock('../../features/chat/lib/chatOutbox', () => ({
  clearChatOutbox: mocks.clearOutbox,
}))
vi.mock('../../platform/desktop', () => ({ isDesktopBuild: false }))
vi.mock('../../shared/lib/config', () => ({ API: 'https://example.invalid' }))

afterEach(() => {
  vi.unstubAllGlobals()
  mocks.savedSession = null
  mocks.clearPersistence.mockReset()
  mocks.clearOutbox.mockReset()
  mocks.resetRegistration.mockReset()
  document.body.replaceChildren()
})

describe('useAppSession cross-tab isolation', () => {
  it('purges old account persistence if storage changes user under a reused session ID', () => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    vi.stubGlobal('localStorage', { removeItem: vi.fn(), setItem: vi.fn(), getItem: vi.fn() })
    const session = (id: number): Session => ({
      sessionId: 'same-id',
      token: 'token',
      user: { id, email: 'member@example.com', username: 'member', displayName: 'Member' },
    }) as Session
    mocks.savedSession = session(1)
    let currentUserId: number | undefined
    function Probe() {
      currentUserId = useAppSession().session?.user.id
      return null
    }
    const element = document.createElement('div')
    document.body.append(element)
    const root = createRoot(element)
    act(() => root.render(<Probe />))
    expect(currentUserId).toBe(1)

    mocks.savedSession = session(2)
    act(() => window.dispatchEvent(new StorageEvent('storage', { key: 'chatnet-session' })))
    expect(currentUserId).toBe(2)
    expect(mocks.clearPersistence).toHaveBeenCalledWith(1)
    expect(mocks.clearOutbox).toHaveBeenCalledWith(1)
    expect(mocks.clearPersistence).not.toHaveBeenCalledWith(2)
    act(() => root.unmount())
  })
})
