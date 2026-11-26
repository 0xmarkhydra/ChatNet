import type { FriendConnection } from "../types";

/** A mutation response is untrusted until the relationship fields are validated. */
export function parseFriendMutationResult(value: unknown, expectedUserId: number): FriendConnection | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const item = value as Record<string, unknown>;
  if (item.id !== expectedUserId || !Number.isSafeInteger(item.id) ||
      (item.status !== "accepted" && item.status !== "pending") ||
      typeof item.username !== "string" || !item.username.trim() ||
      typeof item.displayName !== "string" ||
      typeof item.online !== "boolean" ||
      typeof item.updatedAt !== "string") return null;
  if (item.direction !== undefined && item.direction !== "incoming" && item.direction !== "outgoing") return null;
  return item as FriendConnection;
}
