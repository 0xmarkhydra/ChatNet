/**
 * An incomplete or malformed membership listing must NEVER be interpreted as
 * permission revocation. Return null unless all pages are verified.
 */
export async function loadVerifiedMembershipSnapshot(
  fetchPage: (after: number) => Promise<Response>,
  isCurrent: () => boolean,
): Promise<Set<number> | null> {
  const authorized = new Set<number>();
  let after = 0;
  try {
    for (let page = 0; page < 200; page += 1) {
      if (!isCurrent()) return null;
      const response = await fetchPage(after);
      if (!isCurrent() || !response.ok) return null;
      const raw: unknown = await response.json();
      if (!isCurrent() || !isMembershipPage(raw, after)) return null;

      for (const id of raw.ids) authorized.add(id);
      if (raw.nextAfter === null) return authorized;
      after = raw.nextAfter;
    }
  } catch {
    // Network, JSON, or interrupted pages are not evidence of revoked access.
  }
  return null;
}

type MembershipPage = { ids: number[]; nextAfter: number | null };

function isMembershipPage(data: unknown, after: number): data is MembershipPage {
  if (typeof data !== "object" || data === null || !("ids" in data) || !("nextAfter" in data)) return false;
  const { ids, nextAfter } = data;
  if (!Array.isArray(ids) || ids.length > 500) return false;
  let previous = after;
  for (const id of ids) {
    if (typeof id !== "number" || !Number.isSafeInteger(id) || id <= previous) return false;
    previous = id;
  }
  return nextAfter === null ||
    (typeof nextAfter === "number" && Number.isSafeInteger(nextAfter) &&
      ids.length > 0 && nextAfter === previous);
}
