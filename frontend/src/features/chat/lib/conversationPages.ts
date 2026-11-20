import type { Conversation } from "../types";

/**
 * Conversation listing pages are only usable if they belong to the current
 * session/request and contain valid conversation IDs. Never advance the
 * pagination cursor on malformed or stale responses.
 */
export async function loadVerifiedConversationPage(
  fetchPage: () => Promise<Response>,
  isCurrent: () => boolean,
): Promise<Conversation[] | null> {
  try {
    if (!isCurrent()) return null;
    const response = await fetchPage();
    if (!isCurrent() || !response.ok) return null;
    const raw: unknown = await response.json();
    if (!isCurrent() || !isValidConversationPage(raw)) return null;
    return raw;
  } catch {
    return null;
  }
}

export function isValidConversationPage(data: unknown): data is Conversation[] {
  if (!Array.isArray(data)) return false;
  const ids = new Set<number>();
  for (const candidate of data) {
    if (typeof candidate !== "object" || candidate === null || !("id" in candidate)) return false;
    const id = candidate.id;
    if (typeof id !== "number" || !Number.isSafeInteger(id) || id <= 0 || ids.has(id)) return false;
    ids.add(id);
  }
  return true;
}

/** The loading-more cursor follows the server page size, not the filtered list size. */
export function appendConversationPage(
  current: readonly Conversation[],
  page: readonly Conversation[],
  isAllowed: (conversation: Conversation) => boolean,
): Conversation[] {
  const ids = new Set(current.map(item => item.id));
  const additions = page.filter(item => {
    if (ids.has(item.id) || !isAllowed(item)) return false;
    ids.add(item.id);
    return true;
  });
  return additions.length ? [...current, ...additions] : [...current];
}
