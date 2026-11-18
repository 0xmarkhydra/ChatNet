import { useEffect } from "react";
import { useLatest } from "../../shared/hooks/useLatest";

/** Refresh the visible Feed without retaining callbacks from an old render. */
export function useFeedRefreshInterval({
  enabled,
  sessionId,
  sessionToken,
  refreshPosts,
  refreshStories,
}: {
  enabled: boolean;
  sessionId: string | null;
  sessionToken: string | null;
  refreshPosts: () => Promise<unknown>;
  refreshStories: () => Promise<unknown>;
}) {
  const postsRef = useLatest(refreshPosts);
  const storiesRef = useLatest(refreshStories);

  useEffect(() => {
    if (!enabled || !sessionId || !sessionToken) return;
    // A slow refresh must not race with the next timer tick or visibility event.
    // Each effect owns its own guard so a new session can refresh immediately.
    let active = true;
    let refreshing = false;
    let refreshAfterCurrent = false;
    const isOnline = () => navigator.onLine !== false;
    const refresh = (onDemand = false) => {
      // Do not start new network reads for a background tab.
      if (!active || !isOnline() || document.visibilityState !== "visible") return;
      if (refreshing) {
        // Visibility/online events should not be lost behind a slow request.
        if (onDemand) refreshAfterCurrent = true;
        return;
      }
      refreshing = true;
      const call = (callback: () => Promise<unknown>) => {
        try {
          return Promise.resolve(callback());
        } catch {
          // The request owns its error UI; keep the polling cycle recoverable.
          return Promise.resolve();
        }
      };
      void Promise.allSettled([
        call(postsRef.current),
        call(storiesRef.current),
      ]).then(() => {
        refreshing = false;
        if (!active || !refreshAfterCurrent) return;
        refreshAfterCurrent = false;
        if (document.visibilityState === "visible") refresh();
      });
    };
    refresh();
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") refresh(true);
    };
    const timer = window.setInterval(refreshWhenVisible, 12_000);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    window.addEventListener("online", refreshWhenVisible);
    return () => {
      active = false;
      refreshAfterCurrent = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
      window.removeEventListener("online", refreshWhenVisible);
    };
  }, [enabled, sessionId, sessionToken, postsRef, storiesRef]);
}