import { findDirectConversation } from "../api/contacts";
import type { Conversation } from "../../chat";
import type { UseContactActionsDeps } from "./contactActionTypes";

type BlockedConversationDeps = Pick<UseContactActionsDeps,
  "apiFetch" | "conversations" | "friends" | "session" | "sessionRef" |
  "setConversations" | "setDesktopSection" | "setTab" | "setActiveConversationId" | "setNotice"
>;

/** Opens a blocked contact's existing direct chat without initiating a new conversation. */
export function createBlockedConversationActions({
  apiFetch, conversations, friends, session, sessionRef,
  setConversations, setDesktopSection, setTab, setActiveConversationId, setNotice,
}: BlockedConversationDeps) {
  async function openBlockedFriendConversation(userId: number) {
    const sid = session?.sessionId;
    if (!sid) return;
    let direct = conversations.find((item) => item.type === 'direct' && item.otherUserId === userId);
    if (!direct) {
      const username = friends.find((item) => item.id === userId)?.username;
      if (username) {
        try {
          // The chat may be on a later page of the paginated conversation list.
          const response = await findDirectConversation(apiFetch, username);
          if (response.ok) {
            const data: unknown = await response.json();
            if (sessionRef.current?.sessionId !== sid) return;
            if (Array.isArray(data)) direct = data.find((item): item is Conversation =>
              item !== null && typeof item === 'object' && item.type === 'direct' &&
              item.otherUserId === userId && Number.isSafeInteger(item.id) && item.id > 0);
            if (direct) {
              const found = direct;
              setConversations((current) => [found, ...current.filter((item) => item.id !== found.id)]);
            }
          }
        } catch {
          // A connectivity problem must not remove the contact from the directory.
        }
      }
    }
    if (sessionRef.current?.sessionId !== sid) return;
    if (!direct) {
      setNotice('Chưa tìm thấy hội thoại cũ để mở.', 'warning');
      return;
    }
    setDesktopSection(null);
    setTab('chat');
    setActiveConversationId(direct.id);
  }
  return { openBlockedFriendConversation };
}
