/** The same permalink is used by the router and by links shared outside the app. */
export type FeedPostLinkParams = {
  ref?: 'share';
  source?: 'chat';
};

export function feedPostPath(id: number, params?: FeedPostLinkParams): string {
  const path = `/feed/posts/${id}`;
  const query = new URLSearchParams();
  if (params?.ref === 'share') query.set('ref', 'share');
  if (params?.source === 'chat') query.set('source', 'chat');
  const search = query.toString();
  return search ? `${path}?${search}` : path;
}

export function feedPostIdFromPath(pathname: string): number | null {
  const match = /^\/feed\/posts\/([1-9]\d*)\/?$/.exec(pathname);
  return match ? parsePostId(match[1]) : null;
}

/** Only links to this deployment or the public ChatNet web app can point to a local post. */
export function feedPostIdFromUrl(url: URL, currentOrigin: string): number | null {
  if (url.username || url.password ||
      (url.origin !== currentOrigin && url.origin !== "https://chat.codelocal.cloud")) return null;
  const canonicalId = feedPostIdFromPath(url.pathname);
  if (canonicalId !== null) return canonicalId;
  if (/^\/feed\/?$/.test(url.pathname) ||
      (url.pathname === "/" && url.searchParams.get("tab") === "feed")) {
    return parsePostId(url.searchParams.get("post"));
  }
  return null;
}

function parsePostId(value: string | null): number | null {
  if (!value || !/^[1-9]\d*$/.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) ? id : null;
}
