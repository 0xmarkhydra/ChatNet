import { useEffect, type RefObject } from "react";

export type ChatMessageJump = {
  conversationId: number;
  messageId: number;
  revision: number;
};

/**
 * The search result owns the scroll/highlight lifecycle, not the app shell.
 * Wait for the target message to enter the loaded conversation before scrolling.
 * A superseded jump cancels its pending animation frame.
 */
export function useChatMessageJumpFocus({
  jump,
  activeConversationId,
  messages,
  lastScrolledRevision,
}: {
  jump: ChatMessageJump | null;
  activeConversationId: number | null;
  messages: readonly { id: number }[];
  lastScrolledRevision: RefObject<number>;
}) {
  useEffect(() => {
    if (
      !jump ||
      jump.conversationId !== activeConversationId ||
      lastScrolledRevision.current === jump.revision ||
      !messages.some(item => item.id === jump.messageId)
    ) return;

    const frame = window.requestAnimationFrame(() => {
      const target = document.querySelector(`[data-message-id="${jump.messageId}"]`);
      if (!target) return;

      target.scrollIntoView({
        block: "center",
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
      });
      if (target instanceof HTMLElement && typeof target.animate === "function") {
        target.animate(
          [
            { outline: "2px solid var(--accent, #318a65)", outlineOffset: "3px", backgroundColor: "rgba(49,138,101,0.16)" },
            { outline: "2px solid transparent", outlineOffset: "3px", backgroundColor: "transparent" },
          ],
          { duration: 2200, easing: "ease-out" },
        );
      }
      lastScrolledRevision.current = jump.revision;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [messages, activeConversationId, jump, lastScrolledRevision]);
}
