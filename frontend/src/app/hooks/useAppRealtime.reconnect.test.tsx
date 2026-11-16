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
  globals.IS_REACT_ACT_ENVIRONMENT = previousAct
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

async function setup() {
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
  const opts = {
    session, sessionRef,
    refreshConversations: vi.fn(async () => {}),
    refreshPosts: vi.fn(async () => {}),
    refreshStories: vi.fn(async () => {}),
    refreshFriendConnections: vi.fn(async () => {}),
    reconcileConversationMemberships: vi.fn(async () => {}),
    setStatus: vi.fn(),
    checkSession: vi.fn(async () => true),
    membershipSyncSequence: { current: 0 },
  } as unknown as Parameters<typeof useAppRealtime>[0]
  function Probe() { useAppRealtime(opts); return null }
  await act(async () => { root.render(createElement(Probe)) })
  const transport = TestEventSource.instances[0]
  if (!transport) throw new Error('EventSource not constructed')
  return {
    events, transport,
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
    const app = await setup()
    try {
      await act(async () => app.transport.onerror?.())
      await act(async () => app.transport.onopen?.())
      expect(app.events).toEqual(['A'])
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
