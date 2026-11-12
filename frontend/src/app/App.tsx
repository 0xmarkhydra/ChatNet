import { useEffect, useRef, useState } from "react";
import AuthScreen from "../features/auth/components/AuthScreen";
import { useAuthFlow } from "../features/auth/hooks/useAuthFlow";
import { createSessionClient, loadSession, type Session } from "../features/auth/lib/session";
import { clearChatPersistence } from "../features/chat/lib/chatPersistence";
import { clearChatOutbox } from "../features/chat/lib/chatOutbox";
import { SessionResponseCache } from "../shared/lib/sessionCache";
import { API } from "../shared/lib/config";
import { desktopBridge, isDesktopBuild } from "../platform/desktop";
import type { InstallPromptEvent } from "../features/pwa/types";
import type { ToastKind } from "../features/notifications/utils/toast";
import AuthedApp from "./AuthedApp";

/**
 * Authentication shell. It owns the session lifecycle and only mounts the
 * signed-in application while a session exists, so every hook below
 * AuthedApp always sees a non-null session and all signed-in state is
 * discarded when the session ends or the account changes.
 */
export default function App({
  initialSession,
}: {
  initialSession?: Session | null;
}) {
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
  const auth = useAuthFlow((next) => {
    saveSession(next);
  });
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);

  // The browser fires beforeinstallprompt once, usually while the sign-in
  // screen is still showing, so it must be captured outside AuthedApp.
  useEffect(() => {
    const handleBeforeInstall = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    const handleInstalled = () => setInstallPrompt(null);
    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    window.addEventListener("appinstalled", handleInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

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

  useEffect(() => {
    if (isDesktopBuild) {
      return desktopBridge().auth.onExpired((sessionId) => {
        if (sessionRef.current?.sessionId === sessionId) endSession(false);
      });
    }
    const sync = (event: StorageEvent) => {
      if (event.key !== "chatnet-session" && event.key !== null) return;
      const next = loadSession();
      if (sessionRef.current?.sessionId !== next?.sessionId)
        endSession(false, false);
      sessionRef.current = next;
      setSession(next);
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

  if (!session) return <AuthScreen {...auth} />;

  return (
    <AuthedApp
      key={session.sessionId}
      session={session}
      sessionRef={sessionRef}
      responseCache={responseCache}
      sessionClient={sessionClient}
      saveSession={saveSession}
      endSession={endSession}
      installPrompt={installPrompt}
      setInstallPrompt={setInstallPrompt}
    />
  );
}
