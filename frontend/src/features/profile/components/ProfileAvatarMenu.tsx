import { useRef, useState } from 'react'
import { Image, ImagePlus } from 'lucide-react'
import UserAvatar, { profileAssetUrl } from '@/shared/ui/UserAvatar'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/shared/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/shared/ui/dropdown-menu'

type Props = {
  username: string
  displayName: string
  avatarClassName: string
  avatarVersion?: string
  avatarSet: boolean
  editBusy: boolean
  onChangeAvatar: () => void
}

export default function ProfileAvatarMenu({ username, displayName, avatarClassName, avatarVersion, avatarSet, editBusy, onChangeAvatar }: Props) {
  const [previewOpen, setPreviewOpen] = useState(false)
  const [failedUrl, setFailedUrl] = useState('')
  const trigger = useRef<HTMLButtonElement>(null)
  const openingPreview = useRef(false)
  const url = avatarSet ? profileAssetUrl(username, 'avatar', avatarVersion) : ''

  return <>
    <UserAvatar username={username} name={displayName} className={avatarClassName} online />
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button ref={trigger} type="button" aria-label="Tùy chọn ảnh đại diện"
          className="absolute inset-0 size-full cursor-pointer appearance-none rounded-full border-0 bg-transparent p-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" aria-label="Ảnh đại diện" onCloseAutoFocus={event => {
        if (openingPreview.current) {
          openingPreview.current = false
          event.preventDefault()
        }
      }}>
        <DropdownMenuItem onSelect={() => {
          openingPreview.current = true
          setFailedUrl('')
          setPreviewOpen(true)
        }}><Image size={18} aria-hidden="true" />Xem ảnh đại diện</DropdownMenuItem>
        <DropdownMenuItem disabled={editBusy} onSelect={onChangeAvatar}>
          <ImagePlus size={18} aria-hidden="true" />Đổi ảnh đại diện
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
    <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
      <DialogContent onCloseAutoFocus={event => {
        event.preventDefault()
        trigger.current?.focus()
      }}>
        <DialogTitle className="pr-10">Ảnh đại diện</DialogTitle>
        <DialogDescription>{displayName}</DialogDescription>
        {url && failedUrl !== url
          ? <img src={url} alt={`Ảnh đại diện của ${displayName}`} onError={() => setFailedUrl(url)}
              className="mx-auto block max-h-[65dvh] max-w-full rounded-ui-md object-contain" />
          : <p className="m-0 text-ui-body text-muted-foreground">{url ? 'Không tải được ảnh đại diện.' : 'Bạn chưa có ảnh đại diện.'}</p>}
      </DialogContent>
    </Dialog>
  </>
}
