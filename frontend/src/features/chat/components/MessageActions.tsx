import { userLabel } from '../../../shared/utils/userLabel'
import { attachmentLabel, formatTime } from '../../../shared/utils/format'
import type { MessageActionsProps } from '../types/messageActions'
import MessageReactionChooser from './MessageReactionChooser'
import MessageActionList from './MessageActionList'

export default function MessageActions(props: MessageActionsProps) {
 const { mode = 'actions', activeMessageAction, userId, setMessageActionId } = props
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

        {mode === 'reactions' && (
          <MessageReactionChooser key={activeMessageAction.id} activeMessageAction={activeMessageAction}
            toggleReaction={props.toggleReaction} setMessageActionId={setMessageActionId} />
        )}
        {mode === 'actions' && <MessageActionList {...props} />}
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