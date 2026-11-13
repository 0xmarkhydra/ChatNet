import type { ReactNode } from "react";

type AppHeaderProps = {
  className: string;
  title: ReactNode;
  search?: ReactNode;
  children: ReactNode;
};

/** Shared application header structure; each route supplies only its context and actions. */
export default function AppHeader({ className, title, search, children }: AppHeaderProps) {
  return (
    <header className={className} aria-label="Thanh công cụ chính">
      {title}
      <div className="appbar-brand" aria-label="SocCO">
        <img src="/soco-mark.svg" width="32" height="32" alt="" />
        <strong>SocCO</strong>
      </div>
      {search}
      {children}
    </header>
  );
}

/** Page-specific actions followed by the persistent signed-in account control. */
export function AppHeaderActions({ children, account }: { children: ReactNode; account: ReactNode }) {
  return <div className="appbar-actions">{children}{account}</div>;
}
