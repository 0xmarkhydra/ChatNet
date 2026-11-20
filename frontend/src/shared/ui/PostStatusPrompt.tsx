import UserAvatar from './UserAvatar'

type Props = {
  username: string
  displayName: string
  prompt: string
  onCreatePost: () => void
  pending?: boolean
  avatarClassName?: string
  promptClassName?: string
}

/** Shared avatar + post-entry prompt used by Feed and the owner's Profile. */
export default function PostStatusPrompt({
  username, displayName, prompt, onCreatePost, pending = false,
  avatarClassName, promptClassName,
}: Props) {
  return (
    <>
      <UserAvatar username={username} name={displayName} className={avatarClassName} />
      <button type="button" className={promptClassName} onClick={onCreatePost} disabled={pending}>
        {prompt}
      </button>
    </>
  )
}
