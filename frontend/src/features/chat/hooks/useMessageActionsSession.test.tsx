// @vitest-environment jsdom
import { act, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Session } from '../../../shared/types/session'
import type { Message, MessageReaction } from '../types'
import { useMessageEdits } from './useMessageEdits'
import { useMessageReactions } from './useMessageReactions'

const mocks = vi.hoisted(() => ({
  edit: vi.fn(), recall: vi.fn(), react: vi.fn(), notice: vi.fn(),
  identity: { current: null as null | { sessionId: string; user: { id: number } } },
  session: null as null | { sessionId: string; user: { id: number } },
}))
vi.mock('../api/messages', () => ({
  editMessage: mocks.edit, recallMessage: mocks.recall, reactToMessage: mocks.react,
}))
vi.mock('../../../shared/context/ApiContext', () => ({
  useApi: () => ({ apiFetch: vi.fn() }),
}))
vi.mock('../../../shared/context/NoticeContext', () => ({
  useNotice: () => ({ setNotice: mocks.notice }),
}))
vi.mock('../../../shared/context/SessionContext', () => ({
  useSession: () => ({ session: mocks.session, sessionRef: mocks.identity }),
}))

const globals = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
const previousAct = globals.IS_REACT_ACT_ENVIRONMENT
beforeEach(() => {
  globals.IS_REACT_ACT_ENVIRONMENT = true
  mocks.edit.mockReset(); mocks.recall.mockReset(); mocks.react.mockReset(); mocks.notice.mockReset()
  vi.spyOn(window, 'prompt').mockReturnValue('changed')
  vi.spyOn(window, 'confirm').mockReturnValue(true)
})
afterEach(() => { globals.IS_REACT_ACT_ENVIRONMENT = previousAct; vi.restoreAllMocks() })

function account(id: 'A' | 'B'): Session {
  return { token: 'token-' + id, sessionId: id,
    user: { id: id === 'A' ? 1 : 2, email: 'test@example.invalid', username: id, displayName: id } }
}
function pending<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(done => { resolve = done })
  return { resolve, promise }
}
const initial: Message = {
  id: 23, conversationId: 42, senderId: 1, sender: 'A', text: 'original',
  createdAt: '2026-11-15T00:00:00Z',
}
function setup() {
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  const actionLocks = { current: new Set<string>() }
  const messageChanges = { current: new Set<number>() }
  const activeConversationIdRef = { current: 42 }
  const previews: Record<number, MessageReaction[]> = {}
  let latest!: {
    edit: (message: Message) => Promise<void>;
    recall: (message: Message) => Promise<void>;
    react: (message: Message, emoji: string) => Promise<void>;
  }
  function Probe() {
    const [messages, setMessages] = useState<Message[]>([initial])
    const [reactionPreviews, setReactionPreviews] = useState<Record<number, MessageReaction[]>>(previews)
    const edits = useMessageEdits({
      actionLocks, activeConversationIdRef, messageChanges, setMessages,
      setReplyingTo: vi.fn(), setTranslations: vi.fn(),
    })
    const reactions = useMessageReactions({
      actionLocks, activeConversationIdRef, messageChanges,
      setMessages, setReactionPreviews,
    })
    latest = { edit: edits.editOwnMessage, recall: edits.recallOwnMessage, react: reactions.toggleReaction }
    return <output>{JSON.stringify({ messages, reactionPreviews })}</output>
  }
  return {
    host, actionLocks, messageChanges, get actions() { return latest },
    get view() { return JSON.parse(host.querySelector('output')?.textContent ?? '{}') as {
      messages: Message[]; reactionPreviews: Record<number, MessageReaction[]>
    } },
    async render(session: Session) {
      mocks.identity.current = session
      mocks.session = session
      await act(async () => root.render(<Probe />))
    },
    async close() { await act(async () => root.unmount()); host.remove() },
  }
}
function response(data: Message) { return { ok: true, json: async () => data } }

describe('chat message mutations across account visits', () => {
  it('ignores an old edit response and preserves the new visit action lock', async () => {
    const app = setup()
    const old = pending<{ ok: boolean; json: () => Promise<Message> }>()
    const next = pending<{ ok: boolean; json: () => Promise<Message> }>()
    mocks.edit.mockReturnValueOnce(old.promise).mockReturnValueOnce(next.promise)
    try {
      await app.render(account('A'))
      let first!: Promise<void>
      await act(async () => { first = app.actions.edit(initial) })
      await app.render(account('B'))
      app.actionLocks.current = new Set()
      await app.render(account('A'))
      let second!: Promise<void>
      await act(async () => { second = app.actions.edit(initial) })
      expect(app.actionLocks.current.has('message:23')).toBe(true)
      await act(async () => old.resolve(response({ ...initial, text: 'stale' })))
      await first
      expect(app.view.messages[0].text).toBe('original')
      expect(app.actionLocks.current.has('message:23')).toBe(true)
      await act(async () => next.resolve(response({ ...initial, text: 'current' })))
      await second
      expect(app.view.messages[0].text).toBe('current')
      expect(app.actionLocks.current.has('message:23')).toBe(false)
      expect(mocks.notice).not.toHaveBeenCalled()
    } finally { await app.close() }
  })

  it('ignores an old recall completion after account switching', async () => {
    const app = setup()
    const old = pending<{ ok: boolean; json: () => Promise<Message> }>()
    mocks.recall.mockReturnValueOnce(old.promise)
    try {
      await app.render(account('A'))
      let task!: Promise<void>
      await act(async () => { task = app.actions.recall(initial) })
      await app.render(account('B'))
      app.actionLocks.current = new Set()
      await app.render(account('A'))
      await act(async () => old.resolve(response({ ...initial, deleted: true })))
      await task
      expect(app.view.messages[0].deleted).not.toBe(true)
      expect(app.messageChanges.current.has(23)).toBe(false)
      expect(mocks.notice).not.toHaveBeenCalled()
    } finally { await app.close() }
  })

  it('does not clear a new reaction preview or lock when an old result arrives', async () => {
    const app = setup()
    const old = pending<{ ok: boolean; json: () => Promise<Message> }>()
    const next = pending<{ ok: boolean; json: () => Promise<Message> }>()
    mocks.react.mockReturnValueOnce(old.promise).mockReturnValueOnce(next.promise)
    try {
      await app.render(account('A'))
      let first!: Promise<void>
      await act(async () => { first = app.actions.react(initial, '👍') })
      await app.render(account('B'))
      app.actionLocks.current = new Set()
      await app.render(account('A'))
      let second!: Promise<void>
      await act(async () => { second = app.actions.react(initial, '❤️') })
      expect(app.actionLocks.current.has('message:23')).toBe(true)
      expect(app.view.reactionPreviews[23]).toBeDefined()
      await act(async () => old.resolve(response({ ...initial, reactions: [] })))
      await first
      expect(app.actionLocks.current.has('message:23')).toBe(true)
      expect(app.view.reactionPreviews[23]).toBeDefined()
      await act(async () => next.resolve(response({ ...initial, reactions: [{ emoji: '❤️', count: 1, mine: true }] })))
      await second
      expect(app.view.messages[0].reactions?.[0].emoji).toBe('❤️')
      expect(app.view.reactionPreviews[23]).toBeUndefined()
      expect(mocks.notice).not.toHaveBeenCalled()
    } finally { await app.close() }
  })
})
