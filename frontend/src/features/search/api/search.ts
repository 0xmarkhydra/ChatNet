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
