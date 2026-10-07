import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ExternalE2EEKeyProvider,
  isE2EESupported,
  Room,
  RoomEvent,
  Track,
  type LocalTrack,
  type Participant,
  type RemoteTrack,
  type TrackPublication,
} from 'livekit-client'
import {
  Mic, MicOff, MonitorUp, MonitorX, Phone, PhoneOff, ShieldCheck,
  Users, Video, VideoOff, Volume2, VolumeX, X,
} from 'lucide-react'
import {
  createCall, declineCall, endCall, getCurrentCalls, getE2EEEnvelope,
  joinCall, leaveCall, listE2EEPublicKeys, publishE2EEPublicKey, putE2EEEnvelope,
  type CallJoinCredentials, type CallMediaType, type CallRealtimeEvent,
  type CallRequest, type CallSession, type CallView,
} from './calls'
import {
  generateEphemeralCallKeyPair, generateKeyGeneration, generateMediaKey,
  mediaKeyBuffer, unwrapMediaKey, wrapMediaKey, type EphemeralCallKeyPair,
} from './callCrypto'
import './call.css'

type ConversationLite = { id: number; name: string; type: 'direct' | 'group' }
type CallLaunchDetail = { conversationId: number; mediaType: CallMediaType }

type CallManagerProps = {
  request: CallRequest
  apiBase: string
  token: string
  userId: number
  conversations: ConversationLite[]
}

export function CallHeaderActions({ conversationId }: { conversationId: number }) {
  const start = (mediaType: CallMediaType) => {
    window.dispatchEvent(new CustomEvent<CallLaunchDetail>('chatnet:start-call', {
      detail: { conversationId, mediaType },
    }))
  }
  return (
    <div className="call-header-actions" aria-label="Gọi điện">
      <button type="button" aria-label="Gọi thoại" title="Gọi thoại" onClick={() => start('audio')}>
        <Phone size={19} />
      </button>
      <button type="button" aria-label="Gọi video" title="Gọi video" onClick={() => start('video')}>
        <Video size={20} />
      </button>
    </div>
  )
}

export default function CallManager({ request, apiBase, token, userId, conversations }: CallManagerProps) {
  const [incoming, setIncoming] = useState<CallView | null>(null)
  const [active, setActive] = useState<CallView | CallSession | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const requestRef = useRef(request)
  requestRef.current = request
  const callRequest = useCallback<CallRequest>((path, init) => requestRef.current(path, init), [])

  const conversationMap = useMemo(
    () => new Map(conversations.map((item) => [item.id, item])),
    [conversations],
  )
  const refresh = useCallback(async () => {
    if (!token) return
    try {
      const calls = await getCurrentCalls(callRequest)
      const current = calls.find((item) => item.joined && (item.status === 'ringing' || item.status === 'active'))
      const ringing = calls.find((item) => item.incoming && (item.status === 'ringing' || item.status === 'active'))
      if (!active && current) setActive(current)
      setIncoming(active ? null : ringing || null)
    } catch {
      // Realtime reconnects are best effort; the next SSE event/refresh will recover state.
    }
  }, [active, callRequest, token])

  useEffect(() => {
    if (!token) return
    void refresh()
    const source = new EventSource(`${apiBase}/api/events?token=${encodeURIComponent(token)}`)
    source.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as CallRealtimeEvent
        if (!payload.type?.startsWith('call.')) return
        if (payload.type === 'call.ended') {
          if (payload.callId === incoming?.id) setIncoming(null)
          if (payload.callId === active?.id) setActive(null)
          return
        }
        if (payload.type === 'call.created' && payload.call && payload.call.createdBy !== userId && !active) {
          void refresh()
          return
        }
        if (payload.type === 'call.updated') void refresh()
      } catch {
        // Ignore unrelated SSE payloads.
      }
    }
    source.onerror = () => {
      // EventSource reconnects automatically.
    }
    return () => source.close()
  }, [active?.id, apiBase, incoming?.id, refresh, token, userId])

  useEffect(() => {
    const onStart = (event: Event) => {
      const detail = (event as CustomEvent<CallLaunchDetail>).detail
      if (!detail?.conversationId || (detail.mediaType !== 'audio' && detail.mediaType !== 'video')) return
      void startCall(detail.conversationId, detail.mediaType)
    }
    window.addEventListener('chatnet:start-call', onStart)
    return () => window.removeEventListener('chatnet:start-call', onStart)
  })

  async function startCall(conversationId: number, mediaType: CallMediaType) {
    if (busy || active) return
    setBusy(true)
    setError('')
    try {
      if (!window.isSecureContext || !isE2EESupported()) {
        throw new Error('Trình duyệt này chưa hỗ trợ cuộc gọi E2EE an toàn.')
      }
      const call = await createCall(callRequest, conversationId, mediaType)
      setIncoming(null)
      setActive(call)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể bắt đầu cuộc gọi.')
    } finally {
      setBusy(false)
    }
  }

  async function acceptIncoming() {
    if (!incoming || busy) return
    setBusy(true)
    setError('')
    try {
      if (!incoming.configured) throw new Error('Máy chủ gọi video chưa được cấu hình.')
      if (!window.isSecureContext || !isE2EESupported()) throw new Error('Thiết bị này chưa hỗ trợ E2EE WebRTC.')
      setActive(incoming)
      setIncoming(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể nhận cuộc gọi.')
    } finally {
      setBusy(false)
    }
  }

  async function rejectIncoming() {
    if (!incoming || busy) return
    setBusy(true)
    try {
      await declineCall(callRequest, incoming.id)
      setIncoming(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể từ chối cuộc gọi.')
    } finally {
      setBusy(false)
    }
  }

  const incomingName = incoming ? conversationMap.get(incoming.conversationId)?.name || 'Cuộc trò chuyện' : ''
  const activeName = active ? conversationMap.get(active.conversationId)?.name || 'ChatNet Call' : ''

  return (
    <>
      {error && !active && (
        <div className="call-global-error" role="alert">
          <ShieldCheck size={18} /><span>{error}</span><button type="button" onClick={() => setError('')}><X size={17} /></button>
        </div>
      )}

      {incoming && !active && (
        <div className="incoming-call-layer" role="dialog" aria-modal="true" aria-label="Cuộc gọi đến">
          <div className="incoming-call-card">
            <div className="incoming-call-orb"><span>{incoming.mediaType === 'video' ? '📹' : '📞'}</span></div>
            <small>Cuộc gọi {incoming.mediaType === 'video' ? 'video' : 'thoại'} E2EE</small>
            <h2>{incomingName}</h2>
            <p><ShieldCheck size={15} /> Mã hóa đầu cuối · ChatNet Secure Call</p>
            <div className="incoming-call-actions">
              <button type="button" className="call-reject" disabled={busy} onClick={() => void rejectIncoming()}>
                <PhoneOff size={23} /><span>Từ chối</span>
              </button>
              <button type="button" className="call-accept" disabled={busy} onClick={() => void acceptIncoming()}>
                {incoming.mediaType === 'video' ? <Video size={24} /> : <Phone size={23} />}<span>Nhận</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {active && (
        <SecureCallRoom
          call={active}
          title={activeName}
          request={callRequest}
          userId={userId}
          canEnd={'canEnd' in active ? active.canEnd : active.createdBy === userId}
          onClosed={() => { setActive(null); setIncoming(null); void refresh() }}
          onError={setError}
        />
      )}
    </>
  )
}

type SecureCallRoomProps = {
  call: CallSession
  title: string
  request: CallRequest
  userId: number
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

function SecureCallRoom({ call, title, request, userId, canEnd, onClosed, onError }: SecureCallRoomProps) {
  const [phase, setPhase] = useState<'securing' | 'connecting' | 'connected' | 'reconnecting' | 'error'>('securing')
  const [detail, setDetail] = useState('Đang thiết lập mã hóa đầu cuối…')
  const [runtime, setRuntime] = useState<RoomRuntime | null>(null)
  const [revision, setRevision] = useState(0)
  const [micOn, setMicOn] = useState(true)
  const [cameraOn, setCameraOn] = useState(call.mediaType === 'video')
  const [screenOn, setScreenOn] = useState(false)
  const [soundOn, setSoundOn] = useState(true)
  const [ending, setEnding] = useState(false)
  const lastEnvelopeGeneration = useRef('')
  const hostWrappedKeys = useRef(new Map<number, string>())
  const disposed = useRef(false)

  useEffect(() => {
    disposed.current = false
    let hostSyncTimer = 0
    let participantSyncTimer = 0
    let localRuntime: RoomRuntime | null = null

    const setup = async () => {
      try {
        if (!window.isSecureContext || !isE2EESupported()) throw new Error('Thiết bị không hỗ trợ E2EE an toàn.')
        setPhase('securing')
        setDetail('Đang tạo khóa tạm thời trên thiết bị…')

        const credentials = await joinCall(request, call.id)
        const keyPair = await generateEphemeralCallKeyPair()
        await publishE2EEPublicKey(request, call.id, keyPair.publicKey)

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

        await room.setE2EEEnabled(true)
        setPhase('connecting')
        setDetail('Đang kết nối media an toàn…')

        const update = () => setRevision((value) => value + 1)
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
          if (!disposed.current) { setPhase('error'); setDetail('Cuộc gọi đã ngắt kết nối.') }
        })

        await room.connect(credentials.serverUrl, credentials.token, { autoSubscribe: true })
        if (disposed.current) return
        setRuntime(localRuntime)
        setPhase('connected')
        setDetail('Mã hóa đầu cuối đang bật')

        await room.localParticipant.setMicrophoneEnabled(true)
        setMicOn(true)
        if (call.mediaType === 'video') {
          await room.localParticipant.setCameraEnabled(true)
          setCameraOn(true)
        }
        try { await room.startAudio() } catch { /* user can re-enable audio from the control */ }

        if (isHost && hostMediaKey) {
          const syncHostKeys = async () => {
            try {
              const publicKeys = await listE2EEPublicKeys(request, call.id)
              for (const record of publicKeys) {
                if (record.userId === userId) continue
                const fingerprint = `${record.updatedAt}:${hostGeneration}`
                if (hostWrappedKeys.current.get(record.userId) === fingerprint) continue
                const wrapped = await wrapMediaKey(hostMediaKey!, keyPair.privateKey, record.publicKey, call.id, userId, record.userId)
                await putE2EEEnvelope(request, call.id, {
                  recipientUserId: record.userId,
                  generation: hostGeneration,
                  iv: wrapped.iv,
                  ciphertext: wrapped.ciphertext,
                })
                hostWrappedKeys.current.set(record.userId, fingerprint)
              }
            } catch {
              // Retry on the next interval; never fall back to plaintext media.
            }
          }
          await syncHostKeys()
          hostSyncTimer = window.setInterval(() => void syncHostKeys(), 1800)
        } else {
          const syncParticipantKey = async () => {
            try {
              const result = await getE2EEEnvelope(request, call.id)
              const envelope = result.envelope
              if (!envelope || envelope.generation === lastEnvelopeGeneration.current) return
              const keys = await listE2EEPublicKeys(request, call.id)
              const sender = keys.find((item) => item.userId === envelope.senderUserId)
              if (!sender) return
              const key = await unwrapMediaKey(
                envelope.iv, envelope.ciphertext, keyPair.privateKey, sender.publicKey,
                call.id, envelope.senderUserId, userId,
              )
              await keyProvider.setKey(mediaKeyBuffer(key))
              lastEnvelopeGeneration.current = envelope.generation
              setDetail('E2EE đã xoay khóa an toàn')
            } catch {
              // Keep the existing valid key and retry; do not downgrade encryption.
            }
          }
          participantSyncTimer = window.setInterval(() => void syncParticipantKey(), 1800)
        }
      } catch (err) {
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
      disposed.current = true
      window.clearInterval(hostSyncTimer)
      window.clearInterval(participantSyncTimer)
      if (localRuntime) {
        void localRuntime.room.disconnect()
        localRuntime.worker.terminate()
      }
    }
  }, [call.id, call.createdBy, call.mediaType, onError, request, userId])

  const room = runtime?.room
  const participants = useMemo(() => {
    if (!room) return [] as Participant[]
    revision // force recomputation when LiveKit emits topology/track events
    return [room.localParticipant, ...Array.from(room.remoteParticipants.values())]
  }, [revision, room])

  async function toggleMic() {
    if (!room) return
    try {
      const next = !micOn
      await room.localParticipant.setMicrophoneEnabled(next)
      setMicOn(next)
    } catch (err) { onError(friendlyCallError(err)) }
  }

  async function toggleCamera() {
    if (!room) return
    try {
      const next = !cameraOn
      await room.localParticipant.setCameraEnabled(next)
      setCameraOn(next)
    } catch (err) { onError(friendlyCallError(err)) }
  }

  async function toggleScreen() {
    if (!room) return
    try {
      const next = !screenOn
      await room.localParticipant.setScreenShareEnabled(next)
      setScreenOn(next)
    } catch (err) { onError(friendlyCallError(err)) }
  }

  async function toggleSound() {
    if (!room) return
    const next = !soundOn
    for (const participant of room.remoteParticipants.values()) {
      for (const publication of participant.audioTrackPublications.values()) {
        const element = publication.track?.attachedElements?.[0] as HTMLMediaElement | undefined
        if (element) element.muted = !next
      }
    }
    if (next) {
      try { await room.startAudio() } catch { onError('Trình duyệt đang chặn phát âm thanh. Hãy chạm lại nút loa.') }
    }
    setSoundOn(next)
  }

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

  return (
    <div className="secure-call-layer" role="dialog" aria-modal="true" aria-label={`Cuộc gọi với ${title}`}>
      <div className="secure-call-stage">
        <header className="secure-call-topbar">
          <div>
            <strong>{title}</strong>
            <span className={`call-security-state phase-${phase}`}>
              <ShieldCheck size={14} /> {detail}
            </span>
          </div>
          <div className="secure-call-topmeta">
            <span><Users size={15} /> {Math.max(1, participants.length)}</span>
            <span>E2EE</span>
          </div>
        </header>

        <div className={`secure-call-grid count-${Math.min(participants.length, 6)}`}>
          {participants.length === 0 ? (
            <div className="call-connecting-state">
              <div className="call-secure-spinner" />
              <ShieldCheck size={28} />
              <strong>{phase === 'error' ? 'Không thể kết nối an toàn' : 'Đang bảo vệ cuộc gọi…'}</strong>
              <span>{detail}</span>
            </div>
          ) : participants.map((participant) => (
            <ParticipantTile key={participant.identity} participant={participant} local={participant === room?.localParticipant} />
          ))}
        </div>

        {room && <RemoteAudioSinks room={room} muted={!soundOn} revision={revision} />}

        <footer className="secure-call-controls">
          <button type="button" className={!micOn ? 'is-off' : ''} disabled={!room || ending} onClick={() => void toggleMic()}>
            {micOn ? <Mic /> : <MicOff />}<span>{micOn ? 'Mic' : 'Tắt mic'}</span>
          </button>
          <button type="button" className={!cameraOn ? 'is-off' : ''} disabled={!room || ending} onClick={() => void toggleCamera()}>
            {cameraOn ? <Video /> : <VideoOff />}<span>Camera</span>
          </button>
          <button type="button" className={screenOn ? 'is-on' : ''} disabled={!room || ending} onClick={() => void toggleScreen()}>
            {screenOn ? <MonitorX /> : <MonitorUp />}<span>Chia sẻ</span>
          </button>
          <button type="button" className={!soundOn ? 'is-off' : ''} disabled={!room || ending} onClick={() => void toggleSound()}>
            {soundOn ? <Volume2 /> : <VolumeX />}<span>Âm thanh</span>
          </button>
          <button type="button" className="hangup-button" disabled={ending} onClick={() => void closeCall(canEnd)}>
            <PhoneOff /><span>{canEnd ? 'Kết thúc' : 'Rời'}</span>
          </button>
        </footer>
      </div>
    </div>
  )
}

async function waitForEnvelope(
  request: CallRequest,
  callId: string,
  userId: number,
  keyPair: EphemeralCallKeyPair,
  timeoutMs: number,
): Promise<{ key: Uint8Array; generation: string }> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const result = await getE2EEEnvelope(request, callId)
    const envelope = result.envelope
    if (envelope) {
      const keys = await listE2EEPublicKeys(request, callId)
      const sender = keys.find((item) => item.userId === envelope.senderUserId)
      if (sender) {
        const key = await unwrapMediaKey(
          envelope.iv, envelope.ciphertext, keyPair.privateKey, sender.publicKey,
          callId, envelope.senderUserId, userId,
        )
        return { key, generation: envelope.generation }
      }
    }
    await new Promise((resolve) => window.setTimeout(resolve, 550))
  }
  throw new Error('Không nhận được khóa E2EE từ host. Cuộc gọi không được hạ xuống chế độ kém an toàn.')
}

function ParticipantTile({ participant, local }: { participant: Participant; local: boolean }) {
  const camera = participant.getTrackPublication(Track.Source.Camera)
  const screen = participant.getTrackPublication(Track.Source.ScreenShare)
  const videoPublication = screen?.track ? screen : camera
  const muted = !videoPublication?.track || videoPublication.isMuted
  return (
    <div className={`call-participant-tile ${screen?.track ? 'screen-tile' : ''}`}>
      {!muted && videoPublication?.track ? (
        <VideoTrackView publication={videoPublication} mirror={local && videoPublication.source === Track.Source.Camera} />
      ) : (
        <div className="call-avatar-fallback"><span>{identityLabel(participant.identity)}</span></div>
      )}
      <div className="call-participant-label">
        <span>{local ? 'Bạn' : identityLabel(participant.identity)}</span>
        {participant.isSpeaking && <i className="call-speaking-dot" />}
      </div>
    </div>
  )
}

function VideoTrackView({ publication, mirror }: { publication: TrackPublication; mirror: boolean }) {
  const ref = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    const element = ref.current
    const track = publication.track as LocalTrack | RemoteTrack | undefined
    if (!element || !track) return
    track.attach(element)
    return () => { track.detach(element) }
  }, [publication.track])
  return <video ref={ref} autoPlay playsInline muted={mirror} className={mirror ? 'mirror' : ''} />
}

function RemoteAudioSinks({ room, muted, revision }: { room: Room; muted: boolean; revision: number }) {
  revision
  const tracks = Array.from(room.remoteParticipants.values()).flatMap((participant) =>
    Array.from(participant.audioTrackPublications.values()).filter((publication) => publication.track),
  )
  return <>{tracks.map((publication) => <AudioTrackSink key={publication.trackSid} publication={publication} muted={muted} />)}</>
}

function AudioTrackSink({ publication, muted }: { publication: TrackPublication; muted: boolean }) {
  const ref = useRef<HTMLAudioElement>(null)
  useEffect(() => {
    const element = ref.current
    const track = publication.track as RemoteTrack | undefined
    if (!element || !track) return
    track.attach(element)
    return () => { track.detach(element) }
  }, [publication.track])
  return <audio ref={ref} autoPlay muted={muted} />
}

function identityLabel(identity: string) {
  const id = identity.startsWith('u_') ? identity.slice(2) : identity
  return `U${id}`
}

function friendlyCallError(error: unknown) {
  if (error instanceof DOMException) {
    if (error.name === 'NotAllowedError') return 'Quyền camera/microphone bị từ chối. Hãy cho phép quyền rồi thử lại.'
    if (error.name === 'NotFoundError') return 'Không tìm thấy camera hoặc microphone phù hợp.'
  }
  if (error instanceof Error && error.message) return error.message
  return 'Không thể thiết lập cuộc gọi an toàn.'
}
