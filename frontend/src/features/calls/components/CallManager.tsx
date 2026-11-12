import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ExternalE2EEKeyProvider,
  isE2EESupported,
  Room,
  RoomEvent,
  type Participant,
  type RemoteTrack,
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
} from '../lib/calls'
import {
  generateEphemeralCallKeyPair, generateKeyGeneration, generateMediaKey,
  mediaKeyBuffer, unwrapMediaKey, wrapMediaKey, type EphemeralCallKeyPair,
} from '../lib/callCrypto'
import { startCallMediaInterpreter, type InterpreterSession, type InterpreterUpdate } from '../lib/callMediaInterpreter'
import { buildLanguageOptions } from '../../i18n/utils/languages'
import { isDesktopBuild } from '../../../platform/desktop'
import { requireDesktopMedia } from '../../../platform/desktopMedia'
import CallDeviceSettings from './CallDeviceSettings'
import { ParticipantTile, RemoteAudioSinks, identityLabel } from './CallMediaTracks'
import { CallGroupPanel, CallTranslationPanel } from './CallRoomPanels'
import IncomingCallDialog from './IncomingCallDialog'
import CallRoomNotices from './CallRoomNotices'
import CallRoomControls from './CallRoomControls'
import { CallRoomTopbar, CallRoomMediaStage } from './CallRoomStage'
import { appendCallCaption, type CallCaption } from '../lib/callCaptions'
import { waitForEnvelope } from '../lib/waitForCallEnvelope'
import type { CallLaunchDetail } from './CallHeaderActions'
import UserAvatar from '../../../shared/ui/UserAvatar'
import { notifyDesktopCall, dismissDesktopCall } from '../../chat/hooks/useDesktopNotifications'
import '../styles/call.css'

type ConversationLite = { id: number; name: string; type: 'direct' | 'group'; otherUsername?: string; blocked?: boolean }

type CallManagerProps = {
  request: CallRequest
  apiBase: string
  token: string
  sessionId?: string
  userId: number
  sourceLanguage: string
  targetLanguage: string
  conversations: ConversationLite[]
}

const CONSENT_TOPIC = 'chatnet.call.translation.consent.v1'
export { default as CallHeaderActions } from './CallHeaderActions'

export default function CallManager({
  request, apiBase, token, sessionId, userId, sourceLanguage, targetLanguage, conversations,
}: CallManagerProps) {
  const [incoming, setIncoming] = useState<CallView | null>(null)
  const [active, setActive] = useState<CallView | CallSession | null>(null)
  const [busy, setBusy] = useState(false)
  const userActivatedCall = useRef<string | null>(null)
  const [error, setError] = useState('')
  const [incomingPermission, setIncomingPermission] = useState('')
  const requestRef = useRef(request)
  requestRef.current = request
  const callRequest = useCallback<CallRequest>((path, init) => requestRef.current(path, init), [])

  useEffect(() => {
    if (!isDesktopBuild || !sessionId || !incoming) return
    // Defer one tick so StrictMode setup/cleanup cannot consume dedupe before the live effect.
    const timer = window.setTimeout(() => notifyDesktopCall(sessionId, incoming), 0)
    return () => { window.clearTimeout(timer); dismissDesktopCall(sessionId, incoming.id) }
  }, [incoming?.id, sessionId])

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
    const onCallEvent = (event: MessageEvent) => {
      try {
        const payload = JSON.parse(event.data) as CallRealtimeEvent
        if (!payload.type?.startsWith('call.')) return
        if (payload.type === 'call.ended') {
          if (payload.callId === incoming?.id) setIncoming(null)
          if (payload.callId === active?.id) setActive(null)
          return
        }
        if (payload.type === 'call.created' || payload.type === 'call.updated') void refresh()
      } catch {
        // Ignore unrelated SSE payloads.
      }
    }
    // Chat sends named "update" events, not default "message" events.
    source.addEventListener('update', onCallEvent)
    source.onmessage = onCallEvent
    source.onopen = () => void refresh()
    // Recover missed ringing calls after SSE disconnects or background-tab suspension.
    const poll = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refresh()
    }, 10000)
    const onFocus = () => void refresh()
    window.addEventListener('focus', onFocus)
    return () => {
      window.clearInterval(poll)
      window.removeEventListener('focus', onFocus)
      source.close()
    }
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
    if (conversationMap.get(conversationId)?.blocked) {
      setError('Không thể gọi khi cuộc hội thoại bị chặn.')
      return
    }
    setBusy(true)
    setError('')
    try {
      if (!window.isSecureContext || !isE2EESupported()) {
        throw new Error('Trình duyệt này chưa hỗ trợ cuộc gọi E2EE an toàn.')
      }
      // The lookup is best effort: a temporary read error must not prevent creating a call.
      const available = await getCurrentCalls(callRequest).catch(() => [] as CallView[])
      const existing = available.find((item) =>
        item.conversationId === conversationId && (item.status === 'ringing' || item.status === 'active'))
      if (existing) {
        await joinExistingCall(existing)
        return
      }
      await requireDesktopMedia('microphone')
      if (mediaType === 'video') await requireDesktopMedia('camera')
      try {
        const call = await createCall(callRequest, conversationId, mediaType)
        userActivatedCall.current = call.id
        setIncoming(null)
        setActive(call)
      } catch (cause) {
        // Another participant can create the room between the lookup and POST.
        if (!(cause instanceof Error) || !cause.message.includes('already has an active call')) throw cause
        const concurrent = (await getCurrentCalls(callRequest)).find((item) =>
          item.conversationId === conversationId && (item.status === 'ringing' || item.status === 'active'))
        if (!concurrent) throw cause
        await joinExistingCall(concurrent)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể bắt đầu cuộc gọi.')
    } finally {
      setBusy(false)
    }
  }

  async function joinExistingCall(call: CallView) {
    if (!call.configured) throw new Error('Máy chủ gọi video chưa được cấu hình.')
    if (!window.isSecureContext || !isE2EESupported()) throw new Error('Thiết bị này chưa hỗ trợ E2EE WebRTC.')
    await requireDesktopMedia('microphone')
    if (call.mediaType === 'video') await requireDesktopMedia('camera')
    userActivatedCall.current = call.id
    setActive(call)
    setIncoming(null)
  }

  async function acceptIncoming() {
    if (!incoming || busy) return
    setBusy(true)
    setError('')
    try {
      await joinExistingCall(incoming)
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

  async function checkIncomingPermission(kind: 'camera' | 'microphone') {
    if (busy) return
    setIncomingPermission('')
    setBusy(true)
    try {
      await requireDesktopMedia(kind)
      const stream = await navigator.mediaDevices.getUserMedia(
        kind === 'camera' ? { video: true, audio: false } : { audio: true, video: false }
      )
      stream.getTracks().forEach((track) => track.stop())
      setIncomingPermission(kind === 'camera' ? 'Camera đã được cấp quyền.' : 'Microphone đã được cấp quyền.')
    } catch (cause) {
      setIncomingPermission(friendlyCallError(cause))
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
        <IncomingCallDialog incoming={incoming} incomingName={incomingName}
          otherUsername={conversationMap.get(incoming.conversationId)?.otherUsername}
          isGroup={conversationMap.get(incoming.conversationId)?.type === 'group'}
          busy={busy} incomingPermission={incomingPermission}
          rejectIncoming={() => void rejectIncoming()} acceptIncoming={() => void acceptIncoming()}
          checkIncomingPermission={(kind) => void checkIncomingPermission(kind)} />
      )}

      {active && (
        <SecureCallRoom
          call={active}
          isGroup={conversationMap.get(active.conversationId)?.type === 'group'}
          autoPublish={!isDesktopBuild || userActivatedCall.current === active.id}
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

function SecureCallRoom({
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
  const [callTargetLanguage, setCallTargetLanguage] = useState<string>(() => {
    const lang = (localStorage.getItem('chatnet.call.target-language.v1') || targetLanguage).toLowerCase().split('-')[0]
    return lang === 'zh' ? 'zh-Hans' : lang === 'pt' ? 'pt-BR' : lang === 'tl' ? 'fil' : lang
  })
  const [captionMode] = useState(() => localStorage.getItem('chatnet.call.subtitle-mode.v1') || 'both')
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
    if (!room || permissionRetrying || ending) return
    setPermissionRetrying(true)
    try {
      if (!micOn) {
        await requireDesktopMedia('microphone')
        if (room.state !== 'connected') return
        await room.localParticipant.setMicrophoneEnabled(true)
        setMicOn(true)
      }
      if (call.mediaType === 'video' && !cameraOn) {
        await requireDesktopMedia('camera')
        if (room.state !== 'connected') return
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
    if (!room || ending || permissionRetrying) return
    setPermissionRetrying(true)
    try {
      const next = !micOn
      if (next) await requireDesktopMedia('microphone')
      if (next && room.state !== 'connected') return
      await room.localParticipant.setMicrophoneEnabled(next)
      setMicOn(next)
      setMediaPermissionError('')
    } catch (err) { setMediaPermissionError(friendlyCallError(err)) }
    finally { setPermissionRetrying(false) }
  }

  async function toggleCamera() {
    if (!room || ending || permissionRetrying) return
    setPermissionRetrying(true)
    try {
      const next = !cameraOn
      if (next) await requireDesktopMedia('camera')
      if (next && room.state !== 'connected') return
      await room.localParticipant.setCameraEnabled(next)
      setCameraOn(next)
      setMediaPermissionError('')
    } catch (err) { setMediaPermissionError(friendlyCallError(err)) }
    finally { setPermissionRetrying(false) }
  }

  async function toggleScreen() {
    if (!room || ending) return
    try {
      const next = !screenOn
      // Desktop grants video only; system audio is not implicitly shared.
      await room.localParticipant.setScreenShareEnabled(next, isDesktopBuild ? { audio: false } : undefined)
      setScreenOn(room.localParticipant.isScreenShareEnabled)
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

function friendlyCallError(error: unknown) {
  if (error instanceof DOMException) {
    if (error.name === 'NotAllowedError') return 'Quyền camera/microphone bị từ chối. Hãy cho phép quyền rồi thử lại.'
    if (error.name === 'NotFoundError') return 'Không tìm thấy camera hoặc microphone phù hợp.'
  }
  if (error instanceof Error && error.message) return error.message
  return 'Không thể thiết lập cuộc gọi an toàn.'
}