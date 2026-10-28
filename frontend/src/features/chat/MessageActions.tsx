import type { Message } from './types'
import { attachmentLabel, formatTime } from '../../shared/lib/format'

type Props = {
  activeMessageAction: Message
  userId: number
  setMessageActionId: (id: number | null) => void
  toggleReaction: (message: Message, emoji: string) => Promise<void>
  setReplyingTo: (message: Message) => void
  copyMessage: (message: Message) => Promise<void>
  translateMessage: (message: Message) => Promise<void>
  editOwnMessage: (message: Message) => Promise<void>
  recallOwnMessage: (message: Message) => Promise<void>
}

export default function MessageActions({
  activeMessageAction,
  userId,
  setMessageActionId,
  toggleReaction,
  setReplyingTo,
  copyMessage,
  translateMessage,
  editOwnMessage,
  recallOwnMessage,
}: Props) {
  const mine = activeMessageAction.senderId === userId
  const preview = activeMessageAction.text.trim() || attachmentLabel(activeMessageAction.attachments)
  return (
    <div
      className="message-context-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Tùy chọn tin nhắn"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) setMessageActionId(null)
      }}
    >
      <section className="message-context-sheet">
        <div className={mine ? 'message-context-preview mine' : 'message-context-preview'}>
          <small>{mine ? 'Bạn' : `@${activeMessageAction.sender}`}</small>
          <div className="message-context-preview-bubble">{preview || 'Tin nhắn'}</div>
          <time>{formatTime(activeMessageAction.createdAt)}</time>
        </div>

        <div className="message-context-reactions" aria-label="Thả cảm xúc">
          {['❤️', '👍', '😂', '😮', '😢', '🙏'].map((emoji) => (
            <button
              key={emoji}
              type="button"
              className={(activeMessageAction.reactions || []).some((reaction) => reaction.emoji === emoji && reaction.mine) ? 'active' : ''}
              aria-label={`Thả cảm xúc ${emoji}`}
              onClick={() => {
                setMessageActionId(null)
                void toggleReaction(activeMessageAction, emoji)
              }}
            >
              {emoji}
            </button>
          ))}
        </div>

        <div className="message-context-actions">
          <button
            type="button"
            onClick={() => {
              setReplyingTo(activeMessageAction)
              setMessageActionId(null)
            }}
          >
            <span aria-hidden="true">↩</span>
            <b>Trả lời</b>
          </button>

          {Boolean(activeMessageAction.text.trim()) && (
            <button type="button" onClick={() => void copyMessage(activeMessageAction)}>
              <span aria-hidden="true">▣</span>
              <b>Sao chép</b>
            </button>
          )}

          {!mine && Boolean(activeMessageAction.text.trim()) && (
            <button
              type="button"
              onClick={() => {
                setMessageActionId(null)
                void translateMessage(activeMessageAction)
              }}
            >
              <span aria-hidden="true">文</span>
              <b>Dịch</b>
            </button>
          )}

          {mine && Boolean(activeMessageAction.text.trim()) && (
            <button
              type="button"
              onClick={() => {
                setMessageActionId(null)
                void editOwnMessage(activeMessageAction)
              }}
            >
              <span aria-hidden="true">✎</span>
              <b>Sửa</b>
            </button>
          )}

          {mine && (
            <button
              type="button"
              className="danger"
              onClick={() => {
                setMessageActionId(null)
                void recallOwnMessage(activeMessageAction)
              }}
            >
              <span aria-hidden="true">⌫</span>
              <b>Thu hồi</b>
            </button>
          )}
        </div>

        <button
          type="button"
          className="message-context-cancel"
          onClick={() => setMessageActionId(null)}
        >
          Đóng
        </button>
      </section>
    </div>
  )
}
