import type { FriendConnection } from '../../contacts/types'
import type { Conversation } from '../../chat/types'

/**
 * Count the rows of the 'Tất cả' notifications screen:
 * one incoming friend request or one unread conversation = one item.
 * Do not sum message unread counts or include outgoing invitations.
 */
export const isIncomingFriendRequest = (request: FriendConnection): boolean =>
  request.direction === 'incoming'

export const hasUnreadConversation = (conversation: Conversation): boolean =>
  conversation.unreadCount > 0

export function countNotificationItems(
  requests: ReadonlyArray<FriendConnection>,
  conversations: ReadonlyArray<Conversation>,
): number {
  return requests.filter(isIncomingFriendRequest).length
    + conversations.filter(hasUnreadConversation).length
}

export function formatNotificationBadge(count: number): string {
  return count > 99 ? '99+' : String(count)
}
