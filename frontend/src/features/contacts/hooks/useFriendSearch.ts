import { useState, useRef } from "react";
import type { FriendSearchResult } from "../types";

export type UseFriendSearchDeps = {

};

export function useFriendSearch({

}: UseFriendSearchDeps) {  const [friendQuery, setFriendQuery] = useState("");
  const [friendResults, setFriendResults] = useState<FriendSearchResult[]>([]);
  const [friendSearching, setFriendSearching] = useState(false);
  const [friendSearchError, setFriendSearchError] = useState(false);
  const [friendSearchRetry, setFriendSearchRetry] = useState(0);
  const [friendActionBusy, setFriendActionBusy] = useState<number | null>(null);
  const friendActionRef = useRef(new Set<number>());
  const [friendBusyIds, setFriendBusyIds] = useState<Set<number>>(
    () => new Set(),
  );
  const [friendMenuId, setFriendMenuId] = useState<number | null>(null);

  return {
    friendActionBusy,
    friendActionRef,
    friendBusyIds,
    friendMenuId,
    friendQuery,
    friendResults,
    friendSearchError,
    friendSearchRetry,
    friendSearching,
    setFriendActionBusy,
    setFriendBusyIds,
    setFriendMenuId,
    setFriendQuery,
    setFriendResults,
    setFriendSearchError,
    setFriendSearchRetry,
    setFriendSearching,
  };
}
