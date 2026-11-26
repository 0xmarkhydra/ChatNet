import { useEffect } from "react";
import type { RefObject } from "react";

/** Release pending UI action locks when the signed-in account changes or unmounts. */
export function useFriendActionSessionReset(
  pendingActions: RefObject<Set<number>>,
  sessionId: string | undefined,
) {
  useEffect(() => {
    const currentLocks = pendingActions.current;
    return () => currentLocks.clear();
  }, [pendingActions, sessionId]);
}
