import type { Dispatch, RefObject, SetStateAction } from "react";
import { useApi } from "../../../shared/context/ApiContext";
import { useNotice } from "../../../shared/context/NoticeContext";
import { useSession } from "../../../shared/context/SessionContext";
import { toggleMessageReactionCount } from "../../../shared/utils/optimistic";
import { reactToMessage } from "../api/messages";
import type { Message, MessageReaction } from "../types";

export type UseMessageReactionsDeps = {
  actionLocks: RefObject<Set<string>>;
  activeConversationIdRef: RefObject<number | null>;
  messageChanges: RefObject<Set<number>>;
  setMessages: Dispatch<SetStateAction<Message[]>>;
  setReactionPreviews: Dispatch<SetStateAction<Record<number, MessageReaction[]>>>;
};

/** Reacts to a message with an optimistic preview. */
export function useMessageReactions({
  actionLocks,
  activeConversationIdRef,
  messageChanges,
  setMessages,
  setReactionPreviews,
}: UseMessageReactionsDeps) {
  const { apiFetch } = useApi();
  const { setNotice } = useNotice();
  const { session, sessionRef } = useSession();
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
      const response = await reactToMessage(apiFetch, message.id, emoji);
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

  return { toggleReaction };
}
