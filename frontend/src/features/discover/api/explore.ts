import type { MediaAttachment } from '../../../shared/utils/media'

export type ExplorePerson = { id: number; username: string; displayName: string; online: boolean; reason?: string }
export type ExplorePost = { id: number; author: string; authorDisplayName?: string; content: string; visibility: 'public'; distanceMeters: number; attachments?: MediaAttachment[] }
import type { ApiRequest } from '../../../shared/types/api'

export type PublicCommunity = {
  id: number
  name: string
  description: string
  topic: string
  visibility: 'public' | 'private'
  memberCount: number
}

export function exploreHttpError(response: Response, message: string) {
  const status = response.status
  const detail = status === 401 ? 'Phiên đăng nhập không còn hợp lệ.'
    : status === 403 ? 'Bạn không có quyền truy cập.'
    : status === 404 || status === 405 ? 'Máy chủ chưa hỗ trợ tính năng này.'
    : status === 429 ? 'Quá nhiều yêu cầu. Hãy thử lại sau.'
    : status >= 500 ? 'Dịch vụ đang gặp sự cố.'
    : status === 400 ? 'Máy chủ từ chối yêu cầu.'
    : 'Hãy thử lại.'
  return new Error(message + ' ' + detail + ' (' + status + ')')
}

export function listExploreCommunities(request: ApiRequest, signal: AbortSignal) {
  return request('/api/groups/public?limit=30&q=', { signal })
}

export function joinExploreCommunity(request: ApiRequest, id: number) {
  return request('/api/groups/' + id + '/join', { method: 'POST' })
}

export const EXPLORE_POST_PAGE_SIZE = 15

export async function listExplorePeople(request: ApiRequest, signal: AbortSignal): Promise<ExplorePerson[]> {
  const response = await request('/api/users/suggestions', { signal, cache: 'no-store' })
  if (!response.ok) throw exploreHttpError(response, 'Không tải được gợi ý kết nối.')
  const data: unknown = await response.json()
  if (!Array.isArray(data)) throw new Error('Dữ liệu người dùng không hợp lệ.')
  return data.filter(user => user && Number.isSafeInteger(user.id) && typeof user.username === 'string')
    .map(user => ({ ...user, displayName: typeof user.displayName === 'string' ? user.displayName : user.username, online: user.online === true }))
}

export type ExplorePostCursor = { distanceMeters: number; id: number }
export type ExplorePostLocation = { latitude: number; longitude: number }
export type ExplorePostPage = { posts: ExplorePost[]; nextCursor: ExplorePostCursor | null }

export async function listExplorePosts(request: ApiRequest, signal: AbortSignal, location: ExplorePostLocation, radiusKm: number, cursor: ExplorePostCursor | null): Promise<ExplorePostPage> {
  const response = await request('/api/posts/nearby', {
    method: 'POST', signal, cache: 'no-store',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...location, radiusKm, limit: EXPLORE_POST_PAGE_SIZE, ...(cursor ? { cursor } : {}) }),
  })
  if (!response.ok) throw exploreHttpError(response, 'Không tải được bài viết công khai.')
  const data = await response.json() as ExplorePostPage
  if (!data || !Array.isArray(data.posts) || (data.nextCursor !== null &&
    (!data.nextCursor || !Number.isSafeInteger(data.nextCursor.id) || data.nextCursor.id < 1 ||
      !Number.isSafeInteger(data.nextCursor.distanceMeters) || data.nextCursor.distanceMeters < 0 ||
      data.nextCursor.distanceMeters > radiusKm * 1000))) throw new Error('Dữ liệu bài viết gần đây không hợp lệ.')
  return { posts: data.posts.filter(post => post && Number.isSafeInteger(post.id) && post.id > 0 &&
    post.visibility === 'public' && typeof post.author === 'string' && typeof post.content === 'string' &&
    Number.isSafeInteger(post.distanceMeters) && post.distanceMeters >= 0 && post.distanceMeters <= radiusKm * 1000), nextCursor: data.nextCursor }
}
