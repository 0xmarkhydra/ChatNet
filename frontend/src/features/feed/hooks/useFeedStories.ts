import { useRef } from 'react'
import { useScopedState } from '../../../shared/hooks/useScopedState'
import type { AppDataContext } from '../../../shared/types/api'
import type { Story } from '../types'
import { listStories } from '../api/stories'
import { useAvatarStoryStatuses } from './useAvatarStoryStatuses'

export function useFeedStories({ session, sessionRef, apiFetch, setStatus }: AppDataContext) {
  // Reset before paint on session changes, including A → B → A. Old async setters
  // are tied to the previous visit and cannot repopulate the next account.
  const [stories, setStories] = useScopedState<Story[]>(session?.sessionId ?? null, [])
  const refreshSequence = useRef(0)
  useAvatarStoryStatuses(session?.sessionId ?? '', stories)

  async function refreshStories() {
    const request = ++refreshSequence.current
    const sessionId = session?.sessionId
    if (!sessionId) return
    try {
      const response = await listStories(apiFetch)
      if (!response.ok) return
      const data = (await response.json()) as Story[]
      if (sessionRef.current?.sessionId === sessionId && refreshSequence.current === request) {
        setStories(data.filter(item => Date.parse(item.expiresAt) > Date.now()))
      }
    } catch {
      if (sessionRef.current?.sessionId === sessionId && refreshSequence.current === request) setStatus('Đang kết nối lại...')
    }
  }

  return { stories, setStories, refreshStories }
}