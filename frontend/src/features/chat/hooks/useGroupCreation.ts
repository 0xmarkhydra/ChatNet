import type { Dispatch, RefObject, SetStateAction } from "react";
import { useApi } from "../../../shared/context/ApiContext";
import { useSession } from "../../../shared/context/SessionContext";
import { createGroupConversation } from "../api/conversations";
import { type CommunityCreationExtras } from "../components/CommunityGroupWizard";
import type { Conversation, NewChatMode } from "../types";
import type { Tab } from "../../../shared/types/navigation";

export type UseGroupCreationDeps = {
  actionLocks: RefObject<Set<string>>;
  membershipEventSequenceRef: RefObject<number>;
  membershipSnapshot: RefObject<Set<number> | null>;
  refreshConversations: () => Promise<void>;
  revokedConversationIds: RefObject<Set<number>>;
  setActiveConversationId: Dispatch<SetStateAction<number | null>>;
  setChatCreateError: Dispatch<SetStateAction<string>>;
  setConversations: Dispatch<SetStateAction<Conversation[]>>;
  setFriendQuery: Dispatch<SetStateAction<string>>;
  setNewChatMode: Dispatch<SetStateAction<NewChatMode>>;
  setTab: Dispatch<SetStateAction<Tab>>;
};

/** Creates a group or community conversation. */
export function useGroupCreation({
  actionLocks,
  membershipEventSequenceRef,
  membershipSnapshot,
  refreshConversations,
  revokedConversationIds,
  setActiveConversationId,
  setChatCreateError,
  setConversations,
  setFriendQuery,
  setNewChatMode,
  setTab,
}: UseGroupCreationDeps) {
  const { apiFetch } = useApi();
  const { session, sessionRef } = useSession();
  async function createGroup(name: string, usernames: string[], extras?: CommunityCreationExtras): Promise<number | null> {
    if (actionLocks.current.has("chat:create")) return null;
    actionLocks.current.add("chat:create");
    setChatCreateError("");
    const sessionId = session?.sessionId;
    try {
      const response = await createGroupConversation(apiFetch, { name, usernames, ...extras });
      const result = await response.json();
      if (sessionRef.current?.sessionId !== sessionId) return null;
      if (!response.ok || !Number.isSafeInteger(result?.id) || result.id <= 0) {
        setChatCreateError(result?.error || "Không thể tạo nhóm");
        return null;
      }
      const created = result as Conversation;
      membershipSnapshot.current?.add(created.id);
      revokedConversationIds.current.delete(created.id);
      membershipEventSequenceRef.current += 1;
      setConversations((current) => [
        created,
        ...current.filter((item) => item.id !== created.id),
      ]);
      setActiveConversationId(created.id);
      setTab("chat");
      setFriendQuery("");
      setNewChatMode("none");
      void refreshConversations();
      return created.id;
    } catch {
      if (sessionRef.current?.sessionId === sessionId)
        setChatCreateError("Không thể tạo nhóm. Kiểm tra kết nối rồi thử lại.");
      return null;
    } finally {
      if (sessionRef.current?.sessionId === sessionId)
        actionLocks.current.delete("chat:create");
    }
  }


  return { createGroup };
}
