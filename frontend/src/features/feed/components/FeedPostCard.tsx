import type { ReactNode } from 'react'
import FeedRepostAction from './FeedRepostAction'
import FeedRepostPreview from './FeedRepostPreview'
import { userLabel } from '../../../shared/utils/userLabel'
import type { Post } from '../types'
import type { ToastKind } from '../../../shared/utils/toast'
import { API } from '../../../shared/lib/config'
import { FeedText } from './FeedDiscussion'
import PostExtrasView from './PostExtrasView'
import { parsePostExtras } from '../utils/postExtras'
import MediaAttachmentsView from '../../../shared/ui/MediaAttachmentsView'
import { Card } from '../../../shared/ui/card'
import { PostCardEngagement, PostCardHeader, PostCardToolbar } from './PostCardSections'

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
  const extras = parsePostExtras(post.content)
  const openPost = () => setActivePostId(post.id)

  return (
    <Card asChild>
      <article className="post zalo-post feed-post-card flex! flex-col! gap-y-2! min-w-0! m-0! px-[18px]! pt-[14px]! pb-[11px]! max-[760px]:px-4! max-[760px]:pt-3! max-[760px]:pb-2.5! overflow-hidden! rounded-2xl! max-[760px]:rounded-none! border! border-[#e8ecf5]! bg-white! shadow-[0_3px_16px_rgba(30,51,96,0.035)]!">
        <PostCardHeader post={post} authorLabel={authorLabel} name={name} onAuthorOpen={onAuthorOpen}
          onEditPost={onEditPost} openPost={openPost} apiFetch={apiFetch} syncFeedPost={syncFeedPost}
          removeFeedPost={removeFeedPost} setNotice={setNotice} onRepostChanged={onRepostChanged} />
        <div className="post-body grid! w-full! min-w-0! gap-1.5! [&>*]:min-w-0!">
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
        <PostCardEngagement post={post} onReactionUsers={onReactionUsers} />
        <PostCardToolbar post={post} busy={likeBusy} like={like} apiFetch={apiFetch}
          syncFeedPost={syncFeedPost} removeFeedPost={removeFeedPost} setNotice={setNotice}
          onRepostChanged={onRepostChanged} onShareToChat={onShareToChat}
          onToggleComments={onToggleComments} discussion={discussion} openPost={openPost} />
        </>}
      </div>
      </article>
    </Card>
  )
}