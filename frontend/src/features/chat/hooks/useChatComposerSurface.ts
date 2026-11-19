import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { useScopedState } from "../../../shared/hooks/useScopedState";
import { transferHasFiles } from "../utils/chatFileTransfer";

/** Owns chat composer DOM interactions without changing draft or send lifetimes. */
export function useChatComposerSurface({
  tab,
  activeConversationId,
  desktopSection,
  messageText,
}: {
  tab: string;
  activeConversationId: number | null;
  desktopSection: string | null;
  messageText: string;
}) {
  const messageInputRef = useRef<HTMLTextAreaElement>(null);
  const chatFileInputRef = useRef<HTMLInputElement>(null);
  const chatDragDepth = useRef(0);
  const setChatDragDepth = useCallback((next: number) => {
    chatDragDepth.current = next;
  }, []);
  const [chatDragActive, setChatDragActive] = useScopedState(
    `${tab}:${activeConversationId ?? "none"}`, false,
  );

  useLayoutEffect(() => {
    const input = messageInputRef.current;
    if (!input) return;
    input.style.height = "auto";
    input.style.height = `${Math.min(input.scrollHeight, 154)}px`;
  }, [messageText, activeConversationId, tab, desktopSection]);

  useEffect(() => {
    chatDragDepth.current = 0;
  }, [activeConversationId, tab]);

  useEffect(() => {
    const preventFileNavigation = (event: DragEvent) => {
      if (transferHasFiles(event.dataTransfer)) event.preventDefault();
    };
    document.addEventListener("dragover", preventFileNavigation);
    document.addEventListener("drop", preventFileNavigation);
    return () => {
      document.removeEventListener("dragover", preventFileNavigation);
      document.removeEventListener("drop", preventFileNavigation);
    };
  }, []);

  return {
    messageInputRef,
    chatFileInputRef,
    chatDragDepth,
    setChatDragDepth,
    chatDragActive,
    setChatDragActive,
  };
}
