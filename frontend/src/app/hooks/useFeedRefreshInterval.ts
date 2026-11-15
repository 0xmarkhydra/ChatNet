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
    const refresh = () => {
      void postsRef.current();
      void storiesRef.current();
    };
    refresh();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, 12_000);
    return () => window.clearInterval(timer);
  }, [enabled, sessionId, sessionToken, postsRef, storiesRef]);
}