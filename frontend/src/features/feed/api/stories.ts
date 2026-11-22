import type { ApiRequest } from '../../../shared/types/api'
import { attachmentRequestBody, type MediaAttachment } from '../../../shared/utils/media'
import type { TextStoryInput } from '../types'

export function listStories(request: ApiRequest) {
  return request('/api/stories?includeText=true')
}

export function submitStory(request: ApiRequest, input: TextStoryInput | { attachment: MediaAttachment }) {
  return request('/api/stories', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify('attachment' in input ? { attachment: attachmentRequestBody(input.attachment) } : input),
  })
}

export type StoryLiker = { id: number; username: string; displayName: string }
export type StoryLikesResult = { liked: boolean } | { likers: StoryLiker[]; next?: number }

export async function readStoryLikes(request: ApiRequest, storyId: number, signal: AbortSignal, after?: number) {
  const response = await request(`/api/stories/${storyId}/like${after ? `?after=${after}` : ''}`, { signal, cache: 'no-store' })
  if (!response.ok) throw new Error('Không thể tải lượt thả tim.')
  return await response.json() as StoryLikesResult
}

export async function changeStoryLike(request: ApiRequest, storyId: number, liked: boolean) {
  const response = await request(`/api/stories/${storyId}/like`, { method: liked ? 'PUT' : 'DELETE' })
  if (!response.ok) throw new Error('Không thể cập nhật lượt thả tim.')
}

export type StoryHighlight = import('../types').Story & { title: string }

export async function readStoryHighlights(request: ApiRequest, username: string, signal: AbortSignal) {
  const response = await request(`/api/stories/highlights?username=${encodeURIComponent(username)}`, { signal, cache: 'no-store' })
  if (!response.ok) throw new Error('Không tải được Tin nổi bật.')
  return await response.json() as StoryHighlight[]
}

export async function changeStoryHighlight(request: ApiRequest, storyId: number, title?: string) {
  const response = await request(`/api/stories/${storyId}/highlight`, title === undefined
    ? { method: 'DELETE' }
    : { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title }) })
  if (response.status === 409) throw new Error('Bộ sưu tập đã đầy. Hãy gỡ một tin trước khi thêm tin mới.')
  if (response.status === 404) throw new Error('Tin đã hết hạn, bị xóa hoặc không còn thuộc về bạn.')
  if (!response.ok) throw new Error('Không thể cập nhật Tin nổi bật.')
}
