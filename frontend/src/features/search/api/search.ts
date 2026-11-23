import type { ApiRequest } from '../../../shared/types/api'

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

export function joinCommunity(request: ApiRequest, id: number) {
  return request('/api/groups/' + id + '/join', { method: 'POST' })
}
