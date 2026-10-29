// A per-tab outbox for unacknowledged chat sends. Only the original request
// fields are saved: never persist bearer tokens or signed media URLs.
export type QueuedChatAttachment = {
  storageRef: string
  name: string
  sizeBytes: number
  contentType: string
  kind: 'image' | 'video' | 'audio' | 'file'
}

export type QueuedChatMessage = {
  clientId: string
  conversationId: number
  text: string
  attachments: QueuedChatAttachment[]
  replyToMessageId?: number
  replyToSender?: string
  replyToText?: string
  createdAt: string
  status: 'queued' | 'unconfirmed' | 'failed'
  error?: string
}

type ChatStore = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
const MAX_OUTBOX = 60
const MAX_BYTES = 600_000
const key = (userId: number) => `chatnet:outbox:v1:${userId}`
const validID = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) > 0
const validClientID = (value: unknown): value is string =>
  typeof value === 'string' && /^[a-zA-Z0-9-]{1,64}$/.test(value)

function usableStore(store?: ChatStore): ChatStore | null {
  try { return store ?? window.sessionStorage } catch { return null }
}

function validItem(value: unknown): value is QueuedChatMessage {
  if (!value || typeof value !== 'object') return false
  const m = value as QueuedChatMessage
  return validClientID(m.clientId) && validID(m.conversationId) &&
    typeof m.text === 'string' && m.text.length <= 4000 &&
    typeof m.createdAt === 'string' && !Number.isNaN(Date.parse(m.createdAt)) &&
    (m.replyToMessageId === undefined || validID(m.replyToMessageId)) &&
    (m.replyToSender === undefined || typeof m.replyToSender === 'string') &&
    (m.replyToText === undefined || typeof m.replyToText === 'string') &&
    (m.status === 'queued' || m.status === 'unconfirmed' || m.status === 'failed') &&
    (m.error === undefined || typeof m.error === 'string') &&
    Array.isArray(m.attachments) && m.attachments.length <= 10 &&
    m.attachments.every((a) => a && typeof a.storageRef === 'string' && a.storageRef.length > 0 &&
      typeof a.name === 'string' && typeof a.contentType === 'string' &&
      Number.isSafeInteger(a.sizeBytes) && a.sizeBytes >= 0 &&
      ['image', 'video', 'audio', 'file'].includes(a.kind)) &&
    (m.text.trim().length > 0 || m.attachments.length > 0)
}

function safeItem(item: QueuedChatMessage): QueuedChatMessage {
  return {
    clientId: item.clientId,
    conversationId: item.conversationId,
    text: item.text,
    attachments: item.attachments.map(({ storageRef, name, sizeBytes, contentType, kind }) =>
      ({ storageRef, name, sizeBytes, contentType, kind })),
    ...(item.replyToMessageId ? { replyToMessageId: item.replyToMessageId } : {}),
    ...(item.replyToSender ? { replyToSender: item.replyToSender } : {}),
    ...(item.replyToText ? { replyToText: item.replyToText } : {}),
    createdAt: item.createdAt,
    status: item.status,
    ...(item.error ? { error: item.error.slice(0, 250) } : {}),
  }
}

export function loadChatOutbox(userId: number, sessionId: string, store?: ChatStore): QueuedChatMessage[] {
  if (!validID(userId) || !sessionId) return []
  try {
    const raw = usableStore(store)?.getItem(key(userId))
    if (!raw || raw.length > MAX_BYTES) return []
    const value: unknown = JSON.parse(raw)
    if (!value || typeof value !== 'object') return []
    const saved = value as { sessionId?: string; items?: unknown }
    if (saved.sessionId !== sessionId || !Array.isArray(saved.items) || saved.items.length > MAX_OUTBOX) return []
    const seen = new Set<string>()
    return saved.items.filter((item): item is QueuedChatMessage => {
      if (!validItem(item) || seen.has(item.clientId)) return false
      seen.add(item.clientId)
      return true
    }).map(safeItem)
  } catch { return [] }
}

export function saveChatOutbox(
  userId: number, sessionId: string, items: QueuedChatMessage[], store?: ChatStore,
): boolean {
  if (!validID(userId) || !sessionId || items.length > MAX_OUTBOX || !items.every(validItem)) return false
  try {
    const target = usableStore(store)
    if (!target) return false
    if (!items.length) target.removeItem(key(userId))
    else {
      const raw = JSON.stringify({ sessionId, items: items.map(safeItem) })
      if (raw.length > MAX_BYTES) return false
      target.setItem(key(userId), raw)
    }
    return true
  } catch { return false }
}

export function clearChatOutbox(userId: number, store?: ChatStore): void {
  if (!validID(userId)) return
  try { usableStore(store)?.removeItem(key(userId)) } catch { /* Restricted storage */ }
}

export function enqueueChatMessage(items: QueuedChatMessage[], message: QueuedChatMessage): QueuedChatMessage[] {
  if (items.length >= MAX_OUTBOX || items.some((item) => item.clientId === message.clientId)) return items
  return [...items, message]
}

export function confirmChatMessage(items: QueuedChatMessage[], clientId: string, conversationId: number): QueuedChatMessage[] {
  return items.filter((item) => item.clientId !== clientId || item.conversationId !== conversationId)
}

export function retryableChatMessages(items: QueuedChatMessage[]): QueuedChatMessage[] {
  return items.filter((item) => item.status !== 'failed')
}
