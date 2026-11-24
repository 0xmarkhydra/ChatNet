import type { ApiRequest } from '../../../shared/types/api'

export type SearchSort = 'relevance' | 'newest'
export type SearchPage<T> = { items: T[]; nextCursor: string | null }
export type SearchRequest = {
  query: string
  limit: number
  sort: SearchSort
  since?: string
  cursor?: string
  signal: AbortSignal
}

export async function search<T>(request: ApiRequest, endpoint: string, input: SearchRequest): Promise<SearchPage<T>> {
  const params = new URLSearchParams({ q: input.query, limit: String(input.limit), sort: input.sort })
  if (input.since) params.set('since', input.since)
  if (input.cursor) params.set('cursor', input.cursor)
  const response = await request(`${endpoint}?${params}`, { signal: input.signal, cache: 'no-store' })
  if (!response.ok) throw new Error('Không thể tải kết quả tìm kiếm.')
  const data: unknown = await response.json()
  if (typeof data !== 'object' || data === null || !('items' in data) || !Array.isArray(data.items) ||
    !('nextCursor' in data) || (data.nextCursor !== null && typeof data.nextCursor !== 'string')) {
    throw new Error('Dữ liệu tìm kiếm không hợp lệ.')
  }
  return data as SearchPage<T>
}

export type PersonResult = { id: number; username: string; displayName: string; online: boolean }
export type CommunityResult = {
  id: number
  name: string
  description: string
  topic: string
  visibility: 'public' | 'private'
  memberCount: number
}
export type ProductResult = {
  id: number
  sellerId: number
  title: string
  description: string
  priceAmount: number
  priceUnit: string
  stock: number
}

async function readJson<T>(response: Response, message: string): Promise<T> {
  if (!response.ok) throw new Error(message)
  return await response.json() as T
}

export async function searchPeople(request: ApiRequest, query: string, signal: AbortSignal) {
  const response = await request('/api/users/search?q=' + encodeURIComponent(query), { signal, cache: 'no-store' })
  return readJson<PersonResult[]>(response, 'Không thể tìm người dùng.')
}

export async function searchCommunities(request: ApiRequest, query: string, signal: AbortSignal) {
  const response = await request('/api/groups/public?limit=20&q=' + encodeURIComponent(query.slice(0, 100)), { signal, cache: 'no-store' })
  return readJson<CommunityResult[]>(response, 'Không thể tìm cộng đồng.')
}

/** The marketplace API has no text search yet; the latest published page is matched on the client. */
export async function listRecentProducts(request: ApiRequest, signal: AbortSignal) {
  const response = await request('/api/marketplace/products?limit=50', { signal, cache: 'no-store' })
  return (await readJson<{ products: ProductResult[] }>(response, 'Không thể tải sản phẩm.')).products
}

export type SuggestedPerson = { id: number; username: string; displayName: string; reason: string }

export async function listSuggestedPeople(request: ApiRequest, signal: AbortSignal) {
  const response = await request('/api/users/suggestions', { signal, cache: 'no-store' })
  const data = await readJson<unknown>(response, 'Không thể tải gợi ý kết nối.')
  if (!Array.isArray(data)) throw new Error('Dữ liệu gợi ý không hợp lệ.')
  return data.filter((user): user is SuggestedPerson => Boolean(user) && Number.isSafeInteger(user.id) && typeof user.username === 'string')
}

export async function listPopularCommunities(request: ApiRequest, signal: AbortSignal) {
  const response = await request('/api/groups/public?limit=5&q=', { signal, cache: 'no-store' })
  return readJson<CommunityResult[]>(response, 'Không thể tải cộng đồng.')
}

export function joinCommunity(request: ApiRequest, id: number) {
  return request('/api/groups/' + id + '/join', { method: 'POST' })
}
