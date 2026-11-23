import { useEffect, useRef, useState, type DragEvent } from 'react'
import type { GroupPhotoTarget } from '../utils/groupPhotoTarget'
import { photoFileError } from '../utils/photoFileValidation'

type Params = {
  target: GroupPhotoTarget
  busy: boolean
  onSave: (target: GroupPhotoTarget, file: File | null) => Promise<boolean>
  onClose: () => void
}

export function useGroupAvatarEditor({ target, busy, onSave, onClose }: Params) {
  const inputRef = useRef<HTMLInputElement>(null)
  const chooseRef = useRef<HTMLButtonElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState('')
  const [remove, setRemove] = useState(false)
  const [error, setError] = useState('')
  const [dragging, setDragging] = useState(false)
  const [imageError, setImageError] = useState(false)

  const label = target.kind === 'cover' ? 'ảnh bìa' : target.kind === 'avatar' ? 'ảnh đại diện' : target.kind === 'channel' ? 'ảnh kênh' : 'ảnh nhóm'
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


  function removePhoto() {
    setFile(null)
    setPreview('')
    setRemove(true)
    setError('')
    setImageError(false)
  }

  return { inputRef, chooseRef, file, preview, remove, error, dragging, setDragging,
    imageError, setImageError, label, isCover, choose, onDrop, reset, submit, imageUrl, removePhoto }
}
