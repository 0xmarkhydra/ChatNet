import type { ReactNode } from "react";

/**
 * React nodes owned by the persistent authenticated shell.
 * Route composition may select a page, but must not own its session/state.
 */
export type RoutePageKey = "contacts" | "search" | "discover" | "market" | "notifications" | "profile" | "feed" | "chat";

export type AppPageContext = {
  /** Shared UI before the Feed content, including cross-page dialogs. */
  beforeFeed: ReactNode;
  /** Shared UI after Feed, kept at the same DOM position as before migration. */
  afterFeed: ReactNode;
  frameClassName: string;
} & Record<RoutePageKey, ReactNode>;