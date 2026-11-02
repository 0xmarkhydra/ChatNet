// Session-tab-only message draft and ambiguous-send recovery.
// Never store an access token or a downloadable media URL here.
export type SavedChatDraft = { text: string }
export type SavedPendingSend = {
  sessionId: string
  conversationId: number
  signature: string
  clientId: string
  expiresAt: number
}

type ChatStore = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
const MAX_DRAFTS = 80
const MAX_TEXT_LENGTH = 12000
const MAX_SIGNATURE_LENGTH = 32000
const PENDING_TTL_MS = 24 * 60 * 60 * 1000
const draftKey = (userId: number) => `chatnet:drafts:v1:${userId}`
const pendingKey = (userId: number) => `chatnet:pending-send:v1:${userId}`

let platformStore: ChatStore | undefined

// Desktop keeps drafts across window/process restarts; Web retains tab-local behavior.
export function configureChatPersistenceStore(store: ChatStore): void { platformStore = store }

function usableStore(store?: ChatStore): ChatStore | null {
  try { return store ?? platformStore ?? window.sessionStorage } catch { return null }
}

function validUser(userId: number): boolean {
  return Number.isSafeInteger(userId) && userId > 0
}

export function loadChatDrafts(userId: number, store?: ChatStore): Record<number, SavedChatDraft> {
  const result: Record<number, SavedChatDraft> = {}
  if (!validUser(userId)) return result
  try {
    const raw = usableStore(store)?.getItem(draftKey(userId))
    if (!raw || raw.length > MAX_DRAFTS * (MAX_TEXT_LENGTH + 40)) return result
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return result
    for (const [key, value] of Object.entries(parsed)) {
      const id = Number(key)
      if (!Number.isSafeInteger(id) || id <= 0 || String(id) !== key || Object.keys(result).length >= MAX_DRAFTS) continue
      if (!value || typeof value !== 'object' || !('text' in value) || typeof value.text !== 'string') continue
      if (value.text.length > 0 && value.text.length <= MAX_TEXT_LENGTH) result[id] = { text: value.text }
    }
  } catch { /* Corrupt or unavailable browser storage must never block chat. */ }
  return result
}

export function saveChatDrafts(userId: number, drafts: Record<number, SavedChatDraft>, store?: ChatStore): void {
  if (!validUser(userId)) return
  try {
    const target = usableStore(store)
    if (!target) return
    const filtered: Record<number, SavedChatDraft> = {}
    for (const [key, draft] of Object.entries(drafts)) {
      const id = Number(key)
      if (!Number.isSafeInteger(id) || id <= 0 || !draft || typeof draft.text !== 'string' || draft.text.length > MAX_TEXT_LENGTH) continue
      if (draft.text.length > 0 && Object.keys(filtered).length < MAX_DRAFTS) filtered[id] = { text: draft.text }
    }
    if (Object.keys(filtered).length === 0) target.removeItem(draftKey(userId))
    else target.setItem(draftKey(userId), JSON.stringify(filtered))
  } catch { /* Ignore quota exceeded, privacy mode, and restricted storage. */ }
}

export function loadPendingSend(userId: number, sessionId: string, store?: ChatStore, now = Date.now()): SavedPendingSend | null {
  if (!validUser(userId) || !sessionId) return null
  try {
    const raw = usableStore(store)?.getItem(pendingKey(userId))
    if (!raw || raw.length > MAX_SIGNATURE_LENGTH + 1000) return null
    const candidate: unknown = JSON.parse(raw)
    if (!candidate || typeof candidate !== 'object') return null
    const saved = candidate as SavedPendingSend
    if (
      saved.sessionId !== sessionId ||
      !Number.isSafeInteger(saved.conversationId) || saved.conversationId <= 0 ||
      typeof saved.signature !== 'string' || saved.signature.length > MAX_SIGNATURE_LENGTH ||
      typeof saved.clientId !== 'string' || !/^[a-zA-Z0-9-]{1,64}$/.test(saved.clientId) ||
      !Number.isFinite(saved.expiresAt) || saved.expiresAt <= now || saved.expiresAt > now + PENDING_TTL_MS
    ) return null
    return saved
  } catch { return null }
}

export function savePendingSend(
  userId: number,
  pending: Omit<SavedPendingSend, 'expiresAt'>,
  store?: ChatStore,
  now = Date.now(),
): void {
  if (!validUser(userId) || pending.signature.length > MAX_SIGNATURE_LENGTH) return
  try {
    usableStore(store)?.setItem(pendingKey(userId), JSON.stringify({ ...pending, expiresAt: now + PENDING_TTL_MS }))
  } catch { /* Storage can be denied by the browser. In-memory retry still works. */ }
}

export function clearPendingSend(userId: number, clientId?: string, store?: ChatStore): void {
  if (!validUser(userId)) return
  try {
    const target = usableStore(store)
    if (!target) return
    if (clientId) {
      const raw = target.getItem(pendingKey(userId))
      const current = raw ? JSON.parse(raw) as { clientId?: string } : null
      if (current?.clientId !== clientId) return
    }
    target.removeItem(pendingKey(userId))
  } catch { /* Do not interrupt message confirmation. */ }
}

export function clearChatPersistence(userId: number, store?: ChatStore): void {
  if (!validUser(userId)) return
  try {
    const target = usableStore(store)
    target?.removeItem(draftKey(userId))
    target?.removeItem(pendingKey(userId))
  } catch { /* Session logout still succeeds if storage is unavailable. */ }
}
