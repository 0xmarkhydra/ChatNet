import type { Post } from '../types'

export function appendUniquePosts(current: Post[], incoming: Post[]): Post[] {
  const ids = new Set(current.map(post => post.id))
  return [...current, ...incoming.filter(post => !ids.has(post.id))]
}

type FeedRequestState = {
  sessionId: string | undefined
  revision: number
  sequence: number
}

export function isCurrentFeedRefresh(request: FeedRequestState, current: FeedRequestState): boolean {
  return request.sessionId === current.sessionId &&
    request.revision === current.revision &&
    request.sequence === current.sequence
}

/** A quick repost occupies the same feed slot as its original. Quotes are distinct posts. */
export function collapseQuickReposts(items: Post[]): Post[] {
  const seen = new Set<number>()
  return items.filter(item => {
    const key = item.repostKind === 'quick' ? item.originalPost?.id ?? item.id : item.id
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
