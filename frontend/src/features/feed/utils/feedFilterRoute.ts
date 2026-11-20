export type FeedFilter = "all" | "following" | "latest" | "saved";

const validFilters: ReadonlySet<string> = new Set(["all", "following", "latest", "saved"]);

/** Unknown or absent values safely fall back to the default Feed. */
export function feedFilterFromSearch(search: string): FeedFilter {
  const candidate = new URLSearchParams(search).get("feed");
  return candidate && validFilters.has(candidate) ? candidate as FeedFilter : "all";
}

/** Preserve unrelated query parameters such as a deep-linked post ID. */
export function feedFilterSearch(search: string, filter: FeedFilter): string {
  const params = new URLSearchParams(search);
  params.set("feed", filter);
  return `?${params.toString()}`;
}
