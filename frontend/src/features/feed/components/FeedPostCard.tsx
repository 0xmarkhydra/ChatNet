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
    <article className="feed-post-card flex flex-col gap-y-2 min-w-0 m-0 px-0 pt-[14px] pb-[11px] overflow-hidden rounded-none border-x-0 border-y border-border-subtle bg-white shadow-none min-[761px]:rounded-2xl min-[761px]:border-0 min-[761px]:shadow-[0_3px_16px_rgba(30,51,96,0.06)] [&>.feed-post-header]:px-4">
        <PostCardHeader post={post} authorLabel={authorLabel} name={name} onAuthorOpen={onAuthorOpen}
          onEditPost={onEditPost} openPost={openPost} apiFetch={apiFetch} syncFeedPost={syncFeedPost}
          removeFeedPost={removeFeedPost} setNotice={setNotice} onRepostChanged={onRepostChanged} />
        <div className="feed-post-body grid w-full min-w-0 gap-1.5 [&>*]:min-w-0 [&>*:not(.feed-media-preview):not(.feed-post-toolbar)]:px-4">
        <PostExtrasView extras={extras} onAuthorOpen={onAuthorOpen} taggedNames={taggedNames} />
        {extras.caption && (
          <div className={post.background ? 'feed-post-clickable feed-text-background bg-' + post.background : 'feed-post-clickable feed-post-text pt-1.5 [&_.feed-text>p]:m-0! [&_.feed-text>p]:mb-1! [&_.feed-text>p]:text-sm! [&_.feed-text>p]:leading-normal! [&_.feed-translation-error]:text-muted-foreground!'}
            onClick={(event) => {
              if (event.target instanceof Element && !event.target.closest('button,a,input,textarea') && !window.getSelection()?.toString()) openPost()
            }}>
            <FeedText api={API} token={token}
              target={translationPreferencesLoaded ? targetLanguage : ''}
              text={extras.caption} maxLines={5} onExpand={() => setActivePostId(post.id)} />
          </div>
        )}
        {Boolean(post.attachments?.length) && (
          <div className="feed-media-preview mt-2! min-w-0! overflow-hidden! rounded-none! [&_.media-attachments]:rounded-none! [&_.media-item]:rounded-none! [&_.media-image-button]:rounded-none! [&_.media-item_img]:rounded-none! [&_.media-item_video]:rounded-none! [&_.media-attachments]:w-full! [&_.media-attachments]:max-w-none! [&_.media-attachments]:m-0! [&_.media-count-1_.media-item_img]:h-auto! [&_.media-count-1_.media-item_img]:max-h-[440px]! [&_.media-count-1_.media-item_img]:object-contain! [&_.media-count-1_.media-item_img]:rounded-none! [&_.media-count-1_.media-item_video]:h-auto! [&_.media-count-1_.media-item_video]:max-h-[440px]! [&_.media-count-1_.media-item_video]:object-contain!">
            <MediaAttachmentsView items={post.attachments} onImageClick={openPost} />
          </div>
        )}
        <FeedRepostPreview post={post} onOpen={setActivePostId} />
        {post.repostKind === 'quick' && <div className="feed-post-toolbar">
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
  )
}