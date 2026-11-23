// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAppRealtime } from './useAppRealtime'
import type { Session } from '../../shared/types/session'

const globals = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
const previousAct = globals.IS_REACT_ACT_ENVIRONMENT
class TestEventSource {
  static instances: TestEventSource[] = []
  onopen: (() => void) | null = null
  onerror: (() => void) | null = null
  closed = false
  constructor(_url: string) { TestEventSource.instances.push(this) }
  addEventListener(_name: string, _listener: EventListener) {}
  close() { this.closed = true }
}
beforeEach(() => {
  globals.IS_REACT_ACT_ENVIRONMENT = true
  TestEventSource.instances = []
  vi.stubGlobal('EventSource', TestEventSource)
})
afterEach(() => {
  vi.useRealTimers()
  globals.IS_REACT_ACT_ENVIRONMENT = previousAct
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

async function setup(ticketResponse = Response.json({ ticket: 't'.repeat(43) }), allowMissingTransport = false) {
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  const session: Session = {
    token: 'token-A', sessionId: 'A',
    user: { id: 1, email: 'a@test.invalid', username: 'A', displayName: 'A' },
  }
  const sessionRef = { current: session }
  const events: string[] = []
  const listener = (event: Event) => {
    events.push((event as CustomEvent<{ sessionId: string }>).detail.sessionId)
  }
  window.addEventListener('chatnet:sse-reconnected', listener)
  const apiFetch = vi.fn(async (path: string) => path === '/api/events/ticket'
    ? ticketResponse.clone()
    : new Response(null, { status: 204 }))
  const setNotice = vi.fn()
  const opts = {
    session, sessionRef,
    refreshConversations: vi.fn(async () => {}),
    refreshPosts: vi.fn(async () => {}),
    refreshStories: vi.fn(async () => {}),
    refreshFriendConnections: vi.fn(async () => {}),
    reconcileConversationMemberships: vi.fn(async () => {}),
    setStatus: vi.fn(),
    setNotice,
    apiFetch,
    checkSession: vi.fn(async () => true),
    membershipSyncSequence: { current: 0 },
  } as unknown as Parameters<typeof useAppRealtime>[0]
  function Probe() { useAppRealtime(opts); return null }
  await act(async () => { root.render(createElement(Probe)) })
  const transport = TestEventSource.instances[0]
  if (!transport && !allowMissingTransport) throw new Error('EventSource not constructed')
  return {
    events, transport: transport as TestEventSource, apiFetch, setNotice,
    async close() {
      await act(async () => { root.unmount() })
      window.removeEventListener('chatnet:sse-reconnected', listener)
      host.remove()
    },
  }
}

describe('SSE reconnect backfill signal', () => {
  it('does not refetch history on initial open but signals on actual reopen', async () => {
    const app = await setup()
    try {
      await act(async () => app.transport.onopen?.())
      expect(app.events).toEqual([])
      await act(async () => app.transport.onopen?.())
      expect(app.events).toEqual(['A'])
    } finally { await app.close() }
  })

  it('signals on the first successful open after an initial connection error', async () => {
    vi.useFakeTimers()
    const app = await setup()
    try {
      await act(async () => app.transport.onerror?.())
      expect(TestEventSource.instances).toHaveLength(1)
      await act(async () => { await vi.advanceTimersByTimeAsync(1000) })
      const replacement = TestEventSource.instances[1]
      expect(app.transport.closed).toBe(true)
      expect(replacement).toBeDefined()
      await act(async () => replacement.onopen?.())
      expect(app.events).toEqual(['A'])
    } finally { await app.close() }
  })

  it('keeps increasing backoff after short-lived connections', async () => {
    vi.useFakeTimers()
    const app = await setup()
    try {
      await act(async () => app.transport.onerror?.())
      await act(async () => { await vi.advanceTimersByTimeAsync(1000) })
      const replacement = TestEventSource.instances[1]
      await act(async () => replacement.onopen?.())
      await act(async () => replacement.onerror?.())

      expect(app.apiFetch).toHaveBeenCalledTimes(2)
      await act(async () => { await vi.advanceTimersByTimeAsync(1999) })
      expect(app.apiFetch).toHaveBeenCalledTimes(2)
      await act(async () => { await vi.advanceTimersByTimeAsync(1) })
      expect(app.apiFetch).toHaveBeenCalledTimes(3)
      expect(TestEventSource.instances).toHaveLength(3)
    } finally { await app.close() }
  })

  it('shows a recoverable notice when ticket request fails permanently', async () => {
    const app = await setup(new Response(null, { status: 404 }), true)
    try {
      expect(app.apiFetch).toHaveBeenCalledOnce()
      expect(app.setNotice).toHaveBeenCalledWith(
        'Không thể kết nối thông báo trực tiếp. Tải lại trang để thử lại.',
        'error',
      )
      expect(TestEventSource.instances).toHaveLength(0)
    } finally { await app.close() }
  })

  it('does not signal from an old session or after cleanup', async () => {
    const app = await setup()
    try {
      await act(async () => app.transport.onopen?.())
      await app.close()
      await act(async () => app.transport.onopen?.())
      expect(app.events).toEqual([])
      expect(app.transport.closed).toBe(true)
    } finally {
      if (!app.transport.closed) await app.close()
    }
  })
})
