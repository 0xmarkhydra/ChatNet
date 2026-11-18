import { useOutletContext } from "react-router-dom";
import AppPageErrorBoundary from "../layouts/AppPageErrorBoundary";
import type { RoutePageKey, AppPageContext } from "./routePageContext";

/**
 * Route-owned page surface. Keep the existing DOM and CSS class contracts:
 * global layout owns the header/sidebar, while this outlet owns the frame.
 */
export default function PageRoute({ page }: { page?: RoutePageKey }) {
  const context = useOutletContext<AppPageContext>();
  const { content, frameClassName } = context;
  const pageContent = page ? context[page] : content;
  return (
    <section className={`phone-frame modern-frame ${frameClassName}`.trim()}>
      <AppPageErrorBoundary>{pageContent}</AppPageErrorBoundary>
    </section>
  );
}