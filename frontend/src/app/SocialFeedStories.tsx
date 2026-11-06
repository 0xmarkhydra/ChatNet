import { useState } from 'react'
import { ChevronRight, Plus } from 'lucide-react'
import type { Story } from '../features/feed/types'
import UserAvatar from '../shared/ui/UserAvatar'

type Props = {
  username: string
  displayName: string
  stories: Story[]
  busy: boolean
  onCreate: () => void
  onOpen: (id: number) => void
}

export default function SocialFeedStories({
  username, displayName, stories, busy, onCreate, onOpen,
}: Props) {
  const [expanded, setExpanded] = useState(false)
  return (
    <section className="social-feed-stories-card" aria-label="Tin mới từ bạn bè">
      <div className="social-feed-stories-heading">
        <h2>Tin mới từ bạn bè</h2>
        <button type="button" aria-expanded={expanded} onClick={() => setExpanded(value => !value)}>
          {expanded ? 'Thu gọn' : 'Xem tất cả'} <ChevronRight size={16} aria-hidden="true" />
        </button>
      </div>
      <div className={expanded ? 'social-feed-story-strip is-expanded' : 'social-feed-story-strip'}>
        <button type="button" className="social-feed-story" aria-label="Tạo Story mới" disabled={busy} onClick={onCreate}>
          <span className="social-feed-story-ring is-self">
            <UserAvatar username={username} name={displayName} className="social-feed-story-avatar" />
            <span className="social-feed-story-add"><Plus size={16} aria-hidden="true" /></span>
          </span>
          <span className="social-feed-story-label">{busy ? 'Đang tải...' : 'Tin của bạn'}</span>
        </button>
        {stories.map((story, index) => (
          <button type="button" className="social-feed-story" key={story.id} onClick={() => onOpen(story.id)}
            aria-label={`Xem Story của ${story.authorDisplayName || story.author}`}>
            <span className={index % 2 ? 'social-feed-story-ring is-purple' : 'social-feed-story-ring'}>
              {story.attachment.kind === 'image' && story.attachment.url
                ? <img className="social-feed-story-cover" src={story.attachment.url} alt="" loading="lazy" />
                : story.attachment.kind === 'video' && story.attachment.url
                  ? <video className="social-feed-story-cover" src={story.attachment.url} muted playsInline preload="metadata" aria-hidden="true" />
                  : <UserAvatar username={story.author} name={story.authorDisplayName || story.author} className="social-feed-story-avatar" />}
            </span>
            <span className="social-feed-story-label">{story.author === username ? 'Story của bạn' : story.authorDisplayName || story.author}</span>
          </button>
        ))}
        {stories.length === 0 && <p className="social-feed-no-stories">Chưa có tin mới từ bạn bè.</p>}
      </div>
    </section>
  )
}