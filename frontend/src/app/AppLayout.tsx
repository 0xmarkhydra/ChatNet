import type { ReactNode } from "react";

/** Persistent application shell shared by every signed-in section. */
export default function AppLayout({ className, children }: { className: string; children: ReactNode }) {
  return <main className={className}>{children}</main>;
}
