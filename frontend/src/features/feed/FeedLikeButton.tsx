import { Heart } from 'lucide-react'
import type { Post } from './types'

// A single like affordance across feed cards, profile timelines and post details.
export default function FeedLikeButton({
  post, busy, onLike,
}: {
  post: Pick<Post, 'liked' | 'myReaction'>
  busy: boolean
  onLike: (emoji: string) => void
}) {
  const selectedReaction = post.myReaction || (post.liked ? '👍' : '')
  const liked = Boolean(selectedReaction)
  return (
    <button
      type="button"
      className={'feed-post-like feed-like-button' + (liked ? ' is-liked' : '')}
      disabled={busy}
      aria-pressed={liked}
      aria-busy={busy}
      aria-label={liked ? 'Bỏ thích bài viết' : 'Thích bài viết'}
      onClick={() => onLike(selectedReaction || '❤️')}
    >
      <Heart size={22} fill={liked ? 'currentColor' : 'none'} aria-hidden="true" />
      <span>{liked ? 'Đã thích' : 'Thích'}</span>
    </button>
  )
}
