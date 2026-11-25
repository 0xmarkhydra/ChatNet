import type { Message } from '../types'
import type { MessageCopyTarget } from '../utils/messageCopyTarget'

export type MessageActionsProps = {
  mode?: 'reactions' | 'actions'
  activeMessageAction: Message
  onForwardMessage: (message: Message) => void
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
