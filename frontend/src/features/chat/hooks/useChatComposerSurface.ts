import { useEffect, useLayoutEffect, useRef } from "react";
import { transferHasFiles } from "../utils/chatFileTransfer";

/** Owns app-wide composer resizing and document-level file drop safety. */
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

  useLayoutEffect(() => {
    const input = messageInputRef.current;
    if (!input) return;
    input.style.height = "auto";
    input.style.height = `${Math.min(input.scrollHeight, 154)}px`;
  }, [messageText, activeConversationId, tab, desktopSection]);

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

  return { messageInputRef };
}
