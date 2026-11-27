import { useUiTranslation, useUiLocale } from '@/shared/i18n/locale'
import { useEffect, useRef, useState } from 'react'
import { ChevronUp, MessageCircle, X } from 'lucide-react'
import type { ApiRequest } from '@/shared/types/api'
import { userLabel } from '@/shared/utils/userLabel'
import { reactionLabel } from '@/shared/utils/reactions'
import UserAvatar from '../../../shared/ui/UserAvatar'
import { readStoryViews, type StoryViewerEntry } from '../api/stories'
import { relativeStoryTime } from '../utils/storyTime'

const wideButton = 'min-h-control-touch w-full cursor-pointer rounded-ui-md border-0 bg-muted px-ui-3 text-ui-body font-semibold text-foreground'

type Props = {
  request: ApiRequest
  storyId: number
  open: boolean
  onOpenChange: (open: boolean) => void
  onOpenMessages: () => void
}

/** Owner view of a story: an activity bar, and a bottom sheet listing who viewed it and how they reacted. */
export default function StoryActivity({ request, storyId, open, onOpenChange, onOpenMessages }: Props) {
  const trUi = useUiTranslation()
  const locale = useUiLocale()
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000)
    return () => window.clearInterval(timer)
  }, [])

  const [viewers, setViewers] = useState<StoryViewerEntry[] | null>(null)
  const [total, setTotal] = useState(0)
  const [next, setNext] = useState<number | undefined>()
  const [after, setAfter] = useState<number | undefined>()
  const [revision, setRevision] = useState(0)
  const [failed, setFailed] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const wasOpen = useRef(false)

  useEffect(() => {
    const controller = new AbortController()
    void readStoryViews(request, storyId, controller.signal, after).then(data => {
      if (controller.signal.aborted) return
      setViewers(current => after ? [...(current ?? []), ...data.viewers] : data.viewers)
      setTotal(data.total)
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

  const summary = !viewers ? (failed ? 'Không tải được' : 'Đang tải…') : total === 0 ? 'Chưa có người xem' : `${total} người xem`
  const kinds = [...new Set(viewers?.flatMap(viewer => viewer.emoji ? [viewer.emoji] : []))].join('')
  const retry = () => {
    setFailed(false)
    setRevision(value => value + 1)
  }

  return (
    <>
      <div className="absolute inset-x-0 bottom-0 z-3 px-ui-3 pb-[max(var(--soco-space-4,16px),env(safe-area-inset-bottom))]">
        <button ref={triggerRef} type="button" aria-haspopup="dialog" aria-expanded={open} aria-label={trUi("common.ui.activityNamed", { v1: String(summary) })}
          onClick={() => {
            setAfter(undefined)
            retry()
            onOpenChange(true)
          }}
          className="flex min-h-12 w-full cursor-pointer items-center gap-ui-3 border-0 bg-transparent p-0 text-left text-white">
          {viewers && viewers.length > 0 && (
            <span aria-hidden="true" className="flex flex-none -space-x-2">
              {viewers.slice(0, 3).map(viewer => (
                <UserAvatar key={viewer.id} username={viewer.username} name={userLabel(viewer.displayName, viewer.username)}
                  className="box-border size-8 flex-none border-2 border-white text-ui-caption font-black" />
              ))}
            </span>
          )}
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-ui-1 text-ui-body font-bold">Hoạt động <ChevronUp size={16} aria-hidden="true" /></span>
            <span className="block truncate text-ui-label text-white/85">{summary}{kinds && <span aria-hidden="true"> · {kinds}</span>}</span>
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
              <button type="button" autoFocus aria-label={trUi("common.ui.closeActivity")} onClick={() => onOpenChange(false)}
                className="grid size-control-touch flex-none cursor-pointer place-items-center rounded-full border-0 bg-muted p-0 text-foreground">
                <X size={20} aria-hidden="true" />
              </button>
            </header>
            <div className="min-h-24 overflow-y-auto px-ui-4">
              {viewers && viewers.length > 0 && (
                <ul aria-label={trUi("chat.seenBy")} className="m-0 list-none p-0">
                  {viewers.map(viewer => {
                    const label = userLabel(viewer.displayName, viewer.username)
                    return (
                      <li key={viewer.id} className="flex min-h-15 items-center gap-ui-3 border-t border-border-subtle">
                        <UserAvatar username={viewer.username} name={label} className="box-border size-10 flex-none text-ui-label font-black" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-ui-body font-semibold">{label}</span>
                          {viewer.viewedAt && <time dateTime={viewer.viewedAt} className="block text-ui-caption text-muted-foreground">{relativeStoryTime(viewer.viewedAt, trUi('feed.justNow'), now, locale)}</time>}
                        </span>
                        {viewer.emoji && <span role="img" aria-label={reactionLabel(viewer.emoji, trUi)} data-slot="reaction" className="flex-none text-xl leading-none">{viewer.emoji}</span>}
                      </li>
                    )
                  })}
                </ul>
              )}
              {failed && (
                <div role="alert" className="grid gap-ui-2 py-ui-3">
                  <p className="m-0 text-ui-body text-muted-foreground">Không thể tải lượt xem.</p>
                  <button type="button" className={wideButton} onClick={retry}>{trUi("common.reload")}</button>
                </div>
              )}
              {next && next !== after && <button type="button" className={wideButton} onClick={() => setAfter(next)}>{trUi("common.seeMore")}</button>}
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