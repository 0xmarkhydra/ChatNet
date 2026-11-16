// @vitest-environment jsdom
import { act, type RefObject } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Session } from "../../features/auth/lib/session";
import { useSessionKeepalive } from "./useSessionKeepalive";

function mountKeepalive(
  sessionId: string,
  sessionRef: RefObject<Session | null>,
  refresh: () => Promise<Session | null>,
  setStatus: (status: string) => void,
) {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const check = vi.fn(async () => true);
  function Probe() {
    useSessionKeepalive(sessionId, sessionRef, { refresh, check }, setStatus);
    return null;
  }
  act(() => root.render(<Probe />));
  return {
    check,
    unmount() {
      act(() => root.unmount());
      container.remove();
    },
  };
}

afterEach(() => vi.unstubAllGlobals());

describe("session keepalive", () => {
  it("does not overlap refresh attempts and ignores late errors after cleanup", async () => {
    let rejectRefresh!: (reason: Error) => void;
    const refresh = vi.fn(() => new Promise<Session | null>((_resolve, reject) => {
      rejectRefresh = reject;
    }));
    const setStatus = vi.fn();
    const sessionRef = { current: { sessionId: "session-a" } } as unknown as RefObject<Session | null>;
    const mounted = mountKeepalive("session-a", sessionRef, refresh, setStatus);
    expect(refresh).toHaveBeenCalledTimes(1);
    act(() => {
      window.dispatchEvent(new Event("focus"));
      window.dispatchEvent(new Event("online"));
    });
    expect(refresh).toHaveBeenCalledTimes(1);
    mounted.unmount();
    await act(async () => {
      rejectRefresh(new Error("late network error"));
      await Promise.resolve();
    });
    expect(setStatus).not.toHaveBeenCalled();
    expect(mounted.check).not.toHaveBeenCalled();
    act(() => window.dispatchEvent(new Event("focus")));
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("ignores a late refresh result after the account changes", async () => {
    let resolveRefresh!: (session: Session | null) => void;
    const refresh = vi.fn(() => new Promise<Session | null>((resolve) => {
      resolveRefresh = resolve;
    }));
    const setStatus = vi.fn();
    const sessionRef = { current: { sessionId: "session-a" } } as unknown as RefObject<Session | null>;
    const mounted = mountKeepalive("session-a", sessionRef, refresh, setStatus);
    sessionRef.current = { sessionId: "session-b" } as Session;
    await act(async () => {
      resolveRefresh({ sessionId: "session-a" } as Session);
      await Promise.resolve();
    });
    expect(mounted.check).not.toHaveBeenCalled();
    act(() => window.dispatchEvent(new Event("online")));
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(setStatus).not.toHaveBeenCalled();
    mounted.unmount();
  });

  it("never refreshes an outdated session", () => {
    const refresh = vi.fn(async () => null);
    const sessionRef = { current: { sessionId: "session-b" } } as unknown as RefObject<Session | null>;
    const mounted = mountKeepalive("session-a", sessionRef, refresh, vi.fn());
    expect(refresh).not.toHaveBeenCalled();
    mounted.unmount();
  });

  it("uses the latest status handler without restarting a pending refresh", async () => {
    let rejectRefresh!: (reason: Error) => void;
    const refresh = vi.fn(() => new Promise<Session | null>((_resolve, reject) => {
      rejectRefresh = reject;
    }));
    const sessionRef = { current: { sessionId: "session-a" } } as unknown as RefObject<Session | null>;
    const firstStatus = vi.fn();
    const latestStatus = vi.fn();
    const client = { refresh, check: vi.fn(async () => true) };
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);

    function Probe({ status }: { status: (message: string) => void }) {
      useSessionKeepalive("session-a", sessionRef, client, status);
      return null;
    }

    try {
      act(() => root.render(<Probe status={firstStatus} />));
      expect(refresh).toHaveBeenCalledTimes(1);
      act(() => root.render(<Probe status={latestStatus} />));
      expect(refresh).toHaveBeenCalledTimes(1);
      await act(async () => {
        rejectRefresh(new Error("connection interrupted"));
        await Promise.resolve();
      });
      expect(firstStatus).not.toHaveBeenCalled();
      expect(latestStatus).toHaveBeenCalledWith("Đang kết nối lại...");
    } finally {
      act(() => root.unmount());
      host.remove();
    }
  });

  it("handles a synchronous refresh failure without throwing from the mount effect", async () => {
    const refresh = vi.fn()
      .mockImplementationOnce(() => { throw new Error("synchronous transport failure"); })
      .mockResolvedValue(null);
    const setStatus = vi.fn();
    const sessionRef = { current: { sessionId: "session-a" } } as unknown as RefObject<Session | null>;
    const mounted = mountKeepalive("session-a", sessionRef, refresh, setStatus);
    try {
      await act(async () => { await Promise.resolve(); });
      expect(setStatus).toHaveBeenCalledWith("Đang kết nối lại...");
      act(() => window.dispatchEvent(new Event("online")));
      expect(refresh).toHaveBeenCalledTimes(2);
    } finally {
      mounted.unmount();
    }
  });

  it("drops a synchronous failure notification when the session switches before rejection settles", async () => {
    const refresh = vi.fn(() => { throw new Error("old session failure"); });
    const setStatus = vi.fn();
    const sessionRef = { current: { sessionId: "session-a" } } as unknown as RefObject<Session | null>;
    const mounted = mountKeepalive("session-a", sessionRef, refresh, setStatus);
    sessionRef.current = { sessionId: "session-b" } as Session;
    try {
      await act(async () => { await Promise.resolve(); });
      expect(setStatus).not.toHaveBeenCalled();
    } finally {
      mounted.unmount();
    }
  });
  it("pauses browser keepalive while offline and retries on reconnect", async () => {
    const oldOnline = Object.getOwnPropertyDescriptor(navigator, "onLine");
    let online = false;
    Object.defineProperty(navigator, "onLine", { configurable: true, get: () => online });
    const sessionRef = { current: { sessionId: "session-a" } } as unknown as RefObject<Session | null>;
    const refresh = vi.fn(async () => null);
    const mounted = mountKeepalive("session-a", sessionRef, refresh, vi.fn());
    try {
      expect(refresh).not.toHaveBeenCalled();
      act(() => window.dispatchEvent(new Event("focus")));
      expect(refresh).not.toHaveBeenCalled();
      online = true;
      act(() => window.dispatchEvent(new Event("online")));
      expect(refresh).toHaveBeenCalledTimes(1);
      await act(async () => { await Promise.resolve(); });
    } finally {
      mounted.unmount();
      if (oldOnline) Object.defineProperty(navigator, "onLine", oldOnline);
      else Reflect.deleteProperty(navigator, "onLine");
    }
  });

});