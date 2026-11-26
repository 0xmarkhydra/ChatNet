// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { Session } from '../../../shared/types/session'
import { useDesktopNotifications } from './useDesktopNotifications'

const bridge = vi.hoisted(() => ({
  onClicked: vi.fn(), sync: vi.fn(), show: vi.fn(), clear: vi.fn(), dismiss: vi.fn(),
}))
vi.mock('../../../platform/desktop', () => ({
  isDesktopBuild: true,
  desktopBridge: () => ({ notifications: bridge }),
}))

const cleanups: Array<() => Promise<void>> = []
const unsubscribe = vi.fn()
beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  bridge.onClicked.mockReturnValue(unsubscribe)
  bridge.sync.mockResolvedValue(undefined)
})
afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup()
  vi.unstubAllGlobals()
})

const flush = () => act(() => new Promise<void>(done => setTimeout(done, 0)))
const account = (sessionId: string) => ({ sessionId, token: 'token', user: { id: 1 } }) as Session

function mount(handler: () => Promise<Response>) {
  const root = createRoot(document.createElement('div'))
  const sessionRef = { current: null as Session | null }
  const request = vi.fn((_path: string) => handler())
  let state!: ReturnType<typeof useDesktopNotifications>
  const renders: Array<{ sessionId: string; unreadCount: number | null }> = []
  function Probe({ session }: { session: Session }) {
    // Every render passes new function identities.
    state = useDesktopNotifications({
      session, sessionRef, apiFetch: (path: string) => request(path), checkSession: async () => true,
      activeConversationId: null, tab: 'chat', sound: true, onOpen: () => {}, onError: () => {},
    })
    renders.push({ sessionId: session.sessionId, unreadCount: state.unreadCount })
    return null
  }
  const render = async (session: Session) => {
    sessionRef.current = session
    await act(async () => root.render(<Probe session={session} />))
    await flush()
  }
  let mounted = true
  const unmount = async () => { if (mounted) { mounted = false; await act(async () => root.unmount()) } }
  cleanups.push(unmount)
  return { render, unmount, renders, request, get state() { return state } }
}

it('does not resubscribe or refetch when it rerenders within one session', async () => {
  const view = mount(async () => Response.json({ unreadCount: 3 }))
  const added = vi.spyOn(window, 'addEventListener')
  try {
    await view.render(account('a'))
    const listeners = added.mock.calls.length
    await view.render(account('a'))
    await view.render(account('a'))
    expect(view.state.unreadCount).toBe(3)
    expect(bridge.onClicked).toHaveBeenCalledTimes(1)
    expect(unsubscribe).not.toHaveBeenCalled()
    expect(view.request).toHaveBeenCalledTimes(1)
    expect(added.mock.calls.length).toBe(listeners)
    await view.render(account('b'))
    expect(unsubscribe).toHaveBeenCalledTimes(1)
    expect(bridge.onClicked).toHaveBeenCalledTimes(2)
    await view.unmount()
    expect(unsubscribe).toHaveBeenCalledTimes(2)
  } finally { added.mockRestore() }
})

it('never shows or syncs the previous session unread count', async () => {
  let pending = false
  const view = mount(() => pending ? new Promise<Response>(() => {}) : Promise.resolve(Response.json({ unreadCount: 5 })))
  await view.render(account('a'))
  expect(view.state.unreadCount).toBe(5)
  pending = true
  view.renders.length = 0
  bridge.sync.mockClear()
  await view.render(account('b'))
  expect(view.renders.at(-1)).toEqual({ sessionId: 'b', unreadCount: null })
  expect(bridge.sync).toHaveBeenCalled()
  for (const [input] of bridge.sync.mock.calls) expect(input).toMatchObject({ sessionId: 'b', unreadCount: null })
})

it('resets the sync warning for a new session', async () => {
  let pending = false
  const view = mount(() => pending ? new Promise<Response>(() => {}) : Promise.resolve(new Response(null, { status: 500 })))
  await view.render(account('a'))
  expect(view.state.warning).toContain('Chưa đồng bộ được số tin chưa đọc')
  pending = true
  await view.render(account('b'))
  expect(view.state.warning).toBe('')
})

it('resets the native warning for a new session and ignores a late sync failure', async () => {
  let rejectSync: ((reason: Error) => void) | undefined
  const view = mount(async () => Response.json({ unreadCount: 0 }))
  await view.render(account('a'))
  await act(async () => { window.dispatchEvent(new Event('soco:notification-unavailable')) })
  expect(view.state.warning).toContain('Hệ điều hành chưa hiển thị được')
  await view.render(account('b'))
  expect(view.state.warning).toBe('')

  bridge.sync.mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectSync = reject }))
  await view.render(account('c'))
  expect(rejectSync).toBeTypeOf('function')
  await view.render(account('d'))
  await act(async () => { rejectSync!(new Error('late')) })
  expect(view.state.warning).toBe('')
})
