import { useCallback, type Dispatch, type SetStateAction } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import type { Tab } from "../../shared/types/navigation";
import { ROUTE, TAB_PATH, tabFromPath, visitorUsernameFromPath } from "./routes";

type ContactsScreen = "directory" | "invitations";

/** Resolve return locations without leaving the app or accepting malformed paths. */
export function visitorReturnPath(value: unknown): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")
    || /[\\\u0000-\u001f\u007f]/.test(value)) return TAB_PATH.profile;
  return value;
}

/** URL-owned navigation state; business and session state remain in the app shell. */
export function useAppRouteNavigation() {
  const location = useLocation();
  const navigate = useNavigate();
  const tab = tabFromPath(location.pathname, new URLSearchParams(location.search).get("tab"));
  const setTab: Dispatch<SetStateAction<Tab>> = useCallback((next) => {
    const nextTab = typeof next === "function" ? next(tab) : next;
    if (TAB_PATH[nextTab] !== location.pathname) navigate(TAB_PATH[nextTab]);
  }, [tab, location.pathname, navigate]);

  const contactsScreen: ContactsScreen =
    location.pathname === "/contacts/requests" ? "invitations" : "directory";
  const setContactsScreen: Dispatch<SetStateAction<ContactsScreen>> = useCallback((next) => {
    const screen = typeof next === "function" ? next(contactsScreen) : next;
    // The Calls workspace embeds the directory and must remain mounted.
    if ((location.pathname === ROUTE.calls || location.pathname.startsWith(`${ROUTE.calls}/`))
      && screen === "directory") return;
    const path = screen === "invitations" ? "/contacts/requests" : TAB_PATH.contacts;
    if (location.pathname !== path) navigate(path);
  }, [contactsScreen, location.pathname, navigate]);

  const desktopProfileSettings = location.pathname === ROUTE.settings
    || location.pathname.startsWith(`${ROUTE.settings}/`);
  const setDesktopProfileSettings: Dispatch<SetStateAction<boolean>> = useCallback((next) => {
    const open = typeof next === "function" ? next(desktopProfileSettings) : next;
    if (open && !desktopProfileSettings) navigate(ROUTE.settings);
    if (!open && desktopProfileSettings) navigate(TAB_PATH.profile);
  }, [desktopProfileSettings, navigate]);

  const visitorUsername = visitorUsernameFromPath(location.pathname);
  const closeVisitor = useCallback(() => {
    navigate(visitorReturnPath(location.state?.visitorReturnTo), { replace: true });
  }, [location.state, navigate]);

  return {
    tab, setTab, contactsScreen, setContactsScreen,
    desktopProfileSettings, setDesktopProfileSettings, visitorUsername, closeVisitor,
  };
}
