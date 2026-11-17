import type { Tab } from "../../shared/types/navigation";

export const TAB_PATH: Record<Tab, string> = {
  chat: "/chat",
  contacts: "/contacts",
  discover: "/discover",
  market: "/marketplace",
  feed: "/feed",
  profile: "/profile",
  notifications: "/notifications",
};

export const ROUTE = {
  calls: "/calls",
  settings: "/settings",
  search: "/search",
} as const;

/** Shareable user profiles; username is encoded as exactly one URL segment. */
export function visitorProfilePath(username: string): string {
  return `/users/${encodeURIComponent(username)}`;
}

export function visitorUsernameFromPath(pathname: string): string | null {
  const match = /^\/users\/([^/]+)\/?$/.exec(pathname);
  if (!match) return null;
  try {
    const username = decodeURIComponent(match[1]);
    return username.trim() === username && username.length > 0 &&
      username.length <= 254 && !/[\\/\u0000-\u001f]/.test(username) ? username : null;
  } catch {
    return null;
  }
}

export { feedPostIdFromPath, feedPostPath } from "../../shared/utils/feedPostPath";

/** Stable shareable chat detail route; only positive safe integer IDs are valid. */
export function chatConversationPath(id: number): string {
  return `${TAB_PATH.chat}/${id}`;
}

export function chatConversationIdFromPath(pathname: string): number | null {
  const match = /^\/chat\/([1-9]\d*)\/?$/.exec(pathname);
  if (!match) return null;
  const id = Number(match[1]);
  return Number.isSafeInteger(id) ? id : null;
}

/** Choose a useful parent destination for unsupported deep links. */
export function fallbackPathForRoute(pathname: string): string {
  const segment = pathname.split("/")[1];
  switch (segment) {
    case "feed": return TAB_PATH.feed;
    case "profile":
    case "users": return TAB_PATH.profile;
    case "settings": return ROUTE.settings;
    case "calls": return ROUTE.calls;
    case "contacts": return TAB_PATH.contacts;
    case "discover":
    case "search": return TAB_PATH.discover;
    case "marketplace": return TAB_PATH.market;
    case "notifications": return TAB_PATH.notifications;
    default: return TAB_PATH.chat;
  }
}

/** Keep route ownership in app; business state stays with the owning feature. */
export function tabFromPath(pathname: string, legacyTab?: string | null): Tab {
  const segment = pathname.split("/")[1];
  if (segment === "calls") return "chat";
  if (segment === "search") return "discover";
  if (segment === "settings" || segment === "users") return "profile";
  const tab = (Object.keys(TAB_PATH) as Tab[]).find(
    (key) => TAB_PATH[key].slice(1) === segment,
  );
  if (tab) return tab;
  if (pathname === "/" && legacyTab && Object.hasOwn(TAB_PATH, legacyTab)) {
    return legacyTab as Tab;
  }
  return "chat";
}
