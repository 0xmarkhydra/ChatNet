import { useEffect, type RefObject } from "react";
import { isDesktopBuild } from "../../platform/desktop";
import { useLatest } from "../../shared/hooks/useLatest";

/** Keep desktop navigation shortcuts current without re-registering global listeners. */
export function useDesktopShortcuts({
  sessionRef,
  onOpenChat,
  messageInputRef,
}: {
  sessionRef: RefObject<unknown | null>;
  onOpenChat: () => void;
  messageInputRef: RefObject<HTMLTextAreaElement | null>;
}) {
  const openChatRef = useLatest(onOpenChat);

  useEffect(() => {
    if (!isDesktopBuild) return;
    let pendingFocus: number | null = null;
    const keyboard = (event: KeyboardEvent) => {
      if (
        !sessionRef.current ||
        event.isComposing ||
        event.altKey ||
        !(event.ctrlKey || event.metaKey) ||
        document.querySelector('[role="dialog"][aria-modal="true"]')
      ) return;

      if (event.key.toLowerCase() === "k" && !event.shiftKey) {
        event.preventDefault();
        openChatRef.current();
        if (pendingFocus !== null) window.cancelAnimationFrame(pendingFocus);
        pendingFocus = window.requestAnimationFrame(() => {
          pendingFocus = null;
          if (!sessionRef.current || document.querySelector('[role="dialog"][aria-modal="true"]')) return;
          document.querySelector<HTMLInputElement>(".appbar-search input")?.focus();
        });
      } else if (event.key.toLowerCase() === "l" && event.shiftKey) {
        event.preventDefault();
        messageInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", keyboard);
    return () => {
      window.removeEventListener("keydown", keyboard);
      if (pendingFocus !== null) window.cancelAnimationFrame(pendingFocus);
    };
  }, [messageInputRef, openChatRef, sessionRef]);
}