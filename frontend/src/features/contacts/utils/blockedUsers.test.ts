import { expect, it } from "vitest";
import { parseBlockedUsers } from "./blockedUsers";

it("preserves valid blocked contacts and their display names", () => {
  expect(parseBlockedUsers([
    { id: 1, username: "alice", displayName: "Alice" },
    { id: 2, username: "bob", displayName: "B" },
  ])).toEqual([
    { id: 1, username: "alice", displayName: "Alice" },
    { id: 2, username: "bob", displayName: "B" },
  ]);
});

it("filters duplicate, invalid and missing contact records", () => {
  expect(parseBlockedUsers([
    null, { id: 1, username: "alice", displayName: "A" },
    { id: 1, username: "duplicate", displayName: "Duplicate" },
    { id: 0, username: "invalid", displayName: "Zero" },
    { id: 2, username: "   ", displayName: "Empty" },
    { id: 3, username: "charlie", displayName: null },
    { id: "4", username: "string-id", displayName: "Bad" },
  ])).toEqual([{ id: 1, username: "alice", displayName: "A" }]);
});

it("rejects non-list responses without pretending the block list is empty", () => {
  expect(parseBlockedUsers({ users: [] })).toBeNull();
  expect(parseBlockedUsers(null)).toBeNull();
  expect(parseBlockedUsers([])).toEqual([]);
});
