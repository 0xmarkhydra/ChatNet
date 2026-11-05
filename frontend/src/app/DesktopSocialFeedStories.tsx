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

export default function DesktopSocialFeedStories({
  username, displayName, stories, busy, onCreate, onOpen,
}: Props) {
  const [expanded, setExpanded] = useState(false)
  return (
    <section className="penpot-feed-stories-card" aria-label="Tin mới từ bạn bè">
      <div className="penpot-feed-stories-heading">
        <h2>Tin mới từ bạn bè</h2>
        <button type="button" aria-expanded={expanded} onClick={() => setExpanded(value => !value)}>
          {expanded ? 'Thu gọn' : 'Xem tất cả'} <ChevronRight size={16} aria-hidden="true" />
        </button>
      </div>
      <div className={expanded ? 'penpot-feed-story-strip is-expanded' : 'penpot-feed-story-strip'}>
        <button type="button" className="penpot-feed-story" aria-label="Tạo Story mới" disabled={busy} onClick={onCreate}>
          <span className="penpot-feed-story-ring is-self">
            <UserAvatar username={username} name={displayName} className="penpot-feed-story-avatar" />
            <span className="penpot-feed-story-add"><Plus size={16} aria-hidden="true" /></span>
          </span>
          <span className="penpot-feed-story-label">{busy ? 'Đang tải...' : 'Tin của bạn'}</span>
        </button>
        {stories.map((story, index) => (
          <button type="button" className="penpot-feed-story" key={story.id} onClick={() => onOpen(story.id)}
            aria-label={`Xem Story của ${story.authorDisplayName || story.author}`}>
            <span className={index % 2 ? 'penpot-feed-story-ring is-purple' : 'penpot-feed-story-ring'}>
              {story.attachment.kind === 'image' && story.attachment.url
                ? <img className="penpot-feed-story-cover" src={story.attachment.url} alt="" loading="lazy" />
                : story.attachment.kind === 'video' && story.attachment.url
                  ? <video className="penpot-feed-story-cover" src={story.attachment.url} muted playsInline preload="metadata" aria-hidden="true" />
                  : <UserAvatar username={story.author} name={story.authorDisplayName || story.author} className="penpot-feed-story-avatar" />}
            </span>
            <span className="penpot-feed-story-label">{story.author === username ? 'Story của bạn' : story.authorDisplayName || story.author}</span>
          </button>
        ))}
        {stories.length === 0 && <p className="penpot-feed-no-stories">Chưa có tin mới từ bạn bè.</p>}
      </div>
    </section>
  )
}
