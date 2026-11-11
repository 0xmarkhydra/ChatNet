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

export function tabFromPath(pathname: string): Tab | null {
  const segment = pathname.split("/")[1];
  const match = (Object.keys(TAB_PATH) as Tab[]).find((tab) => TAB_PATH[tab] === "/" + segment);
  return match ?? null;
}
