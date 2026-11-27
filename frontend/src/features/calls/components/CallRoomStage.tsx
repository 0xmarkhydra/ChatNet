import { useUiTranslation } from '@/shared/i18n/locale'
import { type Dispatch, type SetStateAction } from 'react'
import { type Participant } from 'livekit-client'
import { ChevronDown, Languages, ShieldCheck, Sparkles, Users } from 'lucide-react'
import type { CallCaption } from '../lib/callCaptions'
import { ParticipantTile, identityLabel } from './CallMediaTracks'

type CallRoomTopbarProps = {
  title: string
  phase: string
  detail: string
  statusLabel: string
  participantCount: number
  translationOn: boolean
  setTranslationSheetOpen: Dispatch<SetStateAction<boolean>>
}

export function CallRoomTopbar({ title, phase, detail, statusLabel, participantCount, translationOn, setTranslationSheetOpen }: CallRoomTopbarProps) {
  const trUi = useUiTranslation()

  return (
        <header className="secure-call-topbar">
          <div className="call-heading">
            <div className="call-top-avatar" aria-hidden="true">{title.trim().slice(0, 1).toUpperCase()}</div>
            <div className="call-heading-copy">
              <strong>{title}</strong>
              <span className={`call-security-state phase-${phase}`} title={detail}>
                <ShieldCheck size={13} /> {statusLabel}
                <span className="call-top-separator">·</span>
                <Users size={13} /> {Math.max(1, participantCount)} người
              </span>
            </div>
          </div>
          <div className="secure-call-topmeta">
            {translationOn && (
              <button type="button" className="call-live-status" onClick={() => setTranslationSheetOpen(true)}
                aria-label={trUi("common.ui.openInterpreter")}>
                <Sparkles size={14} /> <span>{trUi("calls.translating")}</span>
              </button>
            )}
            <span className="call-encrypted-chip" title={trUi("calls.encrypted")}>
              <ShieldCheck size={15} /> E2EE
            </span>
          </div>
        </header>
  )
}

type CallRoomMediaStageProps = {
  participants: Participant[]
  localParticipant?: Participant
  phase: string
  detail: string
  translationOn: boolean
  translationSheetOpen: boolean
  latestCaption?: CallCaption
  callTargetLanguage: string
  setTranslationSheetOpen: Dispatch<SetStateAction<boolean>>
}

export function CallRoomMediaStage({ participants, localParticipant, phase, detail, translationOn, translationSheetOpen, latestCaption, callTargetLanguage, setTranslationSheetOpen }: CallRoomMediaStageProps) {
  const trUi = useUiTranslation()

  return (
          <section className="call-stage-media" aria-label={trUi("calls.callParticipants")}>
            <div className={`secure-call-grid count-${Math.min(participants.length, 6)}`}>
              {participants.length === 0 ? (
                <div className="call-connecting-state">
                  <div className="call-secure-spinner" />
                  <ShieldCheck size={28} />
                  <strong>{phase === 'error' ? trUi("calls.secureConnectionFailed") : trUi("calls.connecting")}</strong>
                  <span>{detail}</span>
                </div>
              ) : participants.map((participant) => (
                <ParticipantTile key={participant.identity} participant={participant} local={participant === localParticipant} />
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
  )
}
