import { FormEvent, type Dispatch, type RefObject, type SetStateAction } from "react";
import { useApi } from "../../../shared/context/ApiContext";
import { useNotice } from "../../../shared/context/NoticeContext";
import { useSession } from "../../../shared/context/SessionContext";
import { attachmentRequestBody, type MediaAttachment } from "../../../shared/utils/media";
import { type QueuedChatMessage, enqueueChatMessage } from "../lib/chatOutbox";
import { getConversationEncryptionStatus } from "../api/messages";
import type { Message, MessageDraft } from "../types";

export type UseMessageSenderDeps = {
  activeConversationId: number | null;
  canSend: boolean;
  channelDraftKey: string;
  draft: MessageDraft;
  messageAttachments: MediaAttachment[];
  messageText: string;
  ownSendScrollConversationRef: RefObject<number | null>;
  replyingTo: Message | null;
  retryQueuedChatMessages: () => Promise<void>;
  selectedChannelId: number;
  sendingRef: RefObject<boolean>;
  setChannelDrafts: Dispatch<SetStateAction<Record<string, MessageDraft>>>;
  setChatOnline: Dispatch<SetStateAction<boolean>>;
  setMessageDrafts: Dispatch<SetStateAction<Record<number, MessageDraft>>>;
  setReplyingTo: Dispatch<SetStateAction<Message | null>>;
  updateChatOutbox: (transform: (items: QueuedChatMessage[]) => QueuedChatMessage[]) => QueuedChatMessage[];
};

/** Queues a composed message in the outbox and starts delivery. */
export function useMessageSender({
  activeConversationId,
  canSend,
  channelDraftKey,
  draft,
  messageAttachments,
  messageText,
  ownSendScrollConversationRef,
  replyingTo,
  retryQueuedChatMessages,
  selectedChannelId,
  sendingRef,
  setChannelDrafts,
  setChatOnline,
  setMessageDrafts,
  setReplyingTo,
  updateChatOutbox,
}: UseMessageSenderDeps) {
  const { setNotice } = useNotice();
  const { apiFetch } = useApi();
  const { session, sessionRef } = useSession();
  async function sendMessage(event: FormEvent) {
    event.preventDefault();
    if (!canSend || !activeConversationId || sendingRef.current || !session)
      return;
    sendingRef.current = true;
    const submittingSessionId = session.sessionId;
    const conversationId = activeConversationId;
    try {
      // Fail closed before the plaintext outbox. Do not queue local plaintext
      // for a room that has cut over to MLS, or when the status is unknown.
      const mode = await getConversationEncryptionStatus(apiFetch, conversationId);
      if (sessionRef.current?.sessionId !== submittingSessionId) return;
      if (mode === 'e2ee') {
        setNotice('Cuộc trò chuyện đã dùng E2EE. Luồng gửi mã hóa chưa sẵn sàng; tin nhắn vẫn ở ô nhập.', 'warning');
        return;
      }
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
    ownSendScrollConversationRef.current = conversationId;
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
    } catch {
      if (sessionRef.current?.sessionId === submittingSessionId) {
        setNotice('Không xác minh được chế độ mã hóa. Tin nhắn chưa được gửi hoặc lưu vào hàng đợi.', 'warning');
      }
    } finally {
      sendingRef.current = false;
    }
  }

  return { sendMessage };
}
