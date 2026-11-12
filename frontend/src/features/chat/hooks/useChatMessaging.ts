import { type QueuedChatMessage, confirmChatMessage, retryableChatMessages, enqueueChatMessage } from "../lib/chatOutbox";
import { type Message, type MessageDraft, type MessageReaction } from "../types";
import { mergeById, toggleMessageReactionCount } from "../../../shared/utils/optimistic";
import { FormEvent, type SetStateAction } from "react";
import { attachmentRequestBody, type MediaAttachment } from "../../../shared/utils/media";
import { type Session } from "../../auth/lib/session";
import { type ToastKind } from "../../notifications/utils/toast";
import type { Dispatch, RefObject } from "react";

export type UseChatMessagingDeps = {
  actionLocks: RefObject<Set<string>>;
  activeChannelIdRef: RefObject<number>;
  activeConversationId: number | null;
  activeConversationIdRef: RefObject<number | null>;
  apiFetch: (path: string, init?: RequestInit) => Promise<Response>;
  canSend: boolean;
  channelDraftKey: string;
  chatOutboxRef: RefObject<QueuedChatMessage[]>;
  chatOutboxSession: RefObject<string>;
  draft: MessageDraft;
  messageAttachments: MediaAttachment[];
  messageChanges: RefObject<Set<number>>;
  messageText: string;
  ownSendScrollConversation: RefObject<number | null>;
  refreshConversations: () => Promise<void>;
  replyingTo: Message | null;
  retryOutboxBusy: RefObject<boolean>;
  selectedChannelId: number;
  sendingClientIDs: RefObject<Set<string>>;
  sendingRef: RefObject<boolean>;
  session: Session | null;
  sessionRef: RefObject<Session | null>;
  setChannelDrafts: Dispatch<SetStateAction<Record<string, MessageDraft>>>;
  setChatOnline: Dispatch<SetStateAction<boolean>>;
  setMessageDrafts: Dispatch<SetStateAction<Record<number, MessageDraft>>>;
  setMessages: Dispatch<SetStateAction<Message[]>>;
  setNotice: (message: string, kind?: ToastKind) => void;
  setReactionPreviews: Dispatch<SetStateAction<Record<number, MessageReaction[]>>>;
  setReplyingTo: Dispatch<SetStateAction<Message | null>>;
  setTranslations: Dispatch<SetStateAction<Record<number, string>>>;
  updateChatOutbox: (transform: (items: QueuedChatMessage[]) => QueuedChatMessage[]) => QueuedChatMessage[];
};

export function useChatMessaging({
  actionLocks,
  activeChannelIdRef,
  activeConversationId,
  activeConversationIdRef,
  apiFetch,
  canSend,
  channelDraftKey,
  chatOutboxRef,
  chatOutboxSession,
  draft,
  messageAttachments,
  messageChanges,
  messageText,
  ownSendScrollConversation,
  refreshConversations,
  replyingTo,
  retryOutboxBusy,
  selectedChannelId,
  sendingClientIDs,
  sendingRef,
  session,
  sessionRef,
  setChannelDrafts,
  setChatOnline,
  setMessageDrafts,
  setMessages,
  setNotice,
  setReactionPreviews,
  setReplyingTo,
  setTranslations,
  updateChatOutbox,
}: UseChatMessagingDeps) {
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
      const response = await apiFetch(
        `/api/conversations/${item.conversationId}/messages`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: item.text,
            attachments: item.attachments,
            clientId: item.clientId,
            ...(item.channelId ? { channelId: item.channelId } : {}),
            ...(item.replyToMessageId
              ? { replyToMessageId: item.replyToMessageId }
              : {}),
          }),
        },
      );
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
    if (!navigator.onLine || retryOutboxBusy.current || !sessionRef.current)
      return;
    retryOutboxBusy.current = true;
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
      retryOutboxBusy.current = false;
    }
  }
  function sendMessage(event: FormEvent) {
    event.preventDefault();
    if (!canSend || !activeConversationId || sendingRef.current || !session)
      return;
    sendingRef.current = true;
    window.setTimeout(() => {
      sendingRef.current = false;
    }, 0);

    const conversationId = activeConversationId;
    const channelId = selectedChannelId;
    const draftKey = channelDraftKey;
    const submittedDraft = draft;
    const reply = replyingTo;
    const item: QueuedChatMessage = {
      ...(channelId > 0 ? { channelId } : {}),
      clientId: crypto.randomUUID(),
      conversationId,
      text: messageText.trim(),
      attachments: messageAttachments.map(attachmentRequestBody),
      ...(reply
        ? {
            replyToMessageId: reply.id,
            replyToSender: reply.sender,
            replyToText: reply.text,
          }
        : {}),
      createdAt: new Date().toISOString(),
      status: "queued",
    };
    const next = updateChatOutbox((items) => enqueueChatMessage(items, item));
    if (!next.some((pending) => pending.clientId === item.clientId)) {
      setNotice(
        "Hàng đợi tin nhắn đã đầy. Nội dung vẫn ở ô nhập; hãy thử lại sau.",
        "warning",
      );
      return;
    }
    ownSendScrollConversation.current = conversationId;
    if (channelId > 0) {
      setChannelDrafts(current => {
        if (current[draftKey] !== submittedDraft) return current;
        const next = { ...current };
        delete next[draftKey];
        return next;
      });
    } else {
      setMessageDrafts((current) => {
        if (current[conversationId] !== submittedDraft) return current;
        const updated = { ...current };
        delete updated[conversationId];
        return updated;
      });
    }
    setReplyingTo((current) => (current === reply ? null : current));
    if (navigator.onLine) void retryQueuedChatMessages();
    else setChatOnline(false);
  }
  async function editOwnMessage(message: Message) {
    const key = `message:${message.id}`;
    if (
      message.deleted ||
      message.senderId !== session?.user.id ||
      actionLocks.current.has(key)
    )
      return;
    const next = window.prompt("Sửa tin nhắn", message.text);
    if (next === null || next.trim() === message.text.trim()) return;
    if (!next.trim()) {
      setNotice("Tin nhắn sau khi sửa không được để trống.");
      return;
    }

    const sessionId = session?.sessionId;
    actionLocks.current.add(key);
    try {
      const response = await apiFetch(`/api/messages/${message.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: next.trim() }),
      });
      const result = (await response.json().catch(() => null)) as
        | Message
        | { error?: string }
        | null;
      if (sessionRef.current?.sessionId !== sessionId) return;
      if (
        !response.ok ||
        !result ||
        !("id" in result) ||
        result.id !== message.id ||
        typeof result.text !== "string"
      ) {
        setNotice(
          (result as { error?: string } | null)?.error ||
            "Không sửa được tin nhắn",
        );
        return;
      }
      const updated = result as Message;
      if (activeConversationIdRef.current !== message.conversationId) return;
      messageChanges.current.add(updated.id);
      setMessages((current) =>
        current.map((item) =>
          item.id === updated.id
            ? {
                ...item,
                text: updated.text,
                editedAt: updated.editedAt,
              }
            : item,
        ),
      );
      setTranslations((current) => {
        const nextTranslations = { ...current };
        delete nextTranslations[message.id];
        return nextTranslations;
      });
    } finally {
      if (sessionRef.current?.sessionId === sessionId)
        actionLocks.current.delete(key);
    }
  }
  async function recallOwnMessage(message: Message) {
    const key = `message:${message.id}`;
    if (
      message.deleted ||
      message.senderId !== session?.user.id ||
      actionLocks.current.has(key)
    )
      return;
    if (!window.confirm("Thu hồi tin nhắn này?")) return;
    const sessionId = session?.sessionId;
    actionLocks.current.add(key);
    try {
      const response = await apiFetch(`/api/messages/${message.id}`, {
        method: "DELETE",
      });
      const result = (await response.json().catch(() => null)) as
        | Message
        | { error?: string }
        | null;
      if (sessionRef.current?.sessionId !== sessionId) return;
      if (
        !response.ok ||
        !result ||
        !("id" in result) ||
        result.id !== message.id ||
        !result.deleted
      ) {
        setNotice(
          (result as { error?: string } | null)?.error ||
            "Không thu hồi được tin nhắn",
        );
        return;
      }
      const updated = result as Message;
      if (activeConversationIdRef.current !== message.conversationId) return;
      messageChanges.current.add(updated.id);
      setMessages((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
      setTranslations((current) => {
        const next = { ...current };
        delete next[message.id];
        return next;
      });
      setReplyingTo((current) => (current?.id === message.id ? null : current));
    } finally {
      if (sessionRef.current?.sessionId === sessionId)
        actionLocks.current.delete(key);
    }
  }
  async function toggleReaction(message: Message, emoji: string) {
    const key = `message:${message.id}`;
    if (message.deleted || actionLocks.current.has(key)) return;
    const sessionId = session?.sessionId;
    actionLocks.current.add(key);
    setReactionPreviews((current) => ({
      ...current,
      [message.id]: toggleMessageReactionCount(message.reactions || [], emoji),
    }));
    try {
      const response = await apiFetch(`/api/messages/${message.id}/reactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emoji }),
      });
      const result = (await response.json()) as Message & { error?: string };
      if (sessionRef.current?.sessionId !== sessionId) return;
      if (!response.ok || result.id !== message.id)
        throw new Error(result.error || "Không thả cảm xúc được");
      if (activeConversationIdRef.current === message.conversationId) {
        messageChanges.current.add(result.id);
        setMessages((current) =>
          current.map((item) =>
            item.id === result.id
              ? { ...item, reactions: result.reactions }
              : item,
          ),
        );
      }
    } catch (error) {
      if (sessionRef.current?.sessionId === sessionId)
        setNotice(
          error instanceof Error ? error.message : "Không thả cảm xúc được",
          "error",
        );
    } finally {
      if (sessionRef.current?.sessionId === sessionId) {
        actionLocks.current.delete(key);
        setReactionPreviews((current) => {
          const next = { ...current };
          delete next[message.id];
          return next;
        });
      }
    }
  }

  return {
    editOwnMessage,
    recallOwnMessage,
    retryQueuedChatMessages,
    sendMessage,
    toggleReaction,
  };
}
