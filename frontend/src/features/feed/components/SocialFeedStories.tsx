import { useState } from 'react'
import { ChevronRight, Plus } from 'lucide-react'
import type { Story } from '../types'
import UserAvatar from '../../../shared/ui/UserAvatar'
import '../styles/story-text.css'

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
    <section className="social-feed-stories-card min-[761px]:min-h-[163px] min-[761px]:overflow-hidden min-[761px]:rounded-2xl min-[761px]:border min-[761px]:border-[#e8ecf5] min-[761px]:bg-white min-[761px]:px-[21px] min-[761px]:pt-[15px] min-[761px]:pb-[10px] min-[761px]:shadow-[0_3px_16px_rgba(30,51,96,0.035)]" aria-label="Tin mới từ bạn bè">
      <div className="social-feed-stories-heading min-[761px]:flex min-[761px]:items-center min-[761px]:justify-between min-[761px]:gap-3 [&_h2]:m-0 [&_h2]:text-lg [&_h2]:leading-[26px] [&_h2]:font-bold [&_h2]:text-[#1b2d4b]">
        <h2>Tin mới từ bạn bè</h2>
        <button type="button" className="inline-flex cursor-pointer items-center gap-[3px] whitespace-nowrap border-0! bg-transparent! px-0! py-[5px]! text-ui-caption! font-semibold text-primary hover:text-[#154dbb]" aria-expanded={expanded} onClick={() => setExpanded(value => !value)}>
          {expanded ? 'Thu gọn' : 'Xem tất cả'} <ChevronRight size={16} aria-hidden="true" />
        </button>
      </div>
      <div className={`social-feed-story-strip mt-[11px] flex w-full items-start gap-6 overflow-x-auto overflow-y-hidden pb-[2px] overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${expanded ? 'is-expanded flex-wrap! overflow-visible! gap-y-4!' : ''}`}>
        <button type="button" className="social-feed-story flex w-[88px] min-w-0 basis-[88px] shrink-0 cursor-pointer flex-col items-start gap-1.5 border-0 bg-transparent p-0 text-[11px] leading-[17px] text-[#596e91]" aria-label="Tạo Story mới" disabled={busy} onClick={onCreate}>
          <span className="social-feed-story-ring is-self relative grid size-[69px] shrink-0 place-items-center rounded-full bg-[#e5edff] p-1">
            <UserAvatar username={username} name={displayName} className="social-feed-story-avatar grid size-[61px] place-items-center rounded-full border-[3px] border-white bg-[#eff3ff] object-cover" />
            <span className="social-feed-story-add absolute -right-[3px] -bottom-1 grid size-6 place-items-center rounded-full border-[3px] border-white bg-[#2563eb] text-white"><Plus size={16} aria-hidden="true" /></span>
          </span>
          <span className="social-feed-story-label block max-w-[84px] truncate">Tin của bạn</span>
        </button>
        {stories.map((story, index) => (
          <button type="button" className="social-feed-story flex w-[88px] min-w-0 basis-[88px] shrink-0 cursor-pointer flex-col items-start gap-1.5 border-0 bg-transparent p-0 text-[11px] leading-[17px] text-[#596e91]" key={story.id} onClick={() => onOpen(story.id)}
            aria-label={`Xem Story của ${story.authorDisplayName || story.author}`}>
            <span className={`social-feed-story-ring relative grid size-[69px] shrink-0 place-items-center rounded-full p-1 ${index % 2 ? 'is-purple bg-[#8955f6]' : 'bg-[#2563eb]'}`}>
              {!story.attachment
                ? <div className="social-feed-story-cover story-text-avatar block size-[61px] rounded-full border-[3px] border-white bg-[#eff3ff] object-cover text-center text-sm font-bold text-white"
                    data-story-background={story.background ?? 'berry'} aria-hidden="true">Aa</div>
                : story.attachment.kind === 'image' && story.attachment.url
                ? <img className="social-feed-story-cover block size-[61px] rounded-full border-[3px] border-white bg-[#eff3ff] object-cover" src={story.attachment.url} alt="" loading="lazy" />
                : story.attachment.kind === 'video' && story.attachment.url
                  ? <video className="social-feed-story-cover block size-[61px] rounded-full border-[3px] border-white bg-[#eff3ff] object-cover" src={story.attachment.url} muted playsInline preload="metadata" aria-hidden="true" />
                  : <UserAvatar username={story.author} name={story.authorDisplayName || story.author} className="social-feed-story-avatar grid size-[61px] place-items-center rounded-full border-[3px] border-white bg-[#eff3ff] object-cover" />}
            </span>
            <span className="social-feed-story-label block max-w-[84px] truncate">{story.author === username ? 'Story của bạn' : story.authorDisplayName || story.author}</span>
          </button>
        ))}
        {stories.length === 0 && <p className="social-feed-no-stories m-0 self-center text-xs text-[#9aa7bb]">Chưa có tin mới từ bạn bè.</p>}
      </div>
    </section>
  )
}