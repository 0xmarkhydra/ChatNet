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
} as const;

/** Keep route ownership in app; business state stays with the owning feature. */
export function tabFromPath(pathname: string, legacyTab?: string | null): Tab {
  const segment = pathname.split("/")[1];
  if (segment === "calls") return "chat";
  if (segment === "settings") return "profile";
  const tab = (Object.keys(TAB_PATH) as Tab[]).find(
    (key) => TAB_PATH[key].slice(1) === segment,
  );
  if (tab) return tab;
  if (pathname === "/" && legacyTab && legacyTab in TAB_PATH) {
    return legacyTab as Tab;
  }
  return "chat";
}
