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

  it("never refreshes an outdated session", () => {
    const refresh = vi.fn(async () => null);
    const sessionRef = { current: { sessionId: "session-b" } } as unknown as RefObject<Session | null>;
    const mounted = mountKeepalive("session-a", sessionRef, refresh, vi.fn());
    expect(refresh).not.toHaveBeenCalled();
    mounted.unmount();
  });
});
