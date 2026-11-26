import { useEffect, useRef, useState } from 'react'
import { ChevronUp, MessageCircle, X } from 'lucide-react'
import type { ApiRequest } from '@/shared/types/api'
import { userLabel } from '@/shared/utils/userLabel'
import { reactionLabel } from '@/shared/utils/reactions'
import UserAvatar from '../../../shared/ui/UserAvatar'
import { readStoryLikes, type StoryLiker } from '../api/stories'

const wideButton = 'min-h-control-touch w-full cursor-pointer rounded-ui-md border-0 bg-muted px-ui-3 text-ui-body font-semibold text-foreground'

type Props = {
  request: ApiRequest
  storyId: number
  open: boolean
  onOpenChange: (open: boolean) => void
  onOpenMessages: () => void
}

/** Owner view of a story: an activity bar, and a bottom sheet listing who reacted. */
export default function StoryActivity({ request, storyId, open, onOpenChange, onOpenMessages }: Props) {
  const [likers, setLikers] = useState<StoryLiker[] | null>(null)
  const [next, setNext] = useState<number | undefined>()
  const [after, setAfter] = useState<number | undefined>()
  const [revision, setRevision] = useState(0)
  const [failed, setFailed] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const wasOpen = useRef(false)

  useEffect(() => {
    const controller = new AbortController()
    void readStoryLikes(request, storyId, controller.signal, after).then(data => {
      if (controller.signal.aborted || !('likers' in data)) return
      setLikers(current => after ? [...(current ?? []), ...data.likers] : data.likers)
      setNext(data.next)
      setFailed(false)
    }).catch(() => {
      if (!controller.signal.aborted) setFailed(true)
    })
    return () => controller.abort()
  }, [request, storyId, after, revision])

  useEffect(() => {
    if (wasOpen.current && !open) triggerRef.current?.focus()
    wasOpen.current = open
  }, [open])

  const count = likers ? `${likers.length}${next ? '+' : ''}` : null
  const summary = count === null ? (failed ? 'Không tải được' : 'Đang tải…') : count === '0' ? 'Chưa có cảm xúc nào' : `${count} cảm xúc`
  // Hearts from before reaction types, or from a server without them, have no emoji.
  const kinds = [...new Set(likers?.map(liker => liker.emoji || '❤️'))].join('')
  const retry = () => {
    setFailed(false)
    setRevision(value => value + 1)
  }

  return (
    <>
      <div className="absolute inset-x-0 bottom-0 z-3 px-ui-3 pb-[max(var(--soco-space-4,16px),env(safe-area-inset-bottom))]">
        <button ref={triggerRef} type="button" aria-haspopup="dialog" aria-expanded={open} aria-label={`Hoạt động: ${summary}`}
          onClick={() => {
            setAfter(undefined)
            retry()
            onOpenChange(true)
          }}
          className="flex min-h-12 w-full cursor-pointer items-center gap-ui-3 border-0 bg-transparent p-0 text-left text-white">
          {likers && likers.length > 0 && (
            <span aria-hidden="true" className="flex flex-none -space-x-2">
              {likers.slice(0, 3).map(liker => (
                <UserAvatar key={liker.id} username={liker.username} name={userLabel(liker.displayName, liker.username)}
                  className="avatar box-border size-8! flex-none! rounded-full! border-2 border-white shadow-none! text-ui-caption font-bold" />
              ))}
            </span>
          )}
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-ui-1 text-ui-body font-bold">Hoạt động <ChevronUp size={16} aria-hidden="true" /></span>
            <span className="block truncate text-ui-label text-white/85">{summary}</span>
          </span>
        </button>
      </div>

      {open && (
        <div role="dialog" aria-modal="true" aria-labelledby="story-activity-title" className="absolute inset-0 z-6 grid place-items-end bg-black/55"
          onMouseDown={event => { if (event.target === event.currentTarget) onOpenChange(false) }}>
          <div className="grid max-h-[70%] w-full grid-rows-[auto_minmax(0,1fr)_auto] rounded-t-ui-xl bg-card text-foreground">
            <header className="flex items-center gap-ui-2 py-ui-2 pr-ui-2 pl-ui-4">
              <h2 id="story-activity-title" className="m-0 flex min-w-0 flex-1 items-center gap-ui-2 text-ui-section font-bold">
                {kinds && <span aria-hidden="true" className="flex-none">{kinds}</span>}
                <span className="truncate">{summary}</span>
              </h2>
              <button type="button" autoFocus aria-label="Đóng hoạt động" onClick={() => onOpenChange(false)}
                className="grid size-control-touch flex-none cursor-pointer place-items-center rounded-full border-0 bg-muted p-0 text-foreground">
                <X size={20} aria-hidden="true" />
              </button>
            </header>
            <div className="min-h-24 overflow-y-auto px-ui-4">
              {likers && likers.length > 0 && (
                <ul aria-label="Người đã bày tỏ cảm xúc" className="m-0 list-none p-0">
                  {likers.map(liker => {
                    const label = userLabel(liker.displayName, liker.username)
                    return (
                      <li key={liker.id} className="flex min-h-15 items-center gap-ui-3 border-t border-border-subtle">
                        <UserAvatar username={liker.username} name={label} className="avatar box-border size-10! flex-none! rounded-full! shadow-none! text-ui-label font-bold" />
                        <span className="min-w-0 flex-1 truncate text-ui-body font-semibold">{label}</span>
                        <span role="img" aria-label={reactionLabel(liker.emoji || '❤️')} className="flex-none text-xl leading-none">{liker.emoji || '❤️'}</span>
                      </li>
                    )
                  })}
                </ul>
              )}
              {failed && (
                <div role="alert" className="grid gap-ui-2 py-ui-3">
                  <p className="m-0 text-ui-body text-muted-foreground">Không thể tải cảm xúc.</p>
                  <button type="button" className={wideButton} onClick={retry}>Tải lại</button>
                </div>
              )}
              {next && next !== after && <button type="button" className={wideButton} onClick={() => setAfter(next)}>Xem thêm</button>}
            </div>
            <div className="grid gap-ui-2 border-t border-border-subtle px-ui-4 pt-ui-3 pb-[max(var(--soco-space-4,16px),env(safe-area-inset-bottom))]">
              <p className="m-0 text-ui-label text-muted-foreground">Câu trả lời cho tin của bạn nằm trong Tin nhắn.</p>
              <button type="button" onClick={onOpenMessages}
                className="flex min-h-control-touch w-full cursor-pointer items-center justify-center gap-ui-2 rounded-ui-md border-0 bg-secondary px-ui-3 text-ui-body font-bold text-primary">
                <MessageCircle size={18} aria-hidden="true" /> Mở Tin nhắn
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
