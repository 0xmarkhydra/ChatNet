// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useFeedRefreshInterval } from "./useFeedRefreshInterval";

const previousAct = (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
const visibility = Object.getOwnPropertyDescriptor(document, "visibilityState");

afterEach(() => {
  vi.useRealTimers();
  if (visibility) Object.defineProperty(document, "visibilityState", visibility);
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = previousAct;
  vi.restoreAllMocks();
});

describe("useFeedRefreshInterval", () => {
  it("refreshes on entry and uses current callbacks without restarting the interval", async () => {
    vi.useFakeTimers();
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
    const firstPosts = vi.fn(async () => undefined);
    const firstStories = vi.fn(async () => undefined);
    const currentPosts = vi.fn(async () => undefined);
    const currentStories = vi.fn(async () => undefined);
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);

    function Probe({ newer }: { newer: boolean }) {
      useFeedRefreshInterval({
        enabled: true,
        sessionId: "visit-A",
        sessionToken: "jwt-A",
        refreshPosts: newer ? currentPosts : firstPosts,
        refreshStories: newer ? currentStories : firstStories,
      });
      return null;
    }

    try {
      act(() => root.render(<Probe newer={false} />));
      expect(firstPosts).toHaveBeenCalledTimes(1);
      expect(firstStories).toHaveBeenCalledTimes(1);
      await act(async () => { await Promise.resolve(); });
      act(() => root.render(<Probe newer />));
      expect(currentPosts).not.toHaveBeenCalled();
      act(() => vi.advanceTimersByTime(12_000));
      expect(firstPosts).toHaveBeenCalledTimes(1);
      expect(firstStories).toHaveBeenCalledTimes(1);
      expect(currentPosts).toHaveBeenCalledTimes(1);
      expect(currentStories).toHaveBeenCalledTimes(1);
    } finally {
      act(() => root.unmount());
      host.remove();
    }
    act(() => vi.advanceTimersByTime(24_000));
    expect(currentPosts).toHaveBeenCalledTimes(1);
  });

  it("pauses hidden-page refresh and cleans up on disable or session change", async () => {
    vi.useFakeTimers();
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    let visible = false;
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => visible ? "visible" : "hidden" });
    const posts = vi.fn(async () => undefined);
    const stories = vi.fn(async () => undefined);
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);

    function Probe({ enabled, sessionId, sessionToken }: { enabled: boolean; sessionId: string; sessionToken: string }) {
      useFeedRefreshInterval({ enabled, sessionId, sessionToken, refreshPosts: posts, refreshStories: stories });
      return null;
    }

    try {
      act(() => root.render(<Probe enabled sessionId="A" sessionToken="t-A" />));
      expect(posts).toHaveBeenCalledTimes(1);
      await act(async () => { await Promise.resolve(); });
      act(() => vi.advanceTimersByTime(12_000));
      expect(posts).toHaveBeenCalledTimes(1);
      visible = true;
      act(() => document.dispatchEvent(new Event("visibilitychange")));
      expect(posts).toHaveBeenCalledTimes(2);
      await act(async () => { await Promise.resolve(); });
      act(() => vi.advanceTimersByTime(12_000));
      expect(posts).toHaveBeenCalledTimes(3);
      await act(async () => { await Promise.resolve(); });
      act(() => root.render(<Probe enabled sessionId="B" sessionToken="t-B" />));
      expect(posts).toHaveBeenCalledTimes(4);
      act(() => root.render(<Probe enabled={false} sessionId="B" sessionToken="t-B" />));
      act(() => vi.advanceTimersByTime(24_000));
      act(() => document.dispatchEvent(new Event("visibilitychange")));
      expect(posts).toHaveBeenCalledTimes(4);
      expect(stories).toHaveBeenCalledTimes(4);
    } finally {
      act(() => root.unmount());
      host.remove();
    }
  });

  it("skips overlapping polling and lets a new session refresh despite old pending calls", async () => {
    vi.useFakeTimers();
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
    let finishOldPosts!: () => void;
    let finishOldStories!: () => void;
    const oldPosts = vi.fn(() => new Promise<void>((resolve) => { finishOldPosts = resolve; }));
    const oldStories = vi.fn(() => new Promise<void>((resolve) => { finishOldStories = resolve; }));
    const newPosts = vi.fn(async () => undefined);
    const newStories = vi.fn(async () => undefined);
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    function Probe({ next }: { next: boolean }) {
      useFeedRefreshInterval({
        enabled: true,
        sessionId: next ? "session-B" : "session-A",
        sessionToken: next ? "token-B" : "token-A",
        refreshPosts: next ? newPosts : oldPosts,
        refreshStories: next ? newStories : oldStories,
      });
      return null;
    }
    try {
      act(() => root.render(<Probe next={false} />));
      act(() => {
        vi.advanceTimersByTime(36_000);
        document.dispatchEvent(new Event("visibilitychange"));
      });
      expect(oldPosts).toHaveBeenCalledTimes(1);
      expect(oldStories).toHaveBeenCalledTimes(1);

      act(() => root.render(<Probe next />));
      expect(newPosts).toHaveBeenCalledTimes(1);
      expect(newStories).toHaveBeenCalledTimes(1);

      await act(async () => {
        finishOldPosts();
        finishOldStories();
        await Promise.resolve();
      });
      act(() => vi.advanceTimersByTime(12_000));
      expect(newPosts).toHaveBeenCalledTimes(2);
      expect(newStories).toHaveBeenCalledTimes(2);
      expect(oldPosts).toHaveBeenCalledTimes(1);
    } finally {
      act(() => root.unmount());
      host.remove();
    }
  });

  it("recovers from a rejected refresh on the next polling tick", async () => {
    vi.useFakeTimers();
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
    const posts = vi.fn().mockRejectedValueOnce(new Error("network down")).mockResolvedValue(undefined);
    const stories = vi.fn(async () => undefined);
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    function Probe() {
      useFeedRefreshInterval({
        enabled: true,
        sessionId: "session-A",
        sessionToken: "token-A",
        refreshPosts: posts,
        refreshStories: stories,
      });
      return null;
    }
    try {
      act(() => root.render(<Probe />));
      await act(async () => { await Promise.resolve(); });
      act(() => vi.advanceTimersByTime(12_000));
      expect(posts).toHaveBeenCalledTimes(2);
      expect(stories).toHaveBeenCalledTimes(2);
    } finally {
      act(() => root.unmount());
      host.remove();
    }
  });

  it("refreshes immediately on reconnect, without overlapping a pending request", async () => {
    vi.useFakeTimers();
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
    let finishPosts!: () => void;
    let finishStories!: () => void;
    const posts = vi.fn(() => new Promise<void>((resolve) => { finishPosts = resolve; }));
    const stories = vi.fn(() => new Promise<void>((resolve) => { finishStories = resolve; }));
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    function Probe() {
      useFeedRefreshInterval({
        enabled: true, sessionId: "A", sessionToken: "token-A",
        refreshPosts: posts, refreshStories: stories,
      });
      return null;
    }
    try {
      act(() => root.render(<Probe />));
      act(() => window.dispatchEvent(new Event("online")));
      expect(posts).toHaveBeenCalledTimes(1);
      expect(stories).toHaveBeenCalledTimes(1);
      await act(async () => {
        finishPosts();
        finishStories();
        await Promise.resolve();
      });
      act(() => window.dispatchEvent(new Event("online")));
      expect(posts).toHaveBeenCalledTimes(2);
      expect(stories).toHaveBeenCalledTimes(2);
    } finally {
      act(() => root.unmount());
      host.remove();
    }
    window.dispatchEvent(new Event("online"));
    expect(posts).toHaveBeenCalledTimes(2);
  });

  it("does not refresh a hidden Feed when connectivity returns", async () => {
    vi.useFakeTimers();
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
    const posts = vi.fn(async () => undefined);
    const stories = vi.fn(async () => undefined);
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    function Probe() {
      useFeedRefreshInterval({
        enabled: true, sessionId: "A", sessionToken: "token-A",
        refreshPosts: posts, refreshStories: stories,
      });
      return null;
    }
    try {
      act(() => root.render(<Probe />));
      await act(async () => { await Promise.resolve(); });
      act(() => window.dispatchEvent(new Event("online")));
      expect(posts).toHaveBeenCalledTimes(1);
      expect(stories).toHaveBeenCalledTimes(1);
    } finally {
      act(() => root.unmount());
      host.remove();
    }
  });

  it("skips polling while offline and resumes immediately on reconnect", async () => {
    vi.useFakeTimers();
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const originalOnline = Object.getOwnPropertyDescriptor(navigator, "onLine");
    let online = false;
    Object.defineProperty(navigator, "onLine", { configurable: true, get: () => online });
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
    const posts = vi.fn(async () => undefined);
    const stories = vi.fn(async () => undefined);
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    function Probe() {
      useFeedRefreshInterval({ enabled: true, sessionId: "A", sessionToken: "token-A", refreshPosts: posts, refreshStories: stories });
      return null;
    }
    try {
      act(() => root.render(<Probe />));
      act(() => vi.advanceTimersByTime(48_000));
      expect(posts).not.toHaveBeenCalled();
      expect(stories).not.toHaveBeenCalled();
      online = true;
      act(() => window.dispatchEvent(new Event("online")));
      expect(posts).toHaveBeenCalledTimes(1);
      expect(stories).toHaveBeenCalledTimes(1);
    } finally {
      act(() => root.unmount());
      host.remove();
      if (originalOnline) Object.defineProperty(navigator, "onLine", originalOnline);
      else Reflect.deleteProperty(navigator, "onLine");
    }
  });

  it("coalesces reconnect and visibility refresh while requests are pending", async () => {
    vi.useFakeTimers();
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
    const pending: Array<{ finishPosts: () => void; finishStories: () => void }> = [];
    let finishPosts!: () => void;
    let finishStories!: () => void;
    const posts = vi.fn(() => new Promise<void>((resolve) => { finishPosts = resolve; }));
    const stories = vi.fn(() => new Promise<void>((resolve) => {
      finishStories = resolve;
      pending.push({ finishPosts, finishStories });
    }));
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    function Probe({ enabled = true }: { enabled?: boolean }) {
      useFeedRefreshInterval({ enabled, sessionId: "A", sessionToken: "token-A", refreshPosts: posts, refreshStories: stories });
      return null;
    }
    try {
      act(() => root.render(<Probe />));
      act(() => {
        window.dispatchEvent(new Event("online"));
        document.dispatchEvent(new Event("visibilitychange"));
        vi.advanceTimersByTime(12_000);
      });
      expect(posts).toHaveBeenCalledTimes(1);
      await act(async () => {
        pending[0].finishPosts();
        pending[0].finishStories();
        await Promise.resolve();
      });
      expect(posts).toHaveBeenCalledTimes(2);
      expect(stories).toHaveBeenCalledTimes(2);
      // A pending refresh from an old screen must never trigger work after cleanup.
      act(() => root.render(<Probe enabled={false} />));
      await act(async () => {
        pending[1].finishPosts();
        pending[1].finishStories();
        await Promise.resolve();
      });
      expect(posts).toHaveBeenCalledTimes(2);
    } finally {
      act(() => root.unmount());
      host.remove();
    }
  });
});