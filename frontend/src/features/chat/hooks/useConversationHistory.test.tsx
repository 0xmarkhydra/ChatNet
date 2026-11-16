// @vitest-environment jsdom
import { act, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiContext } from '../../../shared/context/ApiContext'
import { SessionContext } from '../../../shared/context/SessionContext'
import { useChatPanelState } from './useChatPanelState'
import { useConversationHistory } from './useConversationHistory'
import type { Session } from '../../../shared/types/session'
import type { Conversation } from '../types'

const mocks = vi.hoisted(() => ({
  clear: vi.fn(),
  notice: vi.fn(),
}))
vi.mock('../api/conversations', () => ({ clearConversationHistory: mocks.clear }))
vi.mock('../../../shared/context/NoticeContext', () => ({
  useNotice: () => ({ setNotice: mocks.notice }),
}))

const globals = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
const previousAct = globals.IS_REACT_ACT_ENVIRONMENT
beforeEach(() => {
  globals.IS_REACT_ACT_ENVIRONMENT = true
  mocks.clear.mockReset()
  mocks.notice.mockReset()
  vi.spyOn(window, 'confirm').mockReturnValue(true)
})
afterEach(() => {
  globals.IS_REACT_ACT_ENVIRONMENT = previousAct
  vi.restoreAllMocks()
})

function account(id: 'A' | 'B'): Session {
  return {
    token: 'token-' + id, sessionId: id,
    user: { id: id === 'A' ? 1 : 2, username: id, email: id + '@test.invalid', displayName: id },
  }
}
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: Error) => void
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail })
  return { promise, resolve, reject }
}

function setup() {
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  const sessionRef = { current: account('A') as Session | null }
  const activeConversationIdRef = { current: 42 as number | null }
  const invalidate = vi.fn()
  const refresh = vi.fn(async () => {})
  const resetMessages = vi.fn()
  const resetConversations = vi.fn()
  let busy = false
  let clear!: () => Promise<void>
  function Probe({ session, id }: { session: Session; id: number }) {
    const panel = useChatPanelState({ activeConversationId: id, sessionId: session.sessionId })
    const [messages, setMessages] = useState([])
    const cache = { current: { invalidate } }
    const hook = useConversationHistory({
      activeConversationId: id,
      activeConversationIdRef,
      conversations: [{ id, name: 'Room' } as Conversation],
      historyActionBusy: panel.historyActionBusy,
      refreshConversations: refresh,
      responseCache: cache as unknown as Parameters<typeof useConversationHistory>[0]['responseCache'],
      setActiveConversationId: resetConversations,
      setConversationDetailsOpen: panel.setConversationDetailsOpen,
      setHasMoreMessages: vi.fn(),
      setHistoryActionBusy: panel.setHistoryActionBusy,
      setMessageSearchOpen: panel.setMessageSearchOpen,
      setMessages: setMessages as Parameters<typeof useConversationHistory>[0]['setMessages'],
      setReplyingTo: panel.setReplyingTo,
      setSharedContentOpen: panel.setSharedContentOpen,
      setTranslations: vi.fn(),
    })
    busy = panel.historyActionBusy
    clear = hook.clearActiveConversationHistory
    return <output>{String(busy)}</output>
  }
  const request = vi.fn()
  return {
    host, invalidate, refresh, request, resetMessages,
    get busy() { return busy },
    get clear() { return clear },
    async render(session: Session, id = 42) {
      sessionRef.current = session
      activeConversationIdRef.current = id
      await act(async () => root.render(
        <ApiContext.Provider value={{
          apiFetch: request, pendingRequests: { current: new Set() },
          mutationRequests: { current: new Map() },
        }}>
          <SessionContext.Provider value={{ session, sessionRef }}>
            <Probe session={session} id={id} />
          </SessionContext.Provider>
        </ApiContext.Provider>,
      ))
    },
    async close() {
      await act(async () => root.unmount())
      host.remove()
    },
  }
}

describe('clear conversation history ownership', () => {
  it('ignores old A resolution after A → B → A and never blocks the new visit', async () => {
    const p = setup()
    const oldRequest = deferred<Response>()
    mocks.clear.mockReturnValueOnce(oldRequest.promise)
    try {
      await p.render(account('A'))
      let old!: Promise<void>
      await act(async () => { old = p.clear() })
      expect(p.busy).toBe(true)

      await p.render(account('B'))
      expect(p.busy).toBe(false)
      await p.render(account('A'))
      expect(p.busy).toBe(false)

      await act(async () => oldRequest.resolve(new Response(null, { status: 204 })))
      await old
      expect(p.invalidate).not.toHaveBeenCalled()
      expect(p.refresh).not.toHaveBeenCalled()
      expect(mocks.notice).not.toHaveBeenCalled()
      expect(p.busy).toBe(false)
    } finally { await p.close() }
  })

  it('shows a failure for the active visit and releases its busy state', async () => {
    const p = setup()
    const pending = deferred<Response>()
    mocks.clear.mockReturnValueOnce(pending.promise)
    try {
      await p.render(account('A'))
      let action!: Promise<void>
      await act(async () => { action = p.clear() })
      expect(p.busy).toBe(true)
      await act(async () => pending.reject(new Error('offline')))
      await action
      expect(mocks.notice).toHaveBeenCalledWith('offline', 'error')
      expect(p.busy).toBe(false)
    } finally { await p.close() }
  })
  it('does not let an earlier conversation clear a later conversation busy flag', async () => {
    const p = setup()
    const first = deferred<Response>()
    const second = deferred<Response>()
    mocks.clear.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    try {
      await p.render(account('A'), 42)
      let oldAction!: Promise<void>
      await act(async () => { oldAction = p.clear() })
      expect(p.busy).toBe(true)

      await p.render(account('A'), 43)
      expect(p.busy).toBe(false)
      let currentAction!: Promise<void>
      await act(async () => { currentAction = p.clear() })
      expect(p.busy).toBe(true)

      await act(async () => first.resolve(new Response(null, { status: 204 })))
      await oldAction
      expect(p.busy).toBe(true)
      await act(async () => second.resolve(new Response(null, { status: 204 })))
      await currentAction
      expect(p.busy).toBe(false)
    } finally { await p.close() }
  })

})
