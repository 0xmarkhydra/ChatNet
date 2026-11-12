import { getHistoryBatch, getSharedContent } from './api/shared'

// Prefer the indexed shared-content API. Older deployments can return no
// results for messages whose channel_id is NULL; recover from chat history.
export type SharedKind = 'media' | 'files' | 'links'

export type SharedAttachment = {
  id?: number
  storageRef: string
  name: string
  sizeBytes: number
  contentType: string
  kind: 'image' | 'video' | 'audio' | 'file'
  url?: string
}
export type SharedMessage = {
  id: number
  sender: string
  senderDisplayName?: string
  text: string
  createdAt: string
  deleted?: boolean
  attachments?: SharedAttachment[]
}
export type SharedPage = { items: SharedMessage[]; nextBefore?: number }
type RequestFn = (path: string, init?: RequestInit) => Promise<Response>

export function hasSharedContent(message: SharedMessage, kind: SharedKind): boolean {
  if (message.deleted) return false
  if (kind === 'links') return /https?:\/\/[^\s<>"']+/i.test(message.text || '')
  const kinds = kind === 'media' ? ['image', 'video'] : ['file', 'audio']
  return (message.attachments || []).some(attachment => kinds.includes(attachment.kind))
}

function cancelled(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException('Đã hủy yêu cầu', 'AbortError')
}

const HISTORY_BATCH = 200
const MAX_HISTORY_BATCHES = 12

export async function loadSharedContent({
  conversationId, channelId, kind, limit, before, request, signal,
}: {
  conversationId: number
  channelId: number
  kind: SharedKind
  limit: number
  before?: number
  request: RequestFn
  signal?: AbortSignal
}): Promise<SharedPage> {
  let originalError = ''
  try {
    const response = await getSharedContent(request, { conversationId, channelId, kind, limit, before }, signal)
    cancelled(signal)
    if (response.status === 401 || response.status === 403) {
      throw new Error('Bạn không có quyền xem nội dung được chia sẻ trong cuộc trò chuyện này.')
    }
    if (response.ok) {
      const data = await response.json() as SharedPage
      if (Array.isArray(data?.items) && data.items.length > 0) return data
      if (!Array.isArray(data?.items)) originalError = 'Dữ liệu nội dung chia sẻ không hợp lệ'
    } else {
      originalError = 'Không tải được nội dung chia sẻ (HTTP ' + response.status + ')'
    }
  } catch (error) {
    cancelled(signal)
    if (error instanceof Error && error.message.includes('không có quyền')) throw error
    originalError = error instanceof Error ? error.message : 'Không tải được nội dung chia sẻ'
  }

  // /messages already produces fresh, access-checked attachment links.
  const collected: SharedMessage[] = []
  let cursor = before
  let nextBefore: number | undefined
  try {
    for (let pageIndex = 0; pageIndex < MAX_HISTORY_BATCHES; pageIndex += 1) {
      cancelled(signal)
      const response = await getHistoryBatch(request, { conversationId, channelId, limit: HISTORY_BATCH, cursor }, signal)
      cancelled(signal)
      if (!response.ok) throw new Error('Không thể đọc lịch sử tin nhắn (HTTP ' + response.status + ')')
      const messages = await response.json() as SharedMessage[]
      if (!Array.isArray(messages)) throw new Error('Dữ liệu lịch sử tin nhắn không hợp lệ')
      if (!messages.length) break
      const sorted = [...messages].sort((a, b) => b.id - a.id)
      const oldestId = sorted[sorted.length - 1]?.id
      if (!Number.isSafeInteger(oldestId) || (cursor && oldestId >= cursor)) {
        throw new Error('Dữ liệu phân trang tin nhắn không hợp lệ')
      }
      for (const message of sorted) {
        if (hasSharedContent(message, kind)) collected.push(message)
        if (collected.length >= limit) {
          nextBefore = message.id
          return { items: collected.slice(0, limit), nextBefore }
        }
      }
      if (sorted.length < HISTORY_BATCH) return { items: collected }
      cursor = oldestId
      nextBefore = cursor
    }
    return { items: collected, nextBefore }
  } catch (error) {
    cancelled(signal)
    if (originalError) throw new Error(originalError + '. ' + (error instanceof Error ? error.message : 'Không thể tải lại từ lịch sử.'))
    throw error
  }
}
