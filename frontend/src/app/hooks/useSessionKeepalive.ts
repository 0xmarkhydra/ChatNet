import { useEffect, type RefObject } from "react";
import type { Session } from "../../features/auth/lib/session";
import { isDesktopBuild } from "../../platform/desktop";

type SessionKeepaliveClient = {
  refresh: () => Promise<Session | null>;
  check: () => Promise<boolean>;
};

/** Refresh only the active session; ignore late results from a previous session. */
export function useSessionKeepalive(
  sessionId: string | null,
  sessionRef: RefObject<Session | null>,
  sessionClient: SessionKeepaliveClient,
  setStatus: (status: string) => void,
) {
  useEffect(() => {
    if (!sessionId) return;

    let active = true;
    let refreshing = false;
    const refresh = () => {
      if (!active || refreshing || sessionRef.current?.sessionId !== sessionId) return;
      if (!isDesktopBuild && document.visibilityState === "hidden") return;
      refreshing = true;
      void sessionClient.refresh()
        .then((current) => {
          if (active && sessionRef.current?.sessionId === sessionId && isDesktopBuild && current)
            return sessionClient.check();
        })
        .catch(() => {
          if (active && sessionRef.current?.sessionId === sessionId)
            setStatus("Đang kết nối lại...");
        })
        .finally(() => { refreshing = false; });
    };

    refresh();
    const timer = window.setInterval(refresh, 60_000);
    window.addEventListener("focus", refresh);
    window.addEventListener("online", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("online", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [sessionId, sessionRef, sessionClient, setStatus]);
}
