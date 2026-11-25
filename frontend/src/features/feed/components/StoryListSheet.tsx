import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/shared/ui/dialog'
import { cn } from '@/shared/lib/utils'
import UserAvatar from '../../../shared/ui/UserAvatar'
import type { Story } from '../types'
import { groupStories, relativeStoryTime, type StoryGroup } from '../utils/storyGroups'
import StoryPreview from './StoryPreview'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  username: string
  displayName: string
  stories: Story[]
  seen: ReadonlySet<number>
  busy: boolean
  onCreate: () => void
  onOpen: (id: number) => void
}

const rowCls = 'flex min-h-18 w-full cursor-pointer items-center gap-ui-3 border-0 border-t border-border bg-transparent p-0 text-left first:border-t-0'

function StoryRow({ group, unseen, onOpen }: { group: StoryGroup; unseen: boolean; onOpen: (id: number) => void }) {
  return (
    <button type="button" className={rowCls} onClick={() => onOpen(group.openId)}>
      <span className={cn('grid size-14 flex-none place-items-center overflow-hidden rounded-full p-0.75', unseen ? 'bg-(image:--soco-gradient)' : 'bg-border')}>
        <UserAvatar username={group.author} name={group.displayName} className="avatar size-full rounded-full border-2 border-card text-ui-caption font-bold" />
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn('block truncate text-ui-subtitle', unseen ? 'font-bold text-foreground' : 'font-semibold text-muted-foreground')}>{group.displayName}</span>
        <span className={cn('mt-0.5 block text-ui-label', unseen ? 'font-semibold text-primary' : 'text-muted-foreground')}>{relativeStoryTime(group.latest.createdAt)}</span>
      </span>
      <span className={cn('relative h-16 w-11 flex-none overflow-hidden rounded-ui-sm bg-muted', !unseen && 'opacity-60')}>
        <StoryPreview story={group.latest} showText={false} />
      </span>
    </button>
  )
}

/** Full list of stories: own stories, then new (unseen) and seen people. */
export default function StoryListSheet({ open, onOpenChange, username, displayName, stories, seen, busy, onCreate, onOpen }: Props) {
  const [tab, setTab] = useState<'all' | 'unseen'>('all')
  const groups = groupStories(stories, seen, username)
  const own = groups.find(group => group.own)
  const others = groups.filter(group => !group.own)
  const fresh = others.filter(group => group.hasUnseen)
  const viewed = tab === 'all' ? others.filter(group => !group.hasUnseen) : []
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} aria-describedby="story-list-desc"
        className="top-0 left-0 grid h-dvh max-h-none w-full max-w-none translate-x-0 translate-y-0 grid-rows-[auto_1fr] gap-0 rounded-none bg-background p-0">
        <header className="border-b border-border-subtle bg-card">
          <div className="flex h-14 items-center justify-between px-ui-4">
            <DialogTitle className="m-0 text-ui-page font-bold text-foreground">Tin</DialogTitle>
            <DialogDescription id="story-list-desc" className="sr-only">Danh sách tin của bạn và bạn bè trong 24 giờ</DialogDescription>
            <button type="button" aria-label="Đóng danh sách tin" onClick={() => onOpenChange(false)}
              className="min-h-control-touch cursor-pointer border-0 bg-transparent px-ui-1 text-ui-body font-semibold text-primary">Xong</button>
          </div>
          <div role="group" aria-label="Lọc tin" className="flex gap-ui-2 px-ui-3 pb-ui-2">
            {([['all', 'Tất cả'], ['unseen', 'Chưa xem']] as const).map(([id, label]) => (
              <button key={id} type="button" aria-pressed={tab === id} onClick={() => setTab(id)}
                className={cn('min-h-control-md cursor-pointer rounded-full border-0 px-ui-4 text-ui-body', tab === id ? 'bg-secondary font-bold text-primary' : 'bg-muted font-semibold text-muted-foreground')}>{label}</button>
            ))}
          </div>
        </header>
        <div className="grid content-start gap-ui-3 overflow-y-auto p-ui-3">
          <section aria-label="Tin của bạn" className="rounded-ui-lg bg-card px-ui-3">
            <div className="flex min-h-18 items-center gap-ui-3">
              <button type="button" disabled={!own} aria-label="Xem tin của bạn" onClick={() => own && onOpen(own.openId)}
                className="grid size-13 flex-none cursor-pointer place-items-center overflow-hidden rounded-full border-0 bg-(image:--soco-gradient) p-0 disabled:cursor-default">
                <UserAvatar username={username} name={displayName} className="avatar size-full rounded-none text-ui-page font-bold" />
              </button>
              <div className="min-w-0 flex-1">
                <div className="text-ui-subtitle font-bold text-foreground">Tin của bạn</div>
                <div className="mt-0.5 text-ui-label text-muted-foreground">{own ? `${own.stories.length} tin` : 'Chưa có tin nào'}</div>
              </div>
              <button type="button" disabled={busy} onClick={onCreate}
                className="flex min-h-control-touch flex-none cursor-pointer items-center gap-ui-1 rounded-ui-md border-0 bg-secondary px-ui-3 text-ui-label font-bold text-primary disabled:cursor-not-allowed disabled:opacity-60">
                <Plus size={14} strokeWidth={3} aria-hidden="true" />Tạo tin
              </button>
            </div>
          </section>
          {fresh.length > 0 && (
            <section aria-labelledby="story-new" className="rounded-ui-lg bg-card px-ui-3 pt-ui-3">
              <h2 id="story-new" className="m-0 mb-ui-1 text-ui-subtitle font-bold text-foreground">Tin mới</h2>
              {fresh.map(group => <StoryRow key={group.author} group={group} unseen onOpen={onOpen} />)}
            </section>
          )}
          {viewed.length > 0 && (
            <section aria-labelledby="story-seen" className="rounded-ui-lg bg-card px-ui-3 pt-ui-3">
              <h2 id="story-seen" className="m-0 mb-ui-1 text-ui-subtitle font-bold text-foreground">Đã xem</h2>
              {viewed.map(group => <StoryRow key={group.author} group={group} unseen={false} onOpen={onOpen} />)}
            </section>
          )}
          {fresh.length === 0 && viewed.length === 0 && (
            <p className="m-0 px-ui-2 py-ui-6 text-center text-ui-body text-muted-foreground">{tab === 'unseen' ? 'Bạn đã xem hết tin mới.' : 'Chưa có tin từ bạn bè.'}</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
