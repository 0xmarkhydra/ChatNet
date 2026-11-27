import { useUiTranslation } from '@/shared/i18n/locale'
import type { FriendConnection } from '../../contacts'
import UserAvatar from '@/shared/ui/UserAvatar'

type Props = {
  friends: FriendConnection[]
  onViewFriend: (username: string) => void
  onViewAll: () => void
  loading?: boolean
  error?: boolean
  onRetry?: () => void
}

export default function ProfileFriendsPreview({ friends, onViewFriend, onViewAll, loading = false, error = false, onRetry }: Props) {
  const trUi = useUiTranslation()

  const accepted = friends.filter(friend => friend.status === 'accepted' && !friend.blockedByMe && !friend.blockedByOther)
  if (!accepted.length && !loading && !error) return null

  return <section className="grid min-w-0 gap-ui-2" aria-label={trUi("contacts.friends")}>
    <header className="flex items-center justify-between gap-ui-2">
      <h2 className="m-0 text-ui-section! font-semibold! tracking-[-0.3px] text-foreground!">{trUi("contacts.friends")}</h2>
      <button type="button" className="min-h-control-touch cursor-pointer rounded-ui-sm border-0 bg-transparent px-ui-1 text-[15px]! font-medium! text-primary! focus-visible:outline-2 focus-visible:outline-ring" onClick={onViewAll}>{trUi("common.seeAll")}</button>
    </header>
    {loading ? <div role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">{trUi("contacts.loadingFriends")}</span>
      <ul aria-hidden="true" className="m-0 grid list-none grid-cols-4 gap-ui-2 p-0">
        {Array.from({ length: 4 }, (_, index) => <li key={index} className="grid min-w-0 justify-items-center gap-ui-2">
          <div className="aspect-square w-full max-w-[76px] animate-pulse rounded-full bg-muted motion-reduce:animate-none" />
          <div className="h-3 w-3/4 animate-pulse rounded bg-muted motion-reduce:animate-none" />
        </li>)}
      </ul>
    </div> : error ? <p role="alert" className="m-0 text-ui-body text-muted-foreground">
      {trUi("contacts.loadFailed")} {onRetry && <button type="button" className="text-primary underline" onClick={onRetry}>{trUi("common.retry")}</button>}
    </p> : <ul className="m-0 grid list-none grid-cols-4 gap-ui-2 p-0" role="list">
      {accepted.slice(0, 4).map(friend => {
        const label = friend.displayName || friend.username
        return <li key={friend.id} className="min-w-0">
          <button type="button" aria-label={'Xem hồ sơ ' + label} onClick={() => onViewFriend(friend.username)}
            className="flex min-h-control-touch w-full min-w-0 cursor-pointer flex-col items-center gap-ui-2 rounded-ui-md border-0 bg-transparent p-0 text-center focus-visible:outline-2 focus-visible:outline-ring">
            <UserAvatar username={friend.username} name={label} className="aspect-square w-full max-w-[76px] rounded-full text-ui-page font-bold" />
            <span className="line-clamp-2 w-full wrap-anywhere text-ui-body! font-semibold! leading-snug text-foreground!">{label}</span>
          </button>
        </li>
      })}
    </ul>}
  </section>
}
