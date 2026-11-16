import type { ReactNode } from "react";

type AppLayoutProps = {
  className: string;
  sidebar: ReactNode;
  overlays?: ReactNode;
  header: ReactNode;
  children: ReactNode;
};

/** Persistent shell: sidebar, global overlays, shared header, then page content. */
export default function AppLayout({ className, sidebar, overlays, header, children }: AppLayoutProps) {
  return (
    <main className={className}>
      {sidebar}
      {overlays}
      {header}
      {children}
    </main>
  );
}
