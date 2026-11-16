import { Check, SmilePlus, X } from 'lucide-react'
import { POST_FEELINGS, feelingPostLine } from '../utils/feelings'

export default function PostFeelingPicker({ feelingPickerOpen, feelingId, disabled, onClose, onSelect, onClear }: {
  feelingPickerOpen: boolean
  feelingId: string
  disabled: boolean
  onClose: () => void
  onSelect: (id: string) => void
  onClear: () => void
}) {
  const feelingText = feelingPostLine(feelingId)
  return (
    <section className="smart-feeling-picker" aria-label="Cảm xúc của bạn">
      <header className="smart-feeling-heading">
        <strong><SmilePlus size={17} aria-hidden="true" /> Bạn đang cảm thấy thế nào?</strong>
        <button type="button" disabled={disabled} aria-label="Đóng chọn cảm xúc" onClick={onClose}><X size={17} aria-hidden="true" /></button>
      </header>
      {feelingText && <div className="smart-feeling-selected">
        <span>{feelingText}</span>
        <button type="button" disabled={disabled} aria-label="Bỏ cảm xúc đã chọn" onClick={onClear}><X size={15} aria-hidden="true" /></button>
      </div>}
      {feelingPickerOpen && <div className="smart-feeling-options" role="group" aria-label="Chọn cảm xúc">
        {POST_FEELINGS.map(feeling => (
          <button key={feeling.id} type="button" disabled={disabled} aria-pressed={feelingId === feeling.id}
            onClick={() => onSelect(feeling.id)}>
            <span aria-hidden="true">{feeling.emoji}</span>
            <span>{feeling.label}</span>
            {feelingId === feeling.id && <Check size={15} aria-hidden="true" />}
          </button>
        ))}
      </div>}
    </section>
  )
}
