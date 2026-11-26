import { expect, it } from "vitest";
import { parseFriendMutationResult } from "./friendMutationResult";

const accepted = {
  id: 8, username: "alice", displayName: "Alice", online: false,
  updatedAt: "2026-11-26T00:00:00Z", status: "accepted" as const,
};

it("accepts the actual relationship fields and preserves the server record", () => {
  expect(parseFriendMutationResult(accepted, 8)).toEqual(accepted);
  expect(parseFriendMutationResult({ ...accepted, status: "pending", direction: "incoming" }, 8)?.direction).toBe("incoming");
});

it("does not insert a different user or malformed server payload into the friend list", () => {
  for (const payload of [
    null, [], { error: "conflict" }, { ...accepted, id: 9 },
    { ...accepted, id: "8" }, { ...accepted, status: "unknown" },
    { ...accepted, displayName: null }, { ...accepted, username: "" },
    { ...accepted, online: "false" }, { ...accepted, updatedAt: null },
    { ...accepted, direction: "up" },
  ]) {
    expect(parseFriendMutationResult(payload, 8)).toBeNull();
  }
});
