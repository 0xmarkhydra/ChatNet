// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import DesktopBootstrap from './DesktopBootstrap'

const bridge = vi.hoisted(() => ({
  restore: vi.fn(),
  onExpired: vi.fn(),
  initialize: vi.fn(async () => undefined),
}))

vi.mock('./App', () => ({
  default: () => <div data-testid="signed-in-app">Signed in</div>,
}))
vi.mock('../platform/DesktopScreenPicker', () => ({
  default: () => null,
}))
vi.mock('../platform/desktop', () => ({
  desktopBridge: () => ({
    getPlatformInfo: async () => ({ apiOrigin: 'https://chatnet.example' }),
    auth: { restore: bridge.restore, onExpired: bridge.onExpired },
  }),
  initializeDesktopPlatform: bridge.initialize,
}))
vi.mock('../shared/lib/config', () => ({ API: 'https://chatnet.example' }))

afterEach(() => {
  bridge.restore.mockReset()
  bridge.onExpired.mockReset()
  bridge.initialize.mockClear()
  vi.unstubAllGlobals()
  document.body.replaceChildren()
})

describe('DesktopBootstrap', () => {
  it('does not mount an expired session restored after its native revocation event', async () => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    vi.stubGlobal('localStorage', { removeItem: vi.fn(), getItem: vi.fn(() => null), setItem: vi.fn() })
    let completeRestore!: (value: unknown) => void
    bridge.restore.mockImplementation(() => new Promise((resolve) => { completeRestore = resolve }))
    let expire!: (sessionId: string, userId: number) => void
    const unsubscribe = vi.fn()
    bridge.onExpired.mockImplementation((listener: typeof expire) => {
      expire = listener
      return unsubscribe
    })
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)

    await act(async () => { root.render(<DesktopBootstrap />) })
    expect(bridge.restore).toHaveBeenCalledTimes(1)
    await act(async () => {
      expire('session-revoked', 17)
      completeRestore({
        sessionId: 'session-revoked',
        token: 'access-token',
        user: { id: 17, email: 'member@example.com', username: 'member', displayName: 'Member' },
      })
    })

    expect(container.querySelector('[data-testid="signed-in-app"]')).toBeNull()
    expect(container.querySelector('[role="alert"]')).not.toBeNull()
    await act(async () => root.unmount())
    expect(unsubscribe).toHaveBeenCalledOnce()
  })
})
