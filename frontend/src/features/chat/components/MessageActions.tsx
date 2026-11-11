import { userLabel } from '../../../shared/utils/userLabel'
import type { Message } from '../types'
import { messageReactions } from '../utils/messageReactions'
import { attachmentLabel, formatTime } from '../../../shared/utils/format'
import type { MessageCopyTarget } from '../utils/messageCopyTarget'
import { Copy, Languages, Pin, Reply } from 'lucide-react'

type Props = {
  mode?: 'reactions' | 'actions'
  activeMessageAction: Message
  userId: number
  isPinned: boolean
  toggleMessagePin: (message: Message) => Promise<void>
  setMessageActionId: (id: number | null) => void
  toggleReaction: (message: Message, emoji: string) => Promise<void>
  setReplyingTo: (message: Message) => void
  copyTarget: MessageCopyTarget | null
  copyMessageContent: (message: Message, target: MessageCopyTarget) => Promise<void>
  translateMessage: (message: Message) => Promise<void>
  editOwnMessage: (message: Message) => Promise<void>
  recallOwnMessage: (message: Message) => Promise<void>
}

export default function MessageActions({
  mode = 'actions',
  activeMessageAction,
  userId,
  isPinned,
  toggleMessagePin,
  setMessageActionId,
  toggleReaction,
  setReplyingTo,
  copyTarget,
  copyMessageContent,
  translateMessage,
  editOwnMessage,
  recallOwnMessage,
}: Props) {
  const mine = activeMessageAction.senderId === userId
  const preview = activeMessageAction.text.trim() || attachmentLabel(activeMessageAction.attachments)
  return (
    <div
      className={mode === 'reactions' ? 'message-context-backdrop reaction-only' : 'message-context-backdrop'}
      role="dialog"
      aria-modal="true"
      aria-label={mode === 'reactions' ? 'Chọn cảm xúc' : 'Tùy chọn tin nhắn'}
      onClick={(event) => {
        if (event.currentTarget === event.target) setMessageActionId(null)
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') setMessageActionId(null)
      }}
    >
      <section className={mode === 'reactions' ? 'message-context-sheet reaction-only' : 'message-context-sheet'}>
        {mode === 'actions' && <div className={mine ? 'message-context-preview mine' : 'message-context-preview'}>
          <small>{mine ? 'Bạn' : userLabel(activeMessageAction.senderDisplayName, activeMessageAction.sender)}</small>
          <div className="message-context-preview-bubble">{preview || 'Tin nhắn'}</div>
          <time>{formatTime(activeMessageAction.createdAt)}</time>
        </div>}

        {mode === 'reactions' && <div className="message-context-reactions" aria-label="Thả cảm xúc">
          {messageReactions.map(({ emoji, label }) => (
            <button
              key={emoji}
              type="button"
              className={(activeMessageAction.reactions || []).some((reaction) => reaction.emoji === emoji && reaction.mine) ? 'active' : ''}
              aria-pressed={(activeMessageAction.reactions || []).some((reaction) => reaction.emoji === emoji && reaction.mine)}
              aria-label={`${label} ${emoji}`}
              title={label}
              onClick={() => {
                setMessageActionId(null)
                void toggleReaction(activeMessageAction, emoji)
              }}
            >
              {emoji}
              <small>{label}</small>
            </button>
          ))}
        </div>}

        {mode === 'actions' && <div className="message-context-actions">
          {!activeMessageAction.deleted && (
            <button type="button" onClick={() => {
                setMessageActionId(null)
                void toggleMessagePin(activeMessageAction)
              }}>
              <span aria-hidden="true"><Pin size={20} strokeWidth={2} /></span>
              <b>{isPinned ? 'Bỏ ghim tin nhắn' : 'Ghim tin nhắn'}</b>
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setReplyingTo(activeMessageAction)
              setMessageActionId(null)
            }}
          >
            <span aria-hidden="true"><Reply size={21} strokeWidth={2} /></span>
            <b>Trả lời</b>
          </button>

          {copyTarget && (
            <button type="button" onClick={() => void copyMessageContent(activeMessageAction, copyTarget)}>
              <span aria-hidden="true"><Copy size={20} strokeWidth={2} /></span>
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
              <span aria-hidden="true"><Languages size={21} strokeWidth={2} /></span>
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
        </div>}

        {mode === 'actions' && <button
          type="button"
          className="message-context-cancel"
          onClick={() => setMessageActionId(null)}
        >
          Đóng
        </button>}
      </section>
    </div>
  )
}