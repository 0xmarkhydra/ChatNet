import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createAppLogout, type AppLogoutDependencies } from './createAppLogout'
import { getOneSignalPushState } from '../../features/notifications/lib/onesignal'
import { resetConversationMembershipOnLogout } from '../../features/chat/lib/conversationMembershipLifecycle'

vi.mock('../../features/notifications/lib/onesignal', () => ({
  getOneSignalPushState: vi.fn(async () => ({ subscriptionId: 'push-id' })),
}))
vi.mock('../../features/chat/lib/conversationMembershipLifecycle', () => ({
  resetConversationMembershipOnLogout: vi.fn(),
}))

const resetMocks = () => {
  const events: string[] = []
  const outboxRef = { current: [{ clientId: 'pending' }] as unknown }
  const pendingSend = { current: { clientId: 'pending' } as unknown }
  const session = { current: { token: 'original-token', sessionId: 'original-session' } }
  const mediaUploadAbort = { current: { abort: () => events.push('uploadAbort') } as { abort(): void } | null }
  const refs: Record<string, unknown> = {
    chatOutboxRef: outboxRef,
    pendingSend,
    sessionRef: session,
    mediaUploadAbort,
    chatOutboxSession: { current: 'original-session' },
    sendingClientIDs: { current: new Set(['pending']) },
    nearbyRequest: { current: 1 },
    conversationOffset: { current: 10 },
    conversationPagingBusy: { current: true },
    messagesPagingBusy: { current: true },
    actionLocks: { current: new Set(['locked']) },
    pendingRequests: { current: { clear: () => events.push('pendingRequests.clear') } },
    mutationRequests: { current: { clear: () => events.push('mutationRequests.clear') } },
    messageReceipts: { current: { clear: () => events.push('messageReceipts.clear') } },
    messageSound: { current: { clearSeen: () => events.push('messageSound.clearSeen') } },
    preferenceRevision: { current: 3 },
    sendingRef: { current: true },
    friendActionRef: { current: { clear: () => events.push('friendActionRef.clear') } },
    feedRevision: { current: 2 },
    draftBeforeEdit: { current: { text: 'draft' } },
    profileLoadSequence: { current: 2 },
    profilePagingBusy: { current: true },
    postsPagingBusy: { current: true },
    revokedConversationIds: new Set(),
    membershipSnapshot: new Map(),
    membershipSyncSequence: { current: 1 },
    membershipEventSequence: { current: 1 },
    visitorUsername: 'friend',
    navigate: (...args: unknown[]) => { events.push('navigate:' + String(args[0])) },
    resetSavedPosts: () => events.push('resetSavedPosts'),
    setNotice: () => {},
    endSession: (_revoke?: boolean, _clearStorage?: boolean) => {
      events.push('endSession')
      expect(outboxRef.current).toEqual([])
      expect(pendingSend.current).toBeNull()
      expect(refs.chatOutboxSession).toEqual({ current: '' })
    },
  }
  const setters = new Proxy({}, {
    get: (_obj, name: string) => (value: unknown) => {
      events.push(name)
      if (name === 'setChatOutbox') expect(value).toEqual([])
    },
  })
  const options = new Proxy(refs, {
    get: (target, key: string) =>
      Object.prototype.hasOwnProperty.call(target, key)
        ? target[key]
        : Reflect.get(setters, key),
  }) as unknown as AppLogoutDependencies
  return { options, events, outboxRef, pendingSend, mediaUploadAbort, session }
}

describe('createAppLogout session teardown', () => {
  beforeEach(() => {
    vi.mocked(getOneSignalPushState).mockResolvedValue({ subscriptionId: 'push-id' } as never)
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 204 })))
  })
  afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks() })

  it('clears outgoing outbox before ending session, then resets all feature state', async () => {
    const t = resetMocks()
    createAppLogout(t.options)()
    expect(t.events.indexOf('setChatOutbox')).toBeLessThan(t.events.indexOf('endSession'))
    expect(t.events.indexOf('endSession')).toBeLessThan(t.events.indexOf('setConversations'))
    expect(t.events).toContain('setMessages')
    expect(t.events).toContain('setMessageDrafts')
    expect(t.events).toContain('setFriends')
    expect(t.events).toContain('setProfilePosts')
    expect(t.events).toContain('setPosts')
    expect(t.events).toContain('uploadAbort')
    expect(t.mediaUploadAbort.current).toBeNull()
    expect(t.events).toContain('resetSavedPosts')
    expect(resetConversationMembershipOnLogout).toHaveBeenCalledTimes(1)
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(2))
    const calls = vi.mocked(fetch).mock.calls
    expect(calls.map(([url]) => String(url))).toEqual([
      expect.stringContaining('/api/users/nearby'),
      expect.stringContaining('/api/push/subscription'),
    ])
    expect(calls[0][1]?.headers).toEqual({ Authorization: 'Bearer original-token' })
  })

  it('retains revoke/clearStorage options and does not send presence calls without a token', async () => {
    const t = resetMocks()
    const endSession = vi.fn()
    t.options.endSession = endSession
    t.options.visitorUsername = null
    t.options.sessionRef.current = null
    createAppLogout(t.options)(false, false)
    expect(endSession).toHaveBeenCalledWith(false, false, t.options.setNotice)
    expect(t.events.some(x => x.startsWith('navigate:'))).toBe(false)
    expect(fetch).not.toHaveBeenCalled()
    await Promise.resolve()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('completes local teardown when remote unregister requests fail offline', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline') }))
    vi.mocked(getOneSignalPushState).mockRejectedValue(new Error('push unavailable'))
    const t = resetMocks()
    const endSession = vi.fn()
    t.options.endSession = endSession
    createAppLogout(t.options)()
    expect(endSession).toHaveBeenCalledTimes(1)
    expect(t.outboxRef.current).toEqual([])
    expect(t.pendingSend.current).toBeNull()
    expect(t.events).toContain('setMessages')
    await Promise.resolve()
    await Promise.resolve()
  })

  it('uses the original token even if endSession immediately changes the account', async () => {
    const t = resetMocks()
    t.options.endSession = () => { t.options.sessionRef.current = null }
    createAppLogout(t.options)()
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(2))
    const headers = vi.mocked(fetch).mock.calls[1][1]?.headers
    expect(headers).toMatchObject({ Authorization: 'Bearer original-token' })
  })
})