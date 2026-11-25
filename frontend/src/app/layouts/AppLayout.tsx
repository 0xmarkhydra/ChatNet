import type { ReactNode } from "react";
import { Outlet } from "react-router-dom";
import type { AppPageContext } from "../router/routePageContext";
import { useMobileScrollChrome } from "./useMobileScrollChrome";

type AppLayoutProps = {
  className: string;
  activeTab?: string;
  sidebar: ReactNode;
  overlays?: ReactNode;
  header: ReactNode;
  /** Search stays visible on phones independently of the collapsing header. */
  mobileSearch?: ReactNode;
  beforePage?: ReactNode;
  outletContext: AppPageContext;
  children?: ReactNode;
};

/** Shared shell: persistent sidebar, independently collapsing chrome, and route content. */
export default function AppLayout({ className, activeTab, sidebar, overlays, header, mobileSearch, beforePage, outletContext, children }: AppLayoutProps) {
  const shellRef = useMobileScrollChrome(activeTab);
  return (
    <main className={className} ref={shellRef}>
      {sidebar}
      {overlays}
      {header}
      {mobileSearch && <div className="mobile-search-dock">{mobileSearch}</div>}
      {beforePage}
      <Outlet context={outletContext} />
      {children}
    </main>
  );
}
