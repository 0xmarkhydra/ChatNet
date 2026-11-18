import type { ReactNode } from "react";

/**
 * React nodes owned by the persistent authenticated shell.
 * Route composition may select a page, but must not own its session/state.
 */
export type RoutePageKey = "contacts" | "search" | "discover" | "market" | "notifications";

export type AppPageContext = {
  content: ReactNode;
  frameClassName: string;
} & Record<RoutePageKey, ReactNode>;
