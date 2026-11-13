import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { isE2EESupported } from 'livekit-client'
import { ShieldCheck, X } from 'lucide-react'
import {
  createCall, declineCall, getCurrentCalls,
  type CallMediaType, type CallRealtimeEvent, type CallRequest, type CallSession, type CallView,
} from '../lib/calls'
import { isDesktopBuild } from '../../../platform/desktop'
import { requireDesktopMedia } from '../../../platform/desktopMedia'
import IncomingCallDialog from './IncomingCallDialog'
import SecureCallRoom from './SecureCallRoom'
import type { CallLaunchDetail } from './CallHeaderActions'
import { notifyDesktopCall, dismissDesktopCall } from '../../notifications/lib/desktopCallNotifications'
import { friendlyCallError } from '../lib/callErrors'
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
  const refreshGeneration = useRef(0)
  const refreshSequence = useRef(0)
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
    const generation = refreshGeneration.current
    const sequence = ++refreshSequence.current
    try {
      const calls = await getCurrentCalls(callRequest)
      // An older response must not undo a newer SSE refresh or a session change.
      if (generation !== refreshGeneration.current || sequence !== refreshSequence.current) return
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
      refreshGeneration.current += 1
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
