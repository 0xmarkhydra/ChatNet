import { useUiTranslation } from '@/shared/i18n/locale'
import { Copy, Forward, Languages, Pin, Reply } from 'lucide-react'
import type { MessageActionsProps } from '../types/messageActions'

export default function MessageActionList({
 activeMessageAction, onForwardMessage, userId, isPinned, toggleMessagePin,
 setMessageActionId, setReplyingTo, copyTarget, copyMessageContent,
 translateMessage, editOwnMessage, recallOwnMessage,
}: MessageActionsProps) {
  const trUi = useUiTranslation()

 const mine = activeMessageAction.senderId === userId
 return <>
        <div className="message-context-actions">
          <button
            type="button"
            onClick={() => {
              setReplyingTo(activeMessageAction)
              setMessageActionId(null)
            }}
          >
            <span aria-hidden="true"><Reply size={21} strokeWidth={2} /></span>
            <b>{trUi("chat.reply")}</b>
          </button>

          {!activeMessageAction.deleted && (
            <button type="button" onClick={() => {
              setMessageActionId(null)
              onForwardMessage(activeMessageAction)
            }}>
              <span aria-hidden="true"><Forward size={20} strokeWidth={2} /></span>
              <b>{trUi("chat.forward")}</b>
            </button>
          )}

          {copyTarget && (
            <button type="button" onClick={() => void copyMessageContent(activeMessageAction, copyTarget)}>
              <span aria-hidden="true"><Copy size={20} strokeWidth={2} /></span>
              <b>{trUi("common.copy")}</b>
            </button>
          )}

          {!activeMessageAction.deleted && (
            <button type="button" onClick={() => {
                setMessageActionId(null)
                void toggleMessagePin(activeMessageAction)
              }}>
              <span aria-hidden="true"><Pin size={20} strokeWidth={2} /></span>
              <b>{isPinned ? trUi("chat.unpinMessage") : 'Ghim tin nhắn'}</b>
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
              <b>{trUi("chat.translate")}</b>
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
              <b>{trUi("common.edit")}</b>
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
              <b>{trUi("chat.recall")}</b>
            </button>
          )}
        </div>

 </>
}