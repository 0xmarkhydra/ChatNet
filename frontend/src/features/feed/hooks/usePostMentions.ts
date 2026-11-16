import { useEffect, useMemo, useRef } from 'react'
import { useLatest } from '../../../shared/hooks/useLatest'
import { useScopedState } from '../../../shared/hooks/useScopedState'
import type { ApiRequest } from '../../../shared/types/api'
import type { PostMentionNotification } from '../utils/postMentionNotifications'

type Options = {
  sessionId: string | null
  notificationsTab: boolean
  apiFetch: ApiRequest
  onReadError: (message: string) => void
}

/** Owns account-scoped mention polling and read acknowledgement. */
export function usePostMentions({ sessionId, notificationsTab, apiFetch, onReadError }: Options) {
  const [mentions, setMentions] = useScopedState<PostMentionNotification[]>(sessionId, [])
  const requestRef = useLatest(apiFetch)
  const errorRef = useLatest(onReadError)
  const visit = useMemo(() => ({ sessionId }), [sessionId])
  const visitRef = useLatest(visit)
  const mounted = useRef(false)
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])
  const isCurrentVisit = () => mounted.current && visitRef.current === visit && Boolean(visit.sessionId)

  useEffect(() => {
    if (!sessionId) return
    let active = true
    let refreshing = false
    const controller = new AbortController()
    const refresh = async () => {
      if (!active || refreshing) return
      refreshing = true
      try {
        const response = await requestRef.current('/api/feed/mentions', {
          signal: controller.signal, cache: 'no-store',
        })
        if (!response.ok) return
        const items: unknown = await response.json()
        if (!active || !Array.isArray(items)) return
        setMentions(items.filter((item): item is PostMentionNotification =>
          item && Number.isSafeInteger(item.id) && Number.isSafeInteger(item.postId)
          && typeof item.author === 'string' && typeof item.createdAt === 'string'))
      } catch {
        // Network failures should not erase a previously received mention list.
      } finally {
        refreshing = false
      }
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh()
    }
    void refresh()
    const timer = window.setInterval(() => void refresh(), notificationsTab ? 12_000 : 30_000)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      active = false
      controller.abort()
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [sessionId, notificationsTab, setMentions, requestRef])

  async function readPostMention(id: number) {
    if (!isCurrentVisit()) return
    const mention = mentions.find(item => item.id === id)
    if (!mention || mention.readAt) return
    try {
      const response = await apiFetch(`/api/feed/mentions/${id}/read`, { method: 'POST' })
      if (!response.ok) throw new Error('Không đánh dấu được thông báo.')
      if (!isCurrentVisit()) return
      setMentions(current => current.map(item => item.id === id
        ? { ...item, readAt: new Date().toISOString() } : item))
    } catch {
      if (isCurrentVisit())
        errorRef.current('Không đánh dấu được thông báo. Vui lòng thử lại.')
    }
  }

  return { mentions, readPostMention, isCurrentVisit }
}
