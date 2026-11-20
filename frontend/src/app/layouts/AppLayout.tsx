import type { ReactNode } from "react";
import { Outlet } from "react-router-dom";
import type { AppPageContext } from "../router/routePageContext";
import { useMobileScrollChrome } from "./useMobileScrollChrome";

type AppLayoutProps = {
  className: string;
  sidebar: ReactNode;
  overlays?: ReactNode;
  header: ReactNode;
  beforePage?: ReactNode;
  outletContext: AppPageContext;
  children?: ReactNode;
};

/** Shared shell: persistent header/sidebar, a route Outlet, then global dialogs. */
export default function AppLayout({ className, sidebar, overlays, header, beforePage, outletContext, children }: AppLayoutProps) {
  const shellRef = useMobileScrollChrome();
  return (
    <main className={className} ref={shellRef}>
      {sidebar}
      {overlays}
      {header}
      {beforePage}
      <Outlet context={outletContext} />
      {children}
    </main>
  );
}