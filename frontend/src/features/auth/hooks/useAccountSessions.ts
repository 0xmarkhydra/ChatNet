import { isDesktopBuild, desktopBridge } from "../../../platform/desktop";
import type { ManagedAccountSession } from "../types";
import { API } from "../../../shared/lib/config";
import { type Session } from "../lib/session";
import { useRef, type SetStateAction } from "react";
import { type ToastKind } from "../../../shared/utils/toast";
import type { Dispatch, RefObject } from "react";

export type UseAccountSessionsDeps = {
  logout: (revoke?: boolean, clearStorage?: boolean) => void;
  managedSessions: ManagedAccountSession[];
  sessionRef: RefObject<Session | null>;
  sessionsBusy: boolean;
  setManagedSessions: Dispatch<SetStateAction<ManagedAccountSession[]>>;
  setNotice: (message: string, kind?: ToastKind) => void;
  setSessionsBusy: Dispatch<SetStateAction<boolean>>;
  setSessionsError: Dispatch<SetStateAction<string>>;
  setSessionsOpen: Dispatch<SetStateAction<boolean>>;
};

export function useAccountSessions({
  logout,
  managedSessions,
  sessionRef,
  sessionsBusy,
  setManagedSessions,
  setNotice,
  setSessionsBusy,
  setSessionsError,
  setSessionsOpen,
}: UseAccountSessionsDeps) {
  // The ref closes the gap before React renders the busy state after a click.
  const pendingSession = useRef<string | null>(null);
  async function fetchAccountSessions() {
    const current = sessionRef.current;
    if (!current || (!isDesktopBuild && !current.refreshToken) || sessionsBusy || pendingSession.current === current.sessionId)
      return;
    const identity = current.sessionId;
    pendingSession.current = identity;
    setSessionsBusy(true);
    setSessionsError("");
    try {
      let data: ManagedAccountSession[];
      if (isDesktopBuild) {
        data = await desktopBridge().auth.listSessions(identity);
      } else {
        const response = await fetch(`${API}/api/auth/sessions/list`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
          body: JSON.stringify({ refreshToken: current.refreshToken }),
        });
        if (!response.ok) throw new Error("Không tải được phiên đăng nhập.");
        data = (await response.json()) as ManagedAccountSession[];
      }
      if (sessionRef.current?.sessionId === identity) {
        setManagedSessions(data);
        setSessionsOpen(true);
      }
    } catch {
      if (sessionRef.current?.sessionId === identity) {
        setSessionsError("Không thể tải các thiết bị. Vui lòng thử lại.");
      }
    } finally {
      if (pendingSession.current === identity) pendingSession.current = null;
      if (sessionRef.current?.sessionId === identity) setSessionsBusy(false);
    }
  }
  async function revokeAccountSessions(sessionID?: string) {
    const current = sessionRef.current;
    if (!current || (!isDesktopBuild && !current.refreshToken) || sessionsBusy || pendingSession.current === current.sessionId)
      return;
    const identity = current.sessionId;
    const selected = managedSessions.find((item) => item.id === sessionID);
    if (sessionID && !selected) return;
    const message = sessionID
      ? selected?.current
        ? "Bạn muốn đăng xuất khỏi thiết bị này?"
        : "Bạn muốn thu hồi phiên đăng nhập trên thiết bị đã chọn?"
      : "Bạn muốn đăng xuất tất cả thiết bị khác?";
    if (!window.confirm(message)) return;
    pendingSession.current = identity;
    setSessionsBusy(true);
    setSessionsError("");
    try {
      if (isDesktopBuild) {
        const nativeAuth = desktopBridge().auth;
        const revoked = sessionID
          ? await nativeAuth.revokeSession(identity, sessionID)
          : await nativeAuth.revokeOthers(identity);
        if (!revoked) throw new Error("Không thu hồi được phiên đăng nhập.");
      } else {
        const response = await fetch(
          `${API}/api/auth/sessions/${sessionID ? "revoke" : "revoke-others"}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            cache: "no-store",
            body: JSON.stringify({
              refreshToken: current.refreshToken,
              ...(sessionID ? { sessionId: sessionID } : {}),
            }),
          },
        );
        if (!response.ok)
          throw new Error("Không thu hồi được phiên đăng nhập.");
      }
      if (sessionRef.current?.sessionId !== identity) return;
      if (selected?.current) {
        logout(false);
      } else {
        setManagedSessions((items) =>
          sessionID
            ? items.filter((item) => item.id !== sessionID)
            : items.filter((item) => item.current),
        );
        setNotice("Đã thu hồi phiên đăng nhập được chọn.");
      }
    } catch {
      if (sessionRef.current?.sessionId === identity) {
        setSessionsError("Không thu hồi được phiên. Vui lòng thử lại.");
      }
    } finally {
      if (pendingSession.current === identity) pendingSession.current = null;
      if (sessionRef.current?.sessionId === identity) setSessionsBusy(false);
    }
  }

  return {
    fetchAccountSessions,
    revokeAccountSessions,
  };
}
