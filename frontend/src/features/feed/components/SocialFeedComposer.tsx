import { useRef, useState } from 'react'
import { MapPin } from 'lucide-react'
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

type Shortcut = 'photo' | 'story' | 'location'

function PhotoCard() {
  return (
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2.5" className="feed-shortcut-photo-surface" />
      <circle cx="9" cy="9" r="1.6" />
      <path d="m4 17 4-4 3 3 4.5-5L21 17" />
    </svg>
  )
}

export default function SocialFeedComposer({
  username, displayName, draft, pending, storyBusy,
  onCreatePost, onCreateStory, onCreateMediaPost, onCheckIn,
}: Props) {
  const quickMediaInput = useRef<HTMLInputElement>(null)
  const [motion, setMotion] = useState({ photo: 0, story: 0, location: 0 })
  const play = (shortcut: Shortcut) => {
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setMotion(current => ({ ...current, [shortcut]: current[shortcut] + 1 }))
    }
  }
  const hover = (shortcut: Shortcut, pointerType: string, disabled: boolean) => {
    if (pointerType === 'mouse' && !disabled) play(shortcut)
  }
  const iconClass = (shortcut: Shortcut) =>
    `feed-shortcut-icon feed-shortcut-icon--${shortcut}${motion[shortcut] ? ' is-playing' : ''}`
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
            onPointerEnter={event => hover('photo', event.pointerType, pending)}
            onClick={() => {
              play('photo')
              quickMediaInput.current?.click()
            }} disabled={pending}>
            <span key={motion.photo} className={iconClass('photo')} aria-hidden="true">
              <PhotoCard />
              <PhotoCard />
            </span>
          </button>
          <button type="button" aria-label="Story" data-tooltip="Tạo Story"
            onPointerEnter={event => hover('story', event.pointerType, storyBusy || pending)}
            onClick={() => {
              play('story')
              onCreateStory()
            }} disabled={storyBusy || pending}>
            <span key={motion.story} className={iconClass('story')} aria-hidden="true">
              <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 11h18v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <g className="feed-shortcut-clapper-lid">
                  <path d="M3 11V7a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v4z M8 6l2.5 5 M15 6l2.5 5" />
                </g>
              </svg>
            </span>
          </button>
          <button type="button" aria-label="Check-in" data-tooltip="Thêm địa điểm check-in"
            onPointerEnter={event => hover('location', event.pointerType, pending)}
            onClick={() => {
              play('location')
              onCheckIn()
            }} disabled={pending}>
            <span key={motion.location} className={iconClass('location')} aria-hidden="true">
              <MapPin size={21} />
            </span>
          </button>
        </div>
      </div>
    </section>
  )
}
