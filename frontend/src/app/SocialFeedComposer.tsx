import { Image as ImageIcon, MapPin, PencilLine, Plus, Video } from 'lucide-react'
import UserAvatar from '../shared/ui/UserAvatar'

type Props = {
  username: string
  displayName: string
  draft: string
  pending: boolean
  storyBusy: boolean
  onCreatePost: () => void
  onCreateStory: () => void
  onCreateMediaPost: () => void
  onCheckIn: () => void
}

export default function SocialFeedComposer({
  username, displayName, draft, pending, storyBusy,
  onCreatePost, onCreateStory, onCreateMediaPost, onCheckIn,
}: Props) {
  return (
    <section className="social-feed-launcher" aria-label="Tạo nội dung mới">
      <div className="social-feed-launcher-top">
        <UserAvatar username={username} name={displayName} className="social-feed-me-avatar" />
        <button type="button" className="social-feed-launcher-prompt" onClick={onCreatePost} disabled={pending}>
          {draft.trim() ? 'Tiếp tục bản nháp của bạn...' : 'Bạn đang nghĩ gì hôm nay?'}
        </button>
      </div>
      <div className="social-feed-launcher-bottom">
        <div className="social-feed-launcher-shortcuts">
          <button type="button" onClick={onCreateMediaPost} disabled={pending}><ImageIcon size={19} aria-hidden="true" />Ảnh / Video</button>
          <button type="button" onClick={onCreateStory} disabled={storyBusy}><Video size={19} aria-hidden="true" />Story</button>
          <button type="button" onClick={onCheckIn} disabled={pending}><MapPin size={19} aria-hidden="true" />Check-in</button>
        </div>
        <button type="button" className="social-feed-launcher-publish" disabled={pending} onClick={onCreatePost}>
          <PencilLine size={16} aria-hidden="true" /><span>Tạo bài viết</span><Plus size={15} aria-hidden="true" className="social-feed-launcher-publish-plus" />
        </button>
      </div>
    </section>
  )
}