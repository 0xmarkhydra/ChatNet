import { useEffect, useRef, useState, type DragEvent } from 'react'
import { Camera, Check, ImagePlus, RotateCcw, Trash2, X } from 'lucide-react'
import { createPortal } from 'react-dom'
import './group-avatar-editor.css'

export type GroupPhotoTarget = {
  name: string
  avatarUrl?: string
  kind?: 'group' | 'avatar' | 'cover'
}

type Props = {
  target: GroupPhotoTarget
  busy: boolean
  onSave: (target: GroupPhotoTarget, file: File | null) => Promise<boolean>
  onClose: () => void
}

const MAX_SIZE = 12 * 1024 * 1024
const supportedTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif'])
const extensions = /\.(jpe?g|png|webp|gif|heic|heif)$/i

export function photoFileError(file: File): string {
  if (file.size > MAX_SIZE) {
    const sizeMb = (file.size / (1024 * 1024)).toLocaleString('vi-VN', { maximumFractionDigits: 1 })
    return `Ảnh ${file.name} có dung lượng ${sizeMb} MB, vượt quá giới hạn 12 MB. Vui lòng chọn ảnh nhỏ hơn.`
  }
  if (!file.size) return 'Ảnh trống, vui lòng chọn ảnh khác.'
  if (!supportedTypes.has(file.type.toLowerCase()) || !extensions.test(file.name)) {
    return 'Vui lòng chọn ảnh JPG, PNG, WebP, GIF hoặc HEIC.'
  }
  return ''
}

export default function GroupAvatarEditor({ target, busy, onSave, onClose }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const chooseRef = useRef<HTMLButtonElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState('')
  const [remove, setRemove] = useState(false)
  const [error, setError] = useState('')
  const [dragging, setDragging] = useState(false)
  const [imageError, setImageError] = useState(false)

  const label = target.kind === 'cover' ? 'ảnh bìa' : target.kind === 'avatar' ? 'ảnh đại diện' : 'ảnh nhóm'
  const isCover = target.kind === 'cover'

  useEffect(() => {
    chooseRef.current?.focus()
  }, [])
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview) }, [preview])
  useEffect(() => {
    if (busy) return
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        onClose()
      }
    }
    document.addEventListener('keydown', handleEscape, true)
    return () => document.removeEventListener('keydown', handleEscape, true)
  }, [busy, onClose])

  const choose = (selected?: File) => {
    if (!selected || busy) return
    const validation = photoFileError(selected)
    if (validation) {
      setFile(null)
      setPreview('')
      setRemove(false)
      setError(validation)
      return
    }
    setError('')
    setRemove(false)
    setImageError(false)
    setPreview(URL.createObjectURL(selected))
    setFile(selected)
  }
  const onDrop = (event: DragEvent<HTMLButtonElement>) => {
    event.preventDefault()
    setDragging(false)
    if (busy) return
    const dropped = Array.from(event.dataTransfer.files)
    if (dropped.length !== 1) {
      setError('Chỉ chọn một ảnh mỗi lần.')
      return
    }
    choose(dropped[0])
  }
  const reset = () => {
    setPreview('')
    setFile(null)
    setRemove(false)
    setImageError(false)
    setError('')
  }
  const submit = async () => {
    if (busy || (!file && !remove)) return
    if (await onSave(target, remove ? null : file)) onClose()
  }
  const imageUrl = remove ? '' : preview || target.avatarUrl || ''

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
            onClick={() => { setFile(null); setPreview(''); setRemove(true); setError(''); setImageError(false) }}>
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