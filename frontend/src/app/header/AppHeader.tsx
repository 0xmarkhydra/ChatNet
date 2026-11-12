import type { ReactNode } from "react";

type AppHeaderProps = { className: string; children: ReactNode };

/** One shared semantic header shell for all application sections. */
export default function AppHeader({ className, children }: AppHeaderProps) {
  return <header className={className}>{children}</header>;
}

/** Page-specific actions followed by the persistent signed-in account control. */
export function AppHeaderActions({ children, account }: { children: ReactNode; account: ReactNode }) {
  return <div className="appbar-actions">{children}{account}</div>;
}
