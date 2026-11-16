// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useChatOutboxReconnect } from "./useChatOutboxReconnect";

const prevAct = (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
const originalVisibility = Object.getOwnPropertyDescriptor(document, "visibilityState");

afterEach(() => {
  vi.useRealTimers();
  if (originalVisibility) Object.defineProperty(document, "visibilityState", originalVisibility);
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = prevAct;
  vi.restoreAllMocks();
});

describe("useChatOutboxReconnect", () => {
  it("uses the latest retry callback without restarting timers", () => {
    vi.useFakeTimers();
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const oldRetry = vi.fn();
    const newRetry = vi.fn();
    const onOnline = vi.fn();
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    function Probe({ newer }: { newer: boolean }) {
      useChatOutboxReconnect({
        sessionId: "A",
        retryQueuedMessages: newer ? newRetry : oldRetry,
        setChatOnline: onOnline,
      });
      return null;
    }
    try {
      act(() => root.render(<Probe newer={false} />));
      act(() => root.render(<Probe newer />));
      act(() => vi.advanceTimersByTime(250));
      expect(oldRetry).not.toHaveBeenCalled();
      expect(newRetry).toHaveBeenCalledTimes(1);
      act(() => window.dispatchEvent(new Event("online")));
      expect(newRetry).toHaveBeenCalledTimes(2);
      expect(onOnline).toHaveBeenCalledWith(true);
      act(() => vi.advanceTimersByTime(15_000));
      expect(newRetry).toHaveBeenCalledTimes(3);
    } finally {
      act(() => root.unmount());
      host.remove();
    }
    act(() => vi.advanceTimersByTime(30_000));
    window.dispatchEvent(new Event("online"));
    expect(newRetry).toHaveBeenCalledTimes(3);
  });

  it("does not run retries when session is missing or after the session changes", () => {
    vi.useFakeTimers();
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const oldRetry = vi.fn();
    const nextRetry = vi.fn();
    const setChatOnline = vi.fn();
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    function Probe({ sessionId }: { sessionId: string | null }) {
      useChatOutboxReconnect({
        sessionId,
        retryQueuedMessages: sessionId === "A" ? oldRetry : nextRetry,
        setChatOnline,
      });
      return null;
    }
    try {
      act(() => root.render(<Probe sessionId={null} />));
      act(() => vi.advanceTimersByTime(16_000));
      expect(oldRetry).not.toHaveBeenCalled();
      expect(nextRetry).not.toHaveBeenCalled();
      act(() => root.render(<Probe sessionId="A" />));
      act(() => root.render(<Probe sessionId="B" />));
      act(() => vi.advanceTimersByTime(250));
      expect(oldRetry).not.toHaveBeenCalled();
      expect(nextRetry).toHaveBeenCalledTimes(1);
      act(() => window.dispatchEvent(new Event("offline")));
      expect(setChatOnline).toHaveBeenCalledWith(false);
    } finally {
      act(() => root.unmount());
      host.remove();
    }
  });

  it("retries only when document becomes visible", () => {
    vi.useFakeTimers();
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    let visible = false;
    Object.defineProperty(document, "visibilityState", {
      configurable: true, get: () => visible ? "visible" : "hidden",
    });
    const retry = vi.fn();
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    function Probe() {
      useChatOutboxReconnect({ sessionId: "A", retryQueuedMessages: retry, setChatOnline: vi.fn() });
      return null;
    }
    try {
      act(() => root.render(<Probe />));
      act(() => document.dispatchEvent(new Event("visibilitychange")));
      expect(retry).not.toHaveBeenCalled();
      visible = true;
      act(() => document.dispatchEvent(new Event("visibilitychange")));
      expect(retry).toHaveBeenCalledTimes(1);
    } finally {
      act(() => root.unmount());
      host.remove();
    }
  });
  it("does not mark a visible tab online while the device is offline", () => {
    vi.useFakeTimers();
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const originalOnline = Object.getOwnPropertyDescriptor(navigator, "onLine");
    Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
    const retry = vi.fn();
    const setChatOnline = vi.fn();
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    function Probe() {
      useChatOutboxReconnect({ sessionId: "A", retryQueuedMessages: retry, setChatOnline });
      return null;
    }
    try {
      act(() => root.render(<Probe />));
      act(() => document.dispatchEvent(new Event("visibilitychange")));
      expect(setChatOnline).toHaveBeenCalledWith(false);
      expect(setChatOnline).not.toHaveBeenCalledWith(true);
      expect(retry).not.toHaveBeenCalled();
    } finally {
      act(() => root.unmount());
      host.remove();
      if (originalOnline) Object.defineProperty(navigator, "onLine", originalOnline);
      else Reflect.deleteProperty(navigator, "onLine");
    }
  });

});