import { Check, SmilePlus, X } from 'lucide-react'
import { useState } from 'react'
import { POST_FEELINGS } from '../utils/feelings'

export default function PostFeelingPicker({ feelingPickerOpen, feelingId, disabled, onClose, onSelect, onClear }: {
  feelingPickerOpen: boolean
  feelingId: string
  disabled: boolean
  onClose: () => void
  onSelect: (id: string) => void
  onClear: () => void
}) {
  const selected = POST_FEELINGS.find(feeling => feeling.id === feelingId)
  const [selectionRun, setSelectionRun] = useState(0)
  return (
    <section className="smart-feeling-picker" aria-label="Cảm xúc của bạn">
      <header className="smart-feeling-heading">
        <strong><SmilePlus size={17} aria-hidden="true" /> Bạn đang cảm thấy thế nào?</strong>
        <button type="button" disabled={disabled} aria-label="Đóng chọn cảm xúc" onClick={onClose}><X size={17} aria-hidden="true" /></button>
      </header>
      {selected && <div className="smart-feeling-selected">
        <span><span key={`${selected.id}:${selectionRun}`} className="smart-feeling-emoji" data-feeling={selected.id} aria-hidden="true">{selected.emoji}</span> Đang cảm thấy {selected.label}</span>
        <button type="button" disabled={disabled} aria-label="Bỏ cảm xúc đã chọn" onClick={onClear}><X size={15} aria-hidden="true" /></button>
      </div>}
      {feelingPickerOpen && <div className="smart-feeling-options" role="group" aria-label="Chọn cảm xúc">
        {POST_FEELINGS.map(feeling => (
          <button key={feeling.id} type="button" disabled={disabled} aria-pressed={feelingId === feeling.id}
            onClick={() => { setSelectionRun(run => run + 1); onSelect(feeling.id) }}>
            <span className="smart-feeling-emoji" data-feeling={feeling.id} aria-hidden="true">{feeling.emoji}</span>
            <span>{feeling.label}</span>
            {feelingId === feeling.id && <Check size={15} aria-hidden="true" />}
          </button>
        ))}
      </div>}
    </section>
  )
}