import type { Conversation } from "../types";
import { loadVerifiedConversationPage } from "./conversationPages";

const PAGE_SIZE = 100;
const MAX_PAGES = 20;

/**
 * Stream valid group pages in batches, retaining successful pages if a later
 * request fails. A completed scan is the only basis for a successful cache TTL.
 */
export async function scanOlderGroupPages({
  fetchPage,
  isCurrent,
  onBatch,
}: {
  fetchPage: (limit: number, offset: number) => Promise<Response>;
  isCurrent: () => boolean;
  onBatch: (groups: Conversation[]) => void;
}): Promise<boolean> {
  const buffered = new Map<number, Conversation>();
  const flush = () => {
    if (!buffered.size || !isCurrent()) return;
    const batch = [...buffered.values()];
    buffered.clear();
    onBatch(batch);
  };

  for (let pageIndex = 0; pageIndex < MAX_PAGES; pageIndex += 1) {
    if (!isCurrent()) return false;
    const page = await loadVerifiedConversationPage(
      () => fetchPage(PAGE_SIZE, pageIndex * PAGE_SIZE),
      isCurrent,
    );
    if (!page) {
      flush();
      return false;
    }

    for (const item of page) {
      if (item.type === "group") buffered.set(item.id, item);
    }
    // First page is visible immediately; remaining pages are batched to avoid
    // a React render for every page of older group history.
    if (pageIndex === 0 || pageIndex % 5 === 4 || page.length < PAGE_SIZE) flush();
    if (page.length < PAGE_SIZE) return isCurrent();
  }

  // The scan limit was reached without seeing the final page. Do not cache
  // this as a complete snapshot, but keep the verified pages already shown.
  flush();
  return false;
}

/** Merge group metadata without duplicates, respecting membership at commit time. */
export function mergeOlderGroups(
  current: readonly Conversation[],
  groups: readonly Conversation[],
  isAllowed: (group: Conversation) => boolean,
): Conversation[] {
  const allowed = groups.filter(item => item.type === "group" && isAllowed(item));
  if (!allowed.length) return [...current];
  const fresh = new Map(allowed.map(item => [item.id, item]));
  const existingIds = new Set(current.map(item => item.id));
  return [
    ...current.map(item => fresh.get(item.id) ?? item),
    ...allowed.filter(item => !existingIds.has(item.id)),
  ];
}
