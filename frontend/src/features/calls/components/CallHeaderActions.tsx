import { Phone, Video } from 'lucide-react'
import type { CallMediaType } from '../lib/calls'

export type CallLaunchDetail = { conversationId: number; mediaType: CallMediaType }

export function startConversationCall(conversationId: number, mediaType: CallMediaType) {
  window.dispatchEvent(new CustomEvent<CallLaunchDetail>('chatnet:start-call', {
    detail: { conversationId, mediaType },
  }))
}

export default function CallHeaderActions({ conversationId, disabled = false }: { conversationId: number; disabled?: boolean }) {
  return (
    <div className="call-header-actions" role="group" aria-label="Gọi điện">
      <button type="button" aria-label="Gọi thoại" title={disabled ? 'Không thể gọi khi hội thoại bị chặn' : 'Gọi thoại'} disabled={disabled} onClick={() => startConversationCall(conversationId, 'audio')}>
        <Phone size={19} />
      </button>
      <button type="button" aria-label="Gọi video" title={disabled ? 'Không thể gọi khi hội thoại bị chặn' : 'Gọi video'} disabled={disabled} onClick={() => startConversationCall(conversationId, 'video')}>
        <Video size={20} />
      </button>
    </div>
  )
}