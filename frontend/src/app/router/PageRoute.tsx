import type { ReactNode } from "react";
import { useOutletContext } from "react-router-dom";
import AppPageErrorBoundary from "../layouts/AppPageErrorBoundary";

/** Data supplied by the persistent authenticated shell to route pages. */
export type RoutePageKey = "contacts" | "search" | "discover" | "market" | "notifications" | "profile" | "feed" | "chat";

export type AppPageContext = {
  beforeFeed: ReactNode;
  afterFeed: ReactNode;
  frameClassName: string;
} & Record<RoutePageKey, ReactNode>;

/**
 * Route-owned page surface. Keep the existing DOM and CSS class contracts:
 * global layout owns the header/sidebar, while this outlet owns the frame.
 */
export default function PageRoute({ page }: { page: RoutePageKey }) {
  const context = useOutletContext<AppPageContext>();
  const { beforeFeed, frameClassName } = context;
  // Shared dialogs remain in their original DOM order as feature-owned pages
  // are progressively routed. No new CSS or mounting boundary is introduced.
  const pageContent = page === "chat"
    ? <>{context.chat}{beforeFeed}{context.afterFeed}</>
    : page === "feed"
      ? <>{beforeFeed}{context.feed}{context.afterFeed}</>
      : page === "profile"
        ? <>{beforeFeed}{context.afterFeed}{context.profile}</>
        : context[page];
  return (
    <section className={`phone-frame modern-frame ${frameClassName}`.trim()}>
      <AppPageErrorBoundary>{pageContent}</AppPageErrorBoundary>
    </section>
  );
}