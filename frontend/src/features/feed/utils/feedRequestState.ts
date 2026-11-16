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
