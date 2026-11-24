import { useId, type ReactNode } from 'react'
import UserAvatar from '../../../shared/ui/UserAvatar'
import UiIcon from '../../../shared/ui/UiIcon'
import type { Post } from '../types'
import type { ToastKind } from '../../../shared/utils/toast'
import FeedPostActions from './FeedPostActions'
import FeedLikeButton from './FeedLikeButton'
import FeedRepostAction from './FeedRepostAction'
import { postActionClassName } from './postCardStyles'

function formatCount(count: number): string {
  if (count < 1000) return count.toLocaleString('vi-VN')
  return (count / 1000).toLocaleString('vi-VN', { maximumFractionDigits: 1 }) + 'K'
}

function relativeDate(value: string): string {
  const parsed = Date.parse(value)
  if (!Number.isFinite(parsed)) return value
  const minutes = Math.max(0, Math.floor((Date.now() - parsed) / 60000))
  if (minutes < 1) return 'Vừa xong'
  if (minutes < 60) return `${minutes} phút trước`
  if (minutes < 1440) return `${Math.floor(minutes / 60)} giờ trước`
  if (minutes < 10080) return `${Math.floor(minutes / 1440)} ngày trước`
  return new Date(parsed).toLocaleDateString('vi-VN')
}

type PostActions = {
  apiFetch: (path: string, init?: RequestInit) => Promise<Response>
  syncFeedPost: (post: Post) => void
  removeFeedPost: (id: number) => void
  setNotice: (text: string, kind?: ToastKind) => void
  onShareToChat?: (url: string) => void
  onRepostChanged?: () => void
}

export function PostCardHeader({
  post, authorLabel, name, onAuthorOpen, onEditPost, openPost, ...actions
}: PostActions & {
  post: Post
  authorLabel: string
  name: string
  onAuthorOpen?: (username: string) => void
  onEditPost?: (post: Post) => void
  openPost: () => void
}) {
  return (
    <header className="feed-post-header post-card-header flex w-full min-w-0 items-center gap-[9px]">
      <UserAvatar username={post.author} name={authorLabel} className="avatar size-10! basis-10! shrink-0! rounded-full! bg-none! bg-secondary! text-primary!" />
      <div className="feed-post-author flex min-h-10 min-w-0 flex-1 items-center justify-between">
        <div className="grid min-w-0 gap-[3px]">
          <strong className="block! truncate! text-base! font-bold! text-[#142443]!">
            {onAuthorOpen ? <button type="button" className="visitor-name-link" onClick={() => onAuthorOpen(post.author)}>{authorLabel}</button> : authorLabel}
          </strong>
          {post.repostKind && <span className="block text-sm text-muted-foreground">{post.repostKind === 'quick' ? 'Đã đăng lại' : 'Đã trích dẫn'}</span>}
          <small className="block! text-xs! text-[#7889aa]!">
            <button type="button" className="feed-post-open-date" aria-label="Mở bài viết" onClick={openPost}>{relativeDate(post.createdAt)}</button>
            {' · '}{post.visibility === 'private' ? 'Chỉ mình tôi' : post.visibility === 'friends' ? 'Bạn bè' : 'Công khai'}
          </small>
        </div>
        <FeedPostActions
          onEdit={post.repostKind === 'quick' ? undefined : onEditPost}
          post={post}
          mine={post.author === name}
          request={actions.apiFetch}
          onUpdated={actions.syncFeedPost}
          onDeleted={(id) => { actions.removeFeedPost(id); if (post.repostKind) actions.onRepostChanged?.() }}
          onFeedback={(text, kind) => actions.setNotice(text, kind || 'success')}
        />
      </div>
    </header>
  )
}

export function PostCardEngagement({ post, onReactionUsers }: {
  post: Post
  onReactionUsers: (post: Post) => void
}) {
  const commentsCount = post.comments?.length ?? 0
  return (
    <div className="feed-post-engagement whitespace-nowrap flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 px-4 py-2 text-ui-label! text-[#7585a7]!">
      <button type="button" className="feed-post-likes feed-reaction-users-trigger inline-flex items-center gap-2"
        disabled={post.likes === 0} aria-label={`Xem ${post.likes} người bày tỏ cảm xúc`} onClick={() => onReactionUsers(post)}>
        <span>{formatCount(post.likes)} lượt thích</span>
      </button>
      <span className="feed-post-conversation-stats ml-auto text-right">
        {commentsCount.toLocaleString('vi-VN')} bình luận{Boolean(post.repostCount) && ` · ${formatCount(post.repostCount ?? 0)} lượt đăng lại`}
      </span>
    </div>
  )
}

export function PostCardToolbar({
  post, busy, like, onToggleComments, discussion, openPost, ...actions
}: PostActions & {
  post: Post
  busy: boolean
  like: (post: Post, emoji?: string) => Promise<void>
  onToggleComments?: () => void
  discussion?: ReactNode
  openPost: () => void
}) {
  const commentsId = useId()
  const quickRepost = post.repostKind === 'quick'
  return (
    <>
      <div className={`feed-post-toolbar grid ${quickRepost ? 'grid-cols-2' : 'grid-cols-3'} items-center gap-1 mt-0 mx-4 pt-1 border-t border-border-subtle`}>
        {!quickRepost && <FeedLikeButton post={post} busy={busy} onLike={(emoji) => void like(post, emoji)} />}
        <button type="button" className={`post-detail-trigger ${postActionClassName}`}
          aria-expanded={!quickRepost && onToggleComments ? Boolean(discussion) : undefined}
          aria-controls={discussion ? commentsId : undefined}
          onClick={onToggleComments ?? openPost}>
          <UiIcon name="comment" size={18} /><span>Bình luận</span>
        </button>
        <FeedRepostAction post={post} request={actions.apiFetch} onUpdated={actions.syncFeedPost} onRemoved={actions.removeFeedPost}
          onChanged={actions.onRepostChanged} onShareToChat={actions.onShareToChat} onFeedback={actions.setNotice} />
      </div>
      {discussion && (
        <section id={commentsId} className="feed-inline-comments" aria-label="Bình luận về bài viết">
          {!post.comments?.length && <p className="post-comments-empty">Chưa có bình luận. Hãy bắt đầu cuộc trò chuyện.</p>}
          {discussion}
        </section>
      )}
    </>
  )
}
