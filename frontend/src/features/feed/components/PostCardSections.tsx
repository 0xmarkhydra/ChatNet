import { useUiTranslation, useUiLocale, formatUiNumber, formatUiRelativeTime } from '@/shared/i18n/locale'
import PostLocationTag from './PostLocationTag'
import type { ReactNode } from 'react'

import UserAvatar from '../../../shared/ui/UserAvatar'
import UiIcon from '../../../shared/ui/UiIcon'
import type { Post } from '../types'
import type { ToastKind } from '../../../shared/utils/toast'
import FeedPostActions from './FeedPostActions'
import FeedLikeButton from './FeedLikeButton'
import FeedRepostAction from './FeedRepostAction'
import { postActionClassName } from './postCardStyles'

function formatCount(count: number, locale: string): number | string {
  return count < 1000 ? count : formatUiNumber(count, locale, { notation: 'compact', maximumFractionDigits: 1 })
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
  const trUi = useUiTranslation()
  const locale = useUiLocale()

  return (
    <header className="feed-post-header post-card-header flex w-full min-w-0 items-start gap-[9px]">
      <UserAvatar username={post.author} name={authorLabel} className="avatar size-10! basis-10! shrink-0! rounded-full! bg-none! bg-secondary! text-primary!" />
      <div className="feed-post-author flex min-h-10 min-w-0 flex-1 items-start justify-between gap-2">
        <div className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)] gap-[3px]">
          <strong className="block! truncate! text-base! font-bold! text-[#142443]!">
            {onAuthorOpen ? <button type="button" className="visitor-name-link" onClick={() => onAuthorOpen(post.author)}>{authorLabel}</button> : authorLabel}
          </strong>
          {post.repostKind && <span className="block text-sm text-muted-foreground">{trUi(post.repostKind === 'quick' ? 'feed.reposted' : 'feed.quoted')}</span>}
          <small className="block! text-xs! text-[#7889aa]!">
            <button type="button" className="feed-post-open-date" aria-label={trUi("common.ui.openPost")} onClick={openPost}>{formatUiRelativeTime(post.createdAt, locale, trUi('feed.justNow'))}</button>
            {' · '}{post.visibility === 'private' ? trUi("profile.onlyMe") : post.visibility === 'friends' ? trUi("contacts.friends") : trUi("common.public")}
          </small>
          <PostLocationTag post={post} />
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
  const trUi = useUiTranslation()

  const locale = useUiLocale()
  const commentsCount = post.comments?.length ?? 0
  return (
    <div className="feed-post-engagement whitespace-nowrap flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 px-4 py-2 text-ui-label! text-[#7585a7]!">
      <button type="button" className="feed-post-likes feed-reaction-users-trigger inline-flex items-center gap-2"
        disabled={post.likes === 0} aria-label={trUi("common.ui.viewReactionsCount", { v1: String(post.likes) })} onClick={() => onReactionUsers(post)}>
        <span>{trUi('feed.likesCount', { count: formatCount(post.likes, locale) })}</span>
      </button>
      <span className="feed-post-conversation-stats ml-auto text-right">
        {trUi('feed.commentsCount', { count: commentsCount })}{Boolean(post.repostCount) && ` · ${trUi('feed.repostsCount', { count: formatCount(post.repostCount ?? 0, locale) })}`}
      </span>
    </div>
  )
}

export function PostCardToolbar({
  post, busy, like, discussion, openPost, ...actions
}: PostActions & {
  post: Post
  busy: boolean
  like: (post: Post, emoji?: string) => Promise<void>
  discussion?: ReactNode
  openPost: () => void
}) {
  const trUi = useUiTranslation()

  return (
    <>
      <div className="feed-post-toolbar grid grid-cols-3 items-center gap-1 mt-0 mx-4 pt-1 border-t border-border-subtle">
        <FeedLikeButton post={post} busy={busy} onLike={(emoji) => void like(post, emoji)} />
        <button type="button" className={`post-detail-trigger ${postActionClassName}`}
          aria-label={trUi("common.ui.openPostComment")}
          onClick={openPost}>
          <UiIcon name="comment" size={18} /><span>{trUi("feed.comment")}</span>
        </button>
        <FeedRepostAction post={post} request={actions.apiFetch} onUpdated={actions.syncFeedPost} onRemoved={actions.removeFeedPost}
          onChanged={actions.onRepostChanged} onShareToChat={actions.onShareToChat} onFeedback={actions.setNotice} />
      </div>
      {discussion && (
        <section className="feed-inline-comments" aria-label={trUi("common.ui.commentField")}>
          {discussion}
        </section>
      )}
    </>
  )
}