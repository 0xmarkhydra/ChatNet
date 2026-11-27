import { FormEvent, useRef, type Dispatch, type RefObject, type SetStateAction } from "react";
import { useApi } from "../../../shared/context/ApiContext";
import { useNotice } from "../../../shared/context/NoticeContext";
import { useSession } from "../../../shared/context/SessionContext";
import { attachmentRequestBody, type MediaAttachment } from "../../../shared/utils/media";
import { type QueuedChatMessage, enqueueChatMessage } from "../lib/chatOutbox";
import { isGiphyMedia } from "../api/giphy";
import { getConversationEncryptionStatus } from "../api/messages";
import type { Message, MessageDraft } from "../types";

export type UseMessageSenderDeps = {
  activeConversationId: number | null;
  canSend: boolean;
  canSendSticker: boolean;
  uploadMediaFiles: (files: File[], scope: 'chat') => Promise<MediaAttachment[]>;
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
  canSendSticker,
  uploadMediaFiles,
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
  const activeAttempt = useRef<object | null>(null);
  async function sendMessage(event: FormEvent | null, sticker?: string | File) {
    event?.preventDefault();
    const immediate = sticker !== undefined;
    if (typeof sticker === 'string' && (!isGiphyMedia(sticker) || /\s/.test(sticker))) return;
    if (!(immediate ? canSendSticker : canSend) || !activeConversationId || sendingRef.current || !session ||
        sessionRef.current !== session)
      return;
    sendingRef.current = true;
    const attempt = {};
    activeAttempt.current = attempt;
    const conversationId = activeConversationId;
    try {
      // Fail closed before the plaintext outbox. Do not queue local plaintext
      // for a room that has cut over to MLS, or when the status is unknown.
      const mode = await getConversationEncryptionStatus(apiFetch, conversationId);
      if (sessionRef.current !== session) return;
      if (mode !== 'legacy') {
        setNotice('Cuộc trò chuyện yêu cầu E2EE. Hãy gửi qua ô nhập mã hóa khi thiết bị đã sẵn sàng.', 'warning');
        return;
      }
    const channelId = selectedChannelId;
    const draftKey = channelDraftKey;
    const submittedDraft = draft;
    const reply = replyingTo;
    let attachments = immediate ? [] : messageAttachments.map(attachmentRequestBody);
    if (sticker && typeof sticker !== 'string') {
      let uploaded: MediaAttachment[];
      try {
        uploaded = await uploadMediaFiles([sticker], 'chat');
      } catch (error) {
        if (sessionRef.current === session) setNotice(error instanceof Error ? error.message : 'Không thể gửi sticker.', 'error');
        return;
      }
      try {
        if (sessionRef.current !== session) return;
        attachments = uploaded.map(attachmentRequestBody);
      } finally {
        for (const media of uploaded) if (media.url?.startsWith('blob:')) URL.revokeObjectURL(media.url);
      }
      if (!attachments.length) return;
    }
    const item: QueuedChatMessage = {
      ...(channelId > 0 ? { channelId } : {}),
      clientId: crypto.randomUUID(),
      conversationId,
      text: immediate ? (typeof sticker === 'string' ? sticker : '') : messageText.trim(),
      attachments,
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
        immediate ? "Hàng đợi tin nhắn đã đầy. Hãy chọn lại sticker sau." : "Hàng đợi tin nhắn đã đầy. Nội dung vẫn ở ô nhập; hãy thử lại sau.",
        "warning",
      );
      return;
    }
    ownSendScrollConversationRef.current = conversationId;
    if (!immediate && channelId > 0) {
      setChannelDrafts(current => {
        if (current[draftKey] !== submittedDraft) return current;
        const next = { ...current };
        delete next[draftKey];
        return next;
      });
    } else if (!immediate) {
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
      if (sessionRef.current === session) {
        setNotice('Không xác minh được chế độ mã hóa. Tin nhắn chưa được gửi hoặc lưu vào hàng đợi.', 'warning');
      }
    } finally {
      if (activeAttempt.current === attempt) {
        activeAttempt.current = null;
        sendingRef.current = false;
      }
    }
  }

  return { sendMessage };
}