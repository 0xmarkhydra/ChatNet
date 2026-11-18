import type { ApiRequest } from '../../../shared/types/api'
import { getConversationEncryptionStatus, sendMessage } from '../api/messages'
import type { Conversation } from '../types'

export class SharedPostDeliveryError extends Error {
  constructor(message: string, readonly openChat = false) {
    super(message)
  }
}

export async function sendSharedPostLink({
  destination, url, userId, clientId, request, isCurrent,
}: {
  destination: Conversation
  url: string
  userId: number
  clientId: string
  request: ApiRequest
  isCurrent: () => boolean
}): Promise<void> {
  const checkSession = () => {
    if (!isCurrent()) throw new Error('Phiên đăng nhập đã thay đổi.')
  }
  const guardedRequest: ApiRequest = async (path, options) => {
    checkSession()
    const response = await request(path, options)
    checkSession()
    return response
  }
  if (destination.blockedByMe || destination.blockedByOther) {
    throw new SharedPostDeliveryError('Không thể gửi vào cuộc trò chuyện này.')
  }
  let mode: Awaited<ReturnType<typeof getConversationEncryptionStatus>>
  try {
    mode = await getConversationEncryptionStatus(guardedRequest, destination.id)
  } catch {
    throw new SharedPostDeliveryError('Không xác minh được chế độ mã hóa. Liên kết chưa được gửi.')
  }
  checkSession()
  if (mode === 'pending') {
    throw new SharedPostDeliveryError('Hội thoại chưa sẵn sàng mã hóa. Mở hội thoại để hoàn tất thiết lập trước khi gửi.', true)
  }
  if (mode === 'e2ee') {
    if (destination.type !== 'direct' || !destination.otherUserId) {
      throw new SharedPostDeliveryError('Hãy mở hội thoại này để gửi liên kết qua ô nhập mã hóa.', true)
    }
    try {
      const { MLSPilotService } = await import('./mlsPilotService')
      checkSession()
      await new MLSPilotService(guardedRequest, userId, destination.otherUserId, destination.id).send(url)
    } catch {
      // MLS owns its encrypted pending event and retries. Do not create a second event here.
      throw new SharedPostDeliveryError('Không xác nhận được việc gửi mã hóa. Mở hội thoại để kiểm tra trạng thái trước khi gửi lại.', true)
    }
    return
  }
  const response = await sendMessage(guardedRequest, {
    conversationId: destination.id, text: url, attachments: [], clientId,
  })
  if (!response.ok) {
    throw new SharedPostDeliveryError(response.status === 403 || response.status === 404
      ? 'Bạn không còn quyền gửi vào cuộc trò chuyện này.'
      : 'Không gửi được liên kết. Vui lòng thử lại.')
  }
}
