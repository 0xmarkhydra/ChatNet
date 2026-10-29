import { act, useRef } from 'react'
import { createRoot } from 'react-dom/client'
import { useConversationData } from '../src/features/chat/useConversationData'
import { useMessageData } from '../src/features/chat/useMessageData'
import { useContactData } from '../src/features/contacts/useContactData'
import { useFeedData } from '../src/features/feed/useFeedData'
import { useApiRequest } from '../src/app/useApiRequest'
import type { Session } from '../src/features/auth/session'
import type { Conversation, MessageDraft } from '../src/features/chat/types'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
const session: Session = { sessionId: 'fixture', token: 'fixture', user: { id: 1, email: '', username: 'fixture', displayName: '' } }
const sessionRef = { current: session as Session | null }
const activeConversationIdRef = { current: null as number | null }
let request: (path: string, init?: RequestInit) => Promise<Response>
let transport: (path: string, init?: RequestInit) => Promise<Response>
let drafts: Record<number, MessageDraft> = {}
let purged: number[] = []
let openMessageId: number | null = null
const apiFetch = (path: string, init?: RequestInit) => request(path, init)
const setMessageDrafts = (update: React.SetStateAction<Record<number, MessageDraft>>) => { drafts = typeof update === 'function' ? update(drafts) : update }
const root = createRoot(document.getElementById('root')!)
let data: {
  chat: ReturnType<typeof useConversationData>
  messages: ReturnType<typeof useMessageData>
  contacts: ReturnType<typeof useContactData>
  feed: ReturnType<typeof useFeedData>
  api: ReturnType<typeof useApiRequest>
  actionLocks: React.RefObject<Set<string>>
}
function Harness() {
  const context = { session, sessionRef, apiFetch, setStatus: () => {}, setNotice: () => {} }
  const actionLocks = useRef(new Set<string>())
  const chat = useConversationData({ ...context, activeConversationIdRef, setMessageDrafts, purgeConversation: id => { purged.push(id) } })
  const pendingSend = useRef(null)
  const messageChanges = useRef(new Set<number>())
  const tabRef = useRef<'chat'>('chat')
  const messagesScrollRef = useRef<HTMLDivElement | null>(null)
  const messages = useMessageData({
    ...context, activeConversationId: openMessageId, activeConversationIdRef,
    translationPreferencesLoaded: true, targetLanguage: 'en',
    setTranslations: () => {}, messageChanges, pendingSend, setMessageDrafts,
    setConversations: chat.setConversations, tabRef, messagesScrollRef,
    purgeConversation: id => { purged.push(id) },
  })
  const contacts = useContactData(context)
  const feed = useFeedData({ ...context, actionLocks, setActivePostId: () => {} })
  const api = useApiRequest({ session, sessionRef, sessionClient: { request: (path, init) => transport(path, init), refresh: async () => session } })
  data = { chat, messages, contacts, feed, api, actionLocks }
  return null
}
function check(condition: unknown, message: string) { if (!condition) throw new Error(message) }
const json = (body: unknown, status = 200) => Response.json(body, { status })
const conversations = [{ id: 1 }, { id: 2 }] as Conversation[]
await act(async () => { root.render(<Harness />) })

// An incomplete membership snapshot must never prune known conversations or drafts.
request = async path => path.startsWith('/api/conversations?') ? json(conversations)
  : path.endsWith('after=0') ? json({ ids: [1], nextAfter: 1 }) : json({}, 503)
drafts = { 1: { text: 'one', attachments: [] }, 2: { text: 'two', attachments: [] } }
await act(async () => { await data.chat.refreshConversations() })
await act(async () => { await data.chat.reconcileConversationMemberships() })
check(data.chat.conversations.length === 2 && Object.keys(drafts).length === 2 && purged.length === 0, 'partial membership pruned data')
request = async path => path.startsWith('/api/conversations?') ? json(conversations) : json({ ids: [1], nextAfter: null })
await act(async () => { await data.chat.reconcileConversationMemberships(); await new Promise(r => setTimeout(r, 0)) })
check(data.chat.conversations.length === 1 && !drafts[2], 'complete membership did not reconcile')

// A late response from a previous session must not overwrite current data.
let finish!: (value: Response) => void
request = () => new Promise(resolve => { finish = resolve })
const late = data.chat.refreshConversations()
sessionRef.current = { ...session, sessionId: 'other' }
await act(async () => { finish(json([{ id: 3 }])); await late })
check(data.chat.conversations[0].id === 1, 'old session response applied')
sessionRef.current = session

// The newer of overlapping contact syncs wins, even if the older one ends last.
const deferred: Array<(value: Response) => void> = []
request = () => new Promise(resolve => { deferred.push(resolve) })
let older!: Promise<void>
await act(async () => { older = data.contacts.refreshFriendConnections() })
request = async path => path === '/api/friends' ? json([{ id: 2 }]) : json([])
await act(async () => { await data.contacts.refreshFriendConnections() })
await act(async () => { deferred.forEach((resolve, i) => resolve(json(i === 0 ? [{ id: 1 }] : []))); await older })
check(data.contacts.friends[0].id === 2 && !data.contacts.friendSyncBusy, 'old contact sync overwrote newer sync')

// A refresh must not overwrite an in-progress optimistic feed action.
request = async () => json([{ id: 1 }])
data.actionLocks.current.add('feed:1')
await act(async () => { await data.feed.refreshPosts() })
check(data.feed.posts.length === 0, 'feed refresh ignored action lock')
data.actionLocks.current.clear()
await act(async () => { await data.feed.refreshPosts() })
check(data.feed.posts.length === 1, 'feed refresh did not load after unlock')

// Duplicate writes share one request; failures release pending state.
let sends = 0
transport = () => { sends++; return new Promise(resolve => { finish = resolve }) }
let first!: Promise<Response>, second!: Promise<Response>
await act(async () => {
  first = data.api.apiFetch('/api/posts', { method: 'POST', body: '{}' })
  second = data.api.apiFetch('/api/posts', { method: 'POST', body: '{}' })
})
check(sends === 1 && data.api.pendingActions === 1, 'duplicate mutation or pending state regression')
await act(async () => { finish(json({ id: 1 })); await Promise.all([first, second]) })
check(data.api.pendingActions === 0, 'pending state leaked after success')
transport = async () => { throw new Error('offline') }
await act(async () => {
  const response = await data.api.apiFetch('/api/posts', { method: 'POST', body: '{}' })
  check(response.status === 503, 'ambiguous write did not preserve error response')
})
check(data.api.pendingActions === 0, 'pending state leaked after failure')
// Message history loads through the extracted hook and rejects paging for an inactive chat.
openMessageId = 1
activeConversationIdRef.current = 1
request = async (path, init) => init?.method === 'POST' ? json({}) : json([{ id: 10, conversationId: 1, text: 'history' }])
await act(async () => { root.render(<Harness />) })
for (let attempt = 0; attempt < 50 && data.messages.messages[0]?.id !== 10; attempt++) {
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 10)) })
}
check(data.messages.messages[0]?.id === 10, 'message history not loaded')
let olderHistory!: Promise<void>
request = () => new Promise(resolve => { finish = resolve })
await act(async () => { data.messages.setHasMoreMessages(true) })
await act(async () => { olderHistory = data.messages.loadOlderMessages() })
activeConversationIdRef.current = 2
await act(async () => { finish(json([{ id: 9, conversationId: 1 }])); await olderHistory })
check(data.messages.messages.length === 1 && data.messages.messages[0].id === 10, 'old chat paging response applied to a new chat')
await act(async () => root.unmount())
document.body.dataset.result = 'passed'