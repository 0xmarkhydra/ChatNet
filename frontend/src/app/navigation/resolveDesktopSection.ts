import { ROUTE } from "../router/routes";

export type DesktopSection = "groups" | "calls" | null;

/** URL navigation takes precedence over temporary desktop panel state. */
export function resolveDesktopSection(pathname: string, state: DesktopSection): DesktopSection {
  if (pathname === ROUTE.calls || pathname.startsWith(`${ROUTE.calls}/`)) return "calls";
  return state === "calls" ? null : state;
}
