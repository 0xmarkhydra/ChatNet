import PostLocationTag from './PostLocationTag'
import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { ChevronDown, Heart, MessageCircle, X } from 'lucide-react'
import FeedRepostAction from './FeedRepostAction'
import FeedRepostPreview from './FeedRepostPreview'
import FeedLikeButton from './FeedLikeButton'
import type { Post } from '../types'
import { FeedText } from './FeedDiscussion'
import { CommentComposerTarget } from './commentComposerTarget'
import FeedPostActions from './FeedPostActions'
import PostExtrasView from './PostExtrasView'
import { parsePostExtras } from '../utils/postExtras'
import UserAvatar from '../../../shared/ui/UserAvatar'
import MediaAttachmentsView from '../../../shared/ui/MediaAttachmentsView'
import { userLabel } from '../../../shared/utils/userLabel'
import { API } from '../../../shared/lib/config'
import type { ToastKind } from '../../../shared/utils/toast'
import { ModalPortalContext } from '../../../shared/ui/modalPortalContext'

const postActions = 'post-comments-post-actions mt-1.25 grid grid-cols-3 items-center gap-ui-1 min-h-12 pt-ui-1 border-t border-border text-ui-label whitespace-nowrap'
const commentAction = 'inline-flex w-full min-w-0 min-h-control-touch flex-none items-center justify-center gap-2 rounded-ui-md border-0 bg-transparent m-0 px-2 py-1 text-foreground cursor-pointer [&_span]:text-xs [&_span]:leading-tight hover:bg-muted active:bg-secondary max-sm:gap-1'

type SortOrder = 'newest' | 'oldest'

type Props = {
  post: Post
  onClose: () => void
  username: string
  ownDisplayName?: string
  token: string
  targetLanguage: string
  likeBusy: boolean
  request: (path: string, init?: RequestInit) => Promise<Response>
  onLike: (post: Post, emoji?: string) => Promise<void>
  onReactionUsers: (post: Post, portalContainer?: HTMLElement) => void
  onShareToChat?: (url: string) => void
  onRepostChanged?: () => void
  onRepostRemoved?: (id: number) => void
  onOpenOriginal?: (id: number) => void
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
  post, onClose, username, ownDisplayName, token, targetLanguage, likeBusy,
  request, onLike, onReactionUsers, onUpdated, onDeleted, onFeedback, onAuthorOpen, onEditPost, taggedNames,
  sortOrder, onSortChange, children, onRepostChanged, onRepostRemoved, onOpenOriginal, onShareToChat,
}: Props) {
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const [portalContainer, setPortalContainer] = useState<HTMLDivElement | null>(null)
  const [composerTarget, setComposerTarget] = useState<HTMLDivElement | null>(null)
  useEffect(() => {
    const element = dialog.current
    if (!element) return
    const previous = document.activeElement
    element.showModal()
    return () => {
      element.close()
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus({ preventScroll: true })
    }
  }, [])
  const authorName = userLabel(post.author === username ? (ownDisplayName || post.authorDisplayName) : post.authorDisplayName, post.author)
  const commentCount = post.comments?.length || 0
  const shares = post.repostCount
  const sharesLabel = typeof shares === 'number' && Number.isFinite(shares) ? `${shares.toLocaleString('vi-VN')} lượt đăng lại` : 'Chia sẻ'
  const visibility = post.visibility === 'private' ? 'Chỉ mình tôi' : post.visibility === 'friends' ? 'Bạn bè' : 'Công khai'
  const extras = parsePostExtras(post.content)

  return (
    <dialog ref={dialog} className="post-detail-backdrop post-comments-page" aria-labelledby={titleId}
      onCancel={(event) => {
        if (event.target !== event.currentTarget) return
        event.preventDefault()
        onClose()
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}>
      <header className="post-comments-modal-heading">
        <h2 id={titleId}>{post.repostKind === 'quick' ? `${authorName} đã đăng lại` : `Bài viết của ${authorName}`}</h2>
        <button type="button" aria-label="Đóng chi tiết bài viết" onClick={onClose}><X size={22} aria-hidden="true" /></button>
      </header>
      <div className="post-comments-scroll">
        <ModalPortalContext.Provider value={portalContainer}>

          <article className="post-comments-original" aria-label="Nội dung bài viết">
            <header className="post-comments-author items-start!">
              <UserAvatar username={post.author} name={authorName} className="post-comments-author-avatar" />
              <div className="post-comments-author-copy">
                <button type="button" className="post-comments-author-name" onClick={() => onAuthorOpen(post.author)}>{authorName}</button>
                <div className="post-comments-meta"><span>{relativeDate(post.createdAt)}</span><span>{visibility}</span></div>
                <PostLocationTag post={post} />
              </div>
              <FeedPostActions onEdit={post.repostKind === 'quick' ? undefined : onEditPost} post={post} mine={post.author === username} request={request}
                onUpdated={onUpdated} onDeleted={onDeleted} onFeedback={onFeedback} />
            </header>
            <PostExtrasView extras={{...extras, location: post.visibility === "public" && post.publishLocation ? extras.location : ""}} onAuthorOpen={onAuthorOpen} taggedNames={taggedNames} />
            {extras.caption && (
              <div className={post.background ? `post-comments-content feed-text-background bg-${post.background}` : "post-comments-content"}>
                <FeedText api={API} token={token} target={targetLanguage} text={extras.caption} />
              </div>
            )}
            {Boolean(post.attachments?.length) && (
              <div className="post-comments-media"><MediaAttachmentsView items={post.attachments} /></div>
            )}
            {onOpenOriginal && <FeedRepostPreview post={post} onOpen={onOpenOriginal} />}
          </article>

          {post.repostKind === 'quick' && <div className={postActions}>
            <FeedRepostAction post={post} request={request} onUpdated={onUpdated}
              onShareToChat={onShareToChat} onFeedback={onFeedback} />
          </div>}
          {post.repostKind !== 'quick' && <>
          <div className="post-comments-post-footer">
            <div className="post-comments-stats">
              <button type="button" className="feed-post-likes feed-reaction-users-trigger"
                disabled={post.likes === 0} onClick={() => onReactionUsers(post, portalContainer ?? undefined)}
                aria-label={`Xem ${post.likes} người bày tỏ cảm xúc`}>
                <Heart size={20} fill="currentColor" aria-hidden="true" /> {post.likes.toLocaleString('vi-VN')} lượt thích
              </button>
              <div className="post-comments-totals"><span>{commentCount.toLocaleString('vi-VN')} bình luận</span><span>{sharesLabel}</span></div>
            </div>
            <div className={postActions}>
              <FeedLikeButton post={post} busy={likeBusy} onLike={(emoji) => void onLike(post, emoji)} />
              <button type="button" aria-label="Bình luận" title="Bình luận" className={commentAction}
                onClick={() => composerTarget?.querySelector<HTMLTextAreaElement>('textarea')?.focus()}>
                <MessageCircle size={21} aria-hidden="true" /><span>Bình luận</span>
              </button>
              <FeedRepostAction post={post} request={request} onUpdated={onUpdated}
                onRemoved={onRepostRemoved} onChanged={onRepostChanged} onShareToChat={onShareToChat} onFeedback={onFeedback} />
            </div>
          </div>

          <section className="post-comments-thread" aria-label="Thảo luận về bài viết">
            <header className="post-comments-thread-heading">
              <h2>Bình luận ({commentCount.toLocaleString('vi-VN')})</h2>
              <label className="post-comments-sort">
                <select aria-label="Sắp xếp bình luận" value={sortOrder} onChange={event => onSortChange(event.target.value as SortOrder)}>
                  <option value="newest">Mới nhất</option>
                  <option value="oldest">Cũ nhất</option>
                </select>
                <ChevronDown size={14} aria-hidden="true" />
              </label>
            </header>
            {commentCount === 0 && <p className="post-comments-empty">Chưa có bình luận. Hãy bắt đầu cuộc trò chuyện.</p>}
            {children && composerTarget && portalContainer && (
              <CommentComposerTarget.Provider value={composerTarget}>{children}</CommentComposerTarget.Provider>
            )}
          </section>
          </>}
        </ModalPortalContext.Provider>
      </div>
      {post.repostKind !== 'quick' && <div ref={setComposerTarget} className="post-comments-composer" />}
      <div ref={setPortalContainer} className="post-comments-portals" />
    </dialog>
  )
}