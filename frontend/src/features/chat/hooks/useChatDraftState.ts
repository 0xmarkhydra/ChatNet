import { useCallback, useEffect, useState, type RefObject } from "react";
import { emptyDraft, type MessageDraft } from "../types";
import { loadChatDrafts, saveChatDrafts } from "../lib/chatPersistence";
import type { Session } from "../../../shared/types/session";

/**
 * Conversation drafts belong to Chat, not the app shell.
 * Preserve legacy lifetime: text survives a same-user tab reload, while
 * attachments and per-channel drafts remain memory-only.
 */
export function useChatDraftState({
  userId,
  sessionRef,
  activeConversationId,
  selectedChannelId,
}: {
  userId: number;
  sessionRef: RefObject<Session | null>;
  activeConversationId: number | null;
  selectedChannelId: number;
}) {
  const [messageDrafts, setMessageDrafts] = useState<Record<number, MessageDraft>>(() => {
    const saved = loadChatDrafts(userId);
    return Object.fromEntries(
      Object.entries(saved).map(([id, item]) => [
        Number(id),
        { text: item.text, attachments: [] },
      ]),
    );
  });

  useEffect(() => {
    if (userId && sessionRef.current?.user.id === userId) {
      saveChatDrafts(userId, messageDrafts);
    }
  }, [userId, messageDrafts, sessionRef]);

  const [channelDrafts, setChannelDrafts] = useState<Record<string, MessageDraft>>({});
  const channelDraftKey = `${activeConversationId ?? 0}:${selectedChannelId}`;
  const setMessageText = useCallback((text: string) => {
    if (!activeConversationId) return;
    if (selectedChannelId > 0) {
      setChannelDrafts(current => ({
        ...current,
        [channelDraftKey]: { ...(current[channelDraftKey] ?? emptyDraft), text },
      }));
      return;
    }
    setMessageDrafts(current => ({
      ...current,
      [activeConversationId]: { ...(current[activeConversationId] ?? emptyDraft), text },
    }));
  }, [activeConversationId, selectedChannelId, channelDraftKey]);

  const draft = selectedChannelId > 0
    ? channelDrafts[channelDraftKey] ?? emptyDraft
    : messageDrafts[activeConversationId ?? 0] ?? emptyDraft;

  return {
    messageDrafts,
    setMessageDrafts,
    channelDrafts,
    setChannelDrafts,
    channelDraftKey,
    draft,
    messageText: draft.text,
    messageAttachments: draft.attachments,
    setMessageText,
  };
}
