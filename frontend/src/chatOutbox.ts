// A durable per-account outbox for unacknowledged chat sends. Only the
// original request fields are saved: never persist bearer tokens or signed media URLs.
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

type ChatStore = Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'key' | 'length'>
const MAX_OUTBOX = 60
const MAX_BYTES = 600_000
const prefix = (userId: number) => `chatnet:outbox:v2:${userId}:`
const itemKey = (userId: number, clientId: string) => prefix(userId) + clientId
const validID = (value: unknown): value is number =>
  Number.isSafeInteger(value) && (value as number) > 0
const validClientID = (value: unknown): value is string =>
  typeof value === 'string' && /^[a-zA-Z0-9-]{1,64}$/.test(value)

function usableStore(store?: ChatStore): ChatStore | null {
  try { return store ?? window.localStorage } catch { return null }
}

function storedKeys(target: ChatStore, userId: number): string[] {
  const start = prefix(userId)
  const keys: string[] = []
  for (let index = 0; index < target.length; index++) {
    const candidate = target.key(index)
    if (candidate?.startsWith(start)) keys.push(candidate)
  }
  return keys
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
    const target = usableStore(store)
    if (!target) return []
    const keys = storedKeys(target, userId)
    if (keys.length > MAX_OUTBOX) return []

    let bytes = 0
    const seen = new Set<string>()
    const items: QueuedChatMessage[] = []
    for (const storageKey of keys) {
      const raw = target.getItem(storageKey)
      if (!raw) continue
      bytes += raw.length
      if (bytes > MAX_BYTES) return []
      const value: unknown = JSON.parse(raw)
      if (!value || typeof value !== 'object') continue
      const saved = value as { sessionId?: string; item?: unknown }
      if (saved.sessionId !== sessionId || !validItem(saved.item) ||
        seen.has(saved.item.clientId)) continue
      seen.add(saved.item.clientId)
      items.push(safeItem(saved.item))
    }
    return items.sort((a, b) =>
      a.createdAt.localeCompare(b.createdAt) || a.clientId.localeCompare(b.clientId))
  } catch { return [] }
}

export function persistChatOutboxChange(
  userId: number,
  sessionId: string,
  previous: QueuedChatMessage[],
  next: QueuedChatMessage[],
  store?: ChatStore,
): boolean {
  if (!validID(userId) || !sessionId || next.length > MAX_OUTBOX ||
    !next.every(validItem) || new Set(next.map((item) => item.clientId)).size !== next.length) return false
  try {
    const target = usableStore(store)
    if (!target) return false

    const nextByID = new Map(next.map((item) => [item.clientId, safeItem(item)]))
    const projected = new Map<string, string>()
    for (const storageKey of storedKeys(target, userId)) {
      const raw = target.getItem(storageKey)
      if (raw) projected.set(storageKey, raw)
    }
    for (const item of nextByID.values()) {
      projected.set(itemKey(userId, item.clientId), JSON.stringify({ sessionId, item }))
    }
    for (const old of previous) {
      if (!nextByID.has(old.clientId)) projected.delete(itemKey(userId, old.clientId))
    }
    if (projected.size > MAX_OUTBOX ||
      [...projected.values()].reduce((total, raw) => total + raw.length, 0) > MAX_BYTES) return false

    for (const item of nextByID.values()) {
      target.setItem(itemKey(userId, item.clientId), JSON.stringify({ sessionId, item }))
    }
    for (const old of previous) {
      if (!nextByID.has(old.clientId)) target.removeItem(itemKey(userId, old.clientId))
    }
    return true
  } catch { return false }
}

export function clearChatOutbox(userId: number, store?: ChatStore): void {
  if (!validID(userId)) return
  try {
    const target = usableStore(store)
    if (!target) return
    for (const storageKey of storedKeys(target, userId)) target.removeItem(storageKey)
  } catch { /* Restricted storage */ }
}

export function enqueueChatMessage(
  items: QueuedChatMessage[],
  message: QueuedChatMessage,
): QueuedChatMessage[] {
  if (items.length >= MAX_OUTBOX || items.some((item) => item.clientId === message.clientId)) return items
  return [...items, message]
}

export function confirmChatMessage(
  items: QueuedChatMessage[],
  clientId: string,
  conversationId: number,
): QueuedChatMessage[] {
  return items.filter((item) =>
    item.clientId !== clientId || item.conversationId !== conversationId)
}

export function retryableChatMessages(items: QueuedChatMessage[]): QueuedChatMessage[] {
  return items.filter((item) => item.status !== 'failed')
}
