import type { ApiRequest } from '../../../shared/types/api'
import type { Conversation, Message } from '../types'
import type { MediaAttachment } from '../../../shared/utils/media'
import { attachmentRequestBody } from '../../../shared/utils/media'
import { API } from '../../../shared/lib/config'
import { getConversationEncryptionStatus } from '../api/messages'

export async function forwardMessageLegacy({
  message, destination, request, uploadFiles, clientId, isCurrent,
}: {
  message: Message
  destination: Conversation
  request: ApiRequest
  uploadFiles: (files: File[], scope: 'chat' | 'feed' | 'story' | 'profile') => Promise<MediaAttachment[]>
  clientId: string
  isCurrent: () => boolean
}) {
  const checkCurrent = () => {
    if (!isCurrent()) throw new Error('Phiên đăng nhập đã thay đổi.')
  }
  const guardedRequest: ApiRequest = async (path, init) => {
    checkCurrent()
    const response = await request(path, init)
    checkCurrent()
    return response
  }
  if (message.deleted || destination.blockedByMe || destination.blockedByOther) {
    throw new Error('Không thể chuyển tiếp vào cuộc trò chuyện này.')
  }

  // Forwarding attachments through the plaintext endpoint must not bypass E2EE.
  let mode: Awaited<ReturnType<typeof getConversationEncryptionStatus>>
  try {
    mode = await getConversationEncryptionStatus(guardedRequest, destination.id)
  } catch {
    throw new Error('Không xác minh được chế độ mã hóa. Tin nhắn chưa được chuyển tiếp.')
  }
  checkCurrent()
  if (mode !== 'legacy') {
    throw new Error('Hãy mở hội thoại để chuyển tiếp an toàn qua ô nhập mã hóa.')
  }

  // Re-upload as the forwarding user: another sender's storageRef is not reusable.
  const files = await Promise.all((message.attachments || []).map(async item => {
    checkCurrent()
    if (!item.url) throw new Error('Không thể tải tệp đính kèm để chuyển tiếp.')
    const url = new URL(item.url, window.location.origin)
    const apiOrigin = new URL(API, window.location.origin)
    const response = url.origin === apiOrigin.origin && url.pathname.startsWith('/api/')
      ? await guardedRequest(url.pathname + url.search, { cache: 'no-store' })
      : await fetch(url.toString(), { cache: 'no-store' })
    checkCurrent()
    if (!response.ok) throw new Error('Không thể tải tệp đính kèm để chuyển tiếp.')
    const blob = await response.blob()
    checkCurrent()
    return new File([blob], item.name, { type: item.contentType })
  }))
  checkCurrent()
  const attachments = files.length ? await uploadFiles(files, 'chat') : []
  checkCurrent()
  if (attachments.length !== files.length) throw new Error('Không tải lên đủ tệp đính kèm.')
  const response = await guardedRequest(`/api/conversations/${destination.id}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      clientId, text: message.text, forwarded: true,
      attachments: attachments.map(attachmentRequestBody),
    }),
  })
  if (!response.ok) {
    const detail = await response.json().catch(() => null) as { error?: string } | null
    throw new Error(detail?.error || 'Không thể chuyển tiếp. Hãy kiểm tra quyền gửi ở cuộc trò chuyện đích.')
  }
}
