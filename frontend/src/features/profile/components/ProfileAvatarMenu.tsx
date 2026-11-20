import { useRef, useState } from 'react'
import { Image, ImagePlus } from 'lucide-react'
import UserAvatar, { profileAssetUrl } from '@/shared/ui/UserAvatar'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/shared/ui/dropdown-menu'

type Props = {
  username: string
  displayName: string
  avatarClassName: string
  avatarVersion?: string
  avatarSet: boolean
  editBusy: boolean
  onChangeAvatar: (opener: HTMLButtonElement | null) => void
}

export default function ProfileAvatarMenu({ username, displayName, avatarClassName, avatarVersion, avatarSet, editBusy, onChangeAvatar }: Props) {
  const [previewOpen, setPreviewOpen] = useState(false)
  const [failedUrl, setFailedUrl] = useState('')
  const trigger = useRef<HTMLButtonElement>(null)
  const openingDialog = useRef(false)
  const changeAfterPreview = useRef(false)
  const url = avatarSet ? profileAssetUrl(username, 'avatar', avatarVersion) : ''
  const showPhoto = url !== '' && failedUrl !== url

  return <>
    <UserAvatar username={username} name={displayName} className={`${avatarClassName} profile-hero-avatar`} online />
    <span className="sr-only">Đang hoạt động</span>
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button ref={trigger} type="button" aria-label="Tùy chọn ảnh đại diện"
          className="absolute inset-0 size-full cursor-pointer appearance-none rounded-full border-0 bg-transparent p-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" aria-label="Ảnh đại diện" onCloseAutoFocus={event => {
        if (openingDialog.current) {
          openingDialog.current = false
          event.preventDefault()
        }
      }}>
        <DropdownMenuItem onSelect={() => {
          openingDialog.current = true
          setFailedUrl('')
          setPreviewOpen(true)
        }}><Image size={18} aria-hidden="true" />Xem ảnh đại diện</DropdownMenuItem>
        <DropdownMenuItem disabled={editBusy} onSelect={() => {
          openingDialog.current = true
          onChangeAvatar(trigger.current)
        }}>
          <ImagePlus size={18} aria-hidden="true" />Đổi ảnh đại diện
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
    <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
      <DialogContent className={showPhoto ? undefined : 'max-w-sm gap-4 p-4 sm:p-5'} onCloseAutoFocus={event => {
        event.preventDefault()
        const shouldChange = changeAfterPreview.current
        changeAfterPreview.current = false
        if (shouldChange && !editBusy) onChangeAvatar(trigger.current)
        else trigger.current?.focus()
      }}>
        <DialogHeader className="pr-10">
          <DialogTitle className="m-0">Ảnh đại diện</DialogTitle>
          <DialogDescription className="m-0">{displayName}</DialogDescription>
        </DialogHeader>
        {showPhoto
          ? <img src={url} alt={`Ảnh đại diện của ${displayName}`} onError={() => setFailedUrl(url)}
              className="mx-auto block max-h-[65dvh] max-w-full rounded-ui-md object-contain" />
          : <div className="grid justify-items-center gap-4 rounded-ui-lg border border-solid border-border bg-linear-to-b from-primary/10 to-card p-4 text-center">
              <UserAvatar name={displayName} username={username} initialsOnly
                className="size-20 rounded-full border-4 border-solid border-card text-2xl font-semibold sm:size-24 sm:text-3xl" />
              <div className="grid gap-1.5">
                <p className="m-0 text-ui-body font-semibold">{url ? 'Không tải được ảnh đại diện.' : 'Bạn chưa có ảnh đại diện.'}</p>
                <p className="m-0 text-ui-label text-muted-foreground">{url ? 'Bạn có thể chọn một ảnh khác.' : 'Thêm ảnh để bạn bè dễ nhận ra bạn.'}</p>
              </div>
              <DialogClose asChild>
                <Button size="lg" disabled={editBusy} onClick={() => { changeAfterPreview.current = true }}>
                  <ImagePlus size={17} aria-hidden="true" />
                  {url ? 'Đổi ảnh đại diện' : 'Thêm ảnh đại diện'}
                </Button>
              </DialogClose>
            </div>}
      </DialogContent>
    </Dialog>
  </>
}