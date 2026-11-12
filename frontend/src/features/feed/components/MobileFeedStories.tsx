import UiIcon from '../../../shared/ui/UiIcon'
import UserAvatar from '../../../shared/ui/UserAvatar'
import { userLabel } from '../../../shared/utils/userLabel'
import type { Story } from '../types'

export default function MobileFeedStories({ username, stories, busy, onCreate, onOpen }: {
  username: string
  stories: Story[]
  busy: boolean
  onCreate: () => void
  onOpen: (id: number) => void
}) {
  return <>
    <div className="soco-feed-section-label">
      <strong>Khoảnh khắc</strong>
      <small>Story trong 24 giờ</small>
    </div>
    <div className="stories-row">
      <button type="button" className="story-card" disabled={busy} onClick={onCreate} aria-label="Tạo Story mới">
        <div className="story-visual self-story">
          <span className="story-camera"><UiIcon name="plus" size={22} /></span>
        </div>
        <span>Tạo mới</span>
      </button>
      {stories.map(story => (
        <button type="button" className="story-card" key={story.id}
          onClick={() => onOpen(story.id)}
          aria-label={`Xem Story của ${userLabel(story.authorDisplayName, story.author)}`}>
          <div className="story-visual">
            {story.attachment.kind === 'video' ? (
              <video src={story.attachment.url} muted playsInline preload="metadata" />
            ) : (
              <img src={story.attachment.url} alt="" loading="lazy" />
            )}
            <UserAvatar className="story-avatar-mini" username={story.author}
              name={userLabel(story.authorDisplayName, story.author)} />
          </div>
          <span>{story.author === username ? 'Story của bạn' : userLabel(story.authorDisplayName, story.author)}</span>
        </button>
      ))}
    </div>
  </>
}
