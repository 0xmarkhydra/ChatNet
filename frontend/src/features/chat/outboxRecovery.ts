import { clearPendingSend, loadPendingSend } from './chatPersistence'
import {
  enqueueChatMessage, loadChatOutbox, persistChatOutboxChange,
  type QueuedChatMessage,
} from '../../chatOutbox'

// Preserve an ambiguous legacy POST's original clientId during the migration.
export function restoreChatOutbox(userId: number, sessionId: string): QueuedChatMessage[] {
  const current = loadChatOutbox(userId, sessionId)
  const previous = loadPendingSend(userId, sessionId)
  if (!previous || current.some((message) => message.clientId === previous.clientId)) return current
  try {
    const payload = JSON.parse(previous.signature) as {
      text?: unknown; attachments?: unknown; replyToMessageId?: unknown
    }
    if (typeof payload.text !== 'string' || !payload.text.trim() ||
      !Array.isArray(payload.attachments) || payload.attachments.length !== 0) return current
    const reply = payload.replyToMessageId
    if (reply != null && (!Number.isSafeInteger(reply) || Number(reply) <= 0)) return current
    const next = enqueueChatMessage(current, {
      clientId: previous.clientId, conversationId: previous.conversationId,
      text: payload.text, attachments: [], createdAt: new Date().toISOString(),
      ...(reply ? { replyToMessageId: Number(reply) } : {}),
      status: 'unconfirmed',
    })
    if (next !== current && persistChatOutboxChange(userId, sessionId, current, next)) {
      clearPendingSend(userId, previous.clientId)
      return next
    }
  } catch { /* Legacy media items must never be silently converted into text-only sends. */ }
  return current
}
