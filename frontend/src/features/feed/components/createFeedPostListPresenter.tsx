import type { ComponentProps, ReactNode } from 'react'
import FeedPostCard from './FeedPostCard'
import type { Post } from '../types'

type SharedCardProps = Omit<ComponentProps<typeof FeedPostCard>,
  'post' | 'setActivePostId' | 'discussion' | 'showSave' | 'onReactionUsers'
>

type Options = {
  card: SharedCardProps
  onOpenPost: (id: number) => void
  renderDiscussion: (post: Post) => ReactNode
  onReactionUsers: (post: Post) => void
}

/** Builds the same FeedPostCard elements and keys for feed/profile timelines. */
export function createFeedPostListPresenter({
  card, onOpenPost, renderDiscussion, onReactionUsers,
}: Options) {
  return (items: Post[], showSave = false, onOpen = onOpenPost) =>
    items.map(post => (
      <FeedPostCard
        {...card}
        key={post.id}
        post={post}
        setActivePostId={onOpen}
        discussion={renderDiscussion(post)}
        showSave={showSave}
        onReactionUsers={onReactionUsers}
      />
    ))
}
