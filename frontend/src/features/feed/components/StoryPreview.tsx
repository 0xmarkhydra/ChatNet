import type { Story } from '../types'
import { cn } from '@/shared/lib/utils'

/** Fills its (relative) parent with the story's media, or the text story on its palette. */
export default function StoryPreview({ story, className, showText = true }: { story: Story; className?: string; showText?: boolean }) {
  const attachment = story.attachment
  if (!attachment) {
    return (
      <div data-story-background={story.background ?? 'berry'} aria-hidden="true"
        className={cn('absolute inset-0 grid place-items-center px-ui-2 text-center text-ui-caption font-bold text-white', className)}>
        {showText && <span className="line-clamp-4 wrap-anywhere">{story.text}</span>}
      </div>
    )
  }
  if (attachment.kind === 'video') {
    return <video className={cn('absolute inset-0 size-full object-cover', className)} src={attachment.url} muted playsInline preload="metadata" aria-hidden="true" />
  }
  return <img className={cn('absolute inset-0 size-full object-cover', className)} src={attachment.url} alt="" loading="lazy" />
}
