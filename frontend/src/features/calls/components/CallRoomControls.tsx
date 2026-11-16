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
  return (
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
            {isGroup && <button type="button" className={participantsSheetOpen && !translationSheetOpen ? 'is-on' : ''}
              aria-label="Xem người tham gia" aria-pressed={participantsSheetOpen && !translationSheetOpen}
              onClick={() => {
                if (translationOn && translationSheetOpen) { setTranslationSheetOpen(false); setParticipantsSheetOpen(true) }
                else setParticipantsSheetOpen((current) => !current)
              }}>
              <Users /><span>Thành viên</span>
            </button>}
            <div className="call-more-wrapper" ref={moreRef}>
              <button type="button" aria-label="Thêm tùy chọn cuộc gọi" aria-expanded={moreOpen}
                disabled={!room || ending} onClick={() => setMoreOpen((value) => !value)}>
                <MoreHorizontal /><span>Thêm</span>
              </button>
              {moreOpen && (
                <div className="call-more-popover">
                  {isDesktopBuild && room && <CallDeviceSettings room={room} micOn={micOn} cameraOn={cameraOn} />}
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
  )
}
