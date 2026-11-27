import { useLayoutEffect, useRef, type RefObject } from "react";
import { useLatest } from "../../../shared/hooks/useLatest";
import { positionAtUnread, reconcileChatScroll, resetChatFollowBottom, resetChatScrollRestore } from "../lib/chatScrollPosition";
import type { Message } from "../types";
import type { QueuedChatMessage } from "../lib/chatOutbox";

/** Coordinate scroll when a channel or visible message set changes. */
export function useChatScrollCoordinator({
  activeConversationId,
  selectedChannelId,
  unreadMessageId,
  messageHistoryLoading = false,
  messages,
  outgoingMessage,
  chatOutbox,
  messagesScrollRef,
  messageScrollAtBottom,
  ownSendScrollConversation,
  pendingMessageScrollRestore,
}: {
  activeConversationId: number | null;
  selectedChannelId: number;
  unreadMessageId?: number | null;
  messageHistoryLoading?: boolean;
  messages: readonly Message[];
  outgoingMessage: Message | null;
  chatOutbox: readonly QueuedChatMessage[];
  messagesScrollRef: RefObject<HTMLDivElement | null>;
  messageScrollAtBottom: RefObject<boolean>;
  ownSendScrollConversation: RefObject<number | null>;
  pendingMessageScrollRestore: RefObject<{ top: number; height: number } | null>;
}) {
  const latest = useLatest({
    activeConversationId, messagesScrollRef, messageScrollAtBottom,
    ownSendScrollConversation, pendingMessageScrollRestore,
    unreadMessageId, messageHistoryLoading, messages,
  });
  const entered = useRef(false);
  const positionedCachedHistory = useRef(false);
  useLayoutEffect(() => {
    entered.current = false;
    positionedCachedHistory.current = false;
    resetChatScrollRestore(latest.current);
    resetChatFollowBottom(latest.current);
  }, [activeConversationId, selectedChannelId, latest]);

  const synchronize = useLatest(() => {
    const refs = latest.current;
    const container = refs.messagesScrollRef.current;
    if (!container || !refs.activeConversationId) return;
    // A hidden mobile picker or transitioning panel has no measurable viewport.
    // Do not consume the initial scroll anchor until its real layout is available.
    if (typeof ResizeObserver !== 'undefined' && container.clientHeight === 0) return;
    const { messageHistoryLoading, messages, unreadMessageId, activeConversationId } = refs;
    if (!entered.current) {
      if (messageHistoryLoading) {
        // A revisited room already has history. Place it at the latest message
        // before paint instead of showing its top until revalidation returns.
        if (messages.length && !positionedCachedHistory.current) {
          positionedCachedHistory.current = true;
          if (!positionAtUnread(unreadMessageId, refs)) reconcileChatScroll(activeConversationId, refs);
        }
        return;
      }
      entered.current = true;
      // Respect a user who started reading the cached history while loading.
      if ((!positionedCachedHistory.current || refs.messageScrollAtBottom.current) && positionAtUnread(unreadMessageId, refs)) return;
    }
    reconcileChatScroll(activeConversationId, refs);
  });
  useLayoutEffect(() => {
    synchronize.current();
  }, [activeConversationId, selectedChannelId, unreadMessageId, messageHistoryLoading, messages, outgoingMessage, chatOutbox, synchronize]);

  useLayoutEffect(() => {
    const element = messagesScrollRef.current;
    if (!element || typeof ResizeObserver === 'undefined') return;
    let wasHidden = element.clientHeight === 0;
    const observer = new ResizeObserver(() => {
      if (!element.clientHeight) { wasHidden = true; return; }
      if (wasHidden) {
        wasHidden = false;
        entered.current = false;
        positionedCachedHistory.current = false;
        resetChatFollowBottom(latest.current);
      }
      synchronize.current();
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [activeConversationId, selectedChannelId, messagesScrollRef, latest, synchronize]);
}