import { useLayoutEffect, useRef, type RefObject } from "react";
import { useLatest } from "../../../shared/hooks/useLatest";
import { positionAtUnread, reconcileChatScroll, resetChatFollowBottom } from "../lib/chatScrollPosition";
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
  });
  const entered = useRef(false);
  useLayoutEffect(() => {
    entered.current = false;
    resetChatFollowBottom(latest.current);
  }, [activeConversationId, selectedChannelId, latest]);

  useLayoutEffect(() => {
    const refs = latest.current;
    const container = refs.messagesScrollRef.current;
    if (!container || !activeConversationId) return;
    if (!entered.current) {
      if (messageHistoryLoading) return;
      entered.current = true;
      if (positionAtUnread(unreadMessageId, refs)) return;
    }
    reconcileChatScroll(activeConversationId, refs);
  }, [activeConversationId, selectedChannelId, unreadMessageId, messageHistoryLoading, messages, outgoingMessage, chatOutbox, latest]);
}