import type { FriendSearchResult } from "../types";

/** Accept only user-like entries from an untrusted search/suggestions response. */
export function parseFriendSearchResults(payload: unknown): FriendSearchResult[] | null {
  if (!Array.isArray(payload)) return null;
  const seen = new Set<number>();
  const results: FriendSearchResult[] = [];
  for (const item of payload) {
    if (!item || typeof item !== "object") continue;
    const user = item as Record<string, unknown>;
    if (!Number.isSafeInteger(user.id) || (user.id as number) <= 0 ||
        typeof user.username !== "string" || !user.username.trim() ||
        seen.has(user.id as number)) continue;
    const id = user.id as number;
    seen.add(id);
    results.push({
      ...user,
      id,
      username: user.username,
      displayName: typeof user.displayName === "string" ? user.displayName : user.username,
      online: user.online === true,
    } as FriendSearchResult);
  }
  return results;
}
