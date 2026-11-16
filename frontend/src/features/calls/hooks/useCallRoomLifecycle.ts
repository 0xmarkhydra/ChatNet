import { useEffect, useRef, type Dispatch, type SetStateAction } from 'react'
import {
  ExternalE2EEKeyProvider, isE2EESupported, Room, RoomEvent,
} from 'livekit-client'
import {
  endCall, joinCall, leaveCall, publishE2EEPublicKey,
  type CallJoinCredentials, type CallRequest, type CallSession,
} from '../lib/calls'
import {
  generateEphemeralCallKeyPair, generateKeyGeneration, generateMediaKey,
  mediaKeyBuffer, type EphemeralCallKeyPair,
} from '../lib/callCrypto'
import { waitForEnvelope } from '../lib/waitForCallEnvelope'
import { friendlyCallError } from '../lib/callErrors'
import { createCallKeySynchronizers } from '../lib/callE2EEKeySync'

export type RoomRuntime = {
  room: Room
  worker: Worker
  keyProvider: ExternalE2EEKeyProvider
  keyPair: EphemeralCallKeyPair
  credentials: CallJoinCredentials
}

type CallRoomPhase = 'securing' | 'connecting' | 'connected' | 'reconnecting' | 'error'

type CallRoomLifecycleArgs = {
  call: CallSession
  request: CallRequest
  userId: number
  autoPublish: boolean
  onError: (message: string) => void
  onClosed: () => void
  setPhase: Dispatch<SetStateAction<CallRoomPhase>>
  setDetail: Dispatch<SetStateAction<string>>
  setRuntime: Dispatch<SetStateAction<RoomRuntime | null>>
  setRevision: Dispatch<SetStateAction<number>>
  setMicOn: Dispatch<SetStateAction<boolean>>
  setCameraOn: Dispatch<SetStateAction<boolean>>
  setScreenOn: Dispatch<SetStateAction<boolean>>
  setMediaPermissionError: Dispatch<SetStateAction<string>>
}

export function useCallRoomLifecycle({
  call, request, userId, autoPublish, onError, onClosed,
  setPhase, setDetail, setRuntime, setRevision, setMicOn, setCameraOn,
  setScreenOn, setMediaPermissionError,
}: CallRoomLifecycleArgs) {
  const lastEnvelopeGeneration = useRef('')
  const hostWrappedKeys = useRef(new Map<number, string>())
  useEffect(() => {
    // Effect-local cancellation: StrictMode cleanup must not be undone by the next setup.
    let disposed = false
    let hostSyncTimer = 0
    let participantSyncTimer = 0
    let localRuntime: RoomRuntime | null = null

    const setup = async () => {
      try {
        if (!window.isSecureContext || !isE2EESupported()) throw new Error('Thiết bị không hỗ trợ E2EE an toàn.')
        setPhase('securing')
        setDetail('Đang tạo khóa tạm thời trên thiết bị…')

        const credentials = await joinCall(request, call.id)
        if (disposed) return
        const keyPair = await generateEphemeralCallKeyPair()
        if (disposed) return
        await publishE2EEPublicKey(request, call.id, keyPair.publicKey)
        if (disposed) return

        const keyProvider = new ExternalE2EEKeyProvider({ keySize: 256 })
        const worker = new Worker(new URL('livekit-client/e2ee-worker', import.meta.url), { type: 'module' })
        const room = new Room({
          adaptiveStream: true,
          dynacast: true,
          encryption: { keyProvider, worker },
        })
        localRuntime = { room, worker, keyProvider, keyPair, credentials }

        const isHost = call.createdBy === userId
        let hostMediaKey: Uint8Array | null = null
        let hostGeneration = ''

        if (isHost) {
          hostMediaKey = generateMediaKey()
          hostGeneration = generateKeyGeneration()
          await keyProvider.setKey(mediaKeyBuffer(hostMediaKey))
        } else {
          setDetail('Đang nhận khóa E2EE đã được bọc riêng cho thiết bị…')
          const mediaKey = await waitForEnvelope(request, call.id, userId, keyPair, 25_000)
          lastEnvelopeGeneration.current = mediaKey.generation
          await keyProvider.setKey(mediaKeyBuffer(mediaKey.key))
        }

        if (disposed) { await room.disconnect(); worker.terminate(); return }
        await room.setE2EEEnabled(true)
        if (disposed) { await room.disconnect(); worker.terminate(); return }
        setPhase('connecting')
        setDetail('Đang kết nối media an toàn…')

        const update = () => {
          if (disposed) return
          setRevision((value) => value + 1)
          setMicOn(room.localParticipant.isMicrophoneEnabled)
          setCameraOn(room.localParticipant.isCameraEnabled)
          setScreenOn(room.localParticipant.isScreenShareEnabled)
        }
        room.on(RoomEvent.TrackSubscribed, update)
        room.on(RoomEvent.TrackUnsubscribed, update)
        room.on(RoomEvent.ParticipantConnected, update)
        room.on(RoomEvent.ParticipantDisconnected, update)
        room.on(RoomEvent.LocalTrackPublished, update)
        room.on(RoomEvent.LocalTrackUnpublished, update)
        room.on(RoomEvent.ActiveSpeakersChanged, update)
        room.on(RoomEvent.Reconnecting, () => {
          if (disposed) return
          setPhase('reconnecting')
          setDetail('Mạng thay đổi, đang nối lại…')
        })
        room.on(RoomEvent.Reconnected, () => {
          if (disposed) return
          setPhase('connected')
          setDetail('Đã kết nối lại')
        })
        room.on(RoomEvent.Disconnected, () => {
          if (!disposed) { setPhase('error'); setDetail('Cuộc gọi đã ngắt kết nối.') }
        })

        await room.connect(credentials.serverUrl, credentials.token, { autoSubscribe: true })
        if (disposed) { await room.disconnect(); worker.terminate(); return }
        setRuntime(localRuntime)
        setPhase('connected')
        setDetail('Mã hóa đầu cuối đang bật')

        if (autoPublish) {
          try {
            await room.localParticipant.setMicrophoneEnabled(true)
            if (disposed) { await room.disconnect(); return }
            setMicOn(true)
          } catch (permissionError) {
            setMicOn(false)
            setMediaPermissionError(friendlyCallError(permissionError))
          }
          if (call.mediaType === 'video' && !disposed) {
            try {
              await room.localParticipant.setCameraEnabled(true)
              if (disposed) { await room.disconnect(); return }
              setCameraOn(true)
            } catch (permissionError) {
              setCameraOn(false)
              setMediaPermissionError(friendlyCallError(permissionError))
            }
          }
        } else {
          setMicOn(false)
          setCameraOn(false)
          setMediaPermissionError('Cuộc gọi được khôi phục nhưng mic/camera vẫn tắt. Bấm Cấp quyền khi bạn muốn phát âm thanh hoặc video.')
        }
        try { await room.startAudio() } catch { /* user can re-enable audio from the control */ }

        const { syncHostKeys, syncParticipantKey } = createCallKeySynchronizers({
          request, callId: call.id, userId, keyPair, keyProvider, hostMediaKey, hostGeneration,
          hostWrappedKeys: hostWrappedKeys.current,
          getLastEnvelopeGeneration: () => lastEnvelopeGeneration.current,
          setLastEnvelopeGeneration: (generation) => { lastEnvelopeGeneration.current = generation },
          isDisposed: () => disposed, setDetail,
        })

        if (isHost && hostMediaKey) {
          await syncHostKeys()
          if (disposed) return
          hostSyncTimer = window.setInterval(() => { if (!disposed) void syncHostKeys() }, 1800)
        } else {
          if (!disposed) participantSyncTimer = window.setInterval(() => void syncParticipantKey(), 1800)
        }
      } catch (err) {
        if (disposed) {
          if (localRuntime) { await localRuntime.room.disconnect().catch(() => undefined); localRuntime.worker.terminate() }
          return // A stale setup must never end the newer call instance on the backend.
        }
        const message = friendlyCallError(err)
        setPhase('error')
        setDetail(message)
        onError(message)
        try {
          if (call.createdBy === userId) await endCall(request, call.id)
          else await leaveCall(request, call.id)
        } catch {
          // Cleanup is best effort; never retry by downgrading E2EE.
        }
        if (localRuntime) {
          await localRuntime.room.disconnect().catch(() => undefined)
          localRuntime.worker.terminate()
        }
        onClosed()
      }
    }

    void setup()
    return () => {
      disposed = true
      window.clearInterval(hostSyncTimer)
      window.clearInterval(participantSyncTimer)
      if (localRuntime) {
        void localRuntime.room.disconnect().catch(() => undefined)
        localRuntime.worker.terminate()
      }
    }
  }, [call.id, call.createdBy, call.mediaType, onError, request, userId])

}