import { useUiTranslation, useUiLocale } from '@/shared/i18n/locale'
import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useScopedState } from '../../../shared/hooks/useScopedState'
import { useSession } from '../../../shared/context/SessionContext'
import { AtSign, Bell, Check, MessageCircle, Settings, UserRoundPlus, Users, X } from 'lucide-react'
import type { FriendConnection } from '../../contacts'
import type { Conversation } from '../../chat'
import type { PostMentionNotification } from '../../feed'
import UserAvatar from '../../../shared/ui/UserAvatar'
import { ConversationAvatar } from '../../chat'
import useSlidingPill from '../../../shared/ui/useSlidingPill'
import { buildNotificationItems, countUnreadNotificationItems, filterNotificationItems, type NotificationFilter } from '../utils/notification-items'
import '../styles/notifications-page.css'

type Props = {
  requests: FriendConnection[]
  conversations: Conversation[]
  mentions: PostMentionNotification[]
  onReadMention: (id: number) => void
  onOpenMention: (mention: PostMentionNotification) => void
  search: string
  busyFriendIds: Set<number>
  onAccept: (friend: FriendConnection) => void
  onDecline: (friend: FriendConnection) => void
  onOpenConversation: (id: number) => void
  onOpenInvitations: () => void
  onOpenFriend: (username: string) => void
  onSettings: () => void
}

const displayDate = (input: string, locale: string) => {
  if (!input) return ''
  const date = new Date(input)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export default function NotificationsPage({
  requests, conversations, mentions, onReadMention, onOpenMention, search, busyFriendIds, onAccept, onDecline,
  onOpenConversation, onOpenInvitations, onOpenFriend, onSettings,
}: Props) {
  const trUi = useUiTranslation()
  const locale = useUiLocale()

  const [filter, setFilter] = useState<NotificationFilter>('all')
  const { hostRef: filtersPillSetHost, activeRef: filtersPillSetActive, pillRef: filtersPillSetPill } = useSlidingPill<HTMLDivElement>(filter)
  const { session } = useSession()
  const sessionId = session.sessionId
  const notificationList = useRef<HTMLDivElement>(null)
  const previousNotifications = useRef<{ sessionId: string; keys: Set<string> } | null>(null)
  const [selectedKey, setSelectedKey] = useScopedState<string | null>(session.sessionId, null)
  const notifications = useMemo(() => buildNotificationItems(requests, conversations, mentions, trUi), [requests, conversations, mentions, trUi])

  const filtered = filterNotificationItems(notifications, filter, search)
  const selected = filtered.find(n => n.key === selectedKey) ?? filtered[0] ?? null
  const unseenCount = countUnreadNotificationItems(notifications)

  useLayoutEffect(() => {
    const previous = previousNotifications.current
    const keys = new Set(notifications.map(item => item.key))
    previousNotifications.current = { sessionId, keys }
    if (previous?.sessionId !== sessionId || !notificationList.current
      || !window.matchMedia?.('(prefers-reduced-motion: no-preference)').matches) return

    // Compare source keys, not filtered rows, so search and tab changes never replay the entry.
    const rows = notificationList.current.querySelectorAll<HTMLElement>('[data-notification-key]')
    let animated = 0
    for (const row of rows) {
      const key = row.dataset.notificationKey
      if (!key || previous.keys.has(key) || !row.animate) continue
      row.animate([
        { opacity: .45, transform: 'translateY(-6px)' },
        { opacity: 1, transform: 'translateY(0)' },
      ], { duration: 190, delay: animated * 30, easing: 'cubic-bezier(.2,.8,.2,1)' })
      if (++animated === 4) break
    }
  }, [notifications, sessionId])

  const markRead = (key: string) => {
    const item = notifications.find(value => value.key === key)
    if (item?.mention && !item.mention.readAt) onReadMention(item.mention.id)
  }

  return <div className="np-screen" aria-label={trUi("common.ui.notificationsScreen")}>
    <div className="np-layout">
      <section className="np-card np-list-pane" aria-label={trUi("notifications.new")}>
        <h2>{trUi("notifications.new")}</h2>
        <div ref={filtersPillSetHost} className="np-filters sliding-pill-host" role="tablist" aria-label={trUi("common.ui.filterNotifications")}>
          <span ref={filtersPillSetPill} className="sliding-pill notifications-active-pill" aria-hidden="true" />
          {([['all','common.all'], ['unread','notifications.unread'], ['mentions','notifications.mentions']] as const)
            .map(([key, label]) => <button ref={filter === key ? filtersPillSetActive : undefined} type="button" role="tab" key={key}
              className={filter === key ? 'active' : ''} aria-selected={filter === key}
              onClick={() => setFilter(key)} >{trUi(label)}</button>)}
        </div>
        <div className="np-notification-list" ref={notificationList}>
          {filtered.map(item => <button key={item.key} type="button" data-notification-key={item.key}
            className={'np-notification-row' + (selected?.key === item.key ? ' selected' : '') + (item.mention?.readAt ? ' is-read' : '')}
            onClick={() => { setSelectedKey(item.key); markRead(item.key) }}>
            {(item.kind === 'friend' || item.kind === 'mention') && item.username
              ? <UserAvatar username={item.username} name={item.name} online={false} className="avatar np-avatar"/>
              : item.conversation ? <ConversationAvatar conversation={item.conversation} className="avatar np-avatar" />
              : <span className="np-group-avatar"><Users size={21}/></span>}
            <span className="np-notification-copy">
              <strong>{item.name}</strong><span>{item.subtitle}</span>
              <small>{displayDate(item.date, locale)}</small>
            </span>
            <span className="np-row-icon" aria-hidden="true">
              {item.kind === 'friend' ? <UserRoundPlus size={18}/> : item.kind === 'mention' ? <AtSign size={18}/> : <MessageCircle size={18}/>}
            </span>
          </button>)}
          {!filtered.length && <div className="np-empty" role="status">
            <Bell size={27}/>
            <strong>{filter === 'mentions' ? trUi('notifications.emptyMentions') : filter === 'unread' ? trUi('notifications.emptyUnread') : trUi('notifications.empty')}</strong>
            <p>{filter === 'mentions' ? trUi('notifications.emptyMentionHint') : trUi('notifications.emptyHint')}</p>
          </div>}
        </div>
        {filter === 'all' && unseenCount > 0 && <small className="np-unread-hint">{trUi('notifications.unseenCount', { count: unseenCount })}</small>}
      </section>
      <aside className="np-card np-detail-pane" aria-label={trUi("notifications.info")}>
        <h2>{trUi("notifications.info")}</h2>
        {selected ? <>
          <div className="np-detail-person">
            {(selected.kind === 'friend' || selected.kind === 'mention') && selected.username
              ? <UserAvatar username={selected.username} name={selected.name} online={false} className="avatar np-detail-avatar"/>
              : selected.conversation ? <ConversationAvatar conversation={selected.conversation} className="avatar np-detail-avatar" />
              : <span className="np-detail-group-avatar"><Users size={35}/></span>}
            <h3>{selected.name}</h3>
            <p>{selected.subtitle}</p>
          </div>
          <div className="np-detail-description">
            {selected.mention ? <>
              <p><strong>{trUi(selected.mention.kind === 'repost' ? 'notifications.repostedPost' : selected.mention.kind === 'quote' ? 'notifications.quotedPost' : 'notifications.taggedPost')}</strong></p>
              <p>{trUi('notifications.taggedPostHint')}</p>
            </> : selected.kind === 'friend' && selected.friend ? <>
              <p><strong>@{selected.friend.username}</strong></p>
              <p>{typeof selected.friend.mutualGroups === 'number'
                ? trUi('notifications.mutualGroups', { count: selected.friend.mutualGroups })
                : trUi('notifications.pendingFriend')}</p>
            </> : <>
              <p><strong>{selected.conversation?.type === 'group' ? trUi("chat.groupChat") : trUi('notifications.directChat')}</strong></p>
              <p>{selected.subtitle}</p>
              {selected.conversation?.lastMessage && <p className="np-message-preview">{selected.conversation.lastMessage}</p>}
            </>}
          </div>
          <div className="np-detail-actions">
            {selected.mention ? <>
              <button type="button" className="np-primary" onClick={() => onOpenMention(selected.mention!)}>
                <AtSign size={17}/>{trUi(selected.mention.kind === 'repost' || selected.mention.kind === 'quote' ? 'common.ui.openPost' : 'notifications.openTaggedPost')}</button>
              {!selected.mention.readAt && <button type="button" className="np-secondary"
                onClick={() => onReadMention(selected.mention!.id)}><Check size={17}/>{trUi('notifications.markSeen')}</button>}
              <button type="button" className="np-text-link"
                onClick={() => selected.username && onOpenFriend(selected.username)}>{trUi(selected.mention.kind === 'repost' || selected.mention.kind === 'quote' ? 'notifications.posterProfile' : 'notifications.taggerProfile')}</button>
            </> : selected.friend ? <>
              <button type="button" className="np-primary" disabled={busyFriendIds.has(selected.friend.id)}
                onClick={() => onAccept(selected.friend!)}><Check size={17}/>{trUi('notifications.acceptRequest')}</button>
              <button type="button" className="np-secondary" disabled={busyFriendIds.has(selected.friend.id)}
                onClick={() => onDecline(selected.friend!)}><X size={17}/>{trUi("common.decline")}</button>
              <button type="button" className="np-text-link" onClick={() => selected.username && onOpenFriend(selected.username)}>{trUi('notifications.senderProfile')}</button>
            </> : selected.conversation ? <>
              <button type="button" className="np-primary" onClick={() => onOpenConversation(selected.conversation!.id)}>
                <MessageCircle size={17}/>{trUi('notifications.openConversation')}</button>
              <p className="np-unread-hint">{trUi('notifications.readMessageHint')}</p>
            </> : null}
          </div>
        </> : <div className="np-detail-empty"><Bell size={40}/>
          <h3>{trUi('notifications.selectNotice')}</h3><p>{trUi('notifications.detailHint')}</p>
        </div>}
        <button type="button" className="np-settings" onClick={onSettings}>
          <Settings size={20}/><span><strong>{trUi('notifications.manage')}</strong><small>{trUi('notifications.manageHint')}</small></span>
        </button>
        <button type="button" className="np-invites-link" onClick={onOpenInvitations}>{trUi('notifications.viewRequests')}</button>
      </aside>
    </div>
  </div>
}