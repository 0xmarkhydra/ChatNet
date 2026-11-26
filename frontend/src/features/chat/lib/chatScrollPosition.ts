import type { RefObject } from "react";

export type ChatScrollRefs = {
  messagesScrollRef: RefObject<HTMLDivElement | null>;
  messageScrollAtBottom: RefObject<boolean>;
  ownSendScrollConversation: RefObject<number | null>;
  pendingMessageScrollRestore: RefObject<{ top: number; height: number } | null>;
};

/** Imperative DOM synchronization, separated from the React effect lifecycle. */
export function reconcileChatScroll(activeConversationId: number | null, refs: ChatScrollRefs) {
  const { messagesScrollRef, messageScrollAtBottom, ownSendScrollConversation, pendingMessageScrollRestore } = refs;
  const container = messagesScrollRef.current;
  if (ownSendScrollConversation.current !== null) {
    const sentInCurrentConversation = ownSendScrollConversation.current === activeConversationId;
    ownSendScrollConversation.current = null;
    if (sentInCurrentConversation && container) {
      pendingMessageScrollRestore.current = null;
      container.scrollTop = container.scrollHeight;
      messageScrollAtBottom.current = true;
      return;
    }
  }
  const restore = pendingMessageScrollRestore.current;
  if (restore && container) {
    container.scrollTop = restore.top + container.scrollHeight - restore.height;
    pendingMessageScrollRestore.current = null;
    return;
  }
  if (container && messageScrollAtBottom.current) {
    container.scrollTop = container.scrollHeight;
  }
}

export function resetChatFollowBottom(refs: Pick<ChatScrollRefs, "messageScrollAtBottom">) {
  refs.messageScrollAtBottom.current = true;
}

/** Set the initial position exactly once without smooth-scroll layout jumps. */
export function positionAtUnread(unreadMessageId: number | null | undefined, refs: ChatScrollRefs): boolean {
  const container = refs.messagesScrollRef.current;
  const marker = unreadMessageId && container?.querySelector<HTMLElement>(`[data-unread-message-id="${unreadMessageId}"]`);
  if (!container || !marker) return false;
  refs.pendingMessageScrollRestore.current = null;
  container.scrollTop += marker.getBoundingClientRect().top - container.getBoundingClientRect().top - 12;
  refs.messageScrollAtBottom.current = container.scrollHeight - container.scrollTop - container.clientHeight < 96;
  return true;
}
