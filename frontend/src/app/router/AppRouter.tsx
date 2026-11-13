import { BrowserRouter, HashRouter } from "react-router-dom";
import type { ReactNode } from "react";
import { isDesktopBuild } from "../../platform/desktop";

/** The desktop app:// scheme cannot resolve deep paths through an SPA fallback. */
export default function AppRouter({ children }: { children: ReactNode }) {
  const Router = isDesktopBuild ? HashRouter : BrowserRouter;
  return <Router>{children}</Router>;
}
