import { Copy, Forward, Languages, Pin, Reply } from 'lucide-react'
import type { MessageActionsProps } from '../types/messageActions'
import ImageDownloadButton from '../../../shared/ui/ImageDownloadButton'

export default function MessageActionList({
 activeMessageAction, onForwardMessage, userId, isPinned, toggleMessagePin,
 setMessageActionId, setReplyingTo, copyTarget, copyMessageContent,
 translateMessage, editOwnMessage, recallOwnMessage,
}: MessageActionsProps) {
 const mine = activeMessageAction.senderId === userId
 const image = !activeMessageAction.deleted ? (copyTarget?.kind === 'image' && copyTarget.attachment.url
   ? copyTarget.attachment : activeMessageAction.attachments?.find(item => item.kind === 'image' && item.url)) : undefined
 return <>
        <div className="message-context-actions">
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

          {!activeMessageAction.deleted && (
            <button type="button" onClick={() => {
              setMessageActionId(null)
              onForwardMessage(activeMessageAction)
            }}>
              <span aria-hidden="true"><Forward size={20} strokeWidth={2} /></span>
              <b>Chuyển tiếp</b>
            </button>
          )}

          {copyTarget && (
            <button type="button" onClick={() => void copyMessageContent(activeMessageAction, copyTarget)}>
              <span aria-hidden="true"><Copy size={20} strokeWidth={2} /></span>
              <b>Sao chép</b>
            </button>
          )}

          {image && <ImageDownloadButton key={`${activeMessageAction.id}:${image.storageRef}`} image={image} menu onComplete={() => setMessageActionId(null)} />}

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
        </div>

 </>
}