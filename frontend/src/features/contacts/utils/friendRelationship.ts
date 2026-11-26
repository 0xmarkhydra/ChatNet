import type { FriendConnection } from "../types";

/** Accepted connections take precedence over stale pending request snapshots. */
export function selectFriendRelationship(
  userId: number,
  friends: ReadonlyArray<Pick<FriendConnection, "id">>,
  requests: ReadonlyArray<Pick<FriendConnection, "id" | "direction">>,
): "accepted" | "incoming" | "outgoing" | "none" {
  if (friends.some((friend) => friend.id === userId)) return "accepted";
  const request = requests.find((friend) => friend.id === userId);
  if (request?.direction === "incoming") return "incoming";
  if (request?.direction === "outgoing") return "outgoing";
  return "none";
}
