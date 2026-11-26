import { useEffect, useRef, type Dispatch, type SetStateAction } from 'react'
import type { ApiRequest } from '../../../shared/types/api'
import type { Tab } from '../../../shared/types/navigation'
import type { FriendSearchResult } from '../types'

type Options = {
  sessionToken?: string
  sessionId?: string
  tab: Tab
  desktopSection: 'groups' | 'calls' | null
  newChatMode: string
  friendQuery: string
  friendSearchRetry: number
  apiFetch: ApiRequest
  setFriendResults: Dispatch<SetStateAction<FriendSearchResult[]>>
  setFriendSearching: Dispatch<SetStateAction<boolean>>
  setFriendSearchError: Dispatch<SetStateAction<boolean>>
}

/** Owns the contacts suggestion/search request lifecycle, including stale-request cancellation. */
export function useFriendSearchRequests({
  sessionToken, sessionId, tab, newChatMode,
  friendQuery, friendSearchRetry, apiFetch,
  setFriendResults, setFriendSearching, setFriendSearchError,
}: Options) {
  const friendSearchSessionRef = useRef(sessionId);
  const friendSurfaceOpen = newChatMode === "friends" || tab === "contacts";
  useEffect(() => {
    if (friendSearchSessionRef.current !== sessionId) {
      friendSearchSessionRef.current = sessionId;
      setFriendResults([]);
    }
    if (!sessionToken) {
      setFriendResults([]);
      setFriendSearching(false);
      setFriendSearchError(false);
      return;
    }
    if (!friendSurfaceOpen) return;

    const controller = new AbortController();
    const query = friendQuery.trim();
    // Keep the last successful suggestions visible while refreshing in the background.
    if (query) setFriendResults([]);
    setFriendSearching(true);
    setFriendSearchError(false);

    if (!query) {
      apiFetch("/api/users/suggestions", { signal: controller.signal })
        .then(async (response) => {
          if (!response.ok) throw new Error("Cannot load suggestions");
          return response.json() as Promise<FriendSearchResult[]>;
        })
        .then((items) => {
          if (!controller.signal.aborted) setFriendResults(items);
        })
        .catch(() => {
          if (!controller.signal.aborted) {
            // Retain last-known suggestions on a transient network failure.
            setFriendSearchError(true);
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) setFriendSearching(false);
        });

      return () => controller.abort();
    }

    const timer = window.setTimeout(async () => {
      setFriendSearching(true);
      try {
        const response = await apiFetch(
          `/api/users/search?q=${encodeURIComponent(query)}`,
          { signal: controller.signal },
        );
        if (!response.ok) throw new Error("Cannot search users");
        const items = (await response.json()) as FriendSearchResult[];
        if (!controller.signal.aborted) setFriendResults(items);
      } catch {
        if (!controller.signal.aborted) {
          setFriendResults([]);
          setFriendSearchError(true);
        }
      } finally {
        if (!controller.signal.aborted) setFriendSearching(false);
      }
    }, 250);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [friendQuery, friendSearchRetry, friendSurfaceOpen, sessionToken, sessionId, apiFetch, setFriendResults, setFriendSearching, setFriendSearchError]);

}