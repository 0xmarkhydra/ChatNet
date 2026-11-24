import type { Conversation, Message } from '../types'
import type { MediaAttachment } from '../../../shared/utils/media'

export type MessageForwardPickerProps = {
  message: Message
  conversations: Conversation[]
  request: (path: string, init?: RequestInit) => Promise<Response>
  uploadFiles: (files: File[], scope: 'chat' | 'feed' | 'story' | 'profile') => Promise<MediaAttachment[]>
  onClose: () => void
  onFeedback: (message: string, kind?: 'success' | 'error' | 'warning' | 'info') => void
}
