import { useEffect, useRef, useState, type RefObject } from 'react'
import { Camera, Check, ChevronDown, ImagePlus, RotateCcw, Trash2, Upload } from 'lucide-react'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from '@/shared/ui/dialog'
import type { Post } from '../../feed'
import { avatarFileError, isAvatarPhoto, readAvatarPhoto, type AvatarPhoto } from '../api/avatarPhoto'

type Props = {
  username: string
  avatarUrl?: string
  posts: Post[]
  busy: boolean
  opener: HTMLButtonElement | null
  inputRef: RefObject<HTMLInputElement | null>
  onSave: (file: File | null) => Promise<boolean>
  onClose: () => void
}

type Choice = { kind: 'file'; file: File; url: string } | { kind: 'photo'; photo: AvatarPhoto } | { kind: 'remove' }

const PHOTO_LIMIT = 6

export default function ProfileAvatarPicker({ username, avatarUrl, posts, busy, opener, inputRef, onSave, onClose }: Props) {
  const [choice, setChoice] = useState<Choice | null>(null)
  const [error, setError] = useState('')
  const [brokenPreview, setBrokenPreview] = useState('')
  const [visibleCount, setVisibleCount] = useState(PHOTO_LIMIT)
  const [saving, setSaving] = useState(false)
  const [dragging, setDragging] = useState(false)
  const readRequest = useRef<AbortController | null>(null)
  const disabled = busy || saving

  const localUrl = choice?.kind === 'file' ? choice.url : ''
  const preview = choice?.kind === 'photo' ? choice.photo.url : choice?.kind === 'remove' ? '' : localUrl || avatarUrl
  const photos = [...new Map(posts
    .filter(post => post.author === username)
    .flatMap(post => post.attachments ?? [])
    .filter(isAvatarPhoto)
    .map(photo => [photo.storageRef, photo] as const)).values()]

  useEffect(() => () => { if (localUrl) URL.revokeObjectURL(localUrl) }, [localUrl])
  useEffect(() => () => { readRequest.current?.abort() }, [])

  function selectFile(file?: File) {
    if (!file || disabled) return
    const message = avatarFileError(file)
    setError(message)
    if (message) return
    setBrokenPreview('')
    setChoice({ kind: 'file', file, url: URL.createObjectURL(file) })
  }

  async function save() {
    if (!choice || disabled) return
    const controller = new AbortController()
    readRequest.current = controller
    setSaving(true)
    setError('')
    try {
      const file = choice.kind === 'file' ? choice.file
        : choice.kind === 'photo' ? await readAvatarPhoto(choice.photo, controller.signal) : null
      if (controller.signal.aborted) return
      const saved = await onSave(file)
      if (controller.signal.aborted) return
      if (saved) onClose()
      else setError('Không lưu được ảnh đại diện. Bạn có thể thử lại.')
    } catch (cause) {
      if (!controller.signal.aborted) {
        setError(cause instanceof Error && cause.name !== 'TypeError'
          ? cause.message : 'Không tải được ảnh này. Hãy chọn ảnh khác hoặc tải ảnh từ thiết bị.')
      }
    } finally {
      if (!controller.signal.aborted) {
        readRequest.current = null
        setSaving(false)
      }
    }
  }

  return (
    <Dialog defaultOpen onOpenChange={open => { if (!open && !disabled) onClose() }}>
      <DialogContent
        className={photos.length ? 'max-w-3xl gap-5 p-4 sm:p-6' : 'gap-5 p-4 sm:p-6'}
        showCloseButton={!disabled}
        onCloseAutoFocus={event => {
          if (opener?.isConnected) {
            event.preventDefault()
            opener.focus()
          }
        }}
        onEscapeKeyDown={event => { if (disabled) event.preventDefault() }}
        onInteractOutside={event => { if (disabled) event.preventDefault() }}
      >
        <header className="grid gap-2 pr-9">
          <span className="flex w-fit items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
            <Camera size={14} aria-hidden="true" /> Hồ sơ SocCo
          </span>
          <DialogTitle className="m-0 text-xl">Đổi ảnh đại diện</DialogTitle>
          <DialogDescription className="m-0">
            {photos.length ? 'Tải ảnh mới hoặc chọn một ảnh từ bài viết của bạn.' : 'Tải ảnh từ thiết bị và xem trước khi lưu.'}
          </DialogDescription>
        </header>

        <div className={photos.length ? 'grid min-w-0 gap-4 sm:grid-cols-[minmax(0,3fr)_minmax(0,5fr)]' : 'grid min-w-0'}>
          <section aria-label="Xem trước ảnh đại diện"
            className="grid min-w-0 content-start justify-items-center gap-3 rounded-ui-lg border border-border bg-linear-to-br from-primary/10 via-accent/50 to-card p-4 text-center">
            <div className="m-0 text-sm font-semibold text-foreground">Xem trước</div>
            <div className="grid size-24 place-items-center overflow-hidden rounded-full border-4 border-card bg-card text-primary shadow-sm sm:size-28">
              {preview && preview !== brokenPreview
                ? <img src={preview} alt="Ảnh đại diện xem trước" referrerPolicy="no-referrer"
                    onError={() => setBrokenPreview(preview)} className="size-full object-cover" />
                : <ImagePlus size={28} aria-hidden="true" />}
            </div>
            {choice?.kind === 'remove' && <p className="m-0 text-xs text-muted-foreground">Ảnh hiện tại sẽ được gỡ khi lưu.</p>}
            {choice?.kind === 'file' && <p className="m-0 w-full truncate text-xs text-muted-foreground" title={choice.file.name}>{choice.file.name}</p>}
            <Button size="lg" className={dragging ? 'w-full px-3 ring-2 ring-ring' : 'w-full px-3'}
              disabled={disabled} onClick={() => inputRef.current?.click()}
              onDragOver={event => { event.preventDefault(); if (!disabled) setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={event => {
                event.preventDefault()
                setDragging(false)
                if (disabled) return
                if (event.dataTransfer.files.length !== 1) setError('Chỉ chọn một ảnh mỗi lần.')
                else selectFile(event.dataTransfer.files[0])
              }}>
              <Upload size={17} aria-hidden="true" /> Tải ảnh lên
            </Button>
            <p className="m-0 text-xs text-muted-foreground">JPG, PNG, WebP, GIF, HEIC · Tối đa 12 MB</p>
            <input type="file" hidden ref={inputRef} disabled={disabled} aria-label="Tệp ảnh đại diện"
              accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.gif,.heic,.heif"
              onChange={event => {
                selectFile(event.currentTarget.files?.[0])
                event.currentTarget.value = ''
              }} />
          </section>

          {photos.length > 0 && (
            <section className="grid min-w-0 content-start gap-3" aria-labelledby="profile-avatar-photos">
              <h3 className="m-0 text-sm font-semibold" id="profile-avatar-photos">Ảnh từ bài viết của bạn</h3>
              <div className="grid grid-cols-3 gap-2.5">
                {photos.slice(0, visibleCount).map(photo => {
                  const selected = choice?.kind === 'photo' && choice.photo.storageRef === photo.storageRef
                  return (
                    <button key={photo.storageRef} type="button" aria-label={'Chọn ' + photo.name} aria-pressed={selected}
                      disabled={disabled} onClick={() => { setError(''); setBrokenPreview(''); setChoice({ kind: 'photo', photo }) }}
                      className={'relative aspect-square min-h-11 min-w-0 cursor-pointer overflow-hidden rounded-ui-md border-0 bg-muted p-0 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-default ' +
                        (selected ? 'ring-2 ring-ring ring-offset-2' : 'hover:ring-2 hover:ring-border')}>
                      <img src={photo.url} alt="" loading="lazy" referrerPolicy="no-referrer" className="block size-full object-cover" />
                      {selected && <span className="absolute right-1.5 top-1.5 grid size-6 place-items-center rounded-full bg-primary text-primary-foreground shadow-sm"><Check size={15} aria-hidden="true" /></span>}
                    </button>
                  )
                })}
              </div>
              {photos.length > visibleCount && (
                <Button size="lg" variant="outline" className="w-fit px-3" onClick={() => setVisibleCount(visibleCount + PHOTO_LIMIT)}>
                  <ChevronDown size={16} aria-hidden="true" /> Xem thêm
                </Button>
              )}
            </section>
          )}
        </div>

        {error && <p className="m-0 text-sm text-destructive" role="alert">{error}</p>}
        <DialogFooter className="items-center border-t border-border pt-3">
          {avatarUrl && choice?.kind !== 'remove' && (
            <Button variant="ghost" size="lg" className="mr-auto px-2.5 text-destructive" disabled={disabled}
              onClick={() => { setError(''); setChoice({ kind: 'remove' }) }}>
              <Trash2 size={16} aria-hidden="true" /> Gỡ ảnh
            </Button>
          )}
          {choice && (
            <Button aria-label="Hoàn tác lựa chọn" variant="ghost" size="lg" className="px-2.5" disabled={disabled}
              onClick={() => { setError(''); setChoice(null) }}>
              <RotateCcw size={16} aria-hidden="true" /> Hoàn tác
            </Button>
          )}
          <Button size="lg" className="px-4" disabled={!choice || disabled} onClick={() => void save()}>
            <Check size={17} aria-hidden="true" /> {disabled ? 'Đang lưu…' : 'Lưu ảnh'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
