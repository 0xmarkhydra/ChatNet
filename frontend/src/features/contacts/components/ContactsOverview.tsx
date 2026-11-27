import { useUiLocale, useUiTranslation } from '@/shared/i18n/locale'
import { ArrowRight, Check, ChevronRight, Compass, QrCode, RefreshCw, ShieldCheck, Sparkles, UserRoundPlus, Users, X } from 'lucide-react'
import type { FriendConnection, FriendSearchResult } from '../types'
import UserAvatar from '../../../shared/ui/UserAvatar'
import ContactQrPanel from './ContactQrPanel'
import '../styles/contacts-overview.css'

type Props = {
  friends: FriendConnection[]
  friendRequests: FriendConnection[]
  suggestions: FriendSearchResult[]
  suggestionsLoading: boolean
  suggestionsError: boolean
  friendsLoading: boolean
  friendsError: string
  onRetryFriends: () => void
  onRetrySuggestions: () => void
  friendBusyIds: Set<number>
  actOnFriend: (friend: FriendSearchResult | FriendConnection) => Promise<void>
  declineFriendRequest: (friend: FriendConnection) => Promise<void>
  onDirectory: () => void
  onInvitations: () => void
  onOpenProfile: (friend: FriendSearchResult) => void
  onSettings: () => void
  connectionUrl: string
  onScanQr: () => void
}

const displayName = (friend: FriendSearchResult) => friend.displayName || friend.username

export default function ContactsOverview({
  friends, friendRequests, suggestions, suggestionsLoading, suggestionsError,
  friendsLoading, friendsError, onRetryFriends, onRetrySuggestions, friendBusyIds,
  actOnFriend, declineFriendRequest, onDirectory, onInvitations, onOpenProfile, onSettings, connectionUrl, onScanQr,
}: Props) {
  const trUi = useUiTranslation()
  const uiLocale = useUiLocale()

  const incoming = friendRequests.filter(friend => friend.direction === 'incoming')
  const connectedIds = new Set([...friends, ...friendRequests].map(friend => friend.id))
  const availableSuggestions = suggestions.filter(friend => !connectedIds.has(friend.id))
  const recommended = availableSuggestions.slice(0, 4)

  return <div className="contacts-overview" aria-label={trUi("common.ui.friendsOverview")}>
    <div className="co-layout">
      <div className="co-main">
        <section className="co-stats" aria-label={trUi("common.ui.connectionStats")}>
          <button type="button" className="co-stat" onClick={onDirectory}>
            <span className="co-stat-icon co-stat-friends"><Users size={24} aria-hidden="true" /></span>
            <span><strong>{friendsLoading ? '…' : friendsError ? '–' : friends.length.toLocaleString(uiLocale)}</strong><small>{trUi("contacts.friends")}</small></span>
          </button>
          <button type="button" className="co-stat" onClick={onInvitations}>
            <span className="co-stat-icon co-stat-requests"><UserRoundPlus size={23} aria-hidden="true" /></span>
            <span><strong>{friendsLoading ? '…' : friendsError ? '–' : incoming.length.toLocaleString(uiLocale)}</strong><small>{trUi("contacts.incomingRequests")}</small></span>
          </button>
          <button type="button" className="co-stat" onClick={onDirectory}>
            <span className="co-stat-icon co-stat-suggestions"><Sparkles size={23} aria-hidden="true" /></span>
            <span><strong>{suggestionsLoading ? '…' : suggestionsError ? '–' : availableSuggestions.length.toLocaleString(uiLocale)}</strong><small>{trUi("contacts.availableSuggestions")}</small></span>
          </button>
        </section>

        <section className="co-section" aria-labelledby="co-requests-title">
          <div className="co-section-heading">
            <div><h2 id="co-requests-title">{trUi("contacts.friendRequests") + ' '}{!friendsLoading && !friendsError && incoming.length > 0 && <span className="co-count-pill">{incoming.length}</span>}</h2><p>{friendsLoading ? trUi('contacts.syncRequests') : friendsError ? trUi('contacts.requestSyncFailed') : trUi('contacts.pendingCount', { count: incoming.length })}</p></div>
            <button type="button" onClick={onInvitations}>{trUi("common.seeAll") + ' '}<ArrowRight size={16} aria-hidden="true" /></button>
          </div>
          <div className="co-request-card">
            {friendsLoading && <div className="co-skeleton-list" role="status" aria-label={trUi("common.ui.loadingFriends")}><span className="co-skeleton-avatar" /><span className="co-skeleton-copy"><i /><i /></span><span className="co-skeleton-button" /></div>}
            {!friendsLoading && friendsError && <div className="co-feedback" role="alert"><span>{trUi('contacts.loadFailed')}</span><button type="button" onClick={onRetryFriends}><RefreshCw size={15} aria-hidden="true" />{trUi("common.retry")}</button></div>}
            {!friendsLoading && !friendsError && incoming.length === 0 && <p className="co-empty">{trUi('contacts.noIncoming')}</p>}
            {!friendsLoading && !friendsError && incoming.slice(0, 3).map(friend => <div className="co-request" key={friend.id}>
              <button type="button" className="co-profile-avatar" aria-label={trUi("common.ui.profileOfNamed", { v1: String(displayName(friend)) })} onClick={() => onOpenProfile(friend)}>
                <UserAvatar username={friend.username} name={displayName(friend)} className="avatar co-avatar" online={friend.online} />
              </button>
              <div className="co-person">
                <button type="button" className="co-profile-name" onClick={() => onOpenProfile(friend)}>{displayName(friend)}</button>
                <small>{typeof friend.mutualGroups === 'number' ? trUi('contacts.mutualCount', { count: friend.mutualGroups }) + ' · ' : ''}{trUi("contacts.waitingResponse")}</small>
              </div>
              <div className="co-request-actions">
                <button type="button" className="co-primary" disabled={friendBusyIds.has(friend.id)} onClick={() => void actOnFriend(friend)}>
                  <Check size={17} aria-hidden="true" /> {friendBusyIds.has(friend.id) ? trUi("common.processing") : trUi("common.accept")}
                </button>
                <button type="button" className="co-secondary" disabled={friendBusyIds.has(friend.id)} onClick={() => void declineFriendRequest(friend)}>
                  <X size={17} aria-hidden="true" />{trUi("common.decline")}</button>
              </div>
            </div>)}
          </div>
        </section>

        <section className="co-section" aria-labelledby="co-suggestions-title">
          <div className="co-section-heading">
            <div><h2 id="co-suggestions-title"><Sparkles size={20} aria-hidden="true" /> {trUi('contacts.peopleYouMayKnow')}</h2><p>{trUi('contacts.suggestionsHint')}</p></div>
            <button type="button" onClick={onDirectory}>{trUi("contacts.findFriends") + ' '}<ArrowRight size={16} aria-hidden="true" /></button>
          </div>
          {suggestionsLoading && <div className="co-suggestion-grid" role="status" aria-label={trUi("common.ui.loadingSuggestions")}>{Array.from({ length: 4 }, (_, index) => <div className="co-suggestion co-skeleton-card" key={index} aria-hidden="true"><span className="co-skeleton-avatar" /><span className="co-skeleton-copy"><i /><i /></span><span className="co-skeleton-button" /></div>)}</div>}
          {suggestionsError && !suggestionsLoading && <div className="co-feedback" role="alert"><span>{trUi('contacts.suggestionsFailed')}</span><button type="button" onClick={onRetrySuggestions}><RefreshCw size={15} aria-hidden="true" />{trUi("common.retry")}</button></div>}
          {!suggestionsLoading && !suggestionsError && recommended.length === 0 && <p className="co-empty">{trUi('discover.noConnections')}</p>}
          {!suggestionsLoading && recommended.length > 0 && <div className="co-suggestion-grid">
            {recommended.map(friend => <article className="co-suggestion" key={friend.id}>
              <button type="button" className="co-profile-avatar co-suggestion-profile-avatar" aria-label={trUi("common.ui.profileOfNamed", { v1: String(displayName(friend)) })} onClick={() => onOpenProfile(friend)}>
                <span className="co-suggestion-avatar-wrap"><UserAvatar username={friend.username} name={displayName(friend)} className="avatar co-suggestion-avatar" online={friend.online} /></span>
              </button>
              <button type="button" className="co-profile-name co-suggestion-profile-name" title={displayName(friend)} onClick={() => onOpenProfile(friend)}>{displayName(friend)}</button>
              <small className="co-mutual">{typeof friend.mutualGroups === 'number' ? <><Users size={12} aria-hidden="true" /> {trUi('contacts.mutualCount', { count: friend.mutualGroups })}</> : `@${friend.username}`}</small>
              <button type="button" className="co-secondary co-suggestion-action" aria-label={trUi("common.ui.addFriendNamed", { v1: String(displayName(friend)) })} disabled={friendBusyIds.has(friend.id)} onClick={() => void actOnFriend(friend)}>
                <UserRoundPlus size={17} aria-hidden="true" /> {friendBusyIds.has(friend.id) ? trUi("common.sending") : trUi("contacts.addFriend")}
              </button>
            </article>)}
          </div>}
        </section>
        <div className="co-discover-banner"><div className="co-discover-badge"><Compass size={19} aria-hidden="true" /></div><div><strong>{trUi('contacts.connectMore')}</strong><span>{trUi('contacts.connectMoreHint')}</span></div><button type="button" onClick={onDirectory}>{trUi("discover.discover") + ' '}<ArrowRight size={15} aria-hidden="true" /></button></div>
      </div>
      <aside className="co-side" aria-label={trUi("common.ui.connectionsPrivacy")}>
        <section className="co-qr-wrap" aria-label={trUi("contacts.qrConnect")}><div className="co-side-eyebrow"><QrCode size={15} aria-hidden="true" /> {trUi('contacts.quickConnect')}</div><ContactQrPanel connectionUrl={connectionUrl} onScanQr={onScanQr} /></section>
        <section className="co-privacy">
          <h2><ShieldCheck size={22} aria-hidden="true" /> {trUi('contacts.privacy')}</h2>
          <p>{trUi('contacts.privacyHint')}</p>
          <div className="co-privacy-details"><button type="button" onClick={onSettings}><ShieldCheck size={16} aria-hidden="true" /><span>{trUi('contacts.privacyControl')}</span><ChevronRight size={15} aria-hidden="true" /></button><button type="button" onClick={onInvitations}><UserRoundPlus size={16} aria-hidden="true" /><span>{trUi('contacts.manageRequests')}</span><ChevronRight size={15} aria-hidden="true" /></button></div>
          <button type="button" onClick={onSettings}>{trUi('contacts.managePrivacy')} <ArrowRight size={16} aria-hidden="true" /></button>
        </section>
      </aside>
    </div>
  </div>
}