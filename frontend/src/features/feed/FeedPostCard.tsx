import type { Post } from './types'
import type { ToastKind } from '../notifications/toast'
import { API } from '../../shared/lib/config'
import { FeedText } from './FeedDiscussion'
import FeedPostActions, { FeedShareAction } from './FeedPostActions'
import UserAvatar from '../../shared/ui/UserAvatar'
import MediaAttachmentsView from '../../shared/ui/MediaAttachmentsView'
import UiIcon from '../../shared/ui/UiIcon'

type Props = {
  post: Post
  name: string
  ownDisplayName?: string
  apiFetch: (path: string, init?: RequestInit) => Promise<Response>
  syncFeedPost: (post: Post) => void
  removeFeedPost: (id: number) => void
  setNotice: (text: string, kind?: ToastKind) => void
  token: string
  translationPreferencesLoaded: boolean
  targetLanguage: string
  setActivePostId: (id: number) => void
  likePreviews: Record<number, boolean>
  like: (post: Post) => Promise<void>
}

export default function FeedPostCard({
  post,
  name,
  ownDisplayName,
  apiFetch,
  syncFeedPost,
  removeFeedPost,
  setNotice,
  token,
  translationPreferencesLoaded,
  targetLanguage,
  setActivePostId,
  likePreviews,
  like,
}: Props) {
  return (
    <article className="post zalo-post" key={post.id}>
      <UserAvatar name={post.author} className="avatar" />
      <div className="post-body">
        <div className="post-author">
          <div>
            <strong>{post.author === name ? (ownDisplayName || name) : post.author}</strong>
            <small>{new Date(post.createdAt).toLocaleString('vi-VN')} · {post.visibility === 'private' ? 'Chỉ mình tôi' : post.visibility === 'friends' ? 'Bạn bè' : 'Công khai'}</small>
          </div>
          <FeedPostActions post={post} mine={post.author === name} request={apiFetch}
            onUpdated={syncFeedPost} onDeleted={removeFeedPost}
            onFeedback={(text, kind) => setNotice(text, kind || 'success')} />
        </div>
        {post.content && (
          <div className={post.background ? 'feed-text-background bg-' + post.background : ''}>
            <FeedText api={API} token={token}
              target={translationPreferencesLoaded ? targetLanguage : ''}
              text={post.content} maxLines={5} onExpand={() => setActivePostId(post.id)} />
          </div>
        )}
        <div className="feed-media-preview" onClick={() => setActivePostId(post.id)}>
          <MediaAttachmentsView items={post.attachments} />
        </div>
        {(post.likes > 0 || (post.comments?.length || 0) > 0) && (
          <div className="post-engagement-summary">
            {post.likes > 0 && <span>{post.likes} lượt thích</span>}
            {(post.comments?.length || 0) > 0 && <span>{post.comments.length} bình luận</span>}
          </div>
        )}
        <div className="post-toolbar">
          <button type="button" className={post.liked ? 'liked' : ''} disabled={likePreviews[post.id] !== undefined}
            aria-pressed={post.liked} aria-busy={likePreviews[post.id] !== undefined} onClick={() => void like(post)}>
            <UiIcon name="heart" size={21} /><span>Thích</span>
          </button>
          <button type="button" className="post-stat post-detail-trigger" onClick={() => setActivePostId(post.id)}>
            <UiIcon name="comment" size={21} />
            <span>Bình luận</span>
          </button>
          <FeedShareAction postId={post.id}
            onFeedback={(text, kind) => setNotice(text, kind || 'success')} />
        </div>
      </div>
    </article>
  )
}