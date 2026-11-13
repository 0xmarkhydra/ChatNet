import { useState } from 'react'
import type { AppDataContext } from '../../../shared/types/api'
import type { Story } from '../types'

export function useFeedStories({ session, sessionRef, apiFetch, setStatus }: AppDataContext) {
  const [stories, setStories] = useState<Story[]>([])

  async function refreshStories() {
    const sessionId = session?.sessionId
    if (!sessionId) return
    try {
      const response = await apiFetch('/api/stories')
      if (!response.ok) return
      const data = (await response.json()) as Story[]
      if (sessionRef.current?.sessionId === sessionId) {
        setStories(data.filter(item => Date.parse(item.expiresAt) > Date.now()))
      }
    } catch {
      if (sessionRef.current?.sessionId === sessionId) setStatus('Đang kết nối lại...')
    }
  }

  return { stories, setStories, refreshStories }
}
