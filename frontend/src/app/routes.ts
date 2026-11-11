import type { Tab } from "./types";

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
  invitations: "/contacts/invitations",
} as const;

const EXTRA_SEGMENT_TAB: Record<string, Tab> = { calls: "chat", settings: "profile" };

export function tabFromPath(pathname: string): Tab | null {
  const segment = pathname.split("/")[1];
  const match = (Object.keys(TAB_PATH) as Tab[]).find((tab) => TAB_PATH[tab] === "/" + segment);
  return match ?? EXTRA_SEGMENT_TAB[segment] ?? null;
}
