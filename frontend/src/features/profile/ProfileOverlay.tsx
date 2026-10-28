import { useEffect, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'

type Props = {
  title: string
  drawer?: boolean
  busy?: boolean
  onClose: () => void
  children: ReactNode
}

export default function ProfileOverlay({ title, drawer = false, busy = false, onClose, children }: Props) {
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const element = dialog.current
    element?.showModal()
    element?.querySelector<HTMLElement>('.profile-overlay-body textarea, .profile-overlay-body input')?.focus({ preventScroll: true })
    return () => {
      element?.close()
      previous?.focus({ preventScroll: true })
    }
  }, [])

  return (
    <dialog ref={dialog} className={drawer ? 'profile-overlay profile-edit-drawer' : 'profile-overlay profile-post-dialog'}
      aria-label={title} aria-modal="true"
      onCancel={event => { event.preventDefault(); if (!busy) onClose() }}
      onClick={event => {
        if (event.target !== event.currentTarget || busy) return
        const bounds = event.currentTarget.getBoundingClientRect()
        if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose()
      }}>
      <header className="profile-overlay-heading">
        <h2>{title}</h2>
        <button type="button" disabled={busy} onClick={onClose} aria-label={drawer ? 'Đóng chỉnh sửa hồ sơ' : 'Đóng tạo bài viết'}><X size={23} /></button>
      </header>
      <div className="profile-overlay-body">{children}</div>
    </dialog>
  )
}
