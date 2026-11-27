import { useUiTranslation, type UiCopyKey } from '@/shared/i18n/locale'
import { RefreshCw, Search, UserRoundSearch } from 'lucide-react'
import type { FriendSearchResult } from '../types'
import UserAvatar from '../../../shared/ui/UserAvatar'

type Relationship = 'accepted' | 'incoming' | 'outgoing' | 'none'

type Props = {
  results: FriendSearchResult[]
  loading: boolean
  error: boolean
  busyIds: ReadonlySet<number>
  relationshipFor: (id: number) => Relationship
  onAction: (friend: FriendSearchResult) => void
  onProfile: (friend: FriendSearchResult) => void
  onRetry: () => void
}

const labels: Record<Relationship, UiCopyKey> = {
  accepted: 'chat.message',
  incoming: 'common.accept',
  outgoing: 'contacts.cancelInvitation',
  none: 'contacts.addFriend',
}
const actionLabels: Record<Relationship, UiCopyKey> = {
  accepted: 'common.ui.messageWith',
  incoming: 'common.ui.acceptFriendNamed',
  outgoing: 'common.ui.cancelFriendNamed',
  none: 'common.ui.addFriendNamed',
}

export default function ContactSearchResults({
  results, loading, error, busyIds, relationshipFor, onAction, onProfile, onRetry,
}: Props) {
  const trUi = useUiTranslation()

  return <div className="fd-search-results" aria-busy={loading}>
    {loading ? <div className="fd-search-status" role="status">
      <Search size={20} aria-hidden="true" /><span>{trUi("common.ui.searchingPeople")}</span>
    </div> : error ? <div className="fd-search-status" role="alert">
      <span>{trUi("common.ui.searchPeopleFailed")}</span>
      <button type="button" className="fd-secondary" onClick={onRetry}>
        <RefreshCw size={15} aria-hidden="true" />{trUi("common.retry")}</button>
    </div> : results.length === 0 ? <div className="fd-search-status" role="status">
      <UserRoundSearch size={21} aria-hidden="true" /><span>{trUi("common.ui.noMatchingPeople")}</span>
    </div> : <div className="fd-person-list" aria-label={trUi("common.ui.peopleResults")}>
      {results.map(friend => {
        const name = friend.displayName || friend.username
        const busy = busyIds.has(friend.id)
        const relationship = relationshipFor(friend.id)
        return <div className="fd-person-row" key={friend.id} aria-busy={busy}>
          <button type="button" className="fd-person-identity" onClick={() => onProfile(friend)}>
            <UserAvatar username={friend.username} name={name} className="avatar fd-avatar" online={friend.online} />
            <span><strong>{name}</strong><small>@{friend.username}</small></span>
          </button>
          <button type="button" className="fd-secondary fd-search-action"
            aria-label={relationship === "accepted" ? trUi(actionLabels[relationship], { v1: name }) : relationship === "none" ? trUi(actionLabels[relationship], { v1: name }) : trUi(actionLabels[relationship], { name })}
            disabled={busy} onClick={() => onAction(friend)}>
            {busy ? trUi("common.processing") : trUi(labels[relationship])}
          </button>
        </div>
      })}
    </div>}
  </div>
}