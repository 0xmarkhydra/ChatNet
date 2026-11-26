import { useEffect, useRef, type Dispatch, type SetStateAction } from 'react'
import type { ApiRequest } from '../../../shared/types/api'
import type { Tab } from '../../../shared/types/navigation'
import type { FriendSearchResult } from '../types'
import { listFriendSuggestions, searchFriendUsers } from '../api/contacts'
import { parseFriendSearchResults } from '../utils/friendSearchResults'

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
  const query = friendQuery.trim();
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
    if (!friendSurfaceOpen) {
      setFriendSearching(false);
      return;
    }

    const controller = new AbortController();
    // Keep the last successful suggestions visible while refreshing in the background.
    if (query) setFriendResults([]);
    setFriendSearching(true);
    setFriendSearchError(false);

    if (!query) {
      listFriendSuggestions(apiFetch, controller.signal)
        .then(async (response) => {
          if (!response.ok) throw new Error("Cannot load suggestions");
          const data: unknown = await response.json();
          const items = parseFriendSearchResults(data);
          if (!items) throw new Error("Invalid suggestions response");
          return items;
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
        const response = await searchFriendUsers(apiFetch, query, controller.signal);
        if (!response.ok) throw new Error("Cannot search users");
        const data: unknown = await response.json();
        const items = parseFriendSearchResults(data);
        if (!items) throw new Error("Invalid user search response");
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
  }, [query, friendSearchRetry, friendSurfaceOpen, sessionToken, sessionId, apiFetch, setFriendResults, setFriendSearching, setFriendSearchError]);

}