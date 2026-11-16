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
    let refreshing = false;
    const refresh = () => {
      if (refreshing) return;
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
      ]).then(() => { refreshing = false; });
    };
    refresh();
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    const timer = window.setInterval(refreshWhenVisible, 12_000);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [enabled, sessionId, sessionToken, postsRef, storiesRef]);
}