import { useId, type ReactNode } from 'react'
import { Heart } from 'lucide-react'
import FeedRepostAction from './FeedRepostAction'
import FeedRepostPreview from './FeedRepostPreview'
import FeedLikeButton from './FeedLikeButton'
import { userLabel } from '../../../shared/utils/userLabel'
import type { Post } from '../types'
import type { ToastKind } from '../../../shared/utils/toast'
import { API } from '../../../shared/lib/config'
import { FeedText } from './FeedDiscussion'
import FeedPostActions from './FeedPostActions'
import PostExtrasView from './PostExtrasView'
import { parsePostExtras } from '../utils/postExtras'
import UserAvatar from '../../../shared/ui/UserAvatar'
import MediaAttachmentsView from '../../../shared/ui/MediaAttachmentsView'
import UiIcon from '../../../shared/ui/UiIcon'
import { postActionClassName } from './postCardStyles'

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
  onShareToChat?: (url: string) => void;
  onRepostChanged?: () => void;
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
  onRepostChanged,
  onShareToChat,
  taggedNames,
}: Props) {
  const authorLabel = userLabel(post.author === name ? (ownDisplayName || post.authorDisplayName) : post.authorDisplayName, post.author)
  const likeBusy = likePreviews[post.id] !== undefined
  const commentsCount = post.comments?.length ?? 0
  const extras = parsePostExtras(post.content)
  const commentsId = useId()
  const openPost = () => setActivePostId(post.id)

  return (
    <article className="post zalo-post feed-post-card grid! grid-cols-[44px_minmax(0,1fr)]! gap-x-[9px]! gap-y-1.5! min-w-0! m-0! px-[18px]! pt-[14px]! pb-[11px]! overflow-hidden! rounded-2xl! border! border-[#e8ecf5]! bg-white! shadow-[0_3px_16px_rgba(30,51,96,0.035)]!" key={post.id}>
      <UserAvatar username={post.author} name={authorLabel} className="avatar size-11! basis-11! col-start-1! row-start-1! rounded-full!" />
      <div className="post-body contents! [&>*:not(.post-author)]:col-span-full! [&>*]:min-w-0!">
        <div className="post-author col-start-2! col-span-1! row-start-1! min-h-11! items-center!">
          <div>
            <strong className="text-[14px]! font-bold! text-[#142443]!">{onAuthorOpen ? <button type="button" className="visitor-name-link" onClick={() => onAuthorOpen(post.author)}>{authorLabel}</button> : authorLabel}</strong>
            {post.repostKind && <span className="block text-sm text-muted-foreground">{post.repostKind === 'quick' ? 'Đã đăng lại' : 'Đã trích dẫn'}</span>}
            <small className="text-[11px]! text-[#7889aa]!"><button type="button" className="feed-post-open-date" aria-label="Mở bài viết" onClick={openPost}>
              {relativeDate(post.createdAt)}
            </button> · {post.visibility === 'private' ? 'Chỉ mình tôi' : post.visibility === 'friends' ? 'Bạn bè' : 'Công khai'}</small>
          </div>
          <FeedPostActions
            onEdit={post.repostKind === 'quick' ? undefined : onEditPost}
            post={post}
            mine={post.author === name}
            request={apiFetch}
            onUpdated={syncFeedPost}
            onDeleted={(id) => { removeFeedPost(id); if (post.repostKind) onRepostChanged?.() }}
            onFeedback={(text, kind) => setNotice(text, kind || "success")}
          />
        </div>
        <PostExtrasView extras={extras} onAuthorOpen={onAuthorOpen} taggedNames={taggedNames} />
        {extras.caption && (
          <div className={post.background ? 'feed-post-clickable feed-text-background bg-' + post.background : 'feed-post-clickable feed-post-text pt-1.5! [&_.feed-text>p]:m-0! [&_.feed-text>p]:mb-1! [&_.feed-text>p]:text-sm! [&_.feed-text>p]:leading-normal!'}
            onClick={(event) => {
              if (event.target instanceof Element && !event.target.closest('button,a,input,textarea') && !window.getSelection()?.toString()) openPost()
            }}>
            <FeedText api={API} token={token}
              target={translationPreferencesLoaded ? targetLanguage : ''}
              text={extras.caption} maxLines={5} onExpand={() => setActivePostId(post.id)} />
          </div>
        )}
        {Boolean(post.attachments?.length) && (
          <div className="feed-media-preview mt-2! min-w-0! overflow-hidden! rounded-xl! [&_.media-attachments]:w-full! [&_.media-attachments]:max-w-none! [&_.media-attachments]:m-0! [&_.media-count-1_.media-item_img]:h-auto! [&_.media-count-1_.media-item_img]:max-h-[440px]! [&_.media-count-1_.media-item_img]:object-contain! [&_.media-count-1_.media-item_img]:rounded-xl! [&_.media-count-1_.media-item_video]:h-auto! [&_.media-count-1_.media-item_video]:max-h-[440px]! [&_.media-count-1_.media-item_video]:object-contain!">
            <MediaAttachmentsView items={post.attachments} onImageClick={openPost} />
          </div>
        )}
        <FeedRepostPreview post={post} onOpen={setActivePostId} />
        {post.repostKind === 'quick' && <div className="post-toolbar">
          <FeedRepostAction post={post} request={apiFetch} onUpdated={syncFeedPost}
            onShareToChat={onShareToChat} onFeedback={setNotice} />
        </div>}
        {post.repostKind !== 'quick' && <>
        <div className="post-engagement-summary feed-post-engagement flex! flex-wrap! items-center! justify-between! gap-x-3! gap-y-1.5! px-0.5! py-2! text-[11px]! text-[#7585a7]!">
          <button type="button" className="feed-post-likes feed-reaction-users-trigger inline-flex! items-center! gap-2! [&_svg]:size-[19px]! [&_svg]:text-[#f34373]!"
            disabled={post.likes === 0} aria-label={`Xem ${post.likes} người bày tỏ cảm xúc`}
            onClick={() => onReactionUsers(post)}>
            <Heart size={22} fill="currentColor" aria-hidden="true" />
            <span>{formatCount(post.likes)} lượt thích</span>
          </button>
          <span className="feed-post-conversation-stats ml-auto! text-right!">
            {commentsCount.toLocaleString('vi-VN')} bình luận{Boolean(post.repostCount) && ` · ${formatCount(post.repostCount ?? 0)} lượt đăng lại`}
          </span>
        </div>
        <div className="post-toolbar feed-post-toolbar grid! grid-cols-3! gap-1! mt-0! pt-[5px]! border-t! border-[#e8ecf5]!">
          <FeedLikeButton post={post} busy={likeBusy} onLike={(emoji) => void like(post, emoji)} />
          <button type="button" className={`post-stat post-detail-trigger ${postActionClassName}`}
            aria-expanded={onToggleComments ? Boolean(discussion) : undefined}
            aria-controls={discussion ? commentsId : undefined}
            onClick={onToggleComments ?? openPost}>
            <UiIcon name="comment" size={22} /><span>Bình luận</span>
          </button>
          <FeedRepostAction post={post} request={apiFetch} onUpdated={syncFeedPost} onRemoved={removeFeedPost}
            onChanged={onRepostChanged} onShareToChat={onShareToChat} onFeedback={setNotice} />
        </div>
        {discussion && (
          <section id={commentsId} className="feed-inline-comments" aria-label="Bình luận về bài viết">
            {!post.comments?.length && <p className="post-comments-empty">Chưa có bình luận. Hãy bắt đầu cuộc trò chuyện.</p>}
            {discussion}
          </section>
        )}
        </>}
      </div>
    </article>
  )
}