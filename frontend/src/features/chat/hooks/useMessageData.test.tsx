// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Session } from '../../../shared/types/session'
import type { Tab } from '../../../shared/types/navigation'
import type { Message } from '../types'
import { MESSAGE_PAGE_SIZE } from '../types'
import { useMessageData } from './useMessageData'

const globals = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
const previousAct = globals.IS_REACT_ACT_ENVIRONMENT
beforeEach(() => { globals.IS_REACT_ACT_ENVIRONMENT = true })
afterEach(() => { globals.IS_REACT_ACT_ENVIRONMENT = previousAct; vi.restoreAllMocks() })

function deferred() {
  let resolve!: (response: Response) => void
  let reject!: (reason: Error) => void
  const promise = new Promise<Response>((ok, fail) => { resolve = ok; reject = fail })
  return { promise, resolve, reject }
}
const account = (name: 'A' | 'B'): Session => ({
  token: 'token-' + name, sessionId: name,
  user: { id: name === 'A' ? 1 : 2, username: name, displayName: name, email: name + '@test.invalid' },
})
const message = (id: number, conversationId = 42, channelId = 0): Message => ({
  id, conversationId, channelId, senderId: 100, sender: 'other', text: 'message ' + id,
  createdAt: '2026-11-15T00:00:00Z',
})
const page = (first: number, count = MESSAGE_PAGE_SIZE, channel = 0) =>
  Array.from({ length: count }, (_, i) => message(first + i, 42, channel))

function setup() {
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  const jobs: Array<ReturnType<typeof deferred>> = []
  const request = vi.fn((_path: string, _init?: RequestInit) => {
    const job = deferred()
    jobs.push(job)
    return job.promise
  })
  const notice = vi.fn()
  const setConversations = vi.fn()
  const purgeConversation = vi.fn()
  const tabRef = { current: 'feed' as Tab }
  const sessionRef = { current: account('A') as Session | null }
  const activeConversationIdRef = { current: 42 as number | null }
  const activeChannelIdRef = { current: 0 }
  let current!: ReturnType<typeof useMessageData>
  function Probe({ session, channelId, jump }: {
    session: Session; channelId: number; jump?: { conversationId: number; messageId: number; revision: number }
  }) {
    current = useMessageData({
      session, sessionRef, apiFetch: request, setNotice: notice,
      activeConversationId: 42, activeConversationIdRef, activeChannelId: channelId,
      activeChannelIdRef, activeConversationType: 'direct',
      translationPreferencesLoaded: true, targetLanguage: 'vi',
      setTranslations: vi.fn(), resetMessageChanges: vi.fn(),
      pendingSend: { current: null }, setMessageDrafts: vi.fn(),
      setConversations, refreshConversations: async () => {},
      tabRef, messagesScrollRef: { current: null },
      purgeConversation, jumpToMessage: jump,
    })
    return <output>{current.messages.map(item => item.id).join(',')}</output>
  }
  return {
    host, jobs, notice, purgeConversation, request, setConversations, tabRef,
    get current() { return current },
    async render(session: Session, channelId = 0, jump?: { conversationId: number; messageId: number; revision: number }) {
      sessionRef.current = session
      activeConversationIdRef.current = 42
      activeChannelIdRef.current = channelId
      await act(async () => root.render(<Probe session={session} channelId={channelId} jump={jump} />))
    },
    async respond(index: number, messages: Message[]) {
      await act(async () => {
        jobs[index].resolve(Response.json(messages))
        await Promise.resolve()
      })
    },
    async close() { await act(async () => root.unmount()); host.remove() },
  }
}

describe('chat message pagination visit isolation', () => {
  it('keeps the unread boundary for the visit even after reconnect returns zero', async () => {
    const app = setup()
    const session = account('A')
    try {
      await app.render(session)
      await app.respond(0, [{ ...message(10), firstUnreadMessageId: 11 }, message(11), message(12)])
      expect(app.current.unreadMessageId).toBe(11)
      await act(async () => window.dispatchEvent(new CustomEvent('chatnet:sse-reconnected', { detail: { sessionId: 'A' } })))
      await app.respond(1, [{ ...message(10), firstUnreadMessageId: 0 }, message(11), message(12)])
      expect(app.current.unreadMessageId).toBe(11)
      await app.render(session, 1)
      expect(app.current.unreadMessageId).toBeNull()
      await app.respond(2, [{ ...message(20, 42, 1), firstUnreadMessageId: 20 }])
      expect(app.current.unreadMessageId).toBe(20)
    } finally { await app.close() }
  })

  it('loads a bounded window around the first unread when it predates the latest page', async () => {
    const app = setup()
    try {
      await app.render(account('A'))
      const recent = page(200)
      await app.respond(0, [{ ...recent[0], firstUnreadMessageId: 50 }, ...recent.slice(1)])
      expect(app.request.mock.calls[1]?.[0]).toContain('before=50')
      expect(app.request.mock.calls[2]?.[0]).toContain('after=49')
      await app.respond(1, page(30, 20))
      await app.respond(2, page(50))
      expect(app.current.unreadMessageId).toBe(50)
      expect(app.current.messages.map(item => item.id)).toContain(50)
      expect(app.current.messages.at(-1)?.id).toBe(239)
      expect(app.current.messageGapBefore).toBe(200)
    } finally { await app.close() }
  })

  it('exposes an initial loading state, then resolves after a slow history request', async () => {
    const app = setup()
    try {
      await app.render(account('A'))
      expect(app.current.messageHistoryLoading).toBe(true)
      expect(app.current.messageHistoryError).toBe(false)
      await app.respond(0, [message(10)])
      expect(app.current.messageHistoryLoading).toBe(false)
      expect(app.current.messageHistoryError).toBe(false)
      expect(app.current.messages.map(item => item.id)).toEqual([10])
    } finally { await app.close() }
  })

  it('offers a retry after a failed first load and preserves cached history during retry', async () => {
    const app = setup()
    try {
      await app.render(account('A'))
      await act(async () => app.jobs[0].reject(new Error('offline')))
      expect(app.current.messageHistoryError).toBe(true)
      expect(app.current.messageHistoryLoading).toBe(false)
      await act(async () => app.current.retryMessageHistory())
      expect(app.jobs).toHaveLength(2)
      expect(app.current.messageHistoryLoading).toBe(true)
      await app.respond(1, [message(10)])
      expect(app.current.messageHistoryError).toBe(false)
      expect(app.current.messages.map(item => item.id)).toEqual([10])
      await act(async () => app.current.retryMessageHistory())
      expect(app.current.messages.map(item => item.id)).toEqual([10])
      await app.respond(2, [message(11)])
      expect(app.current.messages.map(item => item.id)).toEqual([11])
    } finally { await app.close() }
  })

  it('reuses only the selected channel history without a blank flash and purges cleared history', async () => {
    const app = setup()
    try {
      await app.render(account('A'), 0)
      await app.respond(0, [message(10, 42, 0)])
      expect(app.current.messages.map(item => item.id)).toEqual([10])

      await app.render(account('A'), 1)
      expect(app.current.messages).toEqual([])
      await app.respond(1, [message(20, 42, 1)])
      expect(app.current.messages.map(item => item.id)).toEqual([20])

      await app.render(account('A'), 0)
      // The delayed request is still unresolved, but authorized channel 0
      // history is present on the first render; channel 1 cannot leak into it.
      expect(app.jobs).toHaveLength(3)
      expect(app.current.messages.map(item => item.id)).toEqual([10])
      await app.respond(2, [message(11, 42, 0)])
      expect(app.current.messages.map(item => item.id)).toEqual([11])

      await act(async () => window.dispatchEvent(new CustomEvent('chatnet:message-history-cleared', {
        detail: { conversationId: 42 },
      })))
      expect(app.current.messages).toEqual([])
    } finally { await app.close() }
  })

  it('does not restore messages from an in-flight history request after a clear', async () => {
    const app = setup()
    try {
      await app.render(account('A'))
      await act(async () => window.dispatchEvent(new CustomEvent('chatnet:message-history-cleared', {
        detail: { conversationId: 42 },
      })))
      await app.respond(0, [message(10)])
      expect(app.current.messages).toEqual([])
      expect(app.current.hasMoreMessages).toBe(false)
    } finally { await app.close() }
  })

  it('keeps the current room cache when a previous visit returns a late 403', async () => {
    const app = setup()
    try {
      await app.render(account('A'), 0)
      await app.render(account('A'), 1)
      await app.render(account('A'), 0)
      await app.respond(2, [message(10)])
      await act(async () => app.jobs[0].resolve(new Response(null, { status: 403 })))
      expect(app.purgeConversation).not.toHaveBeenCalled()
      expect(app.current.messages.map(item => item.id)).toEqual([10])

      await app.render(account('A'), 1)
      await app.render(account('A'), 0)
      expect(app.current.messages.map(item => item.id)).toEqual([10])
    } finally { await app.close() }
  })

  it('never shows another signed-in account cached chat messages', async () => {
    const app = setup()
    try {
      await app.render(account('A'))
      await app.respond(0, [message(101)])
      expect(app.current.messages.map(item => item.id)).toEqual([101])

      await app.render(account('B'))
      expect(app.current.messages).toEqual([])
      await app.respond(1, [message(202)])
      expect(app.current.messages.map(item => item.id)).toEqual([202])

      await app.render(account('A'))
      expect(app.current.messages).toEqual([])
    } finally { await app.close() }
  })

  it('does not merge an old history page into a new A visit after A → B → A', async () => {
    const app = setup()
    try {
      await app.render(account('A'))
      await app.respond(0, page(41))
      expect(app.current.hasMoreMessages).toBe(true)
      expect(app.current.messages[0]?.id).toBe(41)
      let oldPage!: Promise<void>
      await act(async () => { oldPage = app.current.loadOlderMessages() })
      expect(app.jobs).toHaveLength(2)
      const pagingSignal = app.request.mock.calls[1]?.[1]?.signal
      expect(pagingSignal?.aborted).toBe(false)

      await app.render(account('B'))
      expect(pagingSignal?.aborted).toBe(true)
      await app.render(account('A'))
      expect(app.jobs).toHaveLength(4)
      await app.respond(3, page(101))
      expect(app.current.messages[0]?.id).toBe(101)
      await app.respond(1, page(1))
      await oldPage
      expect(app.current.messages[0]?.id).toBe(101)
      expect(app.current.messages).toHaveLength(MESSAGE_PAGE_SIZE)
      expect(app.current.messagesLoadingMore).toBe(false)
      expect(app.notice).not.toHaveBeenCalled()
    } finally { await app.close() }
  })

  it('ignores an old missing-history page after switching channels and returning', async () => {
    const app = setup()
    const jump = { conversationId: 42, messageId: 70, revision: 1 }
    try {
      await app.render(account('A'), 0, jump)
      // A target window and a separate recent window with a real gap.
      await app.respond(0, page(20, 80))
      await app.respond(1, page(200, 200))
      expect(app.current.messageGapBefore).toBe(200)
      let oldGap!: Promise<void>
      await act(async () => { oldGap = app.current.loadMissingMessages() })
      expect(app.jobs).toHaveLength(3)

      await app.render(account('A'), 1, jump)
      await app.render(account('A'), 0, jump)
      expect(app.jobs).toHaveLength(7)
      await app.respond(5, page(30, 80))
      await app.respond(6, page(220, 200))
      expect(app.current.messageGapBefore).toBe(220)

      await app.respond(2, page(120, 80))
      await oldGap
      expect(app.current.messageGapBefore).toBe(220)
      expect(app.current.messages.some(item => item.id === 130)).toBe(false)
      expect(app.current.messageGapLoading).toBe(false)
      expect(app.notice).not.toHaveBeenCalled()
    } finally { await app.close() }
  })
  it('does not mark the new visit read when an old focus receipt completes after A → B → A', async () => {
    const app = setup()
    try {
      await app.render(account('A'))
      await app.respond(0, [message(50)])
      app.tabRef.current = 'chat'
      await act(async () => window.dispatchEvent(new Event('focus')))
      expect(app.jobs).toHaveLength(2)
      expect(app.request.mock.calls[1]?.[0]).toBe('/api/conversations/42/read')

      app.tabRef.current = 'feed'
      await app.render(account('B'))
      await app.render(account('A'))
      await app.respond(1, [])
      expect(app.setConversations).not.toHaveBeenCalled()
      expect(app.notice).not.toHaveBeenCalled()
    } finally { await app.close() }
  })

  it('keeps the new visit paging lock when a prior visit fails late', async () => {
    const app = setup()
    try {
      await app.render(account('A'))
      await app.respond(0, page(41))
      let olderA!: Promise<void>
      await act(async () => { olderA = app.current.loadOlderMessages() })

      await app.render(account('B'))
      await app.render(account('A'))
      await app.respond(3, page(101))
      let olderNewA!: Promise<void>
      await act(async () => { olderNewA = app.current.loadOlderMessages() })
      expect(app.current.messagesLoadingMore).toBe(true)
      expect(app.jobs).toHaveLength(5)

      await act(async () => app.jobs[1].reject(new Error('old request failed')))
      await olderA
      expect(app.current.messagesLoadingMore).toBe(true)
      expect(app.current.messagesPagingBusy.current).toBe(true)
      expect(app.notice).not.toHaveBeenCalled()

      await app.respond(4, page(61))
      await olderNewA
      expect(app.current.messagesLoadingMore).toBe(false)
      expect(app.current.messagesPagingBusy.current).toBe(false)
    } finally { await app.close() }
  })

  it('ignores paging responses after unmount without surfacing an error', async () => {
    const app = setup()
    let closed = false
    try {
      await app.render(account('A'))
      await app.respond(0, page(41))
      let older!: Promise<void>
      await act(async () => { older = app.current.loadOlderMessages() })
      await app.close()
      closed = true
      await act(async () => app.jobs[1].reject(new Error('late page error')))
      await older
      expect(app.notice).not.toHaveBeenCalled()
    } finally {
      if (!closed) await app.close()
    }
  })

  it('refetches current conversation only on reconnect for the active session', async () => {
    const app = setup()
    const session = account('A')
    try {
      await app.render(session)
      await app.respond(0, [message(10)])
      expect(app.current.messages.map(item => item.id)).toEqual([10])

      await act(async () => {
        window.dispatchEvent(new CustomEvent('chatnet:sse-reconnected', {
          detail: { sessionId: 'other-session' },
        }))
      })
      expect(app.jobs).toHaveLength(1)

      await act(async () => {
        window.dispatchEvent(new CustomEvent('chatnet:sse-reconnected', {
          detail: { sessionId: 'A' },
        }))
      })
      expect(app.jobs).toHaveLength(2)
      await app.respond(1, [message(10), message(11)])
      expect(app.current.messages.map(item => item.id)).toEqual([10, 11])
      expect(app.notice).not.toHaveBeenCalled()
    } finally { await app.close() }
  })

  it('does not overwrite reconnect backfill with an earlier in-flight history response', async () => {
    const app = setup()
    const session = account('A')
    try {
      await app.render(session)
      expect(app.jobs).toHaveLength(1)

      await act(async () => {
        window.dispatchEvent(new CustomEvent('chatnet:sse-reconnected', {
          detail: { sessionId: 'A' },
        }))
      })
      expect(app.jobs).toHaveLength(2)
      await app.respond(1, [message(20), message(21)])
      expect(app.current.messages.map(item => item.id)).toEqual([20, 21])

      await app.respond(0, [message(10)])
      expect(app.current.messages.map(item => item.id)).toEqual([20, 21])
      expect(app.notice).not.toHaveBeenCalled()
    } finally { await app.close() }
  })

})

describe('chat history derived loading and error state', () => {
  it('clears the error while retrying and reports it again when the retry fails', async () => {
    const app = setup()
    try {
      await app.render(account('A'))
      await act(async () => app.jobs[0].reject(new Error('offline')))
      await act(async () => app.current.retryMessageHistory())
      expect(app.current.messageHistoryError).toBe(false)
      expect(app.current.messageHistoryLoading).toBe(true)
      await act(async () => app.jobs[1].reject(new Error('still offline')))
      expect(app.current.messageHistoryError).toBe(true)
      expect(app.current.messageHistoryLoading).toBe(false)
    } finally { await app.close() }
  })

  it('stays loading until the latest retry settles, ignoring a superseded failure', async () => {
    const app = setup()
    try {
      await app.render(account('A'))
      await app.respond(0, [message(10)])
      await act(async () => app.current.retryMessageHistory())
      expect(app.current.messageHistoryLoading).toBe(true)
      await act(async () => app.current.retryMessageHistory())
      expect(app.jobs).toHaveLength(3)
      await act(async () => app.jobs[1].reject(new Error('superseded')))
      expect(app.current.messageHistoryLoading).toBe(true)
      expect(app.current.messageHistoryError).toBe(false)
      await app.respond(2, [message(11)])
      expect(app.current.messageHistoryLoading).toBe(false)
      expect(app.current.messageHistoryError).toBe(false)
      expect(app.notice).not.toHaveBeenCalled()
    } finally { await app.close() }
  })

  it('does not carry a ready or error result over to a revisited channel', async () => {
    const app = setup()
    const session = account('A')
    try {
      await app.render(session, 0)
      await act(async () => app.jobs[0].reject(new Error('offline')))
      await app.render(session, 1)
      expect(app.current.messageHistoryError).toBe(false)
      expect(app.current.messageHistoryLoading).toBe(true)
      await app.respond(1, [])
      expect(app.current.messageHistoryLoading).toBe(false)
      await app.render(session, 0)
      expect(app.current.messageHistoryError).toBe(false)
      expect(app.current.messageHistoryLoading).toBe(true)
      await app.respond(2, [])
      expect(app.current.messageHistoryLoading).toBe(false)
      await app.render(session, 0)
      expect(app.jobs).toHaveLength(3)
      expect(app.current.messageHistoryLoading).toBe(false)
    } finally { await app.close() }
  })

  it('stays loading while the unread window is fetched, then reports its failure and recovers on retry', async () => {
    const app = setup()
    try {
      await app.render(account('A'))
      const recent = page(200)
      await app.respond(0, [{ ...recent[0], firstUnreadMessageId: 50 }, ...recent.slice(1)])
      expect(app.jobs).toHaveLength(3)
      expect(app.current.messageHistoryLoading).toBe(true)
      await app.respond(1, page(30, 20))
      expect(app.current.messageHistoryLoading).toBe(true)
      await act(async () => app.jobs[2].reject(new Error('offline')))
      expect(app.current.messageHistoryLoading).toBe(false)
      expect(app.current.messageHistoryError).toBe(true)

      await act(async () => app.current.retryMessageHistory())
      expect(app.current.messageHistoryLoading).toBe(true)
      expect(app.current.messageHistoryError).toBe(false)
      await app.respond(3, [message(10)])
      expect(app.current.messageHistoryLoading).toBe(false)
      expect(app.current.messageHistoryError).toBe(false)
    } finally { await app.close() }
  })
})