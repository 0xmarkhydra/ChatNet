import { useEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import type { Post } from './types'
import { messageReactions } from '../chat/messageReactions'
import './feed-actions.css'

export default function FeedReactionControl({
  post, busy, react, showCount = false,
}: {
  post: Post
  busy: boolean
  react: (post: Post, emoji?: string) => Promise<void>
  showCount?: boolean
}) {
  const [open, setOpen] = useState(false)
  const host = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const close = (event: PointerEvent) => {
      if (!host.current?.contains(event.target as Node)) setOpen(false)
    }
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false) }
    document.addEventListener('pointerdown', close)
    window.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('pointerdown', close)
      window.removeEventListener('keydown', escape)
    }
  }, [open])

  const selected = post.myReaction || (post.liked ? '👍' : '')
  const label = messageReactions.find(({ emoji }) => emoji === selected)?.label || 'Thích'

  return (
    <div className="feed-reaction-control" ref={host}>
      <button type="button" className={post.liked ? 'feed-reaction-primary liked' : 'feed-reaction-primary'}
        disabled={busy} aria-pressed={Boolean(selected)} aria-busy={busy}
        onClick={() => void react(post, '👍')}>
        <span aria-hidden="true">{selected || '👍'}</span>
        <span>{label}</span>
        {showCount && post.likes > 0 && <b>{post.likes}</b>}
      </button>
      <button type="button" className="feed-reaction-expand" disabled={busy}
        aria-expanded={open} aria-label="Chọn cảm xúc" title="Chọn cảm xúc"
        onClick={() => setOpen((current) => !current)}>
        <ChevronDown size={15} />
      </button>
      {open && <div role="group" className="feed-reaction-picker" aria-label="Cảm xúc bài viết">
        {messageReactions.map(({ emoji, label: reactionLabel }) => (
          <button type="button" key={emoji} aria-label={reactionLabel}
            aria-pressed={selected === emoji}
            title={reactionLabel}
            disabled={busy}
            onClick={() => { setOpen(false); void react(post, emoji) }}>
            <span aria-hidden="true">{emoji}</span><small>{reactionLabel}</small>
          </button>
        ))}
      </div>}
    </div>
  )
}
