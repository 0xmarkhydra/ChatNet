import type { ComponentProps } from 'react'
import PostComposer from './PostComposer'

type ComposerProps = ComponentProps<typeof PostComposer>
type EligibleFriend = ComposerProps['taggableFriends'][number] & {
  status: string
  blockedByMe?: boolean
  blockedByOther?: boolean
}

type Options = {
  props: Omit<ComposerProps, 'taggableFriends' | 'popup' | 'displayName' | 'cancelUpload'>
  friends: EligibleFriend[]
  profileDisplayName?: string
  sessionDisplayName?: string
  profileComposerOpen: boolean
  feedComposerOpen: boolean
  cancelUpload: () => void
}

/** Feeds presentation-specific identity, friend eligibility, and overlay state to the existing composer. */
export function createPostComposerPresenter({
  props, friends, profileDisplayName, sessionDisplayName,
  profileComposerOpen, feedComposerOpen, cancelUpload,
}: Options) {
  return (
    <PostComposer
      {...props}
      taggableFriends={friends.filter(friend =>
        friend.status === 'accepted' && !friend.blockedByMe && !friend.blockedByOther)}
      popup={profileComposerOpen || feedComposerOpen}
      displayName={profileDisplayName || sessionDisplayName || props.name}
      cancelUpload={cancelUpload}
    />
  )
}
