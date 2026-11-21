import { useEffect } from "react";
import { useLatest } from "../../../shared/hooks/useLatest";
import { resetConversationView, type ConversationViewResetTargets } from "../lib/resetConversationView";

/** Only conversation identity changes reset the transient Chat view. */
export function useConversationViewReset(
  activeConversationId: number | null,
  targets: ConversationViewResetTargets,
) {
  const latest = useLatest(targets);
  useEffect(() => {
    resetConversationView(activeConversationId, latest.current);
  }, [activeConversationId, latest]);
}
