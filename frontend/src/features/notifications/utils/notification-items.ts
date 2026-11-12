import type { FriendConnection } from '../../contacts/types'
import type { Conversation } from '../../chat/types'
import type { PostMentionNotification } from '../../feed/utils/postMentionNotifications'
import { isIncomingFriendRequest, hasUnreadConversation } from './notification-count'

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

export function buildNotificationItems(
  requests: readonly FriendConnection[],
  conversations: readonly Conversation[],
  mentions: readonly PostMentionNotification[],
): NotificationItem[] {
  const pending: NotificationItem[] = requests.filter(isIncomingFriendRequest).map(friend => ({
    key: 'friend:' + friend.id, kind: 'friend', name: friend.displayName || friend.username,
    subtitle: 'đã gửi lời mời kết bạn', date: friend.updatedAt || '',
    username: friend.username, friend,
  }))
  const unreadChats: NotificationItem[] = conversations.filter(hasUnreadConversation).map(conversation => ({
    key: 'chat:' + conversation.id, kind: 'message', name: conversation.name,
    subtitle: 'có ' + conversation.unreadCount + ' tin nhắn chưa đọc',
    date: conversation.lastMessageAt || conversation.createdAt || '', conversation,
  }))
  const taggedPosts: NotificationItem[] = mentions.map(mention => ({
    key: 'mention:' + mention.id, kind: 'mention',
    name: mention.authorDisplayName || mention.author,
    subtitle: 'đã gắn thẻ bạn trong một bài viết',
    date: mention.createdAt, username: mention.author, mention,
  }))
  return [...pending, ...unreadChats, ...taggedPosts].sort((a, b) => (b.date || '').localeCompare(a.date || ''))
}
