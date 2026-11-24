export type SavedSearch = { query: string; seenAt: number }
export type OpenedResult =
  | { kind: 'person'; username: string; title: string }
  | { kind: 'post'; id: number; title: string; subtitle: string }
  | { kind: 'community'; id: number; title: string; subtitle: string }
export type SearchHistory = { recent: string[]; saved: SavedSearch[]; opened: OpenedResult[] }

export const emptyHistory: SearchHistory = { recent: [], saved: [], opened: [] }
const MAX_RECENT = 8
const MAX_SAVED = 5
const MAX_OPENED = 6

const STORAGE_PREFIX = 'socco.search.v1:'
const storageKey = (scope: string) => STORAGE_PREFIX + scope
const sameQuery = (a: string, b: string) => a.toLocaleLowerCase('vi-VN') === b.toLocaleLowerCase('vi-VN')
const openedKey = (item: OpenedResult) => item.kind + ':' + (item.kind === 'person' ? item.username : item.id)

function isOpened(value: unknown): value is OpenedResult {
  if (!value || typeof value !== 'object') return false
  const item = value as Record<string, unknown>
  if (typeof item.title !== 'string') return false
  if (item.kind === 'person') return typeof item.username === 'string'
  return (item.kind === 'post' || item.kind === 'community') && typeof item.id === 'number' && typeof item.subtitle === 'string'
}

/** History is a per-session convenience; unreadable or malformed storage starts empty. */
export function readHistory(scope: string): SearchHistory {
  if (!scope) return emptyHistory
  let raw: string | null = null
  try { raw = localStorage.getItem(storageKey(scope)) } catch { return emptyHistory }
  if (!raw) return emptyHistory
  try {
    const parsed = JSON.parse(raw) as Partial<Record<keyof SearchHistory, unknown>>
    return {
      recent: Array.isArray(parsed.recent) ? parsed.recent.filter((v): v is string => typeof v === 'string').slice(0, MAX_RECENT) : [],
      saved: Array.isArray(parsed.saved)
        ? parsed.saved.filter((v): v is SavedSearch => !!v && typeof v.query === 'string' && typeof v.seenAt === 'number').slice(0, MAX_SAVED)
        : [],
      opened: Array.isArray(parsed.opened) ? parsed.opened.filter(isOpened).slice(0, MAX_OPENED) : [],
    }
  } catch {
    return emptyHistory
  }
}

export function writeHistory(scope: string, history: SearchHistory) {
  if (!scope) return
  try { localStorage.setItem(storageKey(scope), JSON.stringify(history)) } catch { /* storage full or blocked: history stays in memory */ }
}

export const addRecent = (history: SearchHistory, query: string): SearchHistory => ({
  ...history,
  recent: [query, ...history.recent.filter(item => !sameQuery(item, query))].slice(0, MAX_RECENT),
})

export const removeRecent = (history: SearchHistory, query: string): SearchHistory => ({
  ...history, recent: history.recent.filter(item => item !== query),
})

export const isSaved = (history: SearchHistory, query: string) => history.saved.some(item => sameQuery(item.query, query))

export const toggleSaved = (history: SearchHistory, query: string, now: number): SearchHistory => ({
  ...history,
  saved: isSaved(history, query)
    ? history.saved.filter(item => !sameQuery(item.query, query))
    : [{ query, seenAt: now }, ...history.saved].slice(0, MAX_SAVED),
})

export const markSeen = (history: SearchHistory, query: string, now: number): SearchHistory => ({
  ...history,
  saved: history.saved.map(item => sameQuery(item.query, query) ? { ...item, seenAt: now } : item),
})

export const addOpened = (history: SearchHistory, item: OpenedResult): SearchHistory => ({
  ...history,
  opened: [item, ...history.opened.filter(existing => openedKey(existing) !== openedKey(item))].slice(0, MAX_OPENED),
})

/** Only the signed-in session's history is kept, so a previous account's searches don't linger on a shared device. */
export function removeOtherScopes(scope: string) {
  try {
    const stale: string[] = []
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index)
      if (key?.startsWith(STORAGE_PREFIX) && key !== storageKey(scope)) stale.push(key)
    }
    stale.forEach(key => localStorage.removeItem(key))
  } catch { /* storage blocked: nothing to clean */ }
}

const cache = new Map<string, SearchHistory>()
const listeners = new Set<() => void>()

/** Snapshot for useSyncExternalStore; stable until the next update of that scope. */
export function getHistory(scope: string): SearchHistory {
  let history = cache.get(scope)
  if (!history) {
    history = readHistory(scope)
    cache.set(scope, history)
  }
  return history
}

export function updateHistory(scope: string, change: (history: SearchHistory) => SearchHistory) {
  if (!scope) return
  const next = change(getHistory(scope))
  if (next === getHistory(scope)) return
  cache.set(scope, next)
  writeHistory(scope, next)
  listeners.forEach(listener => listener())
}

export function subscribeHistory(listener: () => void) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}
