import { useEffect, useRef, type ReactNode } from 'react'
import { ChevronDown, Heart, MessageCircle } from 'lucide-react'
import FeedLikeButton from '../features/feed/FeedLikeButton'
import type { Post } from '../features/feed/types'
import { FeedText } from '../features/feed/FeedDiscussion'
import FeedPostActions, { FeedShareAction } from '../features/feed/FeedPostActions'
import PostExtrasView from '../features/feed/PostExtrasView'
import { parsePostExtras } from '../features/feed/postExtras'
import UserAvatar from '../shared/ui/UserAvatar'
import MediaAttachmentsView from '../shared/ui/MediaAttachmentsView'
import { userLabel } from '../shared/lib/userLabel'
import { API } from '../shared/lib/config'
import type { ToastKind } from '../features/notifications/toast'

type SortOrder = 'newest' | 'oldest'

type Props = {
  post: Post
  username: string
  ownDisplayName?: string
  token: string
  targetLanguage: string
  likeBusy: boolean
  request: (path: string, init?: RequestInit) => Promise<Response>
  onLike: (post: Post, emoji?: string) => Promise<void>
  onUpdated: (post: Post) => void
  onDeleted: (id: number) => void
  onFeedback: (message: string, kind?: ToastKind) => void
  onAuthorOpen: (username: string) => void
  onEditPost?: (post: Post) => void
  taggedNames?: Record<string, string>
  sortOrder: SortOrder
  onSortChange: (value: SortOrder) => void
  children: ReactNode
}

function relativeDate(value: string): string {
  const age = Math.max(0, Math.floor((Date.now() - Date.parse(value)) / 60000))
  if (!Number.isFinite(age)) return new Date(value).toLocaleString('vi-VN')
  if (age < 1) return 'Vừa xong'
  if (age < 60) return `${age} phút trước`
  if (age < 1440) return `${Math.floor(age / 60)} giờ trước`
  if (age < 10080) return `${Math.floor(age / 1440)} ngày trước`
  return new Date(value).toLocaleDateString('vi-VN')
}

export default function PostCommentsPage({
  post, username, ownDisplayName, token, targetLanguage, likeBusy,
  request, onLike, onUpdated, onDeleted, onFeedback, onAuthorOpen, onEditPost, taggedNames,
  sortOrder, onSortChange, children,
}: Props) {
  const page = useRef<HTMLElement>(null)
  useEffect(() => { page.current?.focus() }, [post.id])
  const authorName = userLabel(post.author === username ? (ownDisplayName || post.authorDisplayName) : post.authorDisplayName, post.author)
  const commentCount = post.comments?.length || 0
  const shares = (post as Post & { shares?: number }).shares
  const sharesLabel = typeof shares === 'number' && Number.isFinite(shares) ? ` • ${shares.toLocaleString('vi-VN')} chia sẻ` : ' • Chia sẻ'
  const visibility = post.visibility === 'private' ? 'Chỉ mình tôi' : post.visibility === 'friends' ? 'Bạn bè' : 'Công khai'
  const extras = parsePostExtras(post.content)

  return (
    <section ref={page} tabIndex={-1} className="post-comments-page" aria-label="Bình luận bài viết">
      <h1 className="post-comments-visually-hidden">Bình luận bài viết</h1>
      <div className="post-comments-shell">
        <div className="post-comments-grid">
          <article className="post-comments-original" aria-label="Nội dung bài viết">
            <header className="post-comments-author">
              <UserAvatar username={post.author} name={authorName} className="post-comments-author-avatar" />
              <div className="post-comments-author-copy">
                <button type="button" className="post-comments-author-name" onClick={() => onAuthorOpen(post.author)}>{authorName}</button>
                <span>{relativeDate(post.createdAt)} · {visibility}</span>
              </div>
              <FeedPostActions onEdit={onEditPost} post={post} mine={post.author === username} request={request}
                onUpdated={onUpdated} onDeleted={onDeleted} onFeedback={onFeedback} />
            </header>
            <PostExtrasView extras={extras} onAuthorOpen={onAuthorOpen} taggedNames={taggedNames} />
            {extras.caption && (
              <div className="post-comments-content">
                <FeedText api={API} token={token} target={targetLanguage} text={extras.caption} />
              </div>
            )}
            {Boolean(post.attachments?.length) && (
              <div className="post-comments-media"><MediaAttachmentsView items={post.attachments} /></div>
            )}
            <div className="post-comments-post-footer">
              <div className="post-comments-stats">
                <span className="feed-post-likes"><Heart size={20} aria-hidden="true" /> {post.likes.toLocaleString('vi-VN')} lượt thích</span>
                <span>{commentCount.toLocaleString('vi-VN')} bình luận{sharesLabel}</span>
              </div>
              <div className="post-comments-post-actions post-toolbar post-toolbar-compact">
                <FeedLikeButton post={post} busy={likeBusy} onLike={(emoji) => void onLike(post, emoji)} />
                <button type="button" aria-label="Bình luận" title="Bình luận"
                  onClick={() => document.querySelector<HTMLTextAreaElement>('.post-comments-thread .feed-comment-compose textarea')?.focus()}>
                  <MessageCircle size={21} aria-hidden="true" /><span>Bình luận</span>
                </button>
                <FeedShareAction postId={post.id} onFeedback={onFeedback} />
              </div>
            </div>
          </article>

          <section className="post-comments-thread" aria-label="Thảo luận về bài viết">
            <header className="post-comments-thread-heading">
              <h2>Bình luận ({commentCount.toLocaleString('vi-VN')})</h2>
              <label className="post-comments-sort">
                <span className="post-comments-visually-hidden">Sắp xếp bình luận</span>
                <select aria-label="Sắp xếp bình luận" value={sortOrder} onChange={event => onSortChange(event.target.value as SortOrder)}>
                  <option value="newest">Mới nhất</option>
                  <option value="oldest">Cũ nhất</option>
                </select>
                <ChevronDown size={14} aria-hidden="true" />
              </label>
            </header>
            {commentCount === 0 && <p className="post-comments-empty">Chưa có bình luận. Hãy bắt đầu cuộc trò chuyện.</p>}
            {children}
          </section>
        </div>
      </div>
    </section>
  )
}
