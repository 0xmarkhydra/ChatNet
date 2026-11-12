import type { Dispatch, RefObject, SetStateAction } from "react";
import { useApi } from "../../../shared/context/ApiContext";
import { useNotice } from "../../../shared/context/NoticeContext";
import { useSession } from "../../../shared/context/SessionContext";
import { FormEvent } from "react";
import { createDirectConversation } from "../api/conversations";
import { type GroupChannel } from "../utils/groupChannels";
import type { Conversation, NewChatMode } from "../types";
import type { FriendSearchResult } from "../../contacts/types";
import type { Tab } from "../../../shared/types/navigation";

export type UseDirectConversationsDeps = {
  actionLocks: RefObject<Set<string>>;
  directUsername: string;
  membershipEventSequenceRef: RefObject<number>;
  membershipSnapshot: RefObject<Set<number> | null>;
  refreshConversations: () => Promise<void>;
  revokedConversationIds: RefObject<Set<number>>;
  setActiveConversationId: Dispatch<SetStateAction<number | null>>;
  setChatCreateError: Dispatch<SetStateAction<string>>;
  setConversations: Dispatch<SetStateAction<Conversation[]>>;
  setDesktopSection: Dispatch<SetStateAction<"groups" | "calls" | null>>;
  setDirectUsername: Dispatch<SetStateAction<string>>;
  setFriendQuery: Dispatch<SetStateAction<string>>;
  setFriendResults: Dispatch<SetStateAction<FriendSearchResult[]>>;
  setGlobalSearch: Dispatch<SetStateAction<string>>;
  setNewChatMode: Dispatch<SetStateAction<NewChatMode>>;
  setTab: Dispatch<SetStateAction<Tab>>;
  setTranslations: Dispatch<SetStateAction<Record<number, string>>>;
};

/** Opens or creates a direct conversation by username. */
export function useDirectConversations({
  actionLocks,
  directUsername,
  membershipEventSequenceRef,
  membershipSnapshot,
  refreshConversations,
  revokedConversationIds,
  setActiveConversationId,
  setChatCreateError,
  setConversations,
  setDesktopSection,
  setDirectUsername,
  setFriendQuery,
  setFriendResults,
  setGlobalSearch,
  setNewChatMode,
  setTab,
  setTranslations,
}: UseDirectConversationsDeps) {
  const { apiFetch } = useApi();
  const { setNotice } = useNotice();
  const { session, sessionRef } = useSession();
  async function openDirectByUsername(username: string, mediaType?: "audio" | "video", onOpened?: (conversation: Conversation) => void) {
    setChatCreateError("");
    const normalized = username.trim().toLowerCase();
    if (!normalized || actionLocks.current.has("chat:create")) return;
    const sessionId = session?.sessionId;
    actionLocks.current.add("chat:create");
    try {
      const response = await createDirectConversation(apiFetch, normalized);
      const result = await response.json();
      if (sessionRef.current?.sessionId !== sessionId) return;
      if (!response.ok || !Number.isSafeInteger(result?.id) || result.id <= 0) {
        setNotice(result?.error || "Không thể mở cuộc trò chuyện");
        return;
      }

      if (sessionRef.current?.sessionId !== session?.sessionId) return;
      const created = result as Conversation;
      membershipSnapshot.current?.add(created.id);
      revokedConversationIds.current.delete(created.id);
      membershipEventSequenceRef.current += 1;
      setConversations((current) => [
        created,
        ...current.filter((item) => item.id !== created.id),
      ]);
      setActiveConversationId(created.id);
      setDesktopSection(null);
      setTab("chat");
      setGlobalSearch("");
      setDirectUsername("");
      setFriendQuery("");
      setFriendResults([]);
      setNewChatMode("none");
      setTranslations({});
      void refreshConversations();
      if (mediaType) window.dispatchEvent(new CustomEvent("chatnet:start-call", {
        detail: { conversationId: created.id, mediaType },
      }));
      onOpened?.(created);
    } catch {
      if (sessionRef.current?.sessionId === sessionId)
        setNotice(
          "Không mở được cuộc trò chuyện. Kiểm tra kết nối rồi thử lại.",
        );
    } finally {
      if (sessionRef.current?.sessionId === sessionId)
        actionLocks.current.delete("chat:create");
    }
  }
  async function createDirect(event: FormEvent) {
    event.preventDefault();
    await openDirectByUsername(directUsername);
  }

  return { createDirect, openDirectByUsername };
}
