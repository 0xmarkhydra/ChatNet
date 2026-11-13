import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import {
  ChevronLeft, ChevronRight, Flag, Heart, LockKeyhole, MessageCircle,
  MoreHorizontal, Pause, Play, Send, Share2, Trash2, UserRound,
  Volume2, VolumeX, X,
} from 'lucide-react'
import { userLabel } from '../../../shared/utils/userLabel'
import { useScopedState } from '../../../shared/hooks/useScopedState'
import type { Story } from '../types'
import UserAvatar from '../../../shared/ui/UserAvatar'

type Props = {
  activeStory: Story
  stories: Story[]
  name: string
  storyBusy: boolean
  deleteStory: (story: Story) => Promise<void>
  setActiveStoryId: (id: number | null) => void
  onReply: (story: Story, message: string) => Promise<boolean>
  onProfile: (username: string) => void
  onShare: (story: Story) => void
  onReport: (story: Story) => void
}

const STORY_DURATION = 7000

function relativeStoryTime(date: string): string {
  const elapsed = Math.max(0, Date.now() - Date.parse(date))
  const minutes = Math.floor(elapsed / 60000)
  if (!Number.isFinite(minutes)) return ''
  if (minutes < 1) return 'Vừa đăng'
  if (minutes < 60) return minutes + ' phút trước'
  return Math.floor(minutes / 60) + ' giờ trước'
}

export default function StoryViewer({
  activeStory, stories, name, storyBusy, deleteStory, setActiveStoryId,
  onReply, onProfile, onShare, onReport,
}: Props) {
  const authorLabel = userLabel(activeStory.authorDisplayName, activeStory.author)
  const [paused, setPaused] = useScopedState(activeStory.id, false)
  const [muted, setMuted] = useState(true)
  const [videoProgress, setVideoProgress] = useScopedState(activeStory.id, 0)
  const [imageProgress, setImageProgress] = useScopedState(activeStory.id, 0)
  const [reply, setReply] = useScopedState(activeStory.id, '')
  const [replySending, setReplySending] = useScopedState(activeStory.id, false)
  const [menuOpen, setMenuOpen] = useScopedState(activeStory.id, false)
  const imageElapsedRef = useRef(0)
  const videoRef = useRef<HTMLVideoElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const replyInputRef = useRef<HTMLInputElement>(null)

  const groups = useMemo(() => {
    const authors = new Map<string, Story[]>()
    for (const story of stories) {
      if (!authors.has(story.author)) authors.set(story.author, [])
      authors.get(story.author)!.push(story)
    }
    return Array.from(authors.values()).map((items) =>
      [...items].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt)),
    )
  }, [stories])

  const sequence = useMemo(() => groups.flat(), [groups])
  const sequenceIndex = sequence.findIndex((story) => story.id === activeStory.id)
  const previousId = sequenceIndex > 0 ? sequence[sequenceIndex - 1].id : null
  const nextId = sequence[sequenceIndex + 1]?.id ?? null
  const authorStories = groups.find((items) => items[0]?.author === activeStory.author) ?? [activeStory]
  const authorIndex = authorStories.findIndex((story) => story.id === activeStory.id)
  const isOwner = activeStory.author === name
  const isVideo = activeStory.attachment.kind === 'video'

  useEffect(() => {
    imageElapsedRef.current = 0
  }, [activeStory.id])

  useEffect(() => {
    if (isVideo || paused || menuOpen || replySending) return
    const started = performance.now()
    const timer = window.setInterval(() => {
      const elapsed = Math.min(STORY_DURATION, imageElapsedRef.current + performance.now() - started)
      setImageProgress((elapsed / STORY_DURATION) * 100)
      if (elapsed >= STORY_DURATION) {
        window.clearInterval(timer)
        setActiveStoryId(nextId)
      }
    }, 50)
    return () => {
      window.clearInterval(timer)
      imageElapsedRef.current = Math.min(STORY_DURATION, imageElapsedRef.current + performance.now() - started)
    }
  }, [activeStory.id, isVideo, paused, menuOpen, replySending, nextId, setActiveStoryId, setImageProgress])

  useEffect(() => {
    if (!isVideo || !videoRef.current) return
    if (paused || menuOpen || replySending) videoRef.current.pause()
    else void videoRef.current.play().catch(() => setPaused(true))
  }, [activeStory.id, isVideo, paused, menuOpen, replySending, setPaused])

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null
    dialogRef.current?.focus()
    return () => previouslyFocused?.focus?.()
  }, [])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
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
  }, [menuOpen, nextId, previousId, setActiveStoryId, setMenuOpen, setPaused])

  async function submitReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const text = reply.trim()
    if (isOwner || replySending || !text) return
    setReplySending(true)
    try {
      if (await onReply(activeStory, text)) setReply('')
    } finally {
      setReplySending(false)
    }
  }

  return (
    <div
      className="story-screen-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={'Khoảnh khắc của ' + authorLabel}
      ref={dialogRef}
      tabIndex={-1}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) setActiveStoryId(null)
      }}
    >
      <div className="story-screen">
        <div className="story-screen-topbar">
          <div className="story-screen-brand">
            <strong>SocCo</strong>
            <span>Khoảnh khắc</span>
          </div>
          <button className="story-screen-close" type="button" onClick={() => setActiveStoryId(null)}>
            <X size={19} aria-hidden="true" /> Đóng
          </button>
        </div>

        <aside className="story-screen-people" aria-label="Danh sách người đăng Story">
          <header>
            <h2>Khoảnh khắc mới</h2>
            <p>{groups.length} người vừa đăng tin</p>
          </header>
          <div className="story-screen-people-list">
            {groups.map((items) => {
              const latest = items[items.length - 1]
              const active = items[0].author === activeStory.author
              const label = userLabel(latest.authorDisplayName, latest.author)
              return (
                <button key={latest.author} type="button" className={'story-screen-person' + (active ? ' active' : '')}
                  aria-current={active ? 'true' : undefined}
                  onClick={() => setActiveStoryId(active ? activeStory.id : items[0].id)}>
                  <UserAvatar username={latest.author} name={label} className="story-screen-person-avatar" />
                  <span className="story-screen-person-text">
                    <strong>{label}</strong>
                    <small>{relativeStoryTime(latest.createdAt)}</small>
                  </span>
                  {items.length > 1 && <span className="story-screen-person-count">{items.length}</span>}
                </button>
              )
            })}
          </div>
        </aside>

        <section className="story-screen-stage" aria-label={'Đang xem Story của ' + authorLabel}>
          <div className="story-screen-media">
            {isVideo ? (
              <video key={activeStory.id} ref={videoRef} src={activeStory.attachment.url}
                autoPlay muted={muted} playsInline
                onEnded={() => setActiveStoryId(nextId)}
                onTimeUpdate={(event) => {
                  const media = event.currentTarget
                  setVideoProgress(Number.isFinite(media.duration) && media.duration > 0
                    ? Math.min(100, media.currentTime / media.duration * 100) : 0)
                }}
                aria-label={activeStory.attachment.name}
              />
            ) : (
              <img key={activeStory.id} src={activeStory.attachment.url} alt={activeStory.attachment.name} />
            )}
          </div>

          <div className="story-screen-stage-header">
            <div className="story-screen-progress" aria-label={'Tin ' + (authorIndex + 1) + ' trên ' + authorStories.length}>
              {authorStories.map((story, index) => (
                <span key={story.id} className="story-screen-progress-track">
                  <span
                    className={index < authorIndex ? 'complete' : ''}
                    style={index === authorIndex
                      ? { width: (isVideo ? videoProgress : imageProgress) + '%' }
                      : index > authorIndex ? { width: 0 } : undefined}
                  />
                </span>
              ))}
            </div>
            <div className="story-screen-author">
              <button type="button" className="story-screen-author-profile" onClick={() => onProfile(activeStory.author)}
                title={'Xem hồ sơ ' + authorLabel}>
                <UserAvatar username={activeStory.author} name={authorLabel} className="story-screen-author-avatar" />
                <strong>{authorLabel}</strong>
              </button>
              <time dateTime={activeStory.createdAt}>{relativeStoryTime(activeStory.createdAt)}</time>
              <div className="story-screen-author-controls">
                <button type="button" className="story-screen-icon-button" title={paused ? 'Tiếp tục' : 'Tạm dừng'}
                  aria-label={paused ? 'Tiếp tục Story' : 'Tạm dừng Story'} onClick={() => setPaused((v) => !v)}>
                  {paused ? <Play size={19} /> : <Pause size={19} />}
                </button>
                {isVideo && (
                  <button type="button" className="story-screen-icon-button" aria-label={muted ? 'Bật âm thanh' : 'Tắt âm thanh'}
                    onClick={() => setMuted((v) => !v)}>
                    {muted ? <VolumeX size={19} /> : <Volume2 size={19} />}
                  </button>
                )}
                <div className="story-screen-options">
                  <button type="button" className="story-screen-icon-button" aria-label="Tùy chọn Story"
                    aria-expanded={menuOpen} onClick={() => setMenuOpen((v) => !v)}>
                    <MoreHorizontal size={22} />
                  </button>
                  {menuOpen && (
                    <div className="story-screen-options-menu">
                      {isOwner ? (
                        <button type="button" disabled={storyBusy} onClick={() => {
                          setMenuOpen(false)
                          void deleteStory(activeStory)
                        }}><Trash2 size={17} /> Xóa Story</button>
                      ) : (
                        <button type="button" onClick={() => {
                          setMenuOpen(false)
                          onReport(activeStory)
                        }}><Flag size={17} /> Báo cáo Story</button>
                      )}
                      <button type="button" onClick={() => {
                        setMenuOpen(false)
                        onShare(activeStory)
                      }}><Share2 size={17} /> Chia sẻ</button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {previousId !== null && (
            <button type="button" className="story-screen-navigation previous"
              aria-label="Story trước" onClick={() => setActiveStoryId(previousId)}>
              <ChevronLeft size={28} />
            </button>
          )}
          {nextId !== null && (
            <button type="button" className="story-screen-navigation next"
              aria-label="Story tiếp theo" onClick={() => setActiveStoryId(nextId)}>
              <ChevronRight size={28} />
            </button>
          )}

          {!isOwner && (
            <form className="story-screen-reply" onSubmit={submitReply}>
              <input ref={replyInputRef} value={reply}
                onChange={(event) => setReply(event.target.value)}
                onFocus={() => setPaused(true)}
                onBlur={() => setPaused(false)}
                placeholder={'Trả lời ' + authorLabel + '...'}
                aria-label={'Trả lời Story của ' + authorLabel} maxLength={2000} />
              <button type="submit" title="Gửi trả lời Story" aria-label="Trả lời Story" disabled={!reply.trim() || replySending}>
                <Send size={20} />
              </button>
            </form>
          )}
        </section>

        <aside className="story-screen-insights" aria-label="Thông tin Story">
          <h2>Thông tin Story</h2>
          <p className="story-screen-expiry">Khả dụng trong 24 giờ</p>
          <div className="story-screen-insights-divider" />
          <p className="story-screen-action-label">Những hành động có thể làm</p>
          <div className="story-screen-actions">
            <button type="button" disabled={isOwner} onClick={() => replyInputRef.current?.focus()}>
              <MessageCircle size={22} aria-hidden="true" /> Trả lời
            </button>
            <button type="button" disabled title="Thả tim Story chưa được hỗ trợ trên máy chủ">
              <Heart size={22} aria-hidden="true" /> Thả tim
            </button>
            <button type="button" onClick={() => onProfile(activeStory.author)}>
              <UserRound size={22} aria-hidden="true" /> Xem hồ sơ
            </button>
            <button type="button" onClick={() => onShare(activeStory)}>
              <Share2 size={22} aria-hidden="true" /> Chia sẻ
            </button>
            <button type="button" disabled={isOwner} onClick={() => onReport(activeStory)}>
              <Flag size={22} aria-hidden="true" /> Báo cáo
            </button>
          </div>
          <div className="story-screen-privacy">
            <div><LockKeyhole size={21} aria-hidden="true" /> <strong>Quyền xem tin</strong></div>
            <p>Hiển thị theo quyền riêng tư của tác giả.</p>
          </div>
        </aside>
      </div>
    </div>
  )
}
