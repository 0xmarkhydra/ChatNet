import type { Story } from '../types'
import { cn } from '@/shared/lib/utils'

/** Fills its (relative) parent with the story's media, or the text story on its palette. */
export default function StoryPreview({ story, className }: { story: Story; className?: string }) {
  const attachment = story.attachment
  if (!attachment) {
    return (
      <div data-story-background={story.background ?? 'berry'} aria-hidden="true"
        className={cn('absolute inset-0 grid place-items-center px-ui-2 text-center text-ui-caption font-bold text-white', className)}>
        <span className="line-clamp-4 wrap-anywhere">{story.text}</span>
      </div>
    )
  }
  if (attachment.kind === 'video') {
    // iOS draws no frame from metadata alone; a start-time fragment makes it paint the first one.
    return <video className={cn('absolute inset-0 size-full object-cover', className)} src={`${attachment.url}#t=0.001`} muted playsInline preload="metadata" aria-hidden="true" />
  }
  return <img className={cn('absolute inset-0 size-full object-cover', className)} src={attachment.url} alt="" loading="lazy" />
}
