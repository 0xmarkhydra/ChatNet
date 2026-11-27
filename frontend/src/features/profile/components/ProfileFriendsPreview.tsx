import type { FriendConnection } from '../../contacts'
import UserAvatar from '@/shared/ui/UserAvatar'

type Props = {
  friends: FriendConnection[]
  onViewFriend: (username: string) => void
  onViewAll: () => void
}

export default function ProfileFriendsPreview({ friends, onViewFriend, onViewAll }: Props) {
  const accepted = friends.filter(friend => friend.status === 'accepted' && !friend.blockedByMe && !friend.blockedByOther)
  if (!accepted.length) return null

  return <section className="grid min-w-0 gap-ui-2" aria-label="Bạn bè">
    <header className="flex items-center justify-between gap-ui-2">
      <h2 className="m-0 text-ui-section! font-semibold! tracking-[-0.3px] text-foreground!">Bạn bè</h2>
      <button type="button" className="min-h-control-touch cursor-pointer rounded-ui-sm border-0 bg-transparent px-ui-1 text-[15px]! font-medium! text-primary! focus-visible:outline-2 focus-visible:outline-ring" onClick={onViewAll}>Xem tất cả</button>
    </header>
    <ul className="m-0 grid list-none grid-cols-4 gap-ui-2 p-0" role="list">
      {accepted.slice(0, 4).map(friend => {
        const label = friend.displayName || friend.username
        return <li key={friend.id} className="min-w-0">
          <button type="button" aria-label={'Xem hồ sơ ' + label} onClick={() => onViewFriend(friend.username)}
            className="flex min-h-control-touch w-full min-w-0 cursor-pointer flex-col items-center gap-ui-2 rounded-ui-md border-0 bg-transparent p-0 text-center focus-visible:outline-2 focus-visible:outline-ring">
            <UserAvatar storyStatus="none" username={friend.username} name={label} className="aspect-square w-full max-w-[76px] rounded-full text-ui-page font-bold" />
            <span className="line-clamp-2 w-full wrap-anywhere text-ui-body! font-semibold! leading-snug text-foreground!">{label}</span>
          </button>
        </li>
      })}
    </ul>
  </section>
}