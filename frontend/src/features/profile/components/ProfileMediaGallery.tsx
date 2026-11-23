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
  return items.length ? (
    <div className="profile-page-media-grid min-[761px]:grid min-[761px]:grid-cols-3 min-[761px]:gap-3">
      {items.map(({ postId, attachment, index }) => (
        <button className="profile-page-media-item min-[761px]:relative min-[761px]:block min-[761px]:aspect-[1.3] min-[761px]:w-full min-[761px]:cursor-pointer min-[761px]:overflow-hidden min-[761px]:rounded-[13px] min-[761px]:border-0 min-[761px]:bg-[#ecf0f8] min-[761px]:p-0 min-[761px]:[&_img]:h-full min-[761px]:[&_img]:w-full min-[761px]:[&_img]:object-cover min-[761px]:[&_video]:h-full min-[761px]:[&_video]:w-full min-[761px]:[&_video]:object-cover" type="button" key={`${postId}:${attachment.id ?? attachment.storageRef}:${index}`}
          onClick={() => onOpenPost(postId)} aria-label={`Xem bài viết chứa ${attachment.name || 'ảnh hoặc video'}`}>
          {attachment.kind === 'image'
            ? <img src={attachment.url} alt={attachment.name || 'Ảnh bài viết'} loading="lazy" />
            : <><video src={attachment.url} preload="metadata" muted playsInline aria-label={attachment.name || 'Video bài viết'} /><Video size={23} className="profile-page-video-badge" aria-hidden="true" /></>}
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