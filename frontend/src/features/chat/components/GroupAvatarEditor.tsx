import { Camera, Check, ImagePlus, RotateCcw, Trash2, X } from 'lucide-react'
import { createPortal } from 'react-dom'
import { useGroupAvatarEditor } from '../hooks/useGroupAvatarEditor'
export { photoFileError } from '../utils/photoFileValidation'
import '../styles/group-avatar-editor.css'

import type { GroupPhotoTarget } from '../utils/groupPhotoTarget'
export type { GroupPhotoTarget } from '../utils/groupPhotoTarget'

type Props = {
  target: GroupPhotoTarget
  busy: boolean
  onSave: (target: GroupPhotoTarget, file: File | null) => Promise<boolean>
  onClose: () => void
}


export default function GroupAvatarEditor({ target, busy, onSave, onClose }: Props) {
  const { inputRef, chooseRef, file, remove, error, dragging, setDragging,
    imageError, setImageError, label, isCover, choose, onDrop, reset, submit, imageUrl, removePhoto } =
    useGroupAvatarEditor({ target, busy, onSave, onClose })

  return createPortal(
    <div className="group-photo-modal-layer">
      <button type="button" className="group-photo-backdrop" aria-label="Hủy đổi ảnh" disabled={busy} onClick={onClose} />
      <section className="group-photo-modal" role="dialog" aria-modal="true" aria-labelledby="group-photo-title" aria-describedby="group-photo-hint">
        <header>
          <div><strong id="group-photo-title">Đổi {label}</strong><small>{target.name}</small></div>
          <button type="button" aria-label="Đóng" disabled={busy} onClick={onClose}><X size={20} /></button>
        </header>
        <button ref={chooseRef} type="button" className={`group-photo-preview ${isCover ? 'cover' : ''} ${dragging ? 'dragging' : ''}`}
          onClick={() => inputRef.current?.click()}
          onDragOver={event => { event.preventDefault(); if (!busy) setDragging(true) }}
          onDragLeave={event => { event.preventDefault(); setDragging(false) }}
          onDrop={onDrop}
          disabled={busy}
          aria-label={`Chọn ảnh cho ${label}, có thể kéo thả ảnh vào đây`}
          title="Nhấn để chọn ảnh hoặc kéo thả ảnh vào đây">
          {imageUrl && !imageError
            ? <img src={imageUrl} alt={`Xem trước ${label}`} onError={() => setImageError(true)} />
            : <span className="group-photo-placeholder"><Camera size={36} aria-hidden="true" /> Nhấn để chọn ảnh</span>}
          <span className="group-photo-preview-overlay"><ImagePlus size={16} aria-hidden="true" /> {file ? 'Chọn ảnh khác' : 'Chọn ảnh'}</span>
        </button>
        <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.gif,.heic,.heif"
          className="group-photo-input" aria-label={`Tệp ${label}`}
          onChange={event => {
            choose(event.currentTarget.files?.[0])
            event.currentTarget.value = ''
          }} disabled={busy} />
        <p className="group-photo-hint" id="group-photo-hint">Nhấn vào ảnh hoặc kéo thả để thay đổi. JPG, PNG, WebP, GIF, HEIC · tối đa 12 MB.</p>
        {file && !remove && <p className="group-photo-filename" title={file.name}>{file.name}</p>}
        {remove && <p className="group-photo-remove-hint">Ảnh sẽ được gỡ sau khi bạn nhấn Lưu.</p>}
        {error && <p className="group-photo-error" role="alert">{error}</p>}
        <footer className="group-photo-actions">
          <button type="button" className="group-photo-cancel" disabled={busy} onClick={onClose}>Hủy</button>
          {target.avatarUrl && (file || remove) && <button type="button" disabled={busy} onClick={reset}
            aria-label="Hoàn tác thay đổi ảnh"><RotateCcw size={16} /> Hoàn tác</button>}
          {target.avatarUrl && !remove && <button type="button" disabled={busy}
            onClick={removePhoto}>
            <Trash2 size={16} /> Gỡ ảnh
          </button>}
          <button className="group-photo-save" type="button" disabled={busy || (!file && !remove)}
            onClick={() => void submit()}>
            <Check size={16} aria-hidden="true" /> {busy ? 'Đang lưu...' : 'Lưu ảnh'}
          </button>
        </footer>
      </section>
    </div>, document.body
  )
}