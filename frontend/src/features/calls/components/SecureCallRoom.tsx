import { useEffect, useMemo, useRef, useState } from 'react'
import type { Participant } from 'livekit-client'
import { Languages, Mic, ShieldCheck, Sparkles, ChevronDown } from 'lucide-react'
import { endCall, leaveCall, type CallRequest, type CallSession } from '../lib/calls'
import type { InterpreterSession } from '../lib/callMediaInterpreter'
import { RemoteAudioSinks } from './CallMediaTracks'
import { CallGroupPanel, CallTranslationPanel } from './CallRoomPanels'
import CallRoomNotices from './CallRoomNotices'
import CallRoomControls from './CallRoomControls'
import { CallRoomTopbar, CallRoomMediaStage } from './CallRoomStage'
import type { CallCaption } from '../lib/callCaptions'
import { friendlyCallError } from '../lib/callErrors'
import { deriveCallRoomDisplay } from '../lib/callRoomDisplay'
import { useCallMediaControls } from '../hooks/useCallMediaControls'
import { useCallLanguages } from '../hooks/useCallLanguages'
import { useCallOverlayDismiss } from '../hooks/useCallOverlayDismiss'
import { useCallVoiceConsent } from '../hooks/useCallVoiceConsent'
import { useCallRemoteConsent } from '../hooks/useCallRemoteConsent'
import { useCallInterpreterSessions } from '../hooks/useCallInterpreterSessions'
import { useCallRoomLifecycle, type RoomRuntime } from '../hooks/useCallRoomLifecycle'

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
  useCallRoomLifecycle({
    call, request, userId, autoPublish, onError, onClosed,
    setPhase, setDetail, setRuntime, setRevision, setMicOn, setCameraOn,
    setScreenOn, setMediaPermissionError,
  })

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