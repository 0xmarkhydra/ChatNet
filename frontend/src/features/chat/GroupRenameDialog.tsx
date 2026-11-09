import { useEffect, useRef, useState, type FormEvent } from 'react'
import { X } from 'lucide-react'
import UserAvatar from '../../shared/ui/UserAvatar'
import './group-rename-dialog.css'

type Props = {
  currentName: string
  draft: string
  onDraftChange: (value: string) => void
  onConfirm: () => Promise<boolean>
  onClose: () => void
  busy: boolean
}

export default function GroupRenameDialog({ currentName, draft, onDraftChange, onConfirm, onClose, busy }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [submitting, setSubmitting] = useState(false)
  const trimmedName = draft.trim()
  const tooLong = new TextEncoder().encode(trimmedName).length > 120
  const invalid = !trimmedName || tooLong
  const unchanged = trimmedName === currentName

  useEffect(() => {
    const node = dialogRef.current
    if (!node) return
    if (!node.open) node.showModal()
    inputRef.current?.focus()
    inputRef.current?.select()
    return () => { if (node.open) node.close() }
  }, [])

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (submitting || busy || invalid) return
    if (unchanged) { onClose(); return }
    setSubmitting(true)
    try {
      if (await onConfirm()) onClose()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <dialog ref={dialogRef} className="group-rename-dialog"
      aria-labelledby="group-rename-title" aria-describedby="group-rename-description"
      onCancel={(event) => { event.preventDefault(); if (!submitting && !busy) onClose() }}
      onKeyDown={(event) => { if (event.key === 'Escape') event.stopPropagation() }}
      onClick={(event) => { if (event.target === dialogRef.current && !submitting && !busy) onClose() }}>
      <header className="group-rename-dialog-header">
        <h2 id="group-rename-title">Đổi tên nhóm</h2>
        <button type="button" className="group-rename-close" aria-label="Đóng"
          onClick={onClose} disabled={submitting || busy}><X size={19} /></button>
      </header>
      <form onSubmit={(event) => void submit(event)} className="group-rename-dialog-body">
        <UserAvatar name={currentName} group className="group-rename-avatar" />
        <p id="group-rename-description">Bạn có chắc chắn muốn đổi tên nhóm? Tên mới sẽ hiển thị với tất cả thành viên.</p>
        <input ref={inputRef} aria-label="Tên nhóm mới" value={draft}
          onChange={(event) => onDraftChange(event.target.value)} maxLength={120}
          disabled={submitting || busy} autoComplete="off" required />
        {tooLong && <small className="group-rename-error" role="alert">Tên nhóm không được vượt quá 120 byte.</small>}
        <div className="group-rename-actions">
          <button type="button" className="group-rename-cancel"
            onClick={onClose} disabled={submitting || busy}>Hủy</button>
          <button type="submit" className="group-rename-confirm"
            disabled={submitting || busy || invalid}>Xác nhận</button>
        </div>
      </form>
    </dialog>
  )
}
