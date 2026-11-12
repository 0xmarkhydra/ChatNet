import type { Dispatch, RefObject, SetStateAction } from "react";
import { useApi } from "../../../shared/context/ApiContext";
import { useNotice } from "../../../shared/context/NoticeContext";
import { useSession } from "../../../shared/context/SessionContext";
import { editMessage, recallMessage } from "../api/messages";
import type { Message } from "../types";

export type UseMessageEditsDeps = {
  actionLocks: RefObject<Set<string>>;
  activeConversationIdRef: RefObject<number | null>;
  messageChanges: RefObject<Set<number>>;
  setMessages: Dispatch<SetStateAction<Message[]>>;
  setReplyingTo: Dispatch<SetStateAction<Message | null>>;
  setTranslations: Dispatch<SetStateAction<Record<number, string>>>;
};

/** Edits and recalls the signed-in user's own messages. */
export function useMessageEdits({
  actionLocks,
  activeConversationIdRef,
  messageChanges,
  setMessages,
  setReplyingTo,
  setTranslations,
}: UseMessageEditsDeps) {
  const { apiFetch } = useApi();
  const { setNotice } = useNotice();
  const { session, sessionRef } = useSession();
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
      const response = await editMessage(apiFetch, message.id, next.trim());
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
      const response = await recallMessage(apiFetch, message.id);
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

  return { editOwnMessage, recallOwnMessage };
}
