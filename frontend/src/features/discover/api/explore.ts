import type { ApiRequest } from '../../../shared/types/api'

export type PublicCommunity = {
  id: number
  name: string
  description: string
  topic: string
  visibility: 'public' | 'private'
  memberCount: number
}

export function listExploreCommunities(request: ApiRequest, signal: AbortSignal) {
  return request('/api/groups/public?limit=30&q=', { signal })
}

export function joinExploreCommunity(request: ApiRequest, id: number) {
  return request('/api/groups/' + id + '/join', { method: 'POST' })
}
