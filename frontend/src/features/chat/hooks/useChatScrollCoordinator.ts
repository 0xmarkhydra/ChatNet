import { useEffect, useLayoutEffect, type RefObject } from "react";
import { useLatest } from "../../../shared/hooks/useLatest";
import { reconcileChatScroll, resetChatFollowBottom } from "../lib/chatScrollPosition";
import type { Message } from "../types";
import type { QueuedChatMessage } from "../lib/chatOutbox";

/** Coordinate scroll when a channel or visible message set changes. */
export function useChatScrollCoordinator({
  activeConversationId,
  selectedChannelId,
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
  useEffect(() => {
    resetChatFollowBottom(latest.current);
  }, [selectedChannelId, latest]);

  useLayoutEffect(() => {
    reconcileChatScroll(latest.current.activeConversationId, latest.current);
  // Preserve original data-only triggers so unrelated App Shell updates do not move the reader.
  }, [messages, outgoingMessage, chatOutbox, latest]);
}
