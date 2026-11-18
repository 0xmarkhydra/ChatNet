import { describe, expect, it } from "vitest";
import type { Conversation } from "../../features/chat/types";
import type { FriendConnection } from "../../features/contacts/types";
import {
  mergeContactSearchResults,
  selectChatListConversations,
  sortChatListConversations,
  withContactNicknames,
} from "./appListSelectors";

function conversation(id: number, changes: Partial<Conversation> = {}): Conversation {
  return {
    id, name: "Hội thoại " + id, type: "direct", otherUserId: id,
    memberCount: 2, unreadCount: 0, lastMessage: "",
    online: false, createdAt: "2026-10-01T00:00:00Z", ...changes,
  };
}

function friend(id: number, name: string): FriendConnection {
  return {
    id, displayName: name, username: "user" + id, online: false,
    status: "accepted", updatedAt: "2026-10-01",
  };
}

describe("AppShell pure list selectors", () => {
  it("applies only direct-chat nicknames without mutating conversations", () => {
    const original = conversation(1, { name: "Alice" });
    const group = conversation(2, { name: "Team", type: "group" });
    const conversations = Object.freeze([original, group]);
    const result = withContactNicknames(conversations, {
      1: { nickname: "Đồng nghiệp" },
      2: { nickname: "Should not override group" },
    });
    expect(result.map((x) => x.name)).toEqual(["Đồng nghiệp", "Team"]);
    expect(original.name).toBe("Alice");
    expect(result[0]).not.toBe(original);
  });

  it("keeps local friends before remote results and avoids remote duplicates", () => {
    const friends = [friend(1, "Nguyễn An")];
    const requests = [friend(2, "Anh Bình")];
    const remote = [friend(1, "Remote An"), friend(3, "Other")];
    const result = mergeContactSearchResults(" @Nguyễn ", friends, requests, remote);
    expect(result.map((x) => x.id)).toEqual([1, 3]);
    expect(result[0]?.displayName).toBe("Nguyễn An");
    expect(friends[0]?.displayName).toBe("Nguyễn An");
  });

  it("filters unread/groups on the regular rail without removing otherwise visible items", () => {
    const regular = [conversation(1), conversation(2, { unreadCount: 3 }), conversation(3, { type: "group" })];
    const base = {
      visibleConversations: regular, searchActive: false,
      searchItems: [], searchQuery: "", filter: "all" as const,
      revokedIds: new Set<number>(), contactMetadata: {},
    };
    expect(selectChatListConversations({ ...base, filter: "unread" }).map((x) => x.id)).toEqual([2]);
    expect(selectChatListConversations({ ...base, filter: "groups" }).map((x) => x.id)).toEqual([3]);
    expect(selectChatListConversations(base)).toEqual(regular);
  });

  it("normalizes Vietnamese search names, uses contact nicknames, and removes revoked search hits", () => {
    const result = selectChatListConversations({
      visibleConversations: [],
      searchActive: true,
      searchItems: [
        conversation(1, { name: "Lĩnh" }),
        conversation(2, { name: "Linh", otherUserId: 22 }),
        conversation(3, { name: "Linh" }),
        conversation(4, { name: "Đức" }),
      ],
      searchQuery: "linh",
      filter: "unread",
      revokedIds: new Set([3]),
      contactMetadata: { 22: { nickname: "Lĩnh Trần" } },
    });
    expect(result.map((x) => x.id)).toEqual([1, 2]);
    expect(result[1]?.name).toBe("Lĩnh Trần");
  });

  it("sorts pinned first, then pin time and activity time without mutating the source", () => {
    const source = Object.freeze([
      conversation(1, { lastMessageAt: "2026-10-03" }),
      conversation(2, { pinnedAt: "2026-10-01" }),
      conversation(3, { pinnedAt: "2026-10-05" }),
      conversation(4, { lastMessageAt: "2026-10-02" }),
    ]);
    expect(sortChatListConversations(source).map((x) => x.id)).toEqual([3, 2, 1, 4]);
    expect(source.map((x) => x.id)).toEqual([1, 2, 3, 4]);
  });
});
