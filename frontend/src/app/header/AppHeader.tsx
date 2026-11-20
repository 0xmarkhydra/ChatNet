import type { ReactNode } from "react";

type AppHeaderProps = {
  className: string;
  start: ReactNode;
  center?: ReactNode;
  end: ReactNode;
};

/** One shared three-zone shell; page-specific title, search/filter, and actions are supplied by the caller. */
export default function AppHeader({ className, start, center, end }: AppHeaderProps) {
  return (
    <header className={className} aria-label="Thanh công cụ chính">
      <div className="appbar-start">{start}</div>
      <div className="appbar-brand" aria-label="SocCO">
        <img src="/soco-mark.svg" width="32" height="32" alt="" />
        <strong>SocCO</strong>
      </div>
      <div className="appbar-center">{center}</div>
      <div className="appbar-end">{end}</div>
    </header>
  );
}

/** Page-specific actions followed by the persistent signed-in account control. */
export function AppHeaderActions({ children, account }: { children: ReactNode; account: ReactNode }) {
  return <div className="appbar-actions">{children}{account}</div>;
}
