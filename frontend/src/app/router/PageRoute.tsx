import { useOutletContext } from "react-router-dom";
import AppPageErrorBoundary from "../layouts/AppPageErrorBoundary";
import type { RoutePageKey, AppPageContext } from "./routePageContext";

/**
 * Route-owned page surface. Keep the existing DOM and CSS class contracts:
 * global layout owns the header/sidebar, while this outlet owns the frame.
 */
export default function PageRoute({ page }: { page: RoutePageKey }) {
  const context = useOutletContext<AppPageContext>();
  const { beforeFeed, afterFeed, frameClassName } = context;
  // Preserve each page's original shared-dialog order without mounting inactive pages.
  let pageContent = context[page];
  if (page === "chat") pageContent = <>{context.chat}{beforeFeed}{afterFeed}</>;
  else if (page === "feed") pageContent = <>{beforeFeed}{context.feed}{afterFeed}</>;
  else if (page === "profile") pageContent = <>{beforeFeed}{afterFeed}{context.profile}</>;
  return (
    <section className={`phone-frame modern-frame ${frameClassName}`.trim()} data-route-page={page}>
      <AppPageErrorBoundary>{pageContent}</AppPageErrorBoundary>
    </section>
  );
}