import { useEffect, useRef, useState } from "react";
import { useAuthFlow } from "../../features/auth/hooks/useAuthFlow";
import {
  clearPersistedSession,
  createSessionClient,
  loadSession,
  persistSession,
  type Session,
} from "../../features/auth/lib/session";
import { clearChatPersistence } from "../../features/chat/lib/chatPersistence";
import { clearChatOutbox } from "../../features/chat/lib/chatOutbox";
import { desktopBridge, isDesktopBuild } from "../../platform/desktop";
import { API } from "../../shared/lib/config";
import { SessionResponseCache } from "../../shared/lib/sessionCache";
import { useLatest } from "../../shared/hooks/useLatest";
import type { ToastKind } from "../../shared/utils/toast";

/** Owns session persistence, expiration and account-scoped cache cleanup. */
export function useAppSession(initialSession?: Session | null) {
  const [session, setSession] = useState<Session | null>(() =>
    isDesktopBuild ? (initialSession ?? null) : loadSession(),
  );
  const sessionRef = useRef(session);
  const sessionEpoch = useRef(0);
  const responseCache = useRef(new SessionResponseCache());
  const [sessionClient] = useState(() =>
    createSessionClient(
      API,
      {
        get: () => sessionRef.current,
        save: saveSession,
        expire: () => endSession(false),
      },
      isDesktopBuild ? desktopBridge().auth : undefined,
    ),
  );

  function saveSession(next: Session) {
    if (isDesktopBuild) {
      if (next.refreshToken !== undefined)
        throw new Error("Desktop credential boundary violation");
      clearPersistedSession();
    } else {
      persistSession(next);
    }
    sessionEpoch.current += 1;
    sessionRef.current = next;
    setSession(next);
  }

  const auth = useAuthFlow(saveSession);

  function endSession(
    revoke = true,
    clearStorage = true,
    notify?: (message: string, kind?: ToastKind) => void,
  ) {
    responseCache.current.clear();
    const current = sessionRef.current;
    const logoutEpoch = ++sessionEpoch.current;
    const notifyIfCurrent = (message: string, kind: ToastKind) => {
      if (sessionEpoch.current === logoutEpoch) notify?.(message, kind);
    };
    if (isDesktopBuild) {
      void desktopBridge()
        .auth.logout({ sessionId: current?.sessionId ?? null, revoke })
        .then((result) => {
          if (!result.revoked)
            notifyIfCurrent(
              "Đã đăng xuất trên máy này. Chưa thu hồi được phiên trên server.",
              "warning",
            );
        })
        .catch(() =>
          notifyIfCurrent(
            "Không xóa hoặc thu hồi được phiên an toàn. Hãy thu hồi thiết bị này từ một phiên khác.",
            "error",
          ),
        );
    } else if (revoke && current?.refreshToken) {
      void fetch(`${API}/api/auth/logout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: current.refreshToken }),
        keepalive: true,
      })
        .then((response) => {
          if (!response.ok) throw new Error("revocation failed");
        })
        .catch(() =>
          notifyIfCurrent(
            "Đã đăng xuất trên máy này. Không kết nối được server để thu hồi phiên.",
            "warning",
          ),
        );
    }
    if (current?.user.id) {
      clearChatPersistence(current.user.id);
      clearChatOutbox(current.user.id);
    }
    if (clearStorage) clearPersistedSession();
    sessionRef.current = null;
    auth.resetRegistration();
    auth.setAuthMode("login");
    setSession(null);
  }

  const endSessionRef = useLatest(endSession);

  // Async logout callbacks must not report to an app shell that has unmounted.
  useEffect(() => () => { sessionEpoch.current += 1; }, []);

  useEffect(() => {
    if (isDesktopBuild) {
      return desktopBridge().auth.onExpired((sessionId) => {
        if (sessionRef.current?.sessionId === sessionId) endSessionRef.current(false);
      });
    }
    const sync = (event: StorageEvent) => {
      if (event.key !== "chatnet-session" && event.key !== null) return;
      const previous = sessionRef.current;
      const stored = loadSession();
      const next = stored && previous?.sessionId === stored.sessionId && previous.user.id === stored.user.id
        ? { ...stored, refreshToken: previous.refreshToken }
        : stored;
      // A session identifier alone is not an account boundary: storage can
      // change to a different user while retaining the same session ID.
      if (previous?.sessionId !== next?.sessionId || previous?.user.id !== next?.user.id)
        endSessionRef.current(false, false);
      sessionEpoch.current += 1;
      sessionRef.current = next;
      setSession(next);
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, [endSessionRef]);

  return { session, sessionRef, responseCache, sessionClient, auth, saveSession, endSession };
}
