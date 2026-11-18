import type { Conversation } from "../../features/chat/types";
import type { FriendConnection, FriendSearchResult } from "../../features/contacts/types";

type NamedContact = { nickname?: string };
type ContactMetadataByUserId = Readonly<Record<number, NamedContact | undefined>>;

export function withContactNicknames(
  conversations: readonly Conversation[],
  metadata: ContactMetadataByUserId,
): Conversation[] {
  return conversations.map((conversation) => ({
    ...conversation,
    name: conversation.type === "direct" && conversation.otherUserId
      ? metadata[conversation.otherUserId]?.nickname || conversation.name
      : conversation.name,
  }));
}

export function mergeContactSearchResults(
  query: string,
  friends: readonly FriendConnection[],
  requests: readonly FriendConnection[],
  results: readonly FriendSearchResult[],
): FriendSearchResult[] {
  const normalized = query.trim().replace(/^@/, "").toLocaleLowerCase("vi-VN");
  const localMatches = [...friends, ...requests].filter((friend) =>
    `${friend.displayName} ${friend.username}`.toLocaleLowerCase("vi-VN").includes(normalized),
  );
  const localIds = new Set(localMatches.map((friend) => friend.id));
  return [...localMatches, ...results.filter((friend) => !localIds.has(friend.id))];
}

function normalizeChatName(value: string): string {
  return value.toLocaleLowerCase("vi-VN").normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d");
}

export type ChatListFilter = "all" | "unread" | "groups";

export function selectChatListConversations(args: {
  visibleConversations: readonly Conversation[];
  searchActive: boolean;
  searchItems: readonly Conversation[];
  searchQuery: string;
  filter: ChatListFilter;
  revokedIds: ReadonlySet<number>;
  contactMetadata: ContactMetadataByUserId;
}): Conversation[] {
  const { visibleConversations, searchActive, searchItems, searchQuery, filter, revokedIds, contactMetadata } = args;
  if (searchActive) {
    const keyword = normalizeChatName(searchQuery.trim());
    return withContactNicknames(
      searchItems.filter((conversation) => !revokedIds.has(conversation.id)),
      contactMetadata,
    ).filter((conversation) => normalizeChatName(conversation.name).includes(keyword));
  }
  return visibleConversations.filter((conversation) => {
    if (filter === "unread" && conversation.unreadCount <= 0) return false;
    if (filter === "groups" && conversation.type !== "group") return false;
    return true;
  });
}

export function sortChatListConversations(conversations: readonly Conversation[]): Conversation[] {
  return [...conversations].sort((a, b) =>
    Number(Boolean(b.pinnedAt)) - Number(Boolean(a.pinnedAt)) ||
    (b.pinnedAt || "").localeCompare(a.pinnedAt || "") ||
    (b.lastMessageAt || b.createdAt).localeCompare(a.lastMessageAt || a.createdAt),
  );
}
