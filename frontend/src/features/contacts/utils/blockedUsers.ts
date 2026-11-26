export type BlockedUser = { id: number; username: string; displayName: string };

/** The blocked-users endpoint may return malformed records; never pass those to the UI. */
export function parseBlockedUsers(value: unknown): BlockedUser[] | null {
  if (!Array.isArray(value)) return null;
  const seen = new Set<number>();
  const users: BlockedUser[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    if (!Number.isSafeInteger(record.id) || (record.id as number) <= 0 ||
        typeof record.username !== "string" || !record.username.trim() ||
        typeof record.displayName !== "string" || seen.has(record.id as number)) continue;
    seen.add(record.id as number);
    users.push({ id: record.id as number, username: record.username, displayName: record.displayName });
  }
  return users;
}
