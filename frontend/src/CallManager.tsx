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
  Languages, Mic, MicOff, MonitorUp, MonitorX, Phone, PhoneOff, ShieldCheck,
  Users, Video, VideoOff, Volume2, VolumeX, X, MoreHorizontal, Sparkles, ChevronDown, Settings2,
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
import { startCallMediaInterpreter, type InterpreterSession, type InterpreterUpdate } from './callMediaInterpreter'
import { buildLanguageOptions } from './languages'
import './call.css'

type ConversationLite = { id: number; name: string; type: 'direct' | 'group' }
type CallLaunchDetail = { conversationId: number; mediaType: CallMediaType }

type CallManagerProps = {
  request: CallRequest
  apiBase: string
  token: string
  userId: number
  sourceLanguage: string
  targetLanguage: string
  conversations: ConversationLite[]
}

type CallCaption = {
  id: string
  speakerId: string
  original: string
  translated: string
  updatedAt: number
}
const CONSENT_TOPIC = 'chatnet.call.translation.consent.v1'
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

export default function CallManager({
  request, apiBase, token, userId, sourceLanguage, targetLanguage, conversations,
}: CallManagerProps) {
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
          apiBase={apiBase}
          request={callRequest}
          userId={userId}
          sourceLanguage={sourceLanguage}
          targetLanguage={targetLanguage}
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

function SecureCallRoom({
  call, title, apiBase, request, userId, sourceLanguage, targetLanguage, canEnd, onClosed, onError,
}: SecureCallRoomProps) {
  const [phase, setPhase] = useState<'securing' | 'connecting' | 'connected' | 'reconnecting' | 'error'>('securing')
  const [detail, setDetail] = useState('Đang thiết lập mã hóa đầu cuối…')
  const [runtime, setRuntime] = useState<RoomRuntime | null>(null)
  const [revision, setRevision] = useState(0)
  const [micOn, setMicOn] = useState(true)
  const [cameraOn, setCameraOn] = useState(call.mediaType === 'video')
  const [screenOn, setScreenOn] = useState(false)
  const [soundOn, setSoundOn] = useState(true)
  const [translationOn, setTranslationOn] = useState(false)
  const [translationSheetOpen, setTranslationSheetOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const moreRef = useRef<HTMLDivElement>(null)
  const [mediaPermissionError, setMediaPermissionError] = useState('')
  const [permissionRetrying, setPermissionRetrying] = useState(false)
  const [callTargetLanguage, setCallTargetLanguage] = useState<string>(() => {
    const lang = targetLanguage.toLowerCase().split('-')[0]
    return lang === 'zh' ? 'zh-Hans' : lang === 'pt' ? 'pt-BR' : lang === 'tl' ? 'fil' : lang
  })
  const [translationError, setTranslationError] = useState('')
  const [translationRetryEpoch, setTranslationRetryEpoch] = useState(0)
  const [allowMyVoice, setAllowMyVoice] = useState(false)
  const [consentBusy, setConsentBusy] = useState(false)
  const [consentError, setConsentError] = useState('')
  const consentUpdating = useRef(false)
  const consentRevision = useRef(0)
  const [availableLanguages, setAvailableLanguages] = useState<string[]>([])
  const [consentRequested, setConsentRequested] = useState(false)
  const [remoteConsent, setRemoteConsent] = useState<Record<string, boolean>>({})
  const [translatingIds, setTranslatingIds] = useState<string[]>([])
  const [captions, setCaptions] = useState<CallCaption[]>([])
  const interpreters = useRef(new Map<string, InterpreterSession>())
  const interpreterPending = useRef(new Set<string>())
  useEffect(() => {
    let mounted = true
    request('/api/calls/translation/languages').then(async (response) => {
      if (!response.ok) return
      const body = await response.json() as { languages?: string[] }
      if (mounted && Array.isArray(body.languages)) {
        setAvailableLanguages(body.languages)
        if (!body.languages.includes(callTargetLanguage)) {
          setCallTargetLanguage(body.languages.includes(targetLanguage.split('-')[0]) ? targetLanguage.split('-')[0] : 'en')
        }
      }
    }).catch(() => undefined)
    return () => { mounted = false }
  }, [request])

  const languageOptions = useMemo(() => {
    const catalog = buildLanguageOptions(sourceLanguage)
    return availableLanguages.map((value) => {
      const option = catalog.find((item) => item.code === value.split('-')[0])
      const fallback = new Intl.DisplayNames([sourceLanguage], { type: 'language' }).of(value) || value
      return { value, label: (option?.flag || '🌐') + ' ' + (option?.localizedLanguage || fallback) +
        (value.includes('-') ? ' (' + value + ')' : '') + ' · ' + (option?.nativeLanguage || value) }
    }).sort((a,b) => a.label.localeCompare(b.label, sourceLanguage))
  }, [sourceLanguage, availableLanguages])

  const [ending, setEnding] = useState(false)

  useEffect(() => {
    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (moreOpen) setMoreOpen(false)
      else if (translationSheetOpen) setTranslationSheetOpen(false)
    }
    const closeMenuOutside = (event: PointerEvent) => {
      if (moreOpen && event.target instanceof Node && !moreRef.current?.contains(event.target)) {
        setMoreOpen(false)
      }
    }
    window.addEventListener('keydown', onEscape)
    window.addEventListener('pointerdown', closeMenuOutside)
    return () => {
      window.removeEventListener('keydown', onEscape)
      window.removeEventListener('pointerdown', closeMenuOutside)
    }
  }, [moreOpen, translationSheetOpen])

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

        try {
          await room.localParticipant.setMicrophoneEnabled(true)
          setMicOn(true)
        } catch (permissionError) {
          setMicOn(false)
          setMediaPermissionError(friendlyCallError(permissionError))
        }
        if (call.mediaType === 'video') {
          try {
            await room.localParticipant.setCameraEnabled(true)
            setCameraOn(true)
          } catch (permissionError) {
            setCameraOn(false)
            setMediaPermissionError(friendlyCallError(permissionError))
          }
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

  useEffect(() => {
    if (!room) return
    let cancelled = false
    const revisionAtLoad = consentRevision.current
    request(`/api/calls/${encodeURIComponent(call.id)}/translation-consent`).then(async (response) => {
      if (!response.ok) throw new Error('Không thể đọc quyền dịch giọng nói.')
      const data = await response.json() as { allowed: boolean }
      if (!cancelled && !consentUpdating.current && revisionAtLoad === consentRevision.current) setAllowMyVoice(data.allowed === true)
    }).catch(() => { if (!cancelled) setConsentError('Không thể kiểm tra quyền dịch giọng nói. Hãy thử lại hoặc tắt micro.') })
    return () => { cancelled = true }
  }, [room, call.id, request])

  async function updateVoiceConsent(allowed: boolean) {
    if (!room || consentUpdating.current) return
    consentUpdating.current = true
    consentRevision.current += 1
    setConsentBusy(true)
    setConsentError('')
    // Withdraw in the local UI immediately, before the backend responds.
    if (!allowed) setAllowMyVoice(false)
    try {
      const response = await request(`/api/calls/${encodeURIComponent(call.id)}/translation-consent`, {
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

  const participants = useMemo(() => {
    if (!room) return [] as Participant[]
    revision // Active tracks, participants and reconnections update the call UI.
    return [room.localParticipant, ...Array.from(room.remoteParticipants.values())]
  }, [revision, room])

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
  }, [room, allowMyVoice, translationOn])

  useEffect(() => {
    if (!room || !translationOn) return
    void room.localParticipant.publishData(
      new TextEncoder().encode(JSON.stringify({ type: 'request' })),
      { reliable: true, topic: CONSENT_TOPIC },
    ).catch(() => undefined)
  }, [room, translationOn])

  const remoteTracks = participants.flatMap((participant) =>
    participant === room?.localParticipant ? [] : Array.from(participant.audioTrackPublications.values())
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
          speakerId: id, track, callId: call.id, targetLanguage: callTargetLanguage, apiBase, request,
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
      } finally { interpreterPending.current.delete(id) }
    }))
    return () => { cancelled = true; stopAll(); setTranslatingIds([]) }
  // Stable stream IDs and consent data are the only topology dependencies.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room, phase, translationOn, call.id, callTargetLanguage, remoteTrackKey, remoteConsentKey, request, translationRetryEpoch, apiBase])

  useEffect(() => {
    if (!translationOn) {
      setCaptions([])
      setTranslationError('')
      setTranslationSheetOpen(false)
    }
  }, [translationOn])

  async function requestCallMediaPermission() {
    if (!room || permissionRetrying) return
    setPermissionRetrying(true)
    try {
      if (!micOn) {
        await room.localParticipant.setMicrophoneEnabled(true)
        setMicOn(true)
      }
      if (call.mediaType === 'video' && !cameraOn) {
        await room.localParticipant.setCameraEnabled(true)
        setCameraOn(true)
      }
      setMediaPermissionError('')
    } catch (err) {
      setMediaPermissionError(friendlyCallError(err))
    } finally {
      setPermissionRetrying(false)
    }
  }

  async function toggleMic() {
    if (!room) return
    try {
      const next = !micOn
      await room.localParticipant.setMicrophoneEnabled(next)
      setMicOn(next)
    } catch (err) { setMediaPermissionError(friendlyCallError(err)) }
  }

  async function toggleCamera() {
    if (!room) return
    try {
      const next = !cameraOn
      await room.localParticipant.setCameraEnabled(next)
      setCameraOn(next)
    } catch (err) { setMediaPermissionError(friendlyCallError(err)) }
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
        <header className="secure-call-topbar">
          <div className="call-heading">
            <div className="call-top-avatar" aria-hidden="true">{title.trim().slice(0, 1).toUpperCase()}</div>
            <div className="call-heading-copy">
              <strong>{title}</strong>
              <span className={`call-security-state phase-${phase}`} title={detail}>
                <ShieldCheck size={13} /> {statusLabel}
                <span className="call-top-separator">·</span>
                <Users size={13} /> {Math.max(1, participants.length)} người
              </span>
            </div>
          </div>
          <div className="secure-call-topmeta">
            {translationOn && (
              <button type="button" className="call-live-status" onClick={() => setTranslationSheetOpen(true)}
                aria-label="Mở phiên dịch đang hoạt động">
                <Sparkles size={14} /> <span>Đang dịch</span>
              </button>
            )}
            <span className="call-encrypted-chip" title="Cuộc gọi được mã hóa đầu cuối">
              <ShieldCheck size={15} /> E2EE
            </span>
          </div>
        </header>

        <div className={`call-main-layout ${translationOn && translationSheetOpen ? 'has-translation' : ''}`}>
          <section className="call-stage-media" aria-label="Người tham gia cuộc gọi">
            <div className={`secure-call-grid count-${Math.min(participants.length, 6)}`}>
              {participants.length === 0 ? (
                <div className="call-connecting-state">
                  <div className="call-secure-spinner" />
                  <ShieldCheck size={28} />
                  <strong>{phase === 'error' ? 'Không thể kết nối an toàn' : 'Đang kết nối cuộc gọi…'}</strong>
                  <span>{detail}</span>
                </div>
              ) : participants.map((participant) => (
                <ParticipantTile key={participant.identity} participant={participant} local={participant === room?.localParticipant} />
              ))}
            </div>
            {translationOn && latestCaption && (
              <div className="call-caption-overlay" aria-live="polite" aria-atomic="true">
                <div className="call-caption-overlay-speaker">
                  <Sparkles size={13} /> {identityLabel(latestCaption.speakerId)}
                </div>
                <strong>{latestCaption.translated}</strong>
              </div>
            )}
            {translationOn && !translationSheetOpen && (
              <button type="button" className="call-open-translation" onClick={() => setTranslationSheetOpen(true)}>
                <Languages size={16} /> Đang dịch · {callTargetLanguage} <ChevronDown size={15} />
              </button>
            )}
          </section>
          {translationOn && translationSheetOpen && (
            <aside className="call-live-panel" aria-label="Dịch trực tiếp">
              <div className="call-sheet-grabber" aria-hidden="true" />
              <header className="call-live-heading">
                <div className="call-live-title-icon"><Languages size={19} /></div>
                <div className="call-live-heading-copy">
                  <strong>Dịch trực tiếp</strong>
                  <small>Phụ đề và giọng dịch tự động</small>
                </div>
                <button type="button" aria-label="Thu gọn bảng dịch" onClick={() => setTranslationSheetOpen(false)}>
                  <ChevronDown size={20} />
                </button>
              </header>
              <div className="call-live-settings">
                <label htmlFor="call-translation-target">Nghe bằng ngôn ngữ</label>
                <div className="call-language-select">
                  <Languages size={16} />
                  <select id="call-translation-target" value={callTargetLanguage}
                    onChange={(event) => setCallTargetLanguage(event.target.value)}>
                    {languageOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                  <ChevronDown size={15} />
                </div>
                <div className="call-translation-state">
                  <span className={`call-translation-dot ${translatingIds.length ? 'is-live' : ''}`} />
                  <span>{translatingIds.length
                    ? `Đang nghe ${translatingIds.length} người`
                    : waitingConsentCount > 0 ? 'Đang chờ người tham gia cho phép' : 'Đang kết nối phiên dịch'}</span>
                </div>
              </div>
              {translationError && (
                <div className="call-live-error" role="alert">
                  <span>{translationError}</span>
                  <button type="button" onClick={() => { setTranslationError(''); setTranslationRetryEpoch((value) => value + 1) }}>Thử lại</button>
                </div>
              )}
              <div className="call-live-transcript" aria-live="polite">
                {captions.length === 0 ? (
                  <div className="call-live-placeholder">
                    <span className="call-live-placeholder-icon"><Sparkles size={25} /></span>
                    <strong>{translatingIds.length ? 'Đang lắng nghe…' : 'Dịch AI đã bật'}</strong>
                    <span>{waitingConsentCount > 0
                      ? 'Chờ người còn lại đồng ý dịch giọng nói trong cuộc gọi này.'
                      : 'Phụ đề sẽ hiển thị khi mọi người bắt đầu trò chuyện.'}</span>
                  </div>
                ) : captions.map((caption) => (
                  <div className="call-live-entry" key={caption.id}>
                    <div className="call-live-entry-user">
                      <span className="call-live-entry-avatar">{identityLabel(caption.speakerId).slice(0, 2)}</span>
                      <strong>{identityLabel(caption.speakerId)}</strong>
                    </div>
                    {caption.original && <p className="call-live-original">{caption.original}</p>}
                    {caption.translated && <p className="call-live-translated">{caption.translated}</p>}
                  </div>
                ))}
              </div>
              <footer className="call-live-footnote">
                <ShieldCheck size={14} /> Khi đồng ý, âm thanh người nói được giải mã trên thiết bị người nghe rồi gửi tới máy chủ ChatNet và Gemini để dịch.
              </footer>
            </aside>
          )}
        </div>
        {room && <RemoteAudioSinks room={room} muted={!soundOn}
          volume={translationOn && translatingIds.length ? 0.2 : 1} revision={revision} />}

        {translationOn && translationSheetOpen && (
          <button type="button" className="call-sheet-backdrop" aria-label="Thu gọn phụ đề" onClick={() => setTranslationSheetOpen(false)} />
        )}

        {mediaPermissionError && (
          <div className="call-permission-prompt" role="alert">
            <div className="call-notice-icon"><Mic size={18} /></div>
            <div className="call-notice-copy">
              <strong>Cần quyền micro{call.mediaType === 'video' ? ' / camera' : ''}</strong>
              <span>{mediaPermissionError} Nếu đã chặn, hãy bật quyền trong cài đặt trình duyệt.</span>
            </div>
            <button type="button" disabled={!room || permissionRetrying}
              onClick={() => void requestCallMediaPermission()}>
              {permissionRetrying ? 'Đang mở…' : 'Cấp quyền'}
            </button>
          </div>
        )}
        {consentError && <div className="call-global-error" role="alert">{consentError}</div>}
        {consentRequested && !allowMyVoice && (
          <div className="call-translation-consent-prompt" role="alert">
            <div className="call-notice-icon"><Sparkles size={18} /></div>
            <div className="call-notice-copy">
              <strong>Cho phép dịch giọng nói?</strong>
              <span>Chỉ áp dụng cuộc gọi này. Người nghe có thể gửi giọng nói của bạn tới máy chủ ChatNet và Google Gemini để dịch.</span>
            </div>
            <div className="call-consent-actions">
              <button type="button" disabled={consentBusy} onClick={() => void updateVoiceConsent(true)}>{consentBusy ? 'Đang lưu…' : 'Cho phép'}</button>
              <button type="button" className="call-consent-decline" disabled={consentBusy} onClick={() => setConsentRequested(false)}>Để sau</button>
            </div>
          </div>
        )}

        <footer className="secure-call-controls">
          <div className="call-primary-controls">
            <button type="button" className={!micOn ? 'is-off' : ''} disabled={!room || ending}
              aria-label={micOn ? 'Tắt micro' : 'Bật micro'} aria-pressed={!micOn}
              onClick={() => void toggleMic()}>
              {micOn ? <Mic /> : <MicOff />}<span>{micOn ? 'Mic' : 'Tắt mic'}</span>
            </button>
            <button type="button" className={!cameraOn ? 'is-off' : ''} disabled={!room || ending}
              aria-label={cameraOn ? 'Tắt camera' : 'Bật camera'} aria-pressed={!cameraOn}
              onClick={() => void toggleCamera()}>
              {cameraOn ? <Video /> : <VideoOff />}<span>Camera</span>
            </button>
            <button type="button" className={translationOn ? 'is-on call-ai-action' : 'call-ai-action'}
              disabled={!room || ending} aria-pressed={translationOn} title="Bật hoặc tắt dịch trực tiếp"
              onClick={toggleTranslation}>
              <Languages /><span>{translationOn ? 'Đang dịch' : 'Dịch AI'}</span>
            </button>
            <div className="call-more-wrapper" ref={moreRef}>
              <button type="button" aria-label="Thêm tùy chọn cuộc gọi" aria-expanded={moreOpen}
                disabled={!room || ending} onClick={() => setMoreOpen((value) => !value)}>
                <MoreHorizontal /><span>Thêm</span>
              </button>
              {moreOpen && (
                <div className="call-more-popover">
                  <button type="button" onClick={() => { setMoreOpen(false); void toggleScreen() }}>
                    {screenOn ? <MonitorX size={17} /> : <MonitorUp size={17} />} {screenOn ? 'Dừng chia sẻ màn hình' : 'Chia sẻ màn hình'}
                  </button>
                  <button type="button" onClick={() => { setMoreOpen(false); void toggleSound() }}>
                    {soundOn ? <Volume2 size={17} /> : <VolumeX size={17} />} {soundOn ? 'Tắt loa' : 'Bật loa'}
                  </button>
                  {translationOn && (
                    <button type="button" onClick={() => { setMoreOpen(false); setTranslationSheetOpen(true) }}>
                      <Languages size={17} /> Mở phụ đề dịch
                    </button>
                  )}
                  <button type="button" disabled={consentBusy} onClick={() => {
                    setMoreOpen(false)
                    void updateVoiceConsent(!allowMyVoice)
                  }}>
                    <Settings2 size={17} /> {allowMyVoice ? 'Thu hồi quyền AI dịch giọng nói' : 'Cho phép AI dịch giọng nói'}
                  </button>
                </div>
              )}
            </div>
            <button type="button" className="hangup-button" disabled={ending} onClick={() => void closeCall(canEnd)}>
              <PhoneOff /><span>{canEnd ? 'Kết thúc' : 'Rời'}</span>
            </button>
          </div>
        </footer>
      </div>
    </div>
  )
}

function appendCallCaption(current: CallCaption[], update: InterpreterUpdate): CallCaption[] {
  const text = (update.translated || update.original || '').trim()
  if (!text) return current
  const now = Date.now()
  const previous = current.at(-1)
  if (previous && previous.speakerId === update.speakerId && now - previous.updatedAt < 3500) {
    const field = update.translated ? 'translated' : 'original'
    const last = previous[field]
    const nextText = text.startsWith(last) ? text : (last ? last + ' ' : '') + text
    return [...current.slice(0, -1), { ...previous, [field]: nextText.slice(-1200), updatedAt: now }]
  }
  return [...current, {
    id: crypto.randomUUID(),
    speakerId: update.speakerId,
    original: update.original || '',
    translated: update.translated || '',
    updatedAt: now,
  }].slice(-80)
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
    <div className={`call-participant-tile ${screen?.track ? 'screen-tile' : ''} ${participant.isSpeaking ? 'is-speaking' : ''}`}>
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

function RemoteAudioSinks({ room, muted, volume, revision }: { room: Room; muted: boolean; volume: number; revision: number }) {
  revision
  const tracks = Array.from(room.remoteParticipants.values()).flatMap((participant) =>
    Array.from(participant.audioTrackPublications.values()).filter((publication) => publication.track),
  )
  return <>{tracks.map((publication) => <AudioTrackSink key={publication.trackSid} publication={publication} muted={muted} volume={volume} />)}</>
}

function AudioTrackSink({ publication, muted, volume }: { publication: TrackPublication; muted: boolean; volume: number }) {
  const ref = useRef<HTMLAudioElement>(null)
  useEffect(() => {
    if (ref.current) ref.current.volume = volume
  }, [volume])
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