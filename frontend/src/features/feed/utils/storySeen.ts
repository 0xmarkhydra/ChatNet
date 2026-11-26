import { useSyncExternalStore } from 'react'

const PREFIX = 'socco.story.seen.v1:'
const MAX_SEEN = 500
const listeners = new Set<() => void>()
const cache = new Map<string, ReadonlySet<number>>()
const empty: ReadonlySet<number> = new Set()

function read(scope: string): ReadonlySet<number> {
  try {
    const raw = localStorage.getItem(PREFIX + scope)
    const parsed: unknown = raw ? JSON.parse(raw) : []
    return new Set(Array.isArray(parsed) ? parsed.filter((id): id is number => Number.isSafeInteger(id)).slice(-MAX_SEEN) : [])
  } catch {
    return empty
  }
}

function snapshot(scope: string): ReadonlySet<number> {
  if (!scope) return empty
  let value = cache.get(scope)
  if (!value) {
    value = read(scope)
    cache.set(scope, value)
  }
  return value
}

/** Seen state is a per-session convenience kept in the browser; unreadable storage means "nothing seen". */
export function markStorySeen(scope: string, id: number) {
  if (!scope) return
  const current = snapshot(scope)
  if (current.has(id)) return
  const next = new Set([...current, id].slice(-MAX_SEEN))
  cache.set(scope, next)
  try { localStorage.setItem(PREFIX + scope, JSON.stringify([...next])) } catch { /* storage blocked: stays in memory */ }
  listeners.forEach(listener => listener())
}

export function useSeenStories(scope: string): ReadonlySet<number> {
  return useSyncExternalStore(
    listener => { listeners.add(listener); return () => { listeners.delete(listener) } },
    () => snapshot(scope),
    () => empty,
  )
}

export function resetStorySeenCache() {
  cache.clear()
}
