// @vitest-environment jsdom
import { act, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom'
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
  const onHistoryCleared = vi.fn()
  const resetMessages = vi.fn()
  const resetConversations = vi.fn()
  let busy = false
  let clear!: () => Promise<void>
  function Probe({ session, id }: { session: Session; id: number }) {
    const location = useLocation()
    const navigate = useNavigate()
    const panel = useChatPanelState({ activeConversationId: id, sessionId: session.sessionId })
    const [messages, setMessages] = useState([])
    const cache = { current: { invalidate } }
    const hook = useConversationHistory({
      activeConversationId: id,
      activeConversationIdRef,
      conversations: [{ id, name: 'Room' } as Conversation],
      historyActionBusy: panel.historyActionBusy,
      refreshConversations: refresh,
      onHistoryCleared: (clearedId) => {
        onHistoryCleared(clearedId)
        if (location.pathname === `/chat/${clearedId}`) navigate('/chat', { replace: true })
      },
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
    return <><output>{String(busy)}</output><output data-path>{location.pathname}</output><button onClick={() => navigate('/chat/43')}>Other chat</button><button onClick={() => navigate(-1)}>Back</button></>
  }
  const request = vi.fn()
  return {
    host, invalidate, refresh, request, resetMessages, onHistoryCleared,
    get busy() { return busy },
    get clear() { return clear },
    async render(session: Session, id = 42) {
      sessionRef.current = session
      activeConversationIdRef.current = id
      await act(async () => root.render(
        <MemoryRouter initialEntries={['/chat', '/chat/42']}><ApiContext.Provider value={{
          apiFetch: request, pendingRequests: { current: new Set() },
          mutationRequests: { current: new Map() },
        }}>
          <SessionContext.Provider value={{ session, sessionRef }}>
            <Probe session={session} id={id} />
          </SessionContext.Provider>
        </ApiContext.Provider></MemoryRouter>,
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

      await act(async () => oldRequest.resolve(Response.json({ clearedThroughMessageId: 123, historyHidden: true })))
      await old
      expect(p.invalidate).not.toHaveBeenCalled()
      expect(p.refresh).not.toHaveBeenCalled()
      expect(mocks.notice).not.toHaveBeenCalled()
      expect(p.busy).toBe(false)
    } finally { await p.close() }
  })

  it('removes the cleared conversation only after server success', async () => {
    const p = setup()
    mocks.clear.mockResolvedValueOnce(Response.json({ clearedThroughMessageId: 123, historyHidden: true }))
    try {
      await p.render(account('A'))
      await act(async () => { await p.clear() })
      expect(p.onHistoryCleared).toHaveBeenCalledWith(42)
      expect(p.host.querySelector('[data-path]')?.textContent).toBe('/chat')
      await act(async () => { p.host.querySelectorAll('button')[1].click() })
      expect(p.host.querySelector('[data-path]')?.textContent).toBe('/chat')
      expect(p.refresh).toHaveBeenCalled()
    } finally { await p.close() }
  })
  it('does not redirect away from a different chat opened while clearing', async () => {
    const p = setup()
    const pending = deferred<Response>()
    mocks.clear.mockReturnValueOnce(pending.promise)
    try {
      await p.render(account('A'))
      let action!: Promise<void>
      await act(async () => { action = p.clear() })
      await act(async () => { p.host.querySelector('button')?.click() })
      await act(async () => pending.resolve(Response.json({ clearedThroughMessageId: 123, historyHidden: true })))
      await action
      expect(p.host.querySelector('[data-path]')?.textContent).toBe('/chat/43')
    } finally { await p.close() }
  })
  it('reports an older backend that clears history but cannot hide the conversation', async () => {
    const p = setup()
    mocks.clear.mockResolvedValueOnce(Response.json({ clearedThroughMessageId: 123 }))
    try {
      await p.render(account('A'))
      await act(async () => { await p.clear() })
      expect(mocks.notice).toHaveBeenCalledWith(expect.stringContaining('máy chủ chưa hỗ trợ ẩn hội thoại'), 'warning')
      expect(p.onHistoryCleared).toHaveBeenCalledWith(42)
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

      await act(async () => first.resolve(Response.json({ clearedThroughMessageId: 123, historyHidden: true })))
      await oldAction
      expect(p.busy).toBe(true)
      await act(async () => second.resolve(Response.json({ clearedThroughMessageId: 123, historyHidden: true })))
      await currentAction
      expect(p.busy).toBe(false)
    } finally { await p.close() }
  })

})
