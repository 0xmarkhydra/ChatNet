import { Phone, Video } from 'lucide-react'
import type { CallMediaType } from '../lib/calls'

export type CallLaunchDetail = { conversationId: number; mediaType: CallMediaType }

export default function CallHeaderActions({ conversationId, disabled = false }: { conversationId: number; disabled?: boolean }) {
  const start = (mediaType: CallMediaType) => {
    window.dispatchEvent(new CustomEvent<CallLaunchDetail>('chatnet:start-call', {
      detail: { conversationId, mediaType },
    }))
  }
  return (
    <div className="call-header-actions" aria-label="Gọi điện">
      <button type="button" aria-label="Gọi thoại" title={disabled ? 'Không thể gọi khi hội thoại bị chặn' : 'Gọi thoại'} disabled={disabled} onClick={() => start('audio')}>
        <Phone size={19} />
      </button>
      <button type="button" aria-label="Gọi video" title={disabled ? 'Không thể gọi khi hội thoại bị chặn' : 'Gọi video'} disabled={disabled} onClick={() => start('video')}>
        <Video size={20} />
      </button>
    </div>
  )
}
