import { useCallback, useEffect, useRef } from "react";
import { useScopedState } from "../../../shared/hooks/useScopedState";

/** Transient drag state belongs to the mounted Chat section, not the app shell. */
export function useChatDragSurface(activeConversationId: number | null) {
  const chatFileInputRef = useRef<HTMLInputElement>(null);
  const chatDragDepth = useRef(0);
  const setChatDragDepth = useCallback((next: number) => {
    chatDragDepth.current = next;
  }, []);
  const [chatDragActive, setChatDragActive] = useScopedState(activeConversationId, false);

  useEffect(() => {
    chatDragDepth.current = 0;
  }, [activeConversationId]);

  return {
    chatFileInputRef,
    chatDragDepth,
    setChatDragDepth,
    chatDragActive,
    setChatDragActive,
  };
}
