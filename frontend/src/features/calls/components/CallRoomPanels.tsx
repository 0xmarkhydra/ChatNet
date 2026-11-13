import { type Dispatch, type SetStateAction } from 'react'
import { type Participant } from 'livekit-client'
import { ChevronDown, Languages, Mic, Settings2, ShieldCheck, Sparkles, Volume2 } from 'lucide-react'
import type { CallCaption } from '../lib/callCaptions'
import { identityLabel } from './CallMediaTracks'

type CallGroupPanelProps = {
  participants: Participant[]
  localParticipant?: Participant
  translationOn: boolean
  toggleTranslation: () => void
  setTranslationSheetOpen: Dispatch<SetStateAction<boolean>>
}

export function CallGroupPanel({ participants, localParticipant, translationOn, toggleTranslation, setTranslationSheetOpen }: CallGroupPanelProps) {
  return (
<aside className="call-group-panel" aria-label="Người tham gia cuộc gọi nhóm">
              <header><strong>Người tham gia</strong><span>{participants.length} người đang kết nối</span></header>
              <div className="call-group-members">
                {participants.length === 0 ? <p>Đang kết nối với phòng gọi…</p> : participants.map((participant) => (
                  <div key={participant.identity} className="call-group-member">
                    <span className="call-group-member-avatar">{participant === localParticipant ? 'B' : identityLabel(participant.identity).slice(0, 2)}</span>
                    <span><strong>{participant === localParticipant ? 'Bạn' : identityLabel(participant.identity)}</strong><small>{participant.isSpeaking ? 'Đang nói' : 'Đang nghe'}</small></span>
                    {participant.isSpeaking ? <Volume2 size={17} /> : <Mic size={17} />}
                  </div>
                ))}
              </div>
              <footer>
                <strong><Languages size={17} /> Dịch AI {translationOn ? 'đã bật' : 'đang tắt'}</strong>
                <button type="button" onClick={() => { if (!translationOn) toggleTranslation(); else setTranslationSheetOpen(true) }}>
                  <Settings2 size={15} /> {translationOn ? 'Xem bản dịch' : 'Thiết lập dịch'}
                </button>
              </footer>
            </aside>
  )
}

type CallTranslationPanelProps = {
  callTargetLanguage: string
  languageOptions: { value: string; label: string }[]
  translatingIds: string[]
  waitingConsentCount: number
  translationError: string
  captions: CallCaption[]
  captionMode: string
  setTranslationSheetOpen: Dispatch<SetStateAction<boolean>>
  setCallTargetLanguage: Dispatch<SetStateAction<string>>
  setTranslationError: Dispatch<SetStateAction<string>>
  setTranslationRetryEpoch: Dispatch<SetStateAction<number>>
}

export function CallTranslationPanel({ callTargetLanguage, languageOptions, translatingIds, waitingConsentCount, translationError, captions, captionMode, setTranslationSheetOpen, setCallTargetLanguage, setTranslationError, setTranslationRetryEpoch }: CallTranslationPanelProps) {
  return (
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
                    {captionMode === 'both' && caption.original && <p className="call-live-original">{caption.original}</p>}
                    {caption.translated && <p className="call-live-translated">{caption.translated}</p>}
                  </div>
                ))}
              </div>
              <footer className="call-live-footnote">
                <ShieldCheck size={14} /> Khi đồng ý, âm thanh người nói được giải mã trên thiết bị người nghe rồi gửi tới máy chủ ChatNet và Gemini để dịch.
              </footer>
            </aside>
  )
}
