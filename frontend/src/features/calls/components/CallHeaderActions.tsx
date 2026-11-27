import { useUiTranslation } from '@/shared/i18n/locale'
import { Phone, Video } from 'lucide-react'
import type { CallMediaType } from '../lib/calls'

export type CallLaunchDetail = { conversationId: number; mediaType: CallMediaType }

export function startConversationCall(conversationId: number, mediaType: CallMediaType) {
  window.dispatchEvent(new CustomEvent<CallLaunchDetail>('chatnet:start-call', {
    detail: { conversationId, mediaType },
  }))
}

export default function CallHeaderActions({ conversationId, disabled = false }: { conversationId: number; disabled?: boolean }) {
  const trUi = useUiTranslation()

  return (
    <div className="call-header-actions" role="group" aria-label={trUi("calls.phone")}>
      <button type="button" aria-label={trUi("calls.voiceCall")} title={disabled ? trUi("calls.blocked") : trUi("calls.voiceCall")} disabled={disabled} onClick={() => startConversationCall(conversationId, 'audio')}>
        <Phone size={19} />
      </button>
      <button type="button" aria-label={trUi("calls.videoCall")} title={disabled ? trUi("calls.blocked") : trUi("calls.videoCall")} disabled={disabled} onClick={() => startConversationCall(conversationId, 'video')}>
        <Video size={20} />
      </button>
    </div>
  )
}