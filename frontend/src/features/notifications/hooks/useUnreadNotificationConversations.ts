import { useEffect, useMemo } from 'react'
import { useLatest } from '../../../shared/hooks/useLatest'
import { useScopedState } from '../../../shared/hooks/useScopedState'
import type { ApiRequest } from '../../../shared/types/api'
import type { Conversation } from '../../chat'
import { hasUnreadConversation } from '../utils/notification-count'

/** Notifications use the server's unread projection, not the paged inbox. */
export function useUnreadNotificationConversations({ sessionId, request, conversations, active }: {
  sessionId: string | null; request: ApiRequest; conversations: Conversation[]; active: boolean
}) {
  const [snapshot, setSnapshot] = useScopedState<Conversation[] | null>(sessionId, null)
  const requestRef = useLatest(request)
  const fingerprint = useMemo(() => conversations.map(c => c.id + ':' + c.unreadCount + ':' + (c.lastMessageAt || '')).sort().join(','), [conversations])
  const revision = useLatest(fingerprint)
  useEffect(() => {
    if (!sessionId) return
    let alive = true, pending = false, queued = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const controller = new AbortController()
    async function refresh() {
      if (!alive) return
      if (pending) { queued = true; return }
      pending = true
      const before = revision.current
      try {
        const response = await requestRef.current('/api/conversations?unread=true', { cache: 'no-store', signal: controller.signal })
        if (!response.ok) return
        const data: unknown = await response.json()
        if (!alive || !Array.isArray(data) || !data.every(item => item && Number.isSafeInteger(item.id) && typeof item.unreadCount === 'number')) return
        if (before !== revision.current || queued) { queued = true; return }
        setSnapshot([...new Map<number, Conversation>(data.filter(hasUnreadConversation).map(item => [item.id, item])).values()])
      } catch {
        // Keep the last confirmed snapshot on transient network errors.
      } finally {
        pending = false
        if (alive && queued) { queued = false; schedule() }
      }
    }
    function schedule() {
      if (timer !== undefined) clearTimeout(timer)
      timer = setTimeout(() => { timer = undefined; void refresh() }, 120)
    }
    const visible = () => { if (document.visibilityState === 'visible') schedule() }
    void refresh()
    const interval = setInterval(schedule, active ? 12_000 : 30_000)
    for (const event of ['chatnet:notification-source-changed', 'chatnet:sse-reconnected']) window.addEventListener(event, schedule)
    document.addEventListener('visibilitychange', visible)
    return () => {
      alive = false
      controller.abort()
      clearTimeout(timer)
      clearInterval(interval)
      for (const event of ['chatnet:notification-source-changed', 'chatnet:sse-reconnected']) window.removeEventListener(event, schedule)
      document.removeEventListener('visibilitychange', visible)
    }
  }, [sessionId, active, requestRef, setSnapshot, revision, fingerprint])
  return snapshot ?? conversations.filter(hasUnreadConversation)
}
