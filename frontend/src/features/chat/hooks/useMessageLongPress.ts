import { useRef, type SetStateAction } from "react";
import { type Message } from "../types";
import { resolveMessageCopyTarget, type MessageCopyTarget } from "../utils/messageCopyTarget";
import type { Dispatch, RefObject } from "react";

export type UseMessageLongPressDeps = {
  setConversationActionId: Dispatch<SetStateAction<number | null>>;
  setConversationMenuPosition: Dispatch<SetStateAction<{ x: number; y: number; } | null>>;
  setMessageActionId: Dispatch<SetStateAction<number | null>>;
  setMessageActionMode: Dispatch<SetStateAction<"reactions" | "actions">>;
  setMessageCopyTarget: Dispatch<SetStateAction<MessageCopyTarget | null>>;
  suppressConversationClick: RefObject<number | null>;
  suppressMessageClick: RefObject<number | null>;
};

export function useMessageLongPress({
  setConversationActionId,
  setConversationMenuPosition,
  setMessageActionId,
  setMessageActionMode,
  setMessageCopyTarget,
  suppressConversationClick,
  suppressMessageClick,
}: UseMessageLongPressDeps) {
  const conversationLongPress = useRef<{ id: number; x: number; y: number; timer: number } | null>(null);
  const messageLongPressTimer = useRef<number | null>(null);
  const messageLongPressStart = useRef<{
    x: number;
    y: number;
    messageId: number;
  } | null>(null);
  function cancelConversationLongPress() {
    if (conversationLongPress.current) {
      window.clearTimeout(conversationLongPress.current.timer);
      conversationLongPress.current = null;
    }
  }
  function beginConversationLongPress(id: number, x: number, y: number) {
    cancelConversationLongPress();
    suppressConversationClick.current = null;
    const timer = window.setTimeout(() => {
      if (conversationLongPress.current?.id !== id) return;
      conversationLongPress.current = null;
      suppressConversationClick.current = id;
      setConversationMenuPosition(null);
      setConversationActionId(id);
    }, 550);
    conversationLongPress.current = { id, x, y, timer };
  }
  function moveConversationLongPress(x: number, y: number) {
    const start = conversationLongPress.current;
    if (start && Math.hypot(x - start.x, y - start.y) > 12) cancelConversationLongPress();
  }
  function cancelMessageLongPress() {
    if (messageLongPressTimer.current !== null) {
      window.clearTimeout(messageLongPressTimer.current);
      messageLongPressTimer.current = null;
    }
    messageLongPressStart.current = null;
  }
  function openMessageActions(
    message: Message,
    target: EventTarget | null = null,
  ) {
    if (message.deleted) return;
    cancelMessageLongPress();
    const element =
      target instanceof Element
        ? target
        : target instanceof Node
          ? target.parentElement
          : null;
    setMessageCopyTarget(resolveMessageCopyTarget(message, element));
    setMessageActionMode('actions');
    setMessageActionId(message.id);
    navigator.vibrate?.(24);
  }
  function openMessageReactions(message: Message) {
    if (message.deleted) return;
    cancelMessageLongPress();
    setMessageCopyTarget(null);
    setMessageActionMode('reactions');
    setMessageActionId(message.id);
  }
  function beginMessageLongPress(
    message: Message,
    x: number,
    y: number,
    button: number,
    pointerType: string,
    target: EventTarget | null,
  ) {
    // Mouse users keep native text selection and the existing right-click menu.
    if (message.deleted || button !== 0 || pointerType === "mouse") return;
    const element =
      target instanceof Element
        ? target
        : target instanceof Node
          ? target.parentElement
          : null;
    if (element?.closest("button,input,textarea,select,video,audio")) return;
    // Only touch-holding the bubble (including text, links and attachments)
    // opens the sheet; holding the avatar or empty timeline does not.
    if (!element?.closest(".bubble, .chat-message-media, .message-reply-quote")) return;
    if (element.closest("a") && !element.closest("a.message-inline-link, .media-item")) return;
    cancelMessageLongPress();
    suppressMessageClick.current = null;
    messageLongPressStart.current = { x, y, messageId: message.id };
    messageLongPressTimer.current = window.setTimeout(() => {
      if (messageLongPressStart.current?.messageId === message.id) {
        suppressMessageClick.current = message.id;
        openMessageActions(message, target);
      }
    }, 500);
  }
  function moveMessageLongPress(x: number, y: number) {
    const start = messageLongPressStart.current;
    if (!start) return;
    if (Math.hypot(x - start.x, y - start.y) > 12) cancelMessageLongPress();
  }

  return {
    beginConversationLongPress,
    beginMessageLongPress,
    cancelConversationLongPress,
    cancelMessageLongPress,
    moveConversationLongPress,
    moveMessageLongPress,
    openMessageActions,
    openMessageReactions,
  };
}
