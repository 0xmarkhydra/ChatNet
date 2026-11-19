import { describe, expect, it } from "vitest";
import { toCallManagerConversations } from "./AppShellCallManager";

describe("AppShellCallManager conversation adapter", () => {
  it("preserves direct and group names while translating either blocked direction", () => {
    const result = toCallManagerConversations([
      { id: 1, name: "Alice", type: "direct", otherUsername: "alice", blockedByMe: false, blockedByOther: false },
      { id: 2, name: "Group", type: "group", blockedByMe: true },
      { id: 3, name: "Bob", type: "direct", otherUsername: "bob", blockedByOther: true },
    ]);
    expect(result).toEqual([
      { id: 1, name: "Alice", type: "direct", otherUsername: "alice", blocked: false },
      { id: 2, name: "Group", type: "group", otherUsername: undefined, blocked: true },
      { id: 3, name: "Bob", type: "direct", otherUsername: "bob", blocked: true },
    ]);
  });

  it("leaves source conversations immutable and handles empty lists", () => {
    const input = Object.freeze([{ id: 7, name: "Chat", type: "direct" as const, blockedByMe: false }]);
    expect(toCallManagerConversations(input)[0]?.blocked).toBe(false);
    expect(toCallManagerConversations([])).toEqual([]);
    expect(input[0]).not.toHaveProperty("blocked");
  });
});
