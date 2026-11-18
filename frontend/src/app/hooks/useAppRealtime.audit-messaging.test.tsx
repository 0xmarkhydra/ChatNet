// @vitest-environment jsdom
import { act, type SetStateAction } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Conversation, Message } from '../../features/chat/types'
import { SessionResponseCache } from '../../shared/lib/sessionCache'
import type { Tab } from '../../shared/types/navigation'
import type { Session } from '../../shared/types/session'
import { useAppRealtime } from './useAppRealtime'

class TestEventSource {
  static latest: TestEventSource
  onopen?: () => void
  private listeners = new Map<string, (event: { data: string }) => void>()

  constructor() { TestEventSource.latest = this }

  addEventListener(type: string, listener: (event: { data: string }) => void) {
    this.listeners.set(type, listener)
  }

  emit(message: Message) {
    this.listeners.get('update')?.({
      data: JSON.stringify({ type: 'message', conversationId: message.conversationId, message }),
    })
  }

  close() {}
}

const at = (minute: number) => new Date(Date.UTC(2026, 0, 1, 0, minute)).toISOString()
const message = (id: number, overrides: Partial<Message> = {}): Message => ({
  id, conversationId: 42, senderId: 2, sender: 'friend', text: 'message ' + id,
  createdAt: at(id), ...overrides,
})

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.stubGlobal('EventSource', TestEventSource)
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
  vi.spyOn(document, 'hasFocus').mockReturnValue(true)
  vi.spyOn(console, 'info').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

async function openChat({
  tab = 'chat', type = 'direct', channelId = 0, background = false,
  initialMessages = [],
}: {
  tab?: Tab; type?: Conversation['type']; channelId?: number;
  background?: boolean; initialMessages?: Message[];
} = {}) {
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  const session: Session = {
    token: 'fixture', sessionId: 'fixture-session',
    user: { id: 1, username: 'owner', displayName: 'Owner', email: 'owner@example.test' },
  }
  const noop = () => {}
  const asyncNoop = async () => {}
  const last = initialMessages.at(-1)
  let messages = initialMessages
  let conversations: Conversation[] = [{
    id: 42, type, name: 'Chat QA', memberCount: 2, unreadCount: 0, online: true,
    createdAt: at(0), lastMessage: last?.text ?? '', lastMessageAt: last?.createdAt,
  }]
  const apiFetch = vi.fn(async (_path: string, _init?: RequestInit) => new Response(null, { status: 204 }))
  const onMessageConfirmed = vi.fn()
  const options: Parameters<typeof useAppRealtime>[0] = {
    session, sessionRef: { current: session }, apiFetch,
    responseCache: { current: new SessionResponseCache() },
    activeConversationIdRef: { current: background ? null : 42 },
    activeChannelIdRef: { current: channelId },
    activeConversationTypeRef: { current: type },
    tabRef: { current: tab },
    revokedConversationIds: { current: new Set() },
    membershipSnapshot: { current: new Set() },
    membershipEventSequence: { current: 0 },
    membershipSyncSequence: { current: 0 },
    messageChanges: { current: new Set() },
    messageSound: { current: null }, messageSoundEnabledRef: { current: false },
    pendingSend: { current: null }, messageReceipts: { current: new Map() },
    onCategoryAssignmentChanged: noop, onCategoriesChanged: noop,
    refreshCategoryConversations: noop, expireSession: noop,
    checkSession: async () => true, setStatus: noop, purgeConversation: noop,
    refreshConversations: asyncNoop, refreshPosts: asyncNoop, refreshStories: asyncNoop,
    refreshFriendConnections: asyncNoop, reconcileConversationMemberships: asyncNoop,
    refreshGroupMembers: asyncNoop, refreshPinnedMessages: asyncNoop, clearPinnedMessages: noop,
    setTranslations: noop, setMessageDrafts: noop, setOutgoingMessage: noop,
    onMessageConfirmed,
    setMessages: (update: SetStateAction<Message[]>) => {
      messages = typeof update === 'function' ? update(messages) : update
    },
    setConversations: (update: SetStateAction<Conversation[]>) => {
      conversations = typeof update === 'function' ? update(conversations) : update
    },
  }
  function Probe() {
    useAppRealtime(options)
    return null
  }
  await act(async () => root.render(<Probe />))
  return {
    apiFetch, onMessageConfirmed,
    get messages() { return messages },
    get conversation() { return conversations[0] },
    async emit(...incoming: Message[]) {
      await act(async () => { for (const event of incoming) TestEventSource.latest.emit(event) })
    },
    async reconnect() {
      await act(async () => {
        TestEventSource.latest.onopen?.()
        TestEventSource.latest.onopen?.()
      })
    },
    async close() {
      await act(async () => root.unmount())
      host.remove()
    },
  }
}

describe('message receipt across conversation, channel and visibility boundaries', () => {
  it('sends a direct read receipt for a visible open conversation', async () => {
    const chat = await openChat()
    try {
      await chat.emit(message(10))
      expect(chat.messages.map(item => item.id)).toEqual([10])
      expect(chat.conversation.unreadCount).toBe(0)
      expect(chat.apiFetch).toHaveBeenCalledExactlyOnceWith('/api/conversations/42/read', { method: 'POST' })
    } finally { await chat.close() }
  })

  it('counts a message received with the conversation open in a hidden tab without reading it', async () => {
    const chat = await openChat()
    try {
      vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
      await chat.emit(message(10))
      expect(chat.messages.map(item => item.id)).toEqual([10])
      expect(chat.conversation.unreadCount).toBe(1)
      expect(chat.apiFetch).not.toHaveBeenCalled()
    } finally { await chat.close() }
  })

  it('marks only the active group channel read and does not insert other-channel messages', async () => {
    const chat = await openChat({ type: 'group', channelId: 3 })
    try {
      await chat.emit(message(10, { channelId: 4 }), message(11, { channelId: 3 }))
      expect(chat.messages.map(item => item.id)).toEqual([11])
      expect(chat.conversation.unreadCount).toBe(1)
      expect(chat.apiFetch).toHaveBeenCalledExactlyOnceWith('/api/conversations/42/channel-read', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"channelId":3}',
      })
    } finally { await chat.close() }
  })

  it('matches a self-sent SSE receipt to its client ID without unread or read requests', async () => {
    const chat = await openChat({ tab: 'feed', background: true })
    try {
      const incoming = message(20, { senderId: 1, sender: 'owner', clientId: 'client-20' })
      await chat.emit(incoming)
      expect(chat.onMessageConfirmed).toHaveBeenCalledExactlyOnceWith(incoming)
      expect(chat.conversation.unreadCount).toBe(0)
      expect(chat.apiFetch).not.toHaveBeenCalled()
    } finally { await chat.close() }
  })

  it('does not insert duplicate live messages into the active timeline', async () => {
    const chat = await openChat({ tab: 'feed' })
    try {
      await chat.emit(message(10), message(10))
      expect(chat.messages.map(item => item.id)).toEqual([10])
    } finally { await chat.close() }
  })

  it('counts an offscreen SSE replay only once while server refresh is pending', async () => {
    const chat = await openChat({ tab: 'feed', background: true })
    try {
      await chat.emit(message(10), message(10))
      await chat.reconnect()
      await chat.emit(message(10), message(11))
      expect(chat.conversation.unreadCount).toBe(2)
    } finally { await chat.close() }
  })

  it('does not replace a newer conversation preview with an older delayed event', async () => {
    const chat = await openChat({ initialMessages: [message(12)] })
    try {
      await chat.emit(message(11))
      expect(chat.conversation.lastMessage).toBe('message 12')
      expect(chat.conversation.lastMessageAt).toBe(at(12))
    } finally { await chat.close() }
  })

  it('keeps message ID order when a live event arrives after a later history item', async () => {
    const chat = await openChat({ initialMessages: [message(12)] })
    try {
      await chat.emit(message(11))
      expect(chat.messages.map(item => item.id)).toEqual([11, 12])
    } finally { await chat.close() }
  })
})