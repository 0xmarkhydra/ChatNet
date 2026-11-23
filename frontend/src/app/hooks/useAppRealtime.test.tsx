// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Session } from '../../shared/types/session'
import { useAppRealtime } from './useAppRealtime'

class FakeEventSource {
  static instances: FakeEventSource[] = []
  onopen: (() => void) | null = null
  onerror: (() => void) | null = null
  closed = false
  listeners = new Map<string, (event: MessageEvent) => void>()
  constructor(public url: string) { FakeEventSource.instances.push(this) }
  addEventListener(name: string, handler: EventListenerOrEventListenerObject) {
    this.listeners.set(name, handler as (event: MessageEvent) => void)
  }
  close() { this.closed = true }
  emit(type: string, payload: unknown) {
    this.listeners.get(type)?.({ data: JSON.stringify(payload) } as MessageEvent)
  }
}

const user = (id: string): Session => ({
  token: 'token-' + id, sessionId: 'session-' + id,
  user: { id: id === 'A' ? 1 : 2, email: id + '@example.test', username: id, displayName: id },
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  FakeEventSource.instances.length = 0
})

describe('app SSE subscription lifecycle', () => {
  it('uses fresh realtime handlers without reconnecting after a render', async () => {
    const before = (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT
    ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    vi.stubGlobal('EventSource', FakeEventSource)
    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)
    const session = user('A')
    const sessionRef = { current: session }
    const first = vi.fn()
    const latest = vi.fn()
    const statusOld = vi.fn()
    const statusNew = vi.fn()
    const syncOld = vi.fn()
    const syncNew = vi.fn()
    const membershipSyncSequence = { current: 0 }
    const noop = vi.fn()
    const expireSession = vi.fn()
    const required = {
      sessionRef,
      apiFetch: vi.fn(async (path: string) => path === '/api/events/ticket'
        ? Response.json({ ticket: 't'.repeat(43) })
        : new Response(null, { status: 204 })),
      responseCache: { current: { invalidate: vi.fn() } },
      activeConversationIdRef: { current: null },
      activeChannelIdRef: { current: 0 },
      activeConversationTypeRef: { current: null },
      revokedConversationIds: { current: new Set<number>() },
      membershipSnapshot: { current: new Set<number>() },
      membershipEventSequence: { current: 0 },
      membershipSyncSequence,
      messageChanges: { current: new Set<number>() },
      messageSound: { current: null },
      messageSoundEnabledRef: { current: true },
      tabRef: { current: 'chat' },
      pendingSend: { current: null },
      messageReceipts: { current: new Map() },
      refreshPosts: noop, refreshStories: noop, refreshCategoryConversations: noop,
      onCategoryAssignmentChanged: noop, onCategoriesChanged: noop,
      expireSession, checkSession: vi.fn(async () => true),
      purgeConversation: noop, refreshGroupMembers: noop, refreshPinnedMessages: noop,
      clearPinnedMessages: noop, setMessages: noop, setTranslations: noop,
      setMessageDrafts: noop, setOutgoingMessage: noop, setConversations: noop,
      onMessageConfirmed: noop,
    }

    function Probe({ account, refresh, status, membership }: {
      account: Session; refresh: () => void; status: (value: string) => void; membership: () => void
    }) {
      useAppRealtime({
        ...required, session: account, refreshConversations: refresh,
        refreshFriendConnections: refresh, setStatus: status,
        reconcileConversationMemberships: membership,
      } as unknown as Parameters<typeof useAppRealtime>[0])
      return null
    }

    try {
      await act(async () => root.render(<Probe account={session} refresh={first} status={statusOld} membership={syncOld} />))
      expect(FakeEventSource.instances).toHaveLength(1)
      expect(first).toHaveBeenCalledTimes(1) // Initial conversation refresh
      const socket = FakeEventSource.instances[0]

      await act(async () => root.render(<Probe account={session} refresh={latest} status={statusNew} membership={syncNew} />))
      expect(FakeEventSource.instances).toHaveLength(1)
      await act(async () => socket.onopen?.())
      expect(statusOld).not.toHaveBeenCalled()
      expect(statusNew).toHaveBeenCalledWith('Đang online')
      expect(syncOld).not.toHaveBeenCalled()
      expect(syncNew).toHaveBeenCalledOnce()
      await act(async () => socket.emit('update', { type: 'friend.updated' }))
      expect(first).toHaveBeenCalledTimes(1)
      expect(latest).toHaveBeenCalledTimes(2)
      // Switching back to a visible tab must not immediately duplicate the recent friend poll.
      await act(async () => document.dispatchEvent(new Event('visibilitychange')))
      expect(latest).toHaveBeenCalledTimes(3) // Conversations refresh, friends stay within their poll window.

      // A new session closes A's subscription and rejects events from the old socket.
      const other = user('B')
      sessionRef.current = other
      await act(async () => root.render(<Probe account={other} refresh={latest} status={statusNew} membership={syncNew} />))
      expect(socket.closed).toBe(true)
      expect(FakeEventSource.instances).toHaveLength(2)
      const calls = latest.mock.calls.length
      const statusCalls = statusNew.mock.calls.length
      await act(async () => {
        socket.emit('update', { type: 'friend.updated' })
        socket.emit('session-revoked', {})
        socket.onopen?.()
        socket.onerror?.()
      })
      expect(latest).toHaveBeenCalledTimes(calls)
      expect(statusNew).toHaveBeenCalledTimes(statusCalls)
      expect(expireSession).not.toHaveBeenCalled()
      const newSocket = FakeEventSource.instances[1]
      await act(async () => newSocket.onopen?.())
      expect(syncNew).toHaveBeenCalledTimes(3) // Visibility resumes membership reconciliation.
      await act(async () => root.unmount())
      expect(newSocket.closed).toBe(true)
      const syncCalls = syncNew.mock.calls.length
      await act(async () => window.dispatchEvent(new Event('online')))
      expect(syncNew).toHaveBeenCalledTimes(syncCalls)
      expect(membershipSyncSequence.current).toBe(2)
    } finally {
      await act(async () => root.unmount())
      host.remove()
      ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = before
    }
  })
})
