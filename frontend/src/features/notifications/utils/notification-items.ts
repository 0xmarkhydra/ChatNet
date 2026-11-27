import { createUiTranslator } from '@/shared/i18n/locale'
import type { FriendConnection } from '../../contacts'
import type { Conversation } from '../../chat'
import type { PostMentionNotification } from '../../feed'
import { isIncomingFriendRequest, hasUnreadConversation } from './notification-count'

export type NotificationFilter = 'all' | 'unread' | 'mentions'

export type NotificationItem = {
  key: string
  kind: 'friend' | 'message' | 'mention'
  name: string
  subtitle: string
  date: string
  username?: string
  friend?: FriendConnection
  conversation?: Conversation
  mention?: PostMentionNotification
}

export function filterNotificationItems(
  items: readonly NotificationItem[], filter: NotificationFilter, search: string, readKeys: ReadonlySet<string>,
): NotificationItem[] {
  const term = search.toLocaleLowerCase('vi-VN').trim()
  return items.filter(item => {
    if (filter === 'mentions' && item.kind !== 'mention') return false
    if (filter === 'unread' && (item.mention ? Boolean(item.mention.readAt) : readKeys.has(item.key))) return false
    return !term || (item.name + ' ' + item.subtitle).toLocaleLowerCase('vi-VN').includes(term)
  })
}

export function countUnreadNotificationItems(items: readonly NotificationItem[], readKeys: ReadonlySet<string>): number {
  return items.filter(item => item.mention ? !item.mention.readAt : !readKeys.has(item.key)).length
}

export function buildNotificationItems(
  requests: readonly FriendConnection[],
  conversations: readonly Conversation[],
  mentions: readonly PostMentionNotification[],
  trUi = createUiTranslator('vi'),
): NotificationItem[] {
  const pending: NotificationItem[] = requests.filter(isIncomingFriendRequest).map(friend => ({
    key: 'friend:' + friend.id, kind: 'friend', name: friend.displayName || friend.username,
    subtitle: trUi('notifications.friendSubtitle'), date: friend.updatedAt || '',
    username: friend.username, friend,
  }))
  const unreadChats: NotificationItem[] = conversations.filter(hasUnreadConversation).map(conversation => ({
    key: 'chat:' + conversation.id, kind: 'message', name: conversation.name,
    subtitle: trUi('notifications.messageSubtitle', { count: conversation.unreadCount }),
    date: conversation.lastMessageAt || conversation.createdAt || '', conversation,
  }))
  const taggedPosts: NotificationItem[] = mentions.map(mention => ({
    key: 'mention:' + mention.id, kind: 'mention',
    name: mention.authorDisplayName || mention.author,
    subtitle: mention.kind === 'repost' ? trUi('notifications.repostSubtitle') :
      mention.kind === 'quote' ? trUi('notifications.quoteSubtitle') : trUi('notifications.mentionSubtitle'),
    date: mention.createdAt, username: mention.author, mention,
  }))
  return [...pending, ...unreadChats, ...taggedPosts].sort((a, b) => (b.date || '').localeCompare(a.date || ''))
}