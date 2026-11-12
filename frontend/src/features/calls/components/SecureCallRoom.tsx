import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ExternalE2EEKeyProvider, isE2EESupported, Room, RoomEvent,
  type Participant, type RemoteTrack,
} from 'livekit-client'
import { Languages, Mic, ShieldCheck, Sparkles, ChevronDown } from 'lucide-react'
import {
  endCall, getE2EEEnvelope, joinCall, leaveCall, listE2EEPublicKeys,
  publishE2EEPublicKey, putE2EEEnvelope,
  type CallJoinCredentials, type CallRequest, type CallSession,
} from '../lib/calls'
import {
  generateEphemeralCallKeyPair, generateKeyGeneration, generateMediaKey,
  mediaKeyBuffer, unwrapMediaKey, wrapMediaKey, type EphemeralCallKeyPair,
} from '../lib/callCrypto'
import { startCallMediaInterpreter, type InterpreterSession, type InterpreterUpdate } from '../lib/callMediaInterpreter'
import { RemoteAudioSinks } from './CallMediaTracks'
import { CallGroupPanel, CallTranslationPanel } from './CallRoomPanels'
import CallRoomNotices from './CallRoomNotices'
import CallRoomControls from './CallRoomControls'
import { CallRoomTopbar, CallRoomMediaStage } from './CallRoomStage'
import { appendCallCaption, type CallCaption } from '../lib/callCaptions'
import { waitForEnvelope } from '../lib/waitForCallEnvelope'
import { friendlyCallError } from '../lib/callErrors'
import { deriveCallRoomDisplay } from '../lib/callRoomDisplay'
import { useCallMediaControls } from '../hooks/useCallMediaControls'
import { useCallLanguages } from '../hooks/useCallLanguages'
import { useCallOverlayDismiss } from '../hooks/useCallOverlayDismiss'
import { useCallVoiceConsent } from '../hooks/useCallVoiceConsent'
import { useCallRemoteConsent } from '../hooks/useCallRemoteConsent'
import { useCallInterpreterSessions } from '../hooks/useCallInterpreterSessions'

type SecureCallRoomProps = {
  autoPublish: boolean
  isGroup: boolean
  call: CallSession
  title: string
  apiBase: string
  request: CallRequest
  userId: number
  sourceLanguage: string
  targetLanguage: string
  canEnd: boolean
  onClosed: () => void
  onError: (message: string) => void
}

type RoomRuntime = {
  room: Room
  worker: Worker
  keyProvider: ExternalE2EEKeyProvider
  keyPair: EphemeralCallKeyPair
  credentials: CallJoinCredentials
}

export default function SecureCallRoom({
  call, autoPublish, isGroup, title, apiBase, request, userId, sourceLanguage, targetLanguage, canEnd, onClosed, onError,
}: SecureCallRoomProps) {
  const [phase, setPhase] = useState<'securing' | 'connecting' | 'connected' | 'reconnecting' | 'error'>('securing')
  const [detail, setDetail] = useState('Đang thiết lập mã hóa đầu cuối…')
  const [runtime, setRuntime] = useState<RoomRuntime | null>(null)
  const [revision, setRevision] = useState(0)
  const [micOn, setMicOn] = useState(true)
  const [cameraOn, setCameraOn] = useState(call.mediaType === 'video')
  const [screenOn, setScreenOn] = useState(false)
  const [soundOn, setSoundOn] = useState(true)
  const [translationOn, setTranslationOn] = useState(() => localStorage.getItem('chatnet.call.translation.autostart.v1') === 'true')
  const [translationSheetOpen, setTranslationSheetOpen] = useState(() => localStorage.getItem('chatnet.call.translation.autostart.v1') === 'true')
  const [moreOpen, setMoreOpen] = useState(false)
  const [participantsSheetOpen, setParticipantsSheetOpen] = useState(true)
  const moreRef = useRef<HTMLDivElement>(null)
  const [mediaPermissionError, setMediaPermissionError] = useState('')
  const [permissionRetrying, setPermissionRetrying] = useState(false)
  const { callTargetLanguage, setCallTargetLanguage, languageOptions } = useCallLanguages(request, sourceLanguage, targetLanguage)
  const [captionMode] = useState(() => localStorage.getItem('chatnet.call.subtitle-mode.v1') || 'both')
  const [translationError, setTranslationError] = useState('')
  const [translationRetryEpoch, setTranslationRetryEpoch] = useState(0)
  const [allowMyVoice, setAllowMyVoice] = useState(false)
  const [consentBusy, setConsentBusy] = useState(false)
  const [consentError, setConsentError] = useState('')
  const [consentRequested, setConsentRequested] = useState(false)
  const [remoteConsent, setRemoteConsent] = useState<Record<string, boolean>>({})
  const [translatingIds, setTranslatingIds] = useState<string[]>([])
  const [captions, setCaptions] = useState<CallCaption[]>([])
  const interpreters = useRef(new Map<string, InterpreterSession>())
  const interpreterPending = useRef(new Set<string>())
  const [ending, setEnding] = useState(false)

  useCallOverlayDismiss(moreOpen, translationSheetOpen, moreRef, setMoreOpen, setTranslationSheetOpen)

  // Consent is scoped to the current call. Never carry an AI voice grant to a new room.
  useEffect(() => {
    setAllowMyVoice(false)
    setConsentError('')
    setRemoteConsent({})
    setConsentRequested(false)
    setTranslationOn(false)
    setTranslationSheetOpen(false)
    setMoreOpen(false)
    setMediaPermissionError('')
  }, [call.id])
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
        room.on(RoomEvent.Reconnecting, () => { setPhase('reconnecting'); setDetail('Mạng thay đổi, đang nối lại…') })
        room.on(RoomEvent.Reconnected, () => { setPhase('connected'); setDetail('Đã kết nối lại') })
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

        if (isHost && hostMediaKey) {
          let syncingHost = false
          const syncHostKeys = async () => {
            if (disposed || syncingHost) return
            syncingHost = true
            try {
              const publicKeys = await listE2EEPublicKeys(request, call.id)
              if (disposed) return
              for (const record of publicKeys) {
                if (record.userId === userId) continue
                const fingerprint = `${record.updatedAt}:${hostGeneration}`
                if (hostWrappedKeys.current.get(record.userId) === fingerprint) continue
                const wrapped = await wrapMediaKey(hostMediaKey!, keyPair.privateKey, record.publicKey, call.id, userId, record.userId)
                if (disposed) return
                await putE2EEEnvelope(request, call.id, {
                  recipientUserId: record.userId,
                  generation: hostGeneration,
                  iv: wrapped.iv,
                  ciphertext: wrapped.ciphertext,
                })
                if (disposed) return
                hostWrappedKeys.current.set(record.userId, fingerprint)
              }
            } catch {
              // Retry on the next interval; never fall back to plaintext media.
            } finally { syncingHost = false }
          }
          await syncHostKeys()
          if (disposed) return
          hostSyncTimer = window.setInterval(() => { if (!disposed) void syncHostKeys() }, 1800)
        } else {
          let syncingParticipant = false
          const syncParticipantKey = async () => {
            if (disposed || syncingParticipant) return
            syncingParticipant = true
            try {
              const result = await getE2EEEnvelope(request, call.id)
              if (disposed) return
              const envelope = result.envelope
              if (!envelope || envelope.generation === lastEnvelopeGeneration.current) return
              const keys = await listE2EEPublicKeys(request, call.id)
              if (disposed) return
              const sender = keys.find((item) => item.userId === envelope.senderUserId)
              if (!sender) return
              const key = await unwrapMediaKey(
                envelope.iv, envelope.ciphertext, keyPair.privateKey, sender.publicKey,
                call.id, envelope.senderUserId, userId,
              )
              if (disposed) return
              await keyProvider.setKey(mediaKeyBuffer(key))
              if (disposed) return
              lastEnvelopeGeneration.current = envelope.generation
              setDetail('E2EE đã xoay khóa an toàn')
            } catch {
              // Keep the existing valid key and retry; do not downgrade encryption.
            } finally { syncingParticipant = false }
          }
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

  const room = runtime?.room

  const { updateVoiceConsent } = useCallVoiceConsent({
    room, callId: call.id, request,
    setAllowMyVoice, setConsentError, setConsentBusy, setConsentRequested, setMicOn,
  })

  const participants = useMemo(() => {
    if (!room) return [] as Participant[]
    revision // Active tracks, participants and reconnections update the call UI.
    return [room.localParticipant, ...Array.from(room.remoteParticipants.values())]
  }, [revision, room])

  useCallRemoteConsent({ room, allowMyVoice, translationOn, setRemoteConsent, setConsentRequested })

  const { remoteTrackKey, remoteConsentKey, latestCaption, waitingConsentCount, statusLabel } =
    deriveCallRoomDisplay(participants, room?.localParticipant, captions, remoteConsent, phase)
  useCallInterpreterSessions({
    room, phase, translationOn, callId: call.id, callTargetLanguage, apiBase, request,
    remoteTrackKey, remoteConsentKey, translationRetryEpoch, interpreters, interpreterPending,
    setCaptions, setTranslationError, setTranslatingIds,
  })

  useEffect(() => {
    if (!translationOn) {
      setCaptions([])
      setTranslationError('')
      setTranslationSheetOpen(false)
    }
  }, [translationOn])

  const { requestCallMediaPermission, toggleMic, toggleCamera, toggleScreen, toggleSound } = useCallMediaControls({
    room, mediaType: call.mediaType, ending, permissionRetrying, micOn, cameraOn, screenOn, soundOn,
    setPermissionRetrying, setMicOn, setCameraOn, setScreenOn, setSoundOn, setMediaPermissionError, onError,
  })

  async function closeCall(endForEveryone: boolean) {
    if (ending) return
    setEnding(true)
    try {
      if (endForEveryone) await endCall(request, call.id)
      else await leaveCall(request, call.id)
    } catch (err) {
      onError(friendlyCallError(err))
    } finally {
      if (runtime) {
        await runtime.room.disconnect().catch(() => undefined)
        runtime.worker.terminate()
      }
      onClosed()
    }
  }

  const toggleTranslation = () => {
    setMoreOpen(false)
    if (translationOn) {
      setTranslationOn(false)
    } else {
      setTranslationOn(true)
      setTranslationSheetOpen(true)
    }
  }

  return (
    <div className="secure-call-layer" role="dialog" aria-modal="true" aria-label={`Cuộc gọi với ${title}`}>
      <div className="secure-call-stage">
        <CallRoomTopbar title={title} phase={phase} detail={detail} statusLabel={statusLabel}
          participantCount={participants.length} translationOn={translationOn}
          setTranslationSheetOpen={setTranslationSheetOpen} />

        <div className={`call-main-layout ${translationOn && translationSheetOpen ? 'has-translation' : isGroup && participantsSheetOpen ? 'has-participants' : ''}`}>
          <CallRoomMediaStage participants={participants} localParticipant={room?.localParticipant}
            phase={phase} detail={detail} translationOn={translationOn}
            translationSheetOpen={translationSheetOpen} latestCaption={latestCaption}
            callTargetLanguage={callTargetLanguage} setTranslationSheetOpen={setTranslationSheetOpen} />
          {isGroup && participantsSheetOpen && !(translationOn && translationSheetOpen) && (
            <CallGroupPanel participants={participants} localParticipant={room?.localParticipant} translationOn={translationOn} toggleTranslation={toggleTranslation} setTranslationSheetOpen={setTranslationSheetOpen} />
          )}
          {translationOn && translationSheetOpen && (
            <CallTranslationPanel callTargetLanguage={callTargetLanguage} languageOptions={languageOptions} translatingIds={translatingIds} waitingConsentCount={waitingConsentCount} translationError={translationError} captions={captions} captionMode={captionMode} setTranslationSheetOpen={setTranslationSheetOpen} setCallTargetLanguage={setCallTargetLanguage} setTranslationError={setTranslationError} setTranslationRetryEpoch={setTranslationRetryEpoch} />
          )}
        </div>
        {room && <RemoteAudioSinks room={room} muted={!soundOn}
          volume={translationOn && translatingIds.length ? 0.2 : 1} revision={revision} />}

        {translationOn && translationSheetOpen && (
          <button type="button" className="call-sheet-backdrop" aria-label="Thu gọn phụ đề" onClick={() => setTranslationSheetOpen(false)} />
        )}

        <CallRoomNotices mediaPermissionError={mediaPermissionError} mediaType={call.mediaType}
          roomConnected={Boolean(room)} permissionRetrying={permissionRetrying}
          requestCallMediaPermission={() => void requestCallMediaPermission()}
          consentError={consentError} consentRequested={consentRequested} allowMyVoice={allowMyVoice}
          consentBusy={consentBusy} updateVoiceConsent={(allowed) => void updateVoiceConsent(allowed)}
          dismissConsent={() => setConsentRequested(false)} />

        <CallRoomControls room={room} ending={ending} micOn={micOn} cameraOn={cameraOn}
          screenOn={screenOn} soundOn={soundOn} translationOn={translationOn} isGroup={isGroup}
          participantsSheetOpen={participantsSheetOpen} translationSheetOpen={translationSheetOpen}
          moreRef={moreRef} moreOpen={moreOpen} consentBusy={consentBusy} allowMyVoice={allowMyVoice}
          canEnd={canEnd} toggleMic={() => void toggleMic()} toggleCamera={() => void toggleCamera()}
          toggleScreen={() => void toggleScreen()} toggleSound={() => void toggleSound()}
          toggleTranslation={toggleTranslation} closeCall={(endForEveryone) => void closeCall(endForEveryone)}
          updateVoiceConsent={(allowed) => void updateVoiceConsent(allowed)}
          setMoreOpen={setMoreOpen} setTranslationSheetOpen={setTranslationSheetOpen}
          setParticipantsSheetOpen={setParticipantsSheetOpen} />
      </div>
    </div>
  )
}