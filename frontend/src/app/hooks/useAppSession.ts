import { useEffect, useRef, useState } from "react";
import { useAuthFlow } from "../../features/auth/hooks/useAuthFlow";
import { createSessionClient, loadSession, type Session } from "../../features/auth/lib/session";
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
      localStorage.removeItem("chatnet-session");
    } else {
      localStorage.setItem("chatnet-session", JSON.stringify(next));
    }
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
    if (isDesktopBuild) {
      void desktopBridge()
        .auth.logout({ sessionId: current?.sessionId ?? null, revoke })
        .then((result) => {
          if (!result.revoked)
            notify?.(
              "Đã đăng xuất trên máy này. Chưa thu hồi được phiên trên server.",
              "warning",
            );
        })
        .catch(() =>
          notify?.(
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
          notify?.(
            "Đã đăng xuất trên máy này. Không kết nối được server để thu hồi phiên.",
            "warning",
          ),
        );
    }
    if (current?.user.id) {
      clearChatPersistence(current.user.id);
      clearChatOutbox(current.user.id);
    }
    if (clearStorage) localStorage.removeItem("chatnet-session");
    sessionRef.current = null;
    auth.resetRegistration();
    auth.setAuthMode("login");
    setSession(null);
  }

  const endSessionRef = useLatest(endSession);

  useEffect(() => {
    if (isDesktopBuild) {
      return desktopBridge().auth.onExpired((sessionId) => {
        if (sessionRef.current?.sessionId === sessionId) endSessionRef.current(false);
      });
    }
    const sync = (event: StorageEvent) => {
      if (event.key !== "chatnet-session" && event.key !== null) return;
      const next = loadSession();
      if (sessionRef.current?.sessionId !== next?.sessionId ||
          sessionRef.current?.user.id !== next?.user.id)
        endSessionRef.current(false, false);
      sessionRef.current = next;
      setSession(next);
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, [endSessionRef]);

  return { session, sessionRef, responseCache, sessionClient, auth, saveSession, endSession };
}