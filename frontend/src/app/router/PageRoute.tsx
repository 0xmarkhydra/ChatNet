import type { ReactNode } from "react";
import { useOutletContext } from "react-router-dom";
import AppPageErrorBoundary from "../layouts/AppPageErrorBoundary";

/** Data supplied by the persistent authenticated shell to route pages. */
export type AppPageContext = {
  content: ReactNode;
  frameClassName: string;
};

/**
 * Route-owned page surface. Keep the existing DOM and CSS class contracts:
 * global layout owns the header/sidebar, while this outlet owns the frame.
 */
export default function PageRoute() {
  const { content, frameClassName } = useOutletContext<AppPageContext>();
  return (
    <section className={`phone-frame modern-frame ${frameClassName}`.trim()}>
      <AppPageErrorBoundary>{content}</AppPageErrorBoundary>
    </section>
  );
}
