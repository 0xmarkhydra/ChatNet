import type { ReactNode, RefObject } from "react";

type HeaderSearchProps = {
  anchorRef: RefObject<HTMLDivElement | null>;
  children: ReactNode;
};

/** Shared search placement; screens own the input state, handlers and results. */
export default function HeaderSearch({ anchorRef, children }: HeaderSearchProps) {
  return <div className="appbar-search-anchor" ref={anchorRef}>{children}</div>;
}
