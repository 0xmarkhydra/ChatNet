import { useEffect, type RefObject } from "react";
import { useLatest } from "../../../shared/hooks/useLatest";
import type { Message } from "../types";
import type { QueuedChatMessage } from "../lib/chatOutbox";

/**
 * Reconcile locally queued sends against messages confirmed by the server.
 * Never drop another account's receipts or messages without a clientId.
 */
export function useChatOutboxReceiptReconciliation({
  messages,
  sessionId,
  userId,
  chatOutboxRef,
  updateChatOutbox,
}: {
  messages: readonly Message[];
  sessionId: string | null;
  userId: number | null;
  chatOutboxRef: RefObject<QueuedChatMessage[]>;
  updateChatOutbox: (transform: (items: QueuedChatMessage[]) => QueuedChatMessage[]) => QueuedChatMessage[];
}) {
  const updateRef = useLatest(updateChatOutbox);

  useEffect(() => {
    if (!sessionId || !userId || !messages.length || !chatOutboxRef.current.length) return;
    const delivered = new Set(
      messages
        .filter(message => message.senderId === userId && Boolean(message.clientId))
        .map(message => `${message.conversationId}:${message.clientId}`),
    );
    if (!delivered.size) return;
    updateRef.current(items => {
      if (!items.some(item => delivered.has(`${item.conversationId}:${item.clientId}`))) {
        return items;
      }
      return items.filter(item => !delivered.has(`${item.conversationId}:${item.clientId}`));
    });
  }, [messages, sessionId, userId, chatOutboxRef, updateRef]);
}
