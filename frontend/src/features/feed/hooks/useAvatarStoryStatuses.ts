import { useEffect } from 'react'
import { publishAvatarStoryStatuses, type AvatarStoryStatus } from '../../../shared/ui/avatarStoryStatus'
import type { Story } from '../types'
import { useSeenStories } from '../utils/storySeen'

export function avatarStoryStatuses(stories: Story[], seen: ReadonlySet<number>, now: number) {
  const statuses = new Map<string, AvatarStoryStatus>()
  let nextExpiry = Infinity
  for (const story of stories) {
    const expiry = Date.parse(story.expiresAt)
    if (!Number.isFinite(expiry) || expiry <= now) continue
    nextExpiry = Math.min(nextExpiry, expiry)
    if (statuses.get(story.author) !== 'unseen') {
      statuses.set(story.author, seen.has(story.id) ? 'seen' : 'unseen')
    }
  }
  return { statuses, nextExpiry }
}

/** Publish a view-only index of the existing feed data; never fetch per avatar. */
export function useAvatarStoryStatuses(scope: string, stories: Story[]) {
  const seen = useSeenStories(scope)
  useEffect(() => {
    if (!scope) return
    let timer: ReturnType<typeof setTimeout> | undefined
    let release: (() => void) | undefined
    function update() {
      const now = Date.now()
      const { statuses, nextExpiry } = avatarStoryStatuses(stories, seen, now)
      const previous = release
      release = publishAvatarStoryStatuses(scope, statuses)
      previous?.()
      if (Number.isFinite(nextExpiry)) timer = setTimeout(update, Math.min(2_147_483_647, Math.max(1, nextExpiry - now)))
    }
    update()
    return () => {
      clearTimeout(timer)
      release?.()
    }
  }, [scope, stories, seen])
}
