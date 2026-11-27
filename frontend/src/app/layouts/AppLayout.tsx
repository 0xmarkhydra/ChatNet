import type { ReactNode } from "react";
import { Outlet, useMatch } from "react-router-dom";
import { TAB_PATH } from "../router/routes";
import type { AppPageContext } from "../router/routePageContext";
import { useMobileScrollChrome } from "./useMobileScrollChrome";

type AppLayoutProps = {
  className: string;
  activeTab?: string;
  sidebar: ReactNode;
  overlays?: ReactNode;
  header: ReactNode;
  beforePage?: ReactNode;
  outletContext: AppPageContext;
  children?: ReactNode;
};

/** Shared shell: persistent sidebar, stable mobile chrome, and route content. */
export default function AppLayout({ className, activeTab, sidebar, overlays, header, beforePage, outletContext, children }: AppLayoutProps) {
  const ownProfileRoute = useMatch(TAB_PATH.profile);
  const visitorProfileRoute = useMatch("/users/:username");
  const shellRef = useMobileScrollChrome(activeTab);
  return (
    <main className={className} ref={shellRef}>
      {sidebar}
      {overlays}
      {!ownProfileRoute && !visitorProfileRoute && header}
      {beforePage}
      <Outlet context={outletContext} />
      {children}
    </main>
  );
}