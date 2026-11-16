import { useEffect } from "react";

const APP_TITLE = "SocCO – Understand. Connect. Together.";

/** Own the app window title while the authenticated shell is mounted. */
export function useUnreadDocumentTitle(unreadCount: number | null) {
  useEffect(() => {
    document.title = unreadCount !== null && unreadCount > 0
      ? `(${Math.min(99, unreadCount)}${unreadCount > 99 ? "+" : ""}) ${APP_TITLE}`
      : APP_TITLE;
    return () => { document.title = APP_TITLE; };
  }, [unreadCount]);
}
