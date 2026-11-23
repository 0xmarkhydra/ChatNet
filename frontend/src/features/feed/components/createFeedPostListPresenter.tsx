import type { ComponentProps, ReactNode } from 'react'
import FeedPostCard from './FeedPostCard'
import type { Post } from '../types'

type SharedCardProps = Omit<ComponentProps<typeof FeedPostCard>,
  'post' | 'setActivePostId' | 'onToggleComments' | 'discussion' | 'showSave' | 'onReactionUsers'
>

type Options = {
  card: SharedCardProps
  onOpenPost: (id: number) => void
  toggleInlineComments: (id: number) => void
  inlineCommentsId: number | null
  renderDiscussion: (post: Post) => ReactNode
  onReactionUsers: (post: Post) => void
}

/** Builds the same FeedPostCard elements and keys for feed/profile timelines. */
export function createFeedPostListPresenter({
  card, onOpenPost, toggleInlineComments,
  inlineCommentsId, renderDiscussion, onReactionUsers,
}: Options) {
  return (items: Post[], showSave = false, onOpen = onOpenPost) =>
    items.map(post => (
      <FeedPostCard
        {...card}
        key={post.id}
        post={post}
        setActivePostId={onOpen}
        onToggleComments={() => toggleInlineComments(post.id)}
        discussion={inlineCommentsId === post.id ? renderDiscussion(post) : null}
        showSave={showSave}
        onReactionUsers={onReactionUsers}
      />
    ))
}
