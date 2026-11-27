import { useUiTranslation, useUiLocale } from '@/shared/i18n/locale'
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import {
  BookmarkPlus, ChevronLeft, ChevronRight, Flag, LockKeyhole, MessageCircle,
  MoreHorizontal, Pause, Play, Send, Share2, Trash2, UserRound,
  Volume2, VolumeX, X,
} from 'lucide-react'
import { userLabel } from '../../../shared/utils/userLabel'
import { useScopedState } from '../../../shared/hooks/useScopedState'
import type { Story } from '../types'
import type { ApiRequest } from '@/shared/types/api'
import StoryReactionBar from './StoryReactionBar'
import { recordStoryView } from '../api/stories'
import { relativeStoryTime } from '../utils/storyTime'
import StoryActivity from './StoryActivity'
import StoryHighlightEditor from './StoryHighlightEditor'
import UserAvatar from '../../../shared/ui/UserAvatar'
import { useLatest } from '../../../shared/hooks/useLatest'
import { bindStoryVideoProgress } from '../lib/storyVideoProgress'

type Props = {
  activeStory: Story
  stories: Story[]
  setActiveStoryId: (id: number | null) => void
} & ({ mode: 'highlight'; title: string } | {
  mode?: 'feed'
  request?: ApiRequest
  name: string
  storyBusy: boolean
  deleteStory: (story: Story) => Promise<void>
  onReply: (story: Story, message: string) => Promise<boolean>
  onProfile: (username: string) => void
  onShare: (story: Story) => void
  onReport: (story: Story) => void
  onOpenMessages: () => void
})

const STORY_DURATION = 7000

export default function StoryViewer(props: Props) {
  const trUi = useUiTranslation()
  const locale = useUiLocale()
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000)
    return () => window.clearInterval(timer)
  }, [])

  const { activeStory, stories, setActiveStoryId } = props
  const highlight = props.mode === 'highlight' ? props : null
  const feed = props.mode === 'highlight' ? null : props
  const request = feed?.request
  const authorLabel = userLabel(activeStory.authorDisplayName, activeStory.author)
  const [paused, setPaused] = useScopedState(activeStory.id, false)
  const [muted, setMuted] = useState(true)
  const [imageProgress, setImageProgress] = useScopedState(activeStory.id, 0)
  const [reply, setReply] = useScopedState(activeStory.id, '')
  const [replySending, setReplySending] = useScopedState(activeStory.id, false)
  const [highlightOpen, setHighlightOpen] = useScopedState(activeStory.id, false)
  const [highlightSaved, setHighlightSaved] = useScopedState(activeStory.id, false)
  const [menuOpen, setMenuOpen] = useScopedState(activeStory.id, false)
  const [activityOpen, setActivityOpen] = useScopedState(activeStory.id, false)
  const imageElapsedRef = useRef(0)
  const replySequence = useRef(0)
  const activeStoryId = useLatest(activeStory.id)
  const videoRef = useRef<HTMLVideoElement>(null)
  const videoProgressRef = useRef<HTMLSpanElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const replyInputRef = useRef<HTMLInputElement>(null)
  const optionsButtonRef = useRef<HTMLButtonElement>(null)

  const groups = useMemo(() => {
    const authors = new Map<string, Story[]>()
    for (const story of stories) {
      if (!authors.has(story.author)) authors.set(story.author, [])
      authors.get(story.author)!.push(story)
    }
    return Array.from(authors.values()).map((items) => props.mode === 'highlight' ? items
      : [...items].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt)),
    )
  }, [stories, props.mode])

  const sequence = useMemo(() => groups.flat(), [groups])
  const sequenceIndex = sequence.findIndex((story) => story.id === activeStory.id)
  const previousId = sequenceIndex > 0 ? sequence[sequenceIndex - 1].id : null
  const nextId = sequence[sequenceIndex + 1]?.id ?? null
  const authorStories = groups.find((items) => items[0]?.author === activeStory.author) ?? [activeStory]
  const authorIndex = authorStories.findIndex((story) => story.id === activeStory.id)
  const isOwner = activeStory.author === feed?.name
  const attachment = activeStory.attachment
  const isVideo = attachment?.kind === 'video'
  const duration = attachment ? STORY_DURATION : 15_000

  const latestRequest = useLatest(request)
  const countsAsView = Boolean(request && feed && !isOwner)
  useEffect(() => {
    const send = latestRequest.current
    if (!countsAsView || !send) return
    // Best effort: a view that cannot be recorded must not interrupt watching; reopening retries it.
    void recordStoryView(send, activeStory.id).catch(() => {})
  }, [activeStory.id, countsAsView, latestRequest])

  useEffect(() => {
    imageElapsedRef.current = 0
    ++replySequence.current
  }, [activeStory.id])

  useEffect(() => {
    if (isVideo || paused || menuOpen || replySending || activityOpen) return
    const started = performance.now()
    const timer = window.setInterval(() => {
      const elapsed = Math.min(duration, imageElapsedRef.current + performance.now() - started)
      setImageProgress((elapsed / duration) * 100)
      if (elapsed >= duration) {
        window.clearInterval(timer)
        setActiveStoryId(nextId)
      }
    }, 50)
    return () => {
      window.clearInterval(timer)
      imageElapsedRef.current = Math.min(duration, imageElapsedRef.current + performance.now() - started)
    }
  }, [activeStory.id, duration, isVideo, paused, menuOpen, replySending, activityOpen, nextId, setActiveStoryId, setImageProgress])

  useEffect(() => {
    const video = videoRef.current
    const bar = videoProgressRef.current
    if (isVideo && video && bar) return bindStoryVideoProgress(video, bar)
  }, [activeStory.id, isVideo, attachment?.url])

  useEffect(() => {
    if (!isVideo || !videoRef.current) return
    if (paused || menuOpen || replySending || activityOpen) videoRef.current.pause()
    else void videoRef.current.play().catch(() => setPaused(true))
  }, [activeStory.id, isVideo, paused, menuOpen, replySending, activityOpen, setPaused])

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null
    dialogRef.current?.focus()
    return () => previouslyFocused?.focus?.()
  }, [])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (activityOpen) {
        if (event.key === 'Escape') {
          event.preventDefault()
          setActivityOpen(false)
        }
        return
      }
      if (highlightOpen) {
        if (event.key === 'Escape') {
          event.preventDefault()
          setHighlightOpen(false)
          optionsButtonRef.current?.focus()
        }
        return
      }
      if (event.key === 'Escape') {
        event.preventDefault()
        if (menuOpen) setMenuOpen(false)
        else setActiveStoryId(null)
        return
      }
      const typing = event.target instanceof HTMLElement &&
        (event.target.matches('input,textarea') || event.target.isContentEditable)
      if (typing) return
      if (event.key === 'ArrowLeft' && previousId !== null) {
        event.preventDefault()
        setActiveStoryId(previousId)
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault()
        setActiveStoryId(nextId)
      }
      if (event.code === 'Space') {
        event.preventDefault()
        setPaused((current) => !current)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [activityOpen, setActivityOpen, highlightOpen, menuOpen, nextId, previousId, setActiveStoryId, setHighlightOpen, setMenuOpen, setPaused])

  async function submitReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const text = reply.trim()
    if (!feed || isOwner || replySending || !text) return
    const id = ++replySequence.current
    const storyId = activeStory.id
    setReplySending(true)
    try {
      if (await feed.onReply(activeStory, text) && id === replySequence.current && activeStoryId.current === storyId) setReply('')
    } finally {
      if (id === replySequence.current && activeStoryId.current === storyId) setReplySending(false)
    }
  }

  const closeHighlight = () => {
    setHighlightOpen(false)
    optionsButtonRef.current?.focus()
  }
  const iconButton = 'grid size-control-touch flex-none cursor-pointer place-items-center rounded-full border-0 bg-transparent p-0 text-white hover:bg-white/15 aria-expanded:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50'
  const menuItem = 'flex min-h-control-touch w-full cursor-pointer items-center gap-ui-2 rounded-ui-sm border-0 bg-transparent px-ui-3 text-left text-ui-body font-semibold text-white hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50'
  const panelButton = 'flex min-h-control-touch w-full cursor-pointer items-center gap-ui-3 rounded-ui-md border-0 bg-white/8 px-ui-3 text-left text-ui-body font-semibold text-white hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-50'

  return (
    <div
      data-slot="story-viewer"
      className="fixed inset-0 z-350 bg-story-canvas text-white"
      role="dialog"
      aria-modal="true"
      aria-label={'Khoảnh khắc của ' + authorLabel}
      ref={dialogRef}
      tabIndex={-1}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) setActiveStoryId(null)
      }}
    >
      <div className="mx-auto grid h-dvh w-full max-w-396 lg:grid-cols-[320px_minmax(0,1fr)_300px] lg:gap-ui-6 lg:p-ui-6"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) setActiveStoryId(null)
        }}>
        <aside className="hidden min-h-0 flex-col gap-ui-3 rounded-ui-lg bg-white/6 p-ui-3 lg:flex" aria-label={trUi("common.ui.storyAuthors")}>
          <header className="px-ui-2">
            <h2 className="m-0 text-ui-section font-bold">{highlight ? trUi("feed.highlights") : 'Khoảnh khắc mới'}</h2>
            <p className="m-0 mt-ui-1 text-ui-label text-white/70">{highlight ? stories.length + ' tin trên hồ sơ' : groups.length + ' người vừa đăng tin'}</p>
          </header>
          <div className="grid min-h-0 content-start gap-ui-1 overflow-y-auto">
            {groups.map((items) => {
              const latest = items[items.length - 1]
              const active = items[0].author === activeStory.author
              const label = userLabel(latest.authorDisplayName, latest.author)
              return (
                <button key={latest.author} type="button"
                  className={'flex min-h-control-touch w-full cursor-pointer items-center gap-ui-3 rounded-ui-md border-0 p-ui-2 text-left text-white ' + (active ? 'bg-white/15' : 'bg-transparent hover:bg-white/8')}
                  aria-current={active ? 'true' : undefined}
                  onClick={() => setActiveStoryId(active ? activeStory.id : items[0].id)}>
                  <span className={'grid size-12 flex-none place-items-center overflow-hidden rounded-full p-0.75 ' + (active ? 'bg-(image:--soco-gradient)' : 'bg-white/30')}>
                    <UserAvatar storyStatus="none" username={latest.author} name={label} className="box-border size-full border-2 border-story-canvas text-ui-label font-black" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <strong className="block truncate text-ui-body">{label}</strong>
                    <small className="block text-ui-caption text-white/70">{relativeStoryTime(latest.createdAt, trUi('feed.justPosted'), now, locale)}</small>
                  </span>
                  {items.length > 1 && <span className="grid min-w-6 flex-none place-items-center rounded-full bg-white/20 px-ui-1 text-ui-caption font-bold">{items.length}</span>}
                </button>
              )
            })}
          </div>
        </aside>

        <section className="relative isolate mx-auto h-dvh w-full overflow-hidden bg-black lg:aspect-9/16 lg:h-full lg:w-auto lg:max-w-full lg:rounded-ui-xl"
          aria-label={'Đang xem Story của ' + authorLabel}>
          <div data-slot="story-media" className="absolute inset-0 z-0 grid place-items-center">
            {!attachment ? (
              <div className="story-screen-text box-border grid size-full place-items-center px-[clamp(3rem,12%,5rem)] py-[clamp(3.75rem,16dvh,7rem)] text-center text-[length:clamp(1.15rem,3vw,1.9rem)] leading-[1.35] font-bold text-white story-narrow:px-[3.1rem] story-narrow:py-[clamp(3.75rem,13dvh,5.5rem)]"
                data-story-background={activeStory.background ?? 'berry'}>
                <p className="m-0 max-h-full min-h-0 w-full overflow-auto wrap-anywhere whitespace-pre-wrap" tabIndex={0} onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}>{activeStory.text}</p>
              </div>
            ) : isVideo ? (
              <video key={activeStory.id} ref={videoRef} src={attachment.url} className="size-full object-contain"
                autoPlay muted={muted} playsInline
                onEnded={() => setActiveStoryId(nextId)}
                aria-label={attachment.name}
              />
            ) : (
              <img key={activeStory.id} src={attachment.url} alt={attachment.name} className="size-full object-contain" />
            )}
          </div>
          <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 z-1 h-32 bg-linear-to-b from-black/55 to-transparent" />
          <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 z-1 h-40 bg-linear-to-t from-black/60 to-transparent" />

          {previousId !== null && (
            <button type="button" aria-label={trUi("common.ui.previousStory")} onClick={() => setActiveStoryId(previousId)}
              className="group absolute inset-y-24 left-0 z-2 flex w-1/3 cursor-pointer items-center justify-start border-0 bg-transparent pl-ui-3 text-white">
              <ChevronLeft size={32} aria-hidden="true" className="hidden rounded-full bg-black/40 p-ui-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 lg:block" />
            </button>
          )}
          {nextId !== null && (
            <button type="button" aria-label={trUi("common.ui.nextStory")} onClick={() => setActiveStoryId(nextId)}
              className="group absolute inset-y-24 right-0 z-2 flex w-1/3 cursor-pointer items-center justify-end border-0 bg-transparent pr-ui-3 text-white">
              <ChevronRight size={32} aria-hidden="true" className="hidden rounded-full bg-black/40 p-ui-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 lg:block" />
            </button>
          )}

          <div className="absolute inset-x-0 top-0 z-3 px-ui-2 pt-ui-3">
            <div className="flex gap-1 px-ui-1" role="progressbar" aria-valuemin={0} aria-valuemax={authorStories.length} aria-valuenow={authorIndex + 1}
              aria-label={'Tin ' + (authorIndex + 1) + ' trên ' + authorStories.length}>
              {authorStories.map((story, index) => (
                <span key={story.id} className="h-0.75 flex-1 overflow-hidden rounded-full bg-white/40">
                  {isVideo && index === authorIndex ? (
                    <span key="video" ref={videoProgressRef} className="block h-full w-full origin-left bg-white [transform:scaleX(0)]" />
                  ) : (
                    <span key="static" className="block h-full bg-white"
                      style={{ width: index < authorIndex ? '100%' : index === authorIndex ? imageProgress + '%' : '0%' }} />
                  )}
                </span>
              ))}
            </div>
            <div className="mt-ui-2 flex items-center gap-ui-2 px-ui-1">
              {feed ? (
                <button type="button" className="flex min-w-0 flex-1 cursor-pointer items-center gap-ui-2 border-0 bg-transparent p-0 text-left text-white"
                  onClick={() => feed.onProfile(activeStory.author)} title={'Xem hồ sơ ' + authorLabel}>
                  <UserAvatar storyStatus="none" username={activeStory.author} name={authorLabel} className="size-10.5 flex-none border-2 border-white text-ui-label font-black" />
                  <span className="min-w-0">
                    <strong className="block truncate text-ui-subtitle [text-shadow:0_1px_3px_rgba(0,0,0,.5)]">{authorLabel}</strong>
                    <time dateTime={activeStory.createdAt} className="block text-ui-caption text-white/85">{relativeStoryTime(activeStory.createdAt, trUi('feed.justPosted'), now, locale)}</time>
                  </span>
                </button>
              ) : (
                <span className="flex min-w-0 flex-1 items-center gap-ui-2">
                  <UserAvatar storyStatus="none" username={activeStory.author} name={authorLabel} className="size-10.5 flex-none border-2 border-white text-ui-label font-black" />
                  <span className="min-w-0">
                    <strong className="block truncate text-ui-subtitle [text-shadow:0_1px_3px_rgba(0,0,0,.5)]">{authorLabel}</strong>
                    <time dateTime={activeStory.createdAt} className="block text-ui-caption text-white/85">{relativeStoryTime(activeStory.createdAt, trUi('feed.justPosted'), now, locale)}</time>
                  </span>
                </span>
              )}
              <button type="button" className={iconButton} title={paused ? trUi("common.next") : trUi("common.ui.pause")}
                aria-label={paused ? trUi("common.ui.resumeStory") : trUi("common.ui.pauseStory")} onClick={() => setPaused((v) => !v)}>
                {paused ? <Play size={20} aria-hidden="true" /> : <Pause size={20} aria-hidden="true" />}
              </button>
              {isVideo && (
                <button type="button" className={iconButton} aria-label={muted ? trUi("common.ui.soundOn") : trUi("common.ui.soundOff")} onClick={() => setMuted((v) => !v)}>
                  {muted ? <VolumeX size={20} aria-hidden="true" /> : <Volume2 size={20} aria-hidden="true" />}
                </button>
              )}
              {feed && (
                <div className="relative">
                  <button ref={optionsButtonRef} type="button" className={iconButton} aria-label={trUi("common.ui.storyOptions")} aria-expanded={menuOpen}
                    onClick={() => setMenuOpen((v) => !v)}>
                    <MoreHorizontal size={22} aria-hidden="true" />
                  </button>
                  {menuOpen && (
                    <div className="absolute top-full right-0 z-5 mt-ui-1 grid w-56 gap-ui-1 rounded-ui-md bg-story-surface p-ui-1 shadow-ui-overlay">
                      {isOwner ? (
                        <button type="button" className={menuItem} disabled={feed.storyBusy} onClick={() => {
                          setMenuOpen(false)
                          void feed.deleteStory(activeStory)
                        }}><Trash2 size={18} aria-hidden="true" /> Xóa Story</button>
                      ) : (
                        <button type="button" className={menuItem} onClick={() => {
                          setMenuOpen(false)
                          feed.onReport(activeStory)
                        }}><Flag size={18} aria-hidden="true" /> Báo cáo Story</button>
                      )}
                      {request && isOwner && (
                        <button type="button" className={menuItem} onClick={() => {
                          setMenuOpen(false)
                          setPaused(true)
                          setHighlightOpen(true)
                        }}><BookmarkPlus size={18} aria-hidden="true" />{trUi("feed.addHighlight")}</button>
                      )}
                      <button type="button" className={menuItem} onClick={() => {
                        setMenuOpen(false)
                        feed.onShare(activeStory)
                      }}><Share2 size={18} aria-hidden="true" />{trUi("common.share")}</button>
                    </div>
                  )}
                </div>
              )}
              <button type="button" className={iconButton} onClick={() => setActiveStoryId(null)}>
                <X size={24} aria-hidden="true" /><span className="sr-only">{trUi("common.close")}</span>
              </button>
            </div>
          </div>

          {request && feed && isOwner ? (
            <StoryActivity key={activeStory.id} request={request} storyId={activeStory.id}
              open={activityOpen} onOpenChange={setActivityOpen} onOpenMessages={feed.onOpenMessages} />
          ) : (
            <div className="absolute inset-x-0 bottom-0 z-3 px-ui-3 pb-[max(var(--soco-space-4,16px),env(safe-area-inset-bottom))]">
              {request && feed && <StoryReactionBar key={activeStory.id} request={request} storyId={activeStory.id} />}
              <div className="mt-ui-2 flex items-center gap-ui-2">
                {feed && !isOwner ? (
                  <form className="flex min-w-0 flex-1 items-center gap-ui-2" onSubmit={submitReply}>
                    <input ref={replyInputRef} value={reply}
                      onChange={(event) => setReply(event.target.value)}
                      onFocus={() => setPaused(true)}
                      onBlur={() => setPaused(false)}
                      placeholder={trUi('common.ui.replyToPlaceholder', { name: authorLabel })}
                      aria-label={'Trả lời Story của ' + authorLabel} maxLength={2000}
                      className="h-12 min-w-0 flex-1 rounded-full border border-white/70 bg-black/30 px-ui-4 text-[length:var(--soco-type-subtitle)] text-white outline-none placeholder:text-white/75 focus-visible:border-white focus-visible:ring-2 focus-visible:ring-white/40" />
                    <button type="submit" title={trUi("common.ui.sendStoryReply")} aria-label={trUi("common.ui.replyStory")} disabled={!reply.trim() || replySending}
                      className={iconButton + ' size-12'}>
                      <Send size={22} aria-hidden="true" />
                    </button>
                  </form>
                ) : <span className="flex-1" />}
              </div>
            </div>
          )}

          {highlightSaved && <p role="status" className="absolute bottom-24 left-ui-3 z-5 m-0 rounded-ui-md bg-card px-ui-3 py-ui-2 text-ui-label text-foreground">Đã thêm vào Tin nổi bật.</p>}
          {request && isOwner && highlightOpen && (
            <div role="dialog" aria-modal="true" aria-labelledby="story-highlight-title" aria-describedby="story-highlight-desc"
              className="absolute inset-0 z-6 grid place-items-end bg-black/55"
              onMouseDown={(event) => { if (event.target === event.currentTarget) closeHighlight() }}>
              <div className="grid w-full gap-ui-3 rounded-t-ui-xl bg-card p-ui-4 pb-[max(var(--soco-space-4,16px),env(safe-area-inset-bottom))] text-foreground">
                <h2 id="story-highlight-title" className="m-0 text-ui-section font-bold">{trUi("feed.addHighlight")}</h2>
                <p id="story-highlight-desc" className="m-0 text-ui-body text-muted-foreground">Giữ Story này trên hồ sơ sau khi hết 24 giờ.</p>
                <StoryHighlightEditor key={activeStory.id} request={request} storyId={activeStory.id} onSaved={() => {
                  setHighlightOpen(false)
                  setHighlightSaved(true)
                }} />
                <button type="button" onClick={closeHighlight}
                  className="min-h-control-touch cursor-pointer rounded-ui-md border-0 bg-muted px-ui-3 text-ui-body font-semibold text-foreground">{trUi("common.cancel")}</button>
              </div>
            </div>
          )}
        </section>

        <aside className="hidden min-h-0 flex-col gap-ui-3 overflow-y-auto rounded-ui-lg bg-white/6 p-ui-4 lg:flex" aria-label={trUi("feed.storyInfo")}>
          <h2 className="m-0 text-ui-section font-bold">{highlight ? trUi("feed.highlights") : trUi("feed.storyInfo")}</h2>
          {highlight && <p className="m-0 text-ui-label text-white/75">{highlight.title}</p>}
          {feed && <>
            <p className="m-0 text-ui-label text-white/75">Khả dụng trong 24 giờ</p>
            <div className="h-px bg-white/15" />
            <p className="m-0 text-ui-label font-semibold text-white/70">Những hành động có thể làm</p>
            <div className="grid gap-ui-2">
              <button type="button" className={panelButton} disabled={isOwner} onClick={() => replyInputRef.current?.focus()}>
                <MessageCircle size={20} aria-hidden="true" />{trUi("chat.reply")}</button>
              <button type="button" className={panelButton} onClick={() => feed.onProfile(activeStory.author)}>
                <UserRound size={20} aria-hidden="true" />{trUi("chat.viewProfile")}</button>
              <button type="button" className={panelButton} onClick={() => feed.onShare(activeStory)}>
                <Share2 size={20} aria-hidden="true" />{trUi("common.share")}</button>
              <button type="button" className={panelButton} disabled={isOwner} onClick={() => feed.onReport(activeStory)}>
                <Flag size={20} aria-hidden="true" />{trUi("common.report")}</button>
            </div>
            <div className="mt-ui-2 rounded-ui-md bg-white/6 p-ui-3">
              <div className="flex items-center gap-ui-2 text-ui-body font-bold"><LockKeyhole size={20} aria-hidden="true" /> Quyền xem tin</div>
              <p className="m-0 mt-ui-1 text-ui-label text-white/75">Hiển thị theo quyền riêng tư của tác giả.</p>
            </div>
          </>}
        </aside>
      </div>
    </div>
  )
}