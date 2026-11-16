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
  it("refreshes on entry and uses current callbacks without restarting the interval", () => {
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

  it("pauses hidden-page refresh and cleans up on disable or session change", () => {
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
      act(() => vi.advanceTimersByTime(12_000));
      expect(posts).toHaveBeenCalledTimes(1);
      visible = true;
      act(() => vi.advanceTimersByTime(12_000));
      expect(posts).toHaveBeenCalledTimes(2);
      act(() => root.render(<Probe enabled sessionId="B" sessionToken="t-B" />));
      expect(posts).toHaveBeenCalledTimes(3);
      act(() => root.render(<Probe enabled={false} sessionId="B" sessionToken="t-B" />));
      act(() => vi.advanceTimersByTime(24_000));
      expect(posts).toHaveBeenCalledTimes(3);
      expect(stories).toHaveBeenCalledTimes(3);
    } finally {
      act(() => root.unmount());
      host.remove();
    }
  });
});
