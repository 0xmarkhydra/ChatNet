import { useRef } from 'react'
import { Clapperboard, Image as ImageIcon, MapPin } from 'lucide-react'
import UserAvatar from '../../../shared/ui/UserAvatar'

type Props = {
  username: string
  displayName: string
  draft: string
  pending: boolean
  storyBusy: boolean
  onCreatePost: () => void
  onCreateStory: () => void
  onCreateMediaPost: (files: File[]) => void
  onCheckIn: () => void
}

export default function SocialFeedComposer({
  username, displayName, draft, pending, storyBusy,
  onCreatePost, onCreateStory, onCreateMediaPost, onCheckIn,
}: Props) {
  const quickMediaInput = useRef<HTMLInputElement>(null)
  return (
    <section className="social-feed-launcher" aria-label="Tạo nội dung mới">
      <div className="social-feed-launcher-top">
        <UserAvatar username={username} name={displayName} className="social-feed-me-avatar" />
        <button type="button" className="social-feed-launcher-prompt" onClick={onCreatePost} disabled={pending}>
          {draft.trim() ? 'Tiếp tục bài viết của bạn...' : 'Bạn đang nghĩ gì?'}
        </button>
        <div className="social-feed-launcher-shortcuts" role="group" aria-label="Tạo nội dung nhanh">
          <input ref={quickMediaInput} className="hidden-media-input" type="file" accept="image/*,video/*" multiple
            aria-label="Chọn ảnh hoặc video đăng bài"
            onChange={event => {
              const files = Array.from(event.currentTarget.files || [])
              event.currentTarget.value = ''
              if (files.length) onCreateMediaPost(files)
            }} />
          <button type="button" aria-label="Ảnh / Video" data-tooltip="Thêm ảnh hoặc video"
            onClick={() => quickMediaInput.current?.click()} disabled={pending}>
            <ImageIcon size={21} aria-hidden="true" />
          </button>
          <button type="button" aria-label="Story" data-tooltip="Tạo Story" onClick={onCreateStory}
            disabled={storyBusy || pending}>
            <Clapperboard size={21} aria-hidden="true" />
          </button>
          <button type="button" aria-label="Check-in" data-tooltip="Thêm địa điểm check-in" onClick={onCheckIn} disabled={pending}>
            <MapPin size={21} aria-hidden="true" />
          </button>
        </div>
      </div>
    </section>
  )
}
