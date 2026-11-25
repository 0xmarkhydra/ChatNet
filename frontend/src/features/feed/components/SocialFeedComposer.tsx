import PostComposerLauncher from '../../../shared/ui/PostComposerLauncher'

type Props = {
  username: string
  displayName: string
  draft: string
  pending: boolean
  storyBusy: boolean
  onCreatePost: () => void
  onCreateStory: () => void
  onCreateMediaPost: (files: File[]) => void
  onCheckIn: () => void
}

/** Backward-compatible Feed entrypoint; Feed and Profile share the same Tailwind launcher. */
export default function SocialFeedComposer({
  username, displayName, draft, pending, storyBusy,
  onCreatePost, onCreateStory, onCreateMediaPost, onCheckIn,
}: Props) {
  return (
    <PostComposerLauncher
      username={username}
      displayName={displayName}
      prompt={draft.trim() ? 'Tiếp tục bài viết của bạn...' : 'Bạn đang nghĩ gì?'}
      pending={pending}
      storyBusy={storyBusy}
      onCreatePost={onCreatePost}
      onCreateStory={onCreateStory}
      onCreateMediaPost={onCreateMediaPost}
      onCheckIn={onCheckIn}
    />
  )
}
