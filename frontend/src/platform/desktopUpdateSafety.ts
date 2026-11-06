// Update installation must not interrupt a call or abandon an unconfirmed send.
// Treat inaccessible storage as unsafe. Drafts are persisted independently and
// survive app restarts, so only outstanding send state blocks installation.
let callInProgress = false
export function setDesktopCallInProgress(active: boolean): void { callInProgress = active }

export function hasPendingDesktopWork(store?: Pick<Storage, 'length' | 'key' | 'getItem'>): boolean {
  if (callInProgress) return true
  try {
    const target = store ?? window.localStorage
    for (let index = 0; index < target.length; index++) {
      const key = target.key(index)
      if (!key) continue
      if ((key.startsWith('chatnet:outbox:v2:') || key.startsWith('chatnet:pending-send:v1:')) &&
          target.getItem(key) != null) return true
    }
    return false
  } catch {
    return true
  }
}
