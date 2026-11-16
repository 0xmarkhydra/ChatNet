import { useEffect, type Dispatch, type RefObject, type SetStateAction } from 'react'
import { type Room, type RemoteTrack } from 'livekit-client'
import { startCallMediaInterpreter, type InterpreterSession, type InterpreterUpdate } from '../lib/callMediaInterpreter'
import { appendCallCaption, type CallCaption } from '../lib/callCaptions'
import type { CallRequest } from '../lib/calls'

type CallInterpreterSessionsArgs = {
  room?: Room
  phase: string
  translationOn: boolean
  callId: string
  callTargetLanguage: string
  apiBase: string
  request: CallRequest
  remoteTrackKey: string
  remoteConsentKey: string
  translationRetryEpoch: number
  interpreters: RefObject<Map<string, InterpreterSession>>
  interpreterPending: RefObject<Set<string>>
  setCaptions: Dispatch<SetStateAction<CallCaption[]>>
  setTranslationError: Dispatch<SetStateAction<string>>
  setTranslatingIds: Dispatch<SetStateAction<string[]>>
}

export function useCallInterpreterSessions({ room, phase, translationOn, callId, callTargetLanguage, apiBase, request, remoteTrackKey, remoteConsentKey, translationRetryEpoch, interpreters, interpreterPending, setCaptions, setTranslationError, setTranslatingIds }: CallInterpreterSessionsArgs) {
  useEffect(() => {
    let cancelled = false
    const stopAll = () => {
      for (const session of interpreters.current.values()) session.stop()
      interpreters.current.clear()
      interpreterPending.current.clear()
    }
    if (!translationOn || !room || phase !== 'connected') {
      stopAll()
      setTranslatingIds([])
      return
    }
    // Never send remote audio to AI while LiveKit signaling/media is reconnecting.
    // Translate each remote speaker separately so simultaneous speech is not mixed.
    const consent = JSON.parse(remoteConsentKey) as Record<string, boolean>
    const tracks = Array.from(room.remoteParticipants.values()).flatMap((participant) =>
      Array.from(participant.audioTrackPublications.values())
        .filter((publication) => publication.track && !publication.isMuted && consent[participant.identity])
        .map((publication) => ({ id: participant.identity, track: (publication.track as RemoteTrack).mediaStreamTrack })),
    ).slice(0, 5)
    void Promise.all(tracks.map(async ({ id, track }) => {
      if (interpreterPending.current.has(id) || interpreters.current.has(id)) return
      interpreterPending.current.add(id)
      try {
        const session = await startCallMediaInterpreter({
          speakerId: id, track, callId: callId, targetLanguage: callTargetLanguage, apiBase, request,
          onUpdate: (update: InterpreterUpdate) => {
            if (cancelled) return
            setCaptions((current) => appendCallCaption(current, update))
          },
          onError: (message) => { if (!cancelled) setTranslationError(message) },
          onReady: () => { if (!cancelled) setTranslatingIds((current) => Array.from(new Set([...current, id]))) },
        })
        if (cancelled) session.stop()
        else { interpreters.current.set(id, session) }
      } catch (error) {
        if (!cancelled) setTranslationError(error instanceof Error ? error.message : 'Không thể bật phiên dịch.')
      } finally {
        // Cleanup already transferred ownership to the next call effect.
        if (!cancelled) interpreterPending.current.delete(id)
      }
    }))
    return () => { cancelled = true; stopAll(); setTranslatingIds([]) }
  // Stable stream IDs and consent data are the only topology dependencies.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room, phase, translationOn, callId, callTargetLanguage, remoteTrackKey, remoteConsentKey, request, translationRetryEpoch, apiBase])

}
