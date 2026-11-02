import { userLabel } from '../../shared/lib/userLabel'
import type { Post } from './types'
import type { ToastKind } from '../notifications/toast'
import { API } from '../../shared/lib/config'
import { FeedText } from './FeedDiscussion'
import FeedPostActions, { FeedShareAction } from './FeedPostActions'
import FeedReactionControl from './FeedReactionControl'
import UserAvatar from '../../shared/ui/UserAvatar'
import MediaAttachmentsView from '../../shared/ui/MediaAttachmentsView'
import UiIcon from '../../shared/ui/UiIcon'

type Props = {
  post: Post
  name: string
  ownDisplayName?: string
  onAuthorOpen?: (username: string) => void
  apiFetch: (path: string, init?: RequestInit) => Promise<Response>
  syncFeedPost: (post: Post) => void
  removeFeedPost: (id: number) => void
  setNotice: (text: string, kind?: ToastKind) => void
  token: string
  translationPreferencesLoaded: boolean
  targetLanguage: string
  setActivePostId: (id: number) => void
  likePreviews: Record<number, boolean>
  like: (post: Post, emoji?: string) => Promise<void>
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
  likePreviews,
  like,
}: Props) {
  const authorLabel = userLabel(post.author === name ? (ownDisplayName || post.authorDisplayName) : post.authorDisplayName, post.author)
  return (
    <article className="post zalo-post" key={post.id}>
      <UserAvatar username={post.author} name={authorLabel} className="avatar" />
      <div className="post-body">
        <div className="post-author">
          <div>
            <strong>{onAuthorOpen ? <button type="button" className="visitor-name-link" onClick={() => onAuthorOpen(post.author)}>{authorLabel}</button> : authorLabel}</strong>
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
            {post.likes > 0 && <span>{(post.reactions || []).slice(0, 3).map((reaction) => reaction.emoji).join(' ')} {post.likes} lượt cảm xúc</span>}
            {(post.comments?.length || 0) > 0 && <span>{post.comments.length} bình luận</span>}
          </div>
        )}
        <div className="post-toolbar">
          <FeedReactionControl post={post} busy={likePreviews[post.id] !== undefined} react={like} />
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