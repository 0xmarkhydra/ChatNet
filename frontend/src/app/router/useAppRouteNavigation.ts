import { useCallback, type Dispatch, type SetStateAction } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import type { Tab } from "../../shared/types/navigation";
import { ROUTE, TAB_PATH, tabFromPath, visitorProfilePath, visitorUsernameFromPath } from "./routes";

type ContactsScreen = "overview" | "directory" | "invitations";

const CONTACTS_SCREEN_PATH: Record<ContactsScreen, string> = {
  overview: "/contacts/overview",
  directory: TAB_PATH.contacts,
  invitations: "/contacts/requests",
};

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
    location.pathname === CONTACTS_SCREEN_PATH.invitations ? "invitations"
      : location.pathname === CONTACTS_SCREEN_PATH.overview ? "overview" : "directory";
  const setContactsScreen: Dispatch<SetStateAction<ContactsScreen>> = useCallback((next) => {
    const screen = typeof next === "function" ? next(contactsScreen) : next;
    const path = CONTACTS_SCREEN_PATH[screen];
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
  const openVisitorProfile = useCallback((username: string, returnTo?: string) => {
    const path = visitorProfilePath(username);
    if (location.pathname === path) return;
    navigate(path, {
      state: { visitorReturnTo: visitorReturnPath(returnTo ?? (location.pathname + location.search + location.hash)) },
    });
  }, [location.pathname, location.search, location.hash, navigate]);
  const closeVisitor = useCallback(() => {
    navigate(visitorReturnPath(location.state?.visitorReturnTo), { replace: true });
  }, [location.state, navigate]);

  return {
    tab, setTab, contactsScreen, setContactsScreen,
    desktopProfileSettings, setDesktopProfileSettings,
    visitorUsername, openVisitorProfile, closeVisitor,
  };
}
