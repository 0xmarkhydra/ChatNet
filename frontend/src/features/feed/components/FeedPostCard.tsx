import { useId, type ReactNode } from 'react'
import { Heart } from 'lucide-react'
import FeedLikeButton from './FeedLikeButton'
import { userLabel } from '../../../shared/utils/userLabel'
import type { Post } from '../types'
import type { ToastKind } from '../../../shared/utils/toast'
import { API } from '../../../shared/lib/config'
import { FeedText } from './FeedDiscussion'
import FeedPostActions, { FeedSaveAction, FeedShareAction } from './FeedPostActions'
import PostExtrasView from './PostExtrasView'
import { parsePostExtras } from '../utils/postExtras'
import UserAvatar from '../../../shared/ui/UserAvatar'
import MediaAttachmentsView from '../../../shared/ui/MediaAttachmentsView'
import UiIcon from '../../../shared/ui/UiIcon'

type Props = {
  post: Post;
  name: string;
  ownDisplayName?: string;
  onAuthorOpen?: (username: string) => void;
  apiFetch: (path: string, init?: RequestInit) => Promise<Response>;
  syncFeedPost: (post: Post) => void;
  removeFeedPost: (id: number) => void;
  setNotice: (text: string, kind?: ToastKind) => void;
  token: string;
  translationPreferencesLoaded: boolean;
  targetLanguage: string;
  setActivePostId: (id: number) => void;
  onToggleComments?: () => void;
  discussion?: ReactNode;
  likePreviews: Record<number, boolean>;
  like: (post: Post, emoji?: string) => Promise<void>;
  onReactionUsers: (post: Post) => void;
  showSave?: boolean;
  onEditPost?: (post: Post) => void;
  taggedNames?: Record<string, string>;
};

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

export default function FeedPostCard({
  post,
  name,
  ownDisplayName,
  onAuthorOpen,
  apiFetch,
  syncFeedPost,
  removeFeedPost,
  setNotice,
  token,
  translationPreferencesLoaded,
  targetLanguage,
  setActivePostId,
  onToggleComments,
  discussion,
  likePreviews,
  like,
  onReactionUsers,
  onEditPost,
  taggedNames,
}: Props) {
  const authorLabel = userLabel(post.author === name ? (ownDisplayName || post.authorDisplayName) : post.authorDisplayName, post.author)
  const likeBusy = likePreviews[post.id] !== undefined
  const commentsCount = post.comments?.length ?? 0
  const extras = parsePostExtras(post.content)
  const commentsId = useId()
  const openPost = () => setActivePostId(post.id)

  return (
    <article className="post zalo-post feed-post-card" key={post.id}>
      <UserAvatar username={post.author} name={authorLabel} className="avatar" />
      <div className="post-body">
        <div className="post-author">
          <div>
            <strong>{onAuthorOpen ? <button type="button" className="visitor-name-link" onClick={() => onAuthorOpen(post.author)}>{authorLabel}</button> : authorLabel}</strong>
            <small><button type="button" className="feed-post-open-date" aria-label="Mở bài viết" onClick={openPost}>
              {relativeDate(post.createdAt)}
            </button> · {post.visibility === 'private' ? 'Chỉ mình tôi' : post.visibility === 'friends' ? 'Bạn bè' : 'Công khai'}</small>
          </div>
          <FeedPostActions
            onEdit={onEditPost}
            post={post}
            mine={post.author === name}
            request={apiFetch}
            onUpdated={syncFeedPost}
            onDeleted={removeFeedPost}
            onFeedback={(text, kind) => setNotice(text, kind || "success")}
          />
        </div>
        <PostExtrasView extras={extras} onAuthorOpen={onAuthorOpen} taggedNames={taggedNames} />
        {extras.caption && (
          <div className={post.background ? 'feed-post-clickable feed-text-background bg-' + post.background : 'feed-post-clickable feed-post-text'}
            onClick={(event) => {
              if (event.target instanceof Element && !event.target.closest('button,a,input,textarea') && !window.getSelection()?.toString()) openPost()
            }}>
            <FeedText api={API} token={token}
              target={translationPreferencesLoaded ? targetLanguage : ''}
              text={extras.caption} maxLines={5} onExpand={() => setActivePostId(post.id)} />
          </div>
        )}
        {Boolean(post.attachments?.length) && (
          <div className="feed-media-preview">
            <MediaAttachmentsView items={post.attachments} onImageClick={openPost} />
          </div>
        )}
        <div className="post-engagement-summary feed-post-engagement">
          <button type="button" className="feed-post-likes feed-reaction-users-trigger"
            disabled={post.likes === 0} aria-label={`Xem ${post.likes} người bày tỏ cảm xúc`}
            onClick={() => onReactionUsers(post)}>
            <Heart size={22} fill="currentColor" aria-hidden="true" />
            <span>{formatCount(post.likes)} lượt thích</span>
          </button>
          <span className="feed-post-conversation-stats">
            {commentsCount.toLocaleString('vi-VN')} bình luận · Chia sẻ
          </span>
        </div>
        <div className="post-toolbar feed-post-toolbar">
          <FeedLikeButton post={post} busy={likeBusy} onLike={(emoji) => void like(post, emoji)} />
          <button type="button" className="post-stat post-detail-trigger"
            aria-expanded={onToggleComments ? Boolean(discussion) : undefined}
            aria-controls={discussion ? commentsId : undefined}
            onClick={onToggleComments ?? openPost}>
            <UiIcon name="comment" size={22} /><span>Bình luận</span>
          </button>
          <FeedShareAction postId={post.id}
            onFeedback={(text, kind) => setNotice(text, kind || 'success')} />
          <FeedSaveAction post={post} request={apiFetch} onUpdated={syncFeedPost}
            onFeedback={(text, kind) => setNotice(text, kind || 'success')} />
        </div>
        {discussion && (
          <section id={commentsId} className="feed-inline-comments" aria-label="Bình luận về bài viết">
            {!post.comments?.length && <p className="post-comments-empty">Chưa có bình luận. Hãy bắt đầu cuộc trò chuyện.</p>}
            {discussion}
          </section>
        )}
      </div>
    </article>
  )
}