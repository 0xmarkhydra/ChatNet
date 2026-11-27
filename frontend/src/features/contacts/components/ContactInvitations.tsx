import { useUiTranslation } from '@/shared/i18n/locale'
import { useId, useState, type KeyboardEvent } from 'react'
import { ArrowLeft, ArrowRight, Check, Clock3, QrCode, UserRoundPlus, X } from 'lucide-react'
import type { FriendConnection, FriendSearchResult } from '../types'
import UserAvatar from '../../../shared/ui/UserAvatar'
import useSlidingPill from '../../../shared/ui/useSlidingPill'
import ContactQrPanel from './ContactQrPanel'

type InvitationTab = 'incoming' | 'sent' | 'qr'
type Props = {
  friendRequests: FriendConnection[]
  friendBusyIds: Set<number>
  actOnFriend: (friend: FriendSearchResult | FriendConnection) => Promise<void>
  declineFriendRequest: (friend: FriendConnection) => Promise<void>
  connectionUrl: string
  onScanQr: () => void
  onBack: () => void
  onSearch: () => void
}

const personName = (friend: FriendConnection) => friend.displayName || friend.username

export default function ContactInvitations({ friendRequests, friendBusyIds, actOnFriend, declineFriendRequest, connectionUrl, onScanQr, onBack, onSearch }: Props) {
  const trUi = useUiTranslation()

  const [invitationTab, setInvitationTab] = useState<InvitationTab>('incoming')
  const instanceId = useId()
  const tabId = (tab: InvitationTab) => instanceId + '-tab-' + tab
  const panelId = instanceId + '-tabpanel'
  const tabs: InvitationTab[] = ['incoming', 'sent', 'qr']
  const onTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, tab: InvitationTab) => {
    const current = tabs.indexOf(tab)
    const next = event.key === 'ArrowRight' ? (current + 1) % tabs.length
      : event.key === 'ArrowLeft' ? (current + tabs.length - 1) % tabs.length
      : event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : -1
    if (next < 0) return
    event.preventDefault()
    setInvitationTab(tabs[next])
    document.getElementById(tabId(tabs[next]))?.focus()
  }
  const { hostRef, pillRef, activeRef } = useSlidingPill<HTMLDivElement>(invitationTab)
  const incoming = friendRequests.filter(friend => friend.direction === 'incoming')
  const outgoing = friendRequests.filter(friend => friend.direction === 'outgoing')
  const avatar = (friend: FriendConnection) => (
    <UserAvatar username={friend.username} name={personName(friend)} className="avatar fd-avatar" online={friend.online} />
  )
  return <>
    <div className="fd-invitation-layout">
      <div className="fd-invitation-main">
      <div className="fd-invitation-tabs">
        <button type="button" className="fd-back" onClick={onBack} aria-label={trUi("common.ui.backContacts")}><ArrowLeft size={17}/></button>
        <div ref={hostRef} className="sliding-pill-host" role="tablist" aria-label={trUi("contacts.friendRequests")} aria-orientation="horizontal">
          <span ref={pillRef} className="sliding-pill invitation-active-pill" aria-hidden="true" />
          {([['incoming','contacts.incomingRequests'],['sent','common.sent'],['qr','profile.scanQr']] as const).map(([id,label]) =>
            <button ref={invitationTab === id ? activeRef : undefined} role="tab" type="button" key={id} className={invitationTab === id ? 'active' : ''}
              id={tabId(id)} aria-controls={panelId} tabIndex={invitationTab === id ? 0 : -1}
              aria-selected={invitationTab === id} onKeyDown={event => onTabKeyDown(event, id)} onClick={() => setInvitationTab(id)}>{trUi(label)}</button>)}
        </div>
        <small aria-live="polite">{trUi('contacts.requestCounts', { incoming: incoming.length, outgoing: outgoing.length })}</small>
      </div>
        <section className="fd-card fd-invitation-list" id={panelId} role="tabpanel" aria-labelledby={tabId(invitationTab)} tabIndex={0}>
          {invitationTab === 'incoming' ? <>
            <div className="fd-invitation-heading"><h2>{trUi("contacts.incomingRequests")}</h2><p>{trUi('contacts.noAutoAccept')}</p></div>
            {incoming.length === 0 && <p className="fd-empty">{trUi('contacts.noIncomingRequests')}</p>}
            {incoming.map(friend => <div className="fd-request-row" key={friend.id} aria-busy={friendBusyIds.has(friend.id)} >
              {avatar(friend)}<div className="fd-request-copy"><strong>{personName(friend)}</strong>
                <span>@{friend.username} · {friendBusyIds.has(friend.id) ? trUi("common.processingDots") : trUi("contacts.waitingResponse")}</span></div>
              <button type="button" className="fd-primary" disabled={friendBusyIds.has(friend.id)} aria-label={trUi('contacts.acceptNamed', { name: personName(friend) })} onClick={() => void actOnFriend(friend)}><Check size={17}/>{trUi("common.accept")}</button>
              <button type="button" className="fd-secondary" disabled={friendBusyIds.has(friend.id)} aria-label={trUi('contacts.declineNamed', { name: personName(friend) })} onClick={() => void declineFriendRequest(friend)}><X size={17}/>{trUi("common.decline")}</button>
            </div>)}
            <button type="button" className="fd-outgoing-summary" onClick={() => setInvitationTab('sent')}>
              <Clock3 size={18}/><span><strong>{trUi('contacts.sentCount', { count: outgoing.length })}</strong><small>{trUi('contacts.cancelHint')}</small></span><ArrowRight size={18}/>
            </button>
          </> : invitationTab === 'sent' ? <>
            <div className="fd-invitation-heading"><h2>{trUi("common.sent")}</h2><p>{trUi('contacts.sentHint')}</p></div>
            {outgoing.length === 0 && <p className="fd-empty">{trUi('contacts.noPending')}</p>}
            {outgoing.map(friend => <div className="fd-request-row" key={friend.id} aria-busy={friendBusyIds.has(friend.id)} >
              {avatar(friend)}<div className="fd-request-copy"><strong>{personName(friend)}</strong><span>@{friend.username} · {friendBusyIds.has(friend.id) ? trUi("common.processingDots") : trUi('contacts.pending')}</span></div>
              <button type="button" className="fd-secondary" disabled={friendBusyIds.has(friend.id)}
                aria-label={trUi('contacts.cancelSentNamed', { name: personName(friend) })} onClick={() => void actOnFriend(friend)}><X size={17} aria-hidden="true"/>{trUi("contacts.cancelInvitation")}</button>
            </div>)}
            <button type="button" className="fd-outgoing-summary" onClick={onSearch}>
              <UserRoundPlus size={20}/><span><strong>{trUi('contacts.findNew')}</strong><small>{trUi('contacts.backToDirectory')}</small></span><ArrowRight size={18}/>
            </button>
          </> : <>
            <div className="fd-invitation-heading"><h2>{trUi("profile.scanQr")}</h2><p>{trUi('contacts.scanHint')}</p></div>
            <div className="fd-scan-feature"><QrCode size={76}/><h3>{trUi('contacts.qrTitle')}</h3>
              <p>{trUi('contacts.qrCameraHint')}</p>
              <button type="button" className="fd-primary" onClick={onScanQr}><QrCode size={19}/>{trUi('contacts.openScanner')}</button></div>
          </>}
        </section>
      </div>
        <ContactQrPanel connectionUrl={connectionUrl} onScanQr={onScanQr} />
      </div>

  </>
}