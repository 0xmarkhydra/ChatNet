import { useScopedState } from "../../../shared/hooks/useScopedState";

/** Only the mounted Chat section needs these presentation states. */
export function useChatSectionPanels({
  activeConversationId,
}: {
  activeConversationId: number | null;
}) {
  const [pinnedExpanded, setPinnedExpanded] = useScopedState(activeConversationId, false);
  return { pinnedExpanded, setPinnedExpanded };
}
