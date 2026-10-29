import type { MediaAttachment } from '../../shared/lib/media'

export type MessageReaction = {
  emoji: string
  count: number
  mine: boolean
}

export type Message = {
  id: number
  clientId?: string
  conversationId: number
  senderId: number
  sender: string
  senderDisplayName?: string
  text: string
  replyToMessageId?: number
  replyToSender?: string
  replyToDisplayName?: string
  replyToText?: string
  editedAt?: string
  deleted?: boolean
  reactions?: MessageReaction[]
  readByUserIds?: number[]
  translatedText?: string
  translationLanguage?: string
  attachments?: MediaAttachment[]
  createdAt: string
}

export type MessageDraft = { text: string; attachments: MediaAttachment[] }
export const emptyDraft: MessageDraft = { text: '', attachments: [] }
export const CHAT_LIST_PAGE_SIZE = 25
export const MESSAGE_PAGE_SIZE = 40

export type Conversation = {
  id: number
  type: 'direct' | 'group'
  name: string
  otherUserId?: number
  otherUsername?: string
  memberCount: number
  unreadCount: number
  lastMessage: string
  lastMessageAt?: string
  online: boolean
  createdAt: string
}

export type RealtimeEvent = {
  type: 'message' | 'message.updated' | 'conversation.created' | 'conversation.updated' | 'conversation.removed' | 'conversation.read' | 'friend.updated'
  conversationId: number
  message?: Message
  conversation?: Conversation
  readerId?: number
  lastReadMessageId?: number
}

export type GroupMember = {
  id: number
  username: string
  displayName: string
  role: 'owner' | 'admin' | 'member'
  online: boolean
}

export type NewChatMode = 'none' | 'friends' | 'direct' | 'group'