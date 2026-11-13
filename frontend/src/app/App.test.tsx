// @vitest-environment jsdom
import { act, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Session } from '../features/auth/lib/session'
import App from './App'

const state = vi.hoisted(() => ({
  session: null as Session | null,
  mounts: 0,
  unmounts: 0,
}))

vi.mock('./hooks/useAppSession', () => ({
  useAppSession: () => ({
    session: state.session,
    sessionRef: { current: state.session },
    responseCache: { current: {} },
    sessionClient: {},
    auth: {},
    saveSession: vi.fn(),
    endSession: vi.fn(),
  }),
}))
vi.mock('./hooks/useInstallPrompt', () => ({
  useInstallPrompt: () => ({ installPrompt: null, setInstallPrompt: vi.fn() }),
}))
vi.mock('./providers/AuthedProviders', () => ({
  default: function MockAuthedProviders({ children }: { children: React.ReactNode }) {
    useEffect(() => {
      state.mounts++
      return () => { state.unmounts++ }
    }, [])
    return <>{children}</>
  },
}))
vi.mock('./AuthedApp', () => ({ default: () => null }))
vi.mock('../features/auth/components/AuthScreen', () => ({ default: () => null }))

afterEach(() => {
  state.session = null
  state.mounts = 0
  state.unmounts = 0
  vi.unstubAllGlobals()
  document.body.replaceChildren()
})

describe('App session isolation', () => {
  it('remounts authenticated providers when the account changes even if a session ID is reused', () => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    const session = (id: number): Session => ({
      sessionId: 'shared-session-id',
      token: 'token',
      user: { id, email: 'member@example.com', username: 'member', displayName: 'Member' },
    }) as Session
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    state.session = session(1)
    act(() => root.render(<App />))
    expect(state.mounts).toBe(1)
    state.session = session(2)
    act(() => root.render(<App />))
    expect(state.mounts).toBe(2)
    expect(state.unmounts).toBe(1)
    act(() => root.unmount())
  })
})
