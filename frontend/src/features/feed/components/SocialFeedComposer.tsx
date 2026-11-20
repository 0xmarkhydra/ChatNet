import { useRef } from 'react'
import FeedComposerIconButton from './FeedComposerIconButton'
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
    <section className="social-feed-launcher min-[761px]:flex min-[761px]:h-[110px] min-[761px]:flex-col min-[761px]:rounded-2xl min-[761px]:border min-[761px]:border-[#e8ecf5] min-[761px]:bg-white min-[761px]:px-[22px] min-[761px]:pt-[15px] min-[761px]:shadow-[0_3px_16px_rgba(30,51,96,0.035)]" aria-label="Tạo nội dung mới">
      <div className="social-feed-launcher-top min-[761px]:flex min-[761px]:min-h-[49px] min-[761px]:items-center min-[761px]:gap-[15px]">
        <UserAvatar username={username} name={displayName} className="social-feed-me-avatar min-[761px]:size-[46px] min-[761px]:shrink-0 min-[761px]:rounded-full" />
        <button type="button" className="social-feed-launcher-prompt min-[761px]:h-[49px] min-[761px]:min-w-0 min-[761px]:flex-1 min-[761px]:cursor-pointer min-[761px]:rounded-[11px] min-[761px]:border min-[761px]:border-transparent min-[761px]:bg-[#f8fafe] min-[761px]:px-[23px] min-[761px]:text-left min-[761px]:text-[13px] min-[761px]:text-[#8b99ae] min-[761px]:hover:border-[#e3eafe] min-[761px]:hover:bg-[#f0f5ff]" onClick={onCreatePost} disabled={pending}>
          {draft.trim() ? 'Tiếp tục bài viết của bạn...' : 'Bạn đang nghĩ gì?'}
        </button>
        <div className="social-feed-launcher-shortcuts min-[761px]:flex min-[761px]:min-w-0 min-[761px]:items-center min-[761px]:gap-[clamp(10px,3vw,65px)] min-[761px]:[&_button]:inline-flex min-[761px]:[&_button]:min-h-7 min-[761px]:[&_button]:items-center min-[761px]:[&_button]:gap-2 min-[761px]:[&_button]:border-0 min-[761px]:[&_button]:bg-transparent min-[761px]:[&_button]:px-[5px] min-[761px]:[&_button]:text-xs min-[761px]:[&_button]:font-semibold min-[761px]:[&_button]:text-[#667c9c] min-[761px]:[&_button:hover]:text-[#2563eb] min-[761px]:[&_button]:cursor-pointer" role="group" aria-label="Tạo nội dung nhanh">
          <input ref={quickMediaInput} className="hidden-media-input" type="file" accept="image/*,video/*" multiple
            aria-label="Chọn ảnh hoặc video đăng bài"
            onChange={event => {
              const files = Array.from(event.currentTarget.files || [])
              event.currentTarget.value = ''
              if (files.length) onCreateMediaPost(files)
            }} />
          <FeedComposerIconButton icon="photo" aria-label="Ảnh / Video" data-tooltip="Thêm ảnh hoặc video"
            onClick={() => quickMediaInput.current?.click()} disabled={pending} />
          <FeedComposerIconButton icon="story" aria-label="Story" data-tooltip="Tạo Story"
            onClick={onCreateStory} disabled={storyBusy || pending} />
          <FeedComposerIconButton icon="location" aria-label="Check-in" data-tooltip="Thêm địa điểm check-in"
            onClick={onCheckIn} disabled={pending} />
        </div>
      </div>
    </section>
  )
}