import { useCallback, useEffect, useRef, useState, type MouseEvent } from 'react'
import { AlertCircle, ChevronLeft, ChevronRight, Loader2, Plus } from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import UserAvatar from '../../../shared/ui/UserAvatar'
import type { PendingStoryView, Story } from '../types'
import { groupStories } from '../utils/storyGroups'
import StoryPreview from './StoryPreview'

type Props = {
  username: string
  displayName: string
  stories: Story[]
  seen: ReadonlySet<number>
  busy: boolean
  pending?: PendingStoryView | null
  onRetry?: () => void
  onCancel?: () => void
  onCreate: () => void
  onOpen: (id: number) => void
}

const arrow = 'absolute top-1/2 z-2 hidden size-10 -translate-y-1/2 cursor-pointer place-items-center rounded-full border border-border-subtle bg-card p-0 text-foreground shadow-ui-overlay app-desktop:grid'

// The strip clips anything outside a card and the card's picture covers an inset outline, so the
// keyboard focus ring is a layer on top of the picture.
const focusRing = <span aria-hidden="true" className="pointer-events-none absolute inset-0 z-1 hidden rounded-ui-md border-3 border-solid border-ring group-focus-visible:block" />

// A mouse or touch activation gives up focus, so closing the dialog it opens leaves no ring behind.
// Keyboard activation (detail 0) keeps it, and focus returns to the card.
function activate(event: MouseEvent<HTMLButtonElement>, action: () => void) {
  if (event.detail > 0) event.currentTarget.blur()
  action()
}

/** Story strip for every viewport: a "create" card, then one card per person (ring: gradient = unseen, grey = seen). */
export default function StoryTray({ username, displayName, stories, seen, busy, pending, onRetry, onCancel, onCreate, onOpen }: Props) {
  const groups = groupStories(stories, seen, username)
  const hasFriendStories = groups.some(group => !group.own)
  const stripRef = useRef<HTMLDivElement>(null)
  const [edges, setEdges] = useState({ prev: false, next: false })
  const measure = useCallback(() => {
    const strip = stripRef.current
    if (!strip) return
    const prev = strip.scrollLeft > 1
    const next = strip.scrollLeft + strip.clientWidth < strip.scrollWidth - 1
    setEdges(current => current.prev === prev && current.next === next ? current : { prev, next })
  }, [])
  // Observing again when the cards change reports once, so the arrows follow new content and resizes.
  useEffect(() => {
    if (!stripRef.current || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(stripRef.current)
    return () => observer.disconnect()
  }, [measure, groups.length, pending?.status])
  const page = (direction: 1 | -1) => {
    const strip = stripRef.current
    strip?.scrollBy({ left: direction * strip.clientWidth * 0.8, behavior: 'smooth' })
  }
  return (
    <section aria-label="Tin mới từ bạn bè" data-slot="story-tray" className="relative box-border bg-card py-ui-3 app-desktop:bg-transparent app-desktop:py-0">
      {edges.prev && (
        <button type="button" aria-label="Lướt về các tin trước" onClick={() => page(-1)} className={arrow + ' left-ui-2'}>
          <ChevronLeft size={22} aria-hidden="true" />
        </button>
      )}
      {edges.next && (
        <button type="button" aria-label="Xem thêm tin" onClick={() => page(1)} className={arrow + ' right-ui-2'}>
          <ChevronRight size={22} aria-hidden="true" />
        </button>
      )}
      <div ref={stripRef} onScroll={measure} className="flex gap-ui-2 overflow-x-auto pb-ui-1 [scrollbar-width:none]">
        {pending ? (
          <div role={pending.status === 'failed' ? 'alert' : 'status'} aria-label={pending.status === 'failed' ? 'Không đăng được tin' : 'Đang đăng tin'}
            className={cn('relative grid h-46 w-28 flex-none place-content-center justify-items-center gap-ui-2 overflow-hidden rounded-ui-md bg-(image:--soco-gradient) p-ui-2 text-center text-white', pending.status === 'failed' && 'ring-2 ring-destructive ring-inset')}>
            <span aria-hidden="true" className="absolute inset-0 bg-black/55" />
            {pending.status === 'failed' ? (
              <>
                <AlertCircle size={28} aria-hidden="true" className="relative" />
                <span className="relative text-ui-label font-semibold">Không đăng được</span>
                <button type="button" onClick={onRetry} className="relative min-h-control-touch cursor-pointer rounded-full border-0 bg-white px-ui-3 text-ui-label font-bold text-foreground">Thử lại</button>
                <button type="button" onClick={onCancel} className="relative min-h-control-touch cursor-pointer border-0 bg-transparent p-0 text-ui-label font-semibold text-white underline">Hủy</button>
              </>
            ) : (
              <>
                <Loader2 size={28} aria-hidden="true" className="relative animate-spin" />
                <span className="relative text-ui-label font-bold">{pending.percent === null ? 'Đang đăng...' : `Đang đăng ${pending.percent}%`}</span>
              </>
            )}
          </div>
        ) : (
        <button data-slot="story-card" type="button" disabled={busy} onClick={event => activate(event, onCreate)} aria-label="Tạo Story mới"
          className="group focus-visible:outline-none relative flex h-46 w-28 flex-none cursor-pointer flex-col items-stretch overflow-hidden rounded-ui-md border border-border bg-card p-0 text-left disabled:cursor-not-allowed disabled:opacity-60">
          <span className="grid flex-1 place-items-center overflow-hidden bg-(image:--soco-gradient)">
            <UserAvatar username={username} name={displayName} className="size-full text-ui-page font-black [--avatar-radius:0px]" />
          </span>
          <span className="relative grid h-14 place-items-end pb-ui-2">
            <span className="absolute -top-4 left-1/2 grid size-8 -translate-x-1/2 place-items-center rounded-full border-3 border-card bg-primary text-primary-foreground">
              <Plus size={16} strokeWidth={3} aria-hidden="true" />
            </span>
            <span className="w-full text-center text-ui-label font-bold text-foreground">Tạo tin</span>
          </span>
          {focusRing}
        </button>
        )}
        {groups.map(group => (
          <button data-slot="story-card" key={group.author} type="button" onClick={event => activate(event, () => onOpen(group.openId))}
            aria-label={group.own ? 'Xem tin của bạn' : `Xem Story của ${group.displayName}, ${group.hasUnseen ? 'chưa xem' : 'đã xem'}`}
            className={cn('group focus-visible:outline-none relative h-46 w-28 flex-none cursor-pointer overflow-hidden rounded-ui-md border-0 bg-muted p-0 shadow-ui-sm', !group.hasUnseen && 'opacity-80')}>
            <StoryPreview story={group.latest} />
            <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-20 bg-linear-to-t from-black/60 to-transparent" />
            <span className={cn('absolute top-ui-2 left-ui-2 grid size-10 place-items-center overflow-hidden rounded-full p-0.75', group.hasUnseen ? 'bg-(image:--soco-gradient)' : 'bg-border')}>
              <UserAvatar username={group.author} name={group.displayName} className="box-border size-full border-2 border-card text-ui-caption font-black" />
            </span>
            <span className="absolute inset-x-ui-2 bottom-ui-2 line-clamp-2 text-left text-ui-label font-bold text-white [text-shadow:0_1px_3px_rgba(0,0,0,.55)]">{group.own ? 'Tin của bạn' : group.displayName}</span>
            {focusRing}
          </button>
        ))}
        {!hasFriendStories && <p className="m-0 self-center text-ui-label text-muted-foreground">Chưa có tin mới từ bạn bè.</p>}
      </div>
    </section>
  )
}
