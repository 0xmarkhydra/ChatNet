import { AlertCircle, Loader2, Plus } from 'lucide-react'
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
  onSeeAll: () => void
}

/** Mobile story strip: a "create" card, then one card per person (ring: gradient = unseen, grey = seen). */
export default function StoryTray({ username, displayName, stories, seen, busy, pending, onRetry, onCancel, onCreate, onOpen, onSeeAll }: Props) {
  const groups = groupStories(stories, seen, username).filter(group => !group.own)
  return (
    <section aria-label="Tin mới từ bạn bè" className="bg-card py-ui-3">
      <div className="flex items-center justify-between px-ui-4 pb-ui-2">
        <h2 className="m-0 text-ui-section font-bold text-foreground">Tin mới từ bạn bè</h2>
        <button type="button" onClick={onSeeAll} className="min-h-control-touch cursor-pointer border-0 bg-transparent p-0 text-ui-body font-semibold text-primary">Xem tất cả</button>
      </div>
      <div className="flex gap-ui-2 overflow-x-auto px-ui-4 pb-ui-1 [scrollbar-width:none]">
        {pending ? (
          <div role={pending.status === 'failed' ? 'alert' : 'status'} aria-label={pending.status === 'failed' ? 'Không đăng được tin' : 'Đang đăng tin'}
            className={cn('relative grid h-46 w-28 flex-none place-content-center justify-items-center gap-ui-2 overflow-hidden rounded-ui-lg bg-(image:--soco-gradient) p-ui-2 text-center text-white', pending.status === 'failed' && 'ring-2 ring-destructive ring-inset')}>
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
        <button type="button" disabled={busy} onClick={onCreate} aria-label="Tạo Story mới"
          className="relative flex h-46 w-28 flex-none cursor-pointer flex-col overflow-hidden rounded-ui-lg border border-border bg-card p-0 text-left disabled:cursor-not-allowed disabled:opacity-60">
          <span className="grid flex-1 place-items-center overflow-hidden bg-(image:--soco-gradient)">
            <UserAvatar username={username} name={displayName} className="avatar size-full rounded-none text-ui-page font-bold" />
          </span>
          <span className="relative grid h-14 place-items-end pb-ui-2">
            <span className="absolute -top-4 left-1/2 grid size-8 -translate-x-1/2 place-items-center rounded-full border-3 border-card bg-primary text-primary-foreground">
              <Plus size={16} strokeWidth={3} aria-hidden="true" />
            </span>
            <span className="w-full text-center text-ui-label font-bold text-foreground">Tạo tin</span>
          </span>
        </button>
        )}
        {groups.map(group => (
          <button key={group.author} type="button" onClick={() => onOpen(group.openId)}
            aria-label={`Xem Story của ${group.displayName}, ${group.hasUnseen ? 'chưa xem' : 'đã xem'}`}
            className={cn('relative h-46 w-28 flex-none cursor-pointer overflow-hidden rounded-ui-lg border-0 bg-muted p-0 shadow-ui-sm', !group.hasUnseen && 'opacity-80')}>
            <StoryPreview story={group.latest} />
            <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-20 bg-linear-to-t from-black/60 to-transparent" />
            <span className={cn('absolute top-ui-2 left-ui-2 grid size-10 place-items-center overflow-hidden rounded-full p-0.75', group.hasUnseen ? 'bg-(image:--soco-gradient)' : 'bg-border')}>
              <UserAvatar username={group.author} name={group.displayName} className="avatar size-full rounded-full border-2 border-card text-ui-caption font-bold" />
            </span>
            <span className="absolute inset-x-ui-2 bottom-ui-2 line-clamp-2 text-left text-ui-label font-bold text-white [text-shadow:0_1px_3px_rgba(0,0,0,.55)]">{group.displayName}</span>
          </button>
        ))}
        {groups.length === 0 && <p className="m-0 self-center text-ui-label text-muted-foreground">Chưa có tin mới từ bạn bè.</p>}
      </div>
    </section>
  )
}
