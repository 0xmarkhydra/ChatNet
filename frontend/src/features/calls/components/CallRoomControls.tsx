import { useUiTranslation } from '@/shared/i18n/locale'
import { type Dispatch, type RefObject, type SetStateAction } from 'react'
import { type Room } from 'livekit-client'
import { Languages, Mic, MicOff, MonitorUp, MonitorX, PhoneOff, Users, Video, VideoOff, Volume2, VolumeX, MoreHorizontal, Settings2 } from 'lucide-react'
import { isDesktopBuild } from '../../../platform/desktop'
import CallDeviceSettings from './CallDeviceSettings'

type CallRoomControlsProps = {
  room?: Room
  ending: boolean
  micOn: boolean
  cameraOn: boolean
  screenOn: boolean
  soundOn: boolean
  translationOn: boolean
  isGroup: boolean
  participantsSheetOpen: boolean
  translationSheetOpen: boolean
  moreRef: RefObject<HTMLDivElement | null>
  moreOpen: boolean
  consentBusy: boolean
  allowMyVoice: boolean
  canEnd: boolean
  toggleMic: () => void
  toggleCamera: () => void
  toggleScreen: () => void
  toggleSound: () => void
  toggleTranslation: () => void
  closeCall: (endForEveryone: boolean) => void
  updateVoiceConsent: (allowed: boolean) => void
  setMoreOpen: Dispatch<SetStateAction<boolean>>
  setTranslationSheetOpen: Dispatch<SetStateAction<boolean>>
  setParticipantsSheetOpen: Dispatch<SetStateAction<boolean>>
}

export default function CallRoomControls({ room, ending, micOn, cameraOn, screenOn, soundOn, translationOn, isGroup, participantsSheetOpen, translationSheetOpen, moreRef, moreOpen, consentBusy, allowMyVoice, canEnd, toggleMic, toggleCamera, toggleScreen, toggleSound, toggleTranslation, closeCall, updateVoiceConsent, setMoreOpen, setTranslationSheetOpen, setParticipantsSheetOpen }: CallRoomControlsProps) {
  const trUi = useUiTranslation()

  return (
        <footer className="secure-call-controls">
          <div className="call-primary-controls">
            <button type="button" className={!micOn ? 'is-off' : ''} disabled={!room || ending}
              aria-label={micOn ? trUi("calls.micOff") : trUi("calls.micOn")} aria-pressed={!micOn}
              onClick={() => void toggleMic()}>
              {micOn ? <Mic /> : <MicOff />}<span>{micOn ? 'Mic' : trUi("calls.micMute")}</span>
            </button>
            <button type="button" className={!cameraOn ? 'is-off' : ''} disabled={!room || ending}
              aria-label={cameraOn ? trUi("calls.cameraOff") : trUi("calls.cameraOn")} aria-pressed={!cameraOn}
              onClick={() => void toggleCamera()}>
              {cameraOn ? <Video /> : <VideoOff />}<span>Camera</span>
            </button>
            <button type="button" className={translationOn ? 'is-on call-ai-action' : 'call-ai-action'}
              disabled={!room || ending} aria-pressed={translationOn} title={trUi("common.ui.toggleLiveTranslation")}
              onClick={toggleTranslation}>
              <Languages /><span>{translationOn ? trUi("calls.translating") : trUi("chat.aiTranslation")}</span>
            </button>
            {isGroup && <button type="button" className={participantsSheetOpen && !translationSheetOpen ? 'is-on' : ''}
              aria-label={trUi("calls.participantsView")} aria-pressed={participantsSheetOpen && !translationSheetOpen}
              onClick={() => {
                if (translationOn && translationSheetOpen) { setTranslationSheetOpen(false); setParticipantsSheetOpen(true) }
                else setParticipantsSheetOpen((current) => !current)
              }}>
              <Users /><span>{trUi("chat.members")}</span>
            </button>}
            <div className="call-more-wrapper" ref={moreRef}>
              <button type="button" aria-label={trUi("common.ui.moreCallOptions")} aria-expanded={moreOpen}
                disabled={!room || ending} onClick={() => setMoreOpen((value) => !value)}>
                <MoreHorizontal /><span>{trUi("common.more")}</span>
              </button>
              {moreOpen && (
                <div className="call-more-popover">
                  {isDesktopBuild && room && <CallDeviceSettings room={room} micOn={micOn} cameraOn={cameraOn} />}
                  <button type="button" onClick={() => { setMoreOpen(false); void toggleScreen() }}>
                    {screenOn ? <MonitorX size={17} /> : <MonitorUp size={17} />} {screenOn ? trUi("calls.stopScreenShare") : trUi("calls.shareScreen")}
                  </button>
                  <button type="button" onClick={() => { setMoreOpen(false); void toggleSound() }}>
                    {soundOn ? <Volume2 size={17} /> : <VolumeX size={17} />} {soundOn ? trUi("calls.speakerOff") : trUi("calls.speakerOn")}
                  </button>
                  {translationOn && (
                    <button type="button" onClick={() => { setMoreOpen(false); setTranslationSheetOpen(true) }}>
                      <Languages size={17} />{trUi("calls.openSubtitles")}</button>
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
              <PhoneOff /><span>{canEnd ? trUi("calls.end") : trUi("calls.leave")}</span>
            </button>
          </div>
        </footer>
  )
}
