import type { Story } from './types'
import UserAvatar from '../../shared/ui/UserAvatar'
import UiIcon from '../../shared/ui/UiIcon'

type Props = {
  activeStory: Story
  name: string
  storyBusy: boolean
  deleteStory: (story: Story) => Promise<void>
  setActiveStoryId: (id: number | null) => void
  nextStory: () => void
  previousStory: () => void
  activeStoryIndex: number
}

export default function StoryViewer({
  activeStory,
  name,
  storyBusy,
  deleteStory,
  setActiveStoryId,
  nextStory,
  previousStory,
  activeStoryIndex,
}: Props) {
  return (
    <div
      className="story-viewer-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={`Story của @${activeStory.author}`}
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) setActiveStoryId(null)
      }}
    >
      <section className="story-viewer">
        <div className="story-progress" aria-hidden="true">
          <span key={activeStory.id} className={activeStory.attachment.kind === 'image' ? 'running' : ''} />
        </div>
        <header>
          <UserAvatar name={activeStory.author} className="story-viewer-avatar" />
          <div className="story-viewer-owner">
            <strong>@{activeStory.author}</strong>
            <time dateTime={activeStory.createdAt}>
              {new Date(activeStory.createdAt).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'numeric' })}
            </time>
          </div>
          {activeStory.author === name && (
            <button type="button" className="story-delete" aria-label="Xóa Story" title="Xóa Story" disabled={storyBusy} onClick={() => void deleteStory(activeStory)}>
              <UiIcon name="trash" size={20} />
            </button>
          )}
          <button type="button" className="story-close" aria-label="Đóng Story" title="Đóng" onClick={() => setActiveStoryId(null)}>×</button>
        </header>
        <div className="story-viewer-media">
          {activeStory.attachment.kind === 'video' ? (
            <video src={activeStory.attachment.url} autoPlay controls playsInline onEnded={nextStory} />
          ) : (
            <img src={activeStory.attachment.url} alt={activeStory.attachment.name} />
          )}
        </div>
        <button type="button" className="story-nav story-previous" aria-label="Story trước" title="Story trước"
          disabled={activeStoryIndex === 0} onClick={previousStory}>‹</button>
        <button type="button" className="story-nav story-next" aria-label="Story tiếp theo" title="Story tiếp theo"
          onClick={nextStory}>›</button>
      </section>
    </div>
  )
}
