import { useEffect, type Dispatch, type SetStateAction } from 'react'
import { RoomEvent, type Participant, type Room } from 'livekit-client'

const CONSENT_TOPIC = 'chatnet.call.translation.consent.v1'

type CallRemoteConsentArgs = {
  room?: Room
  allowMyVoice: boolean
  translationOn: boolean
  setRemoteConsent: Dispatch<SetStateAction<Record<string, boolean>>>
  setConsentRequested: Dispatch<SetStateAction<boolean>>
}

export function useCallRemoteConsent({ room, allowMyVoice, translationOn, setRemoteConsent, setConsentRequested }: CallRemoteConsentArgs) {
  // Voice consent is explicit; LiveKit already authenticates the sender identity.
  useEffect(() => {
    if (!room) return
    const announce = () => {
      void room.localParticipant.publishData(
        new TextEncoder().encode(JSON.stringify({ type: 'consent', allowed: allowMyVoice })),
        { reliable: true, topic: CONSENT_TOPIC },
      ).catch(() => undefined)
    }
    const onData = (payload: Uint8Array, participant?: Participant, _kind?: unknown, topic?: string) => {
      if (topic !== CONSENT_TOPIC || !participant || payload.byteLength > 256) return
      try {
        const message = JSON.parse(new TextDecoder().decode(payload)) as { type?: string; allowed?: boolean }
        if (message.type === 'consent' && typeof message.allowed === 'boolean') {
          setRemoteConsent((current) => ({ ...current, [participant.identity]: message.allowed! }))
        }
        if (message.type === 'request' && !allowMyVoice) setConsentRequested(true)
      } catch { /* Ignore unrecognized control payloads. */ }
    }
    room.on(RoomEvent.DataReceived, onData)
    const onJoined = () => {
      announce()
      if (translationOn) {
        void room.localParticipant.publishData(
          new TextEncoder().encode(JSON.stringify({ type: 'request' })),
          { reliable: true, topic: CONSENT_TOPIC },
        ).catch(() => undefined)
      }
    }
    const onLeft = (participant: Participant) => {
      setRemoteConsent((current) => {
        if (!Object.prototype.hasOwnProperty.call(current, participant.identity)) return current
        const next = { ...current }
        delete next[participant.identity]
        return next
      })
    }
    room.on(RoomEvent.ParticipantConnected, onJoined)
    room.on(RoomEvent.ParticipantDisconnected, onLeft)
    announce()
    return () => {
      room.off(RoomEvent.DataReceived, onData)
      room.off(RoomEvent.ParticipantConnected, onJoined)
      room.off(RoomEvent.ParticipantDisconnected, onLeft)
    }
  }, [room, allowMyVoice, translationOn, setConsentRequested, setRemoteConsent])

  useEffect(() => {
    if (!room || !translationOn) return
    void room.localParticipant.publishData(
      new TextEncoder().encode(JSON.stringify({ type: 'request' })),
      { reliable: true, topic: CONSENT_TOPIC },
    ).catch(() => undefined)
  }, [room, translationOn])

}
