import { type Participant, type RemoteTrack } from 'livekit-client'
import type { CallCaption } from './callCaptions'

export function deriveCallRoomDisplay(
  participants: Participant[],
  localParticipant: Participant | undefined,
  captions: CallCaption[],
  remoteConsent: Record<string, boolean>,
  phase: string,
) {
  const remoteTracks = participants.flatMap((participant) =>
    participant === localParticipant ? [] : Array.from(participant.audioTrackPublications.values())
      .filter((publication) => publication.track && !publication.isMuted)
      .map((publication) => ({
        speakerId: participant.identity,
        track: (publication.track as RemoteTrack).mediaStreamTrack,
        trackSid: publication.trackSid,
      })),
  )
  const remoteTrackKey = remoteTracks.map((entry) => entry.speakerId + ':' + entry.trackSid).join('|')
  const remoteConsentKey = JSON.stringify(remoteConsent)
  const latestCaption = [...captions].reverse().find((item) => item.translated.trim())
  const waitingConsentCount = Math.max(0, participants.length - 1 - Object.values(remoteConsent).filter(Boolean).length)
  const statusLabel = phase === 'connected' ? 'Bảo mật' : phase === 'reconnecting' ? 'Đang nối lại' : phase === 'error' ? 'Đã ngắt' : 'Đang kết nối'

  return { remoteTrackKey, remoteConsentKey, latestCaption, waitingConsentCount, statusLabel }
}
