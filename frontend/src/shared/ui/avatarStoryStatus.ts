import { useContext, useSyncExternalStore } from 'react'
import { SessionContext } from '../context/SessionContext'

export type AvatarStoryStatus = 'none' | 'seen' | 'unseen'
type StatusMap = ReadonlyMap<string, AvatarStoryStatus>

const statuses = new Map<string, StatusMap>()
const listeners = new Set<() => void>()

function notify() {
  listeners.forEach(listener => listener())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

// A derived presentation snapshot, scoped to the signed-in session.
// The feed remains the owner of Story data and seen state.
export function publishAvatarStoryStatuses(scope: string, next: StatusMap) {
  statuses.set(scope, next)
  notify()
  return () => {
    if (statuses.get(scope) !== next) return
    statuses.delete(scope)
    notify()
  }
}

export function useAvatarStoryStatus(username: string): AvatarStoryStatus {
  const scope = useContext(SessionContext)?.session.sessionId
  return useSyncExternalStore(
    subscribe,
    () => scope ? statuses.get(scope)?.get(username) ?? 'none' : 'none',
    () => 'none',
  )
}
