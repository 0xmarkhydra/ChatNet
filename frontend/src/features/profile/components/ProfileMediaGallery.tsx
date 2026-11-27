import { useUiTranslation } from '@/shared/i18n/locale'
import { Image as ImageIcon, Video } from 'lucide-react'
import type { MediaAttachment } from '../../../shared/utils/media'

export type ProfileMediaItem = { postId: number; attachment: MediaAttachment; index: number }

type Props = {
  items: ProfileMediaItem[]
  emptyText: string
  postsBusy: boolean
  onOpenPost: (postId: number) => void
  onCreatePost: () => void
}

export default function ProfileMediaGallery({ items, emptyText, postsBusy, onOpenPost, onCreatePost }: Props) {
  const trUi = useUiTranslation()

  return items.length ? (
    <div className="profile-page-media-grid app-desktop:grid app-desktop:grid-cols-3 app-desktop:gap-3">
      {items.map(({ postId, attachment, index }) => (
        <button className="profile-page-media-item app-desktop:relative app-desktop:block app-desktop:aspect-[1.3] app-desktop:w-full app-desktop:cursor-pointer app-desktop:overflow-hidden app-desktop:rounded-[13px] app-desktop:border-0 app-desktop:bg-[#ecf0f8] app-desktop:p-0 app-desktop:[&_img]:h-full app-desktop:[&_img]:w-full app-desktop:[&_img]:object-cover app-desktop:[&_video]:h-full app-desktop:[&_video]:w-full app-desktop:[&_video]:object-cover" type="button" key={`${postId}:${attachment.id ?? attachment.storageRef}:${index}`}
          onClick={() => onOpenPost(postId)} aria-label={trUi("common.ui.viewPostContaining", { v1: String(attachment.name || 'ảnh hoặc video') })}>
          {attachment.kind === 'image'
            ? <img src={attachment.url} alt={attachment.name || trUi("feed.postPhoto")} loading="lazy" />
            : <><video src={attachment.url} preload="metadata" muted playsInline aria-label={attachment.name || trUi("feed.postVideo")} /><Video size={23} className="profile-page-video-badge" aria-hidden="true" /></>}
        </button>
      ))}
    </div>
  ) : postsBusy ? null : (
    <div className="profile-page-blank"><ImageIcon size={30} aria-hidden="true" />
      <p>{emptyText}</p>
      <button type="button" onClick={onCreatePost}>Chia sẻ khoảnh khắc</button>
    </div>
  )

}