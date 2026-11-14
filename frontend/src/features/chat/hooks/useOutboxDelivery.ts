import { useApi } from "../../../shared/context/ApiContext";
import { useSession } from "../../../shared/context/SessionContext";
import { mergeById } from "../../../shared/utils/optimistic";
import type { Dispatch, RefObject, SetStateAction } from "react";
import { getConversationEncryptionStatus, sendMessage as sendMessageRequest } from "../api/messages";
import { type QueuedChatMessage, confirmChatMessage, retryableChatMessages } from "../lib/chatOutbox";
import type { Message } from "../types";

export type UseOutboxDeliveryDeps = {
  activeChannelIdRef: RefObject<number>;
  activeConversationIdRef: RefObject<number | null>;
  chatOutboxRef: RefObject<QueuedChatMessage[]>;
  chatOutboxSession: RefObject<string>;
  messageChanges: RefObject<Set<number>>;
  refreshConversations: () => Promise<void>;
  retryOutboxBusyRef: RefObject<boolean>;
  sendingClientIDs: RefObject<Set<string>>;
  setMessages: Dispatch<SetStateAction<Message[]>>;
  updateChatOutbox: (transform: (items: QueuedChatMessage[]) => QueuedChatMessage[]) => QueuedChatMessage[];
};

/** Delivers queued outbox messages to the server and retries the ones still waiting. */
export function useOutboxDelivery({
  activeChannelIdRef,
  activeConversationIdRef,
  chatOutboxRef,
  chatOutboxSession,
  messageChanges,
  refreshConversations,
  retryOutboxBusyRef,
  sendingClientIDs,
  setMessages,
  updateChatOutbox,
}: UseOutboxDeliveryDeps) {
  const { apiFetch } = useApi();
  const { sessionRef } = useSession();
  async function deliverQueuedChatMessage(item: QueuedChatMessage) {
    const identity = sessionRef.current;
    if (
      !identity ||
      chatOutboxSession.current !== identity.sessionId ||
      !navigator.onLine ||
      sendingClientIDs.current.has(item.clientId) ||
      !chatOutboxRef.current.some(
        (pending) =>
          pending.clientId === item.clientId &&
          pending.conversationId === item.conversationId &&
          pending.status !== "failed",
      )
    )
      return;
    sendingClientIDs.current.add(item.clientId);
    try {
      // Old offline outbox entries must not downgrade an MLS conversation.
      // If status is unavailable, fail closed with an unconfirmed item.
      const mode = await getConversationEncryptionStatus(apiFetch, item.conversationId);
      if (sessionRef.current?.sessionId !== identity.sessionId) return;
      if (mode !== 'legacy') {
        updateChatOutbox((items) => items.map((pending) =>
          pending.clientId === item.clientId &&
          pending.conversationId === item.conversationId
            ? {
                ...pending,
                status: 'failed',
                error: 'Tin plaintext không được gửi vì cuộc trò chuyện yêu cầu E2EE.',
              }
            : pending,
        ));
        return;
      }
      const response = await sendMessageRequest(apiFetch, item);
      if (sessionRef.current?.sessionId !== identity.sessionId) return;
      if (!response.ok) {
        const permanent =
          response.status >= 400 &&
          response.status < 500 &&
          response.status !== 408 &&
          response.status !== 429;
        const error = permanent
          ? (
              (await response.json().catch(() => null)) as {
                error?: string;
              } | null
            )?.error
          : undefined;
        if (sessionRef.current?.sessionId !== identity.sessionId) return;
        updateChatOutbox((items) =>
          items.map((pending) =>
            pending.clientId === item.clientId &&
            pending.conversationId === item.conversationId
              ? {
                  ...pending,
                  status: permanent ? "failed" : "unconfirmed",
                  error: permanent
                    ? error || "Không gửi được. Kiểm tra quyền hoặc nội dung."
                    : undefined,
                }
              : pending,
          ),
        );
        return;
      }
      const confirmed = (await response.json()) as Message;
      if (sessionRef.current?.sessionId !== identity.sessionId) return;
      if (
        !Number.isSafeInteger(confirmed.id) ||
        confirmed.id <= 0 ||
        confirmed.clientId !== item.clientId ||
        confirmed.conversationId !== item.conversationId ||
        confirmed.senderId !== identity.user.id
      )
        throw new Error("Unexpected send receipt");
      updateChatOutbox((items) =>
        confirmChatMessage(items, item.clientId, item.conversationId),
      );
      if (activeConversationIdRef.current === item.conversationId &&
          activeChannelIdRef.current === (item.channelId || 0)) {
        messageChanges.current.add(confirmed.id);
        setMessages((current) =>
          mergeById(current, confirmed).sort((a, b) => a.id - b.id),
        );
      }
      void refreshConversations();
    } catch {
      if (sessionRef.current?.sessionId === identity.sessionId) {
        // The HTTP ACK might be lost after the database commit. Reuse the same clientId.
        updateChatOutbox((items) =>
          items.map((pending) =>
            pending.clientId === item.clientId &&
            pending.conversationId === item.conversationId
              ? { ...pending, status: "unconfirmed", error: undefined }
              : pending,
          ),
        );
      }
    } finally {
      sendingClientIDs.current.delete(item.clientId);
    }
  }
  async function retryQueuedChatMessages() {
    if (!navigator.onLine || retryOutboxBusyRef.current || !sessionRef.current)
      return;
    retryOutboxBusyRef.current = true;
    try {
      while (navigator.onLine) {
        const item = retryableChatMessages(chatOutboxRef.current)[0];
        if (!item) break;
        await deliverQueuedChatMessage(item);
        const remaining = chatOutboxRef.current.find(
          (pending) =>
            pending.clientId === item.clientId &&
            pending.conversationId === item.conversationId,
        );
        if (remaining && remaining.status !== "failed") break;
      }
    } finally {
      retryOutboxBusyRef.current = false;
    }
  }

  return { retryQueuedChatMessages };
}