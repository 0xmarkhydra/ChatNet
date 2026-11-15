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
      purgeConversation: vi.fn(), jumpToMessage: jump,
    })
    return <output>{current.messages.map(item => item.id).join(',')}</output>
  }
  return {
    host, jobs, notice, request, setConversations, tabRef,
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

      await app.render(account('B'))
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

})
