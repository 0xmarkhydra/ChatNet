import { expect, it } from "vitest";
import { parseFriendSearchResults } from "./friendSearchResults";

it("retains valid search information while normalizing missing presentation fields", () => {
  expect(parseFriendSearchResults([
    { id: 1, username: "alice", displayName: "Alice", online: true, mutualGroups: 2 },
    { id: 2, username: "bob" },
  ])).toEqual([
    { id: 1, username: "alice", displayName: "Alice", online: true, mutualGroups: 2 },
    { id: 2, username: "bob", displayName: "bob", online: false },
  ]);
});

it("ignores invalid or repeated users rather than forwarding broken records to UI", () => {
  expect(parseFriendSearchResults([
    null, { id: -1, username: "invalid" },
    { id: 3, username: "" },
    { id: 4, username: "chloe", displayName: null, online: "true" },
    { id: 4, username: "duplicate" },
    { id: "7", username: "string-id" },
  ])).toEqual([{ id: 4, username: "chloe", displayName: "chloe", online: false }]);
});

it("distinguishes empty valid results from invalid server payloads", () => {
  expect(parseFriendSearchResults([])).toEqual([]);
  expect(parseFriendSearchResults({ users: [] })).toBeNull();
  expect(parseFriendSearchResults(null)).toBeNull();
});
