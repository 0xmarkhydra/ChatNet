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