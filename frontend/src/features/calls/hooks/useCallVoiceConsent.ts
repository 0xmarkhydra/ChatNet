import { useEffect, useRef, type Dispatch, type SetStateAction } from 'react'
import { type Room } from 'livekit-client'
import type { CallRequest } from '../lib/calls'

type CallVoiceConsentArgs = {
  room?: Room
  callId: string
  request: CallRequest
  setAllowMyVoice: Dispatch<SetStateAction<boolean>>
  setConsentError: Dispatch<SetStateAction<string>>
  setConsentBusy: Dispatch<SetStateAction<boolean>>
  setConsentRequested: Dispatch<SetStateAction<boolean>>
  setMicOn: Dispatch<SetStateAction<boolean>>
}

export function useCallVoiceConsent({ room, callId, request, setAllowMyVoice, setConsentError, setConsentBusy, setConsentRequested, setMicOn }: CallVoiceConsentArgs) {
  const consentUpdating = useRef(false)
  const consentRevision = useRef(0)

  useEffect(() => {
    if (!room) return
    let cancelled = false
    const revisionAtLoad = consentRevision.current
    request(`/api/calls/${encodeURIComponent(callId)}/translation-consent`).then(async (response) => {
      if (!response.ok) throw new Error('Không thể đọc quyền dịch giọng nói.')
      const data = await response.json() as { allowed: boolean }
      if (!cancelled && !consentUpdating.current && revisionAtLoad === consentRevision.current) setAllowMyVoice(data.allowed === true)
    }).catch(() => { if (!cancelled) setConsentError('Không thể kiểm tra quyền dịch giọng nói. Hãy thử lại hoặc tắt micro.') })
    return () => { cancelled = true }
  }, [room, callId, request, setAllowMyVoice, setConsentError])

  async function updateVoiceConsent(allowed: boolean) {
    if (!room || consentUpdating.current) return
    consentUpdating.current = true
    consentRevision.current += 1
    setConsentBusy(true)
    setConsentError('')
    // Withdraw in the local UI immediately, before the backend responds.
    if (!allowed) setAllowMyVoice(false)
    try {
      const response = await request(`/api/calls/${encodeURIComponent(callId)}/translation-consent`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ allowed }),
      })
      if (!response.ok) throw new Error('Không thể cập nhật quyền dịch giọng nói.')
      setAllowMyVoice(allowed)
      setConsentRequested(false)
    } catch {
      if (!allowed) {
        // Revocation could not be confirmed by the backend. Stop sending new voice.
        await room.localParticipant.setMicrophoneEnabled(false).then(() => setMicOn(false)).catch(() => undefined)
        setConsentError('Không xác nhận được thu hồi quyền AI. Micro đã được yêu cầu tắt; hãy kiểm tra hoặc rời cuộc gọi.')
      } else {
        setConsentError('Không cấp được quyền xử lý giọng nói. AI sẽ không nhận âm thanh của bạn.')
      }
    } finally {
      consentUpdating.current = false
      setConsentBusy(false)
    }
  }

  return { updateVoiceConsent }
}