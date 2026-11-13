import { useFriendActions } from "./useFriendActions";
import { updateContactMetadata, findDirectConversation } from "../api/contacts";
import { useContactModeration } from "./useContactModeration";
import type { FriendSearchResult, FriendConnection } from "../types";
import type { UseContactActionsDeps } from "./contactActionTypes";
import type { Conversation } from "../../chat/types";



export function useContactActions({
  apiFetch,
  blockedBusy,
  contactMetadata,
  conversations,
  friendActionRef,
  friendBusyIds,
  friendRelationship,
  friends,
  friendSyncRequest,
  openDirectByUsername,
  refreshConversations,
  refreshFriendConnections,
  session,
  sessionRef,
  setActiveConversationId,
  setBlockedBusy,
  setBlockedError,
  setBlockedOpen,
  setBlockedUsers,
  setContactMetadata,
  setConversations,
  setDesktopSection,
  setFriendActionBusy,
  setFriendBusyIds,
  setFriendMenuId,
  setFriendPreview,
  setFriendRequests,
  setFriendResults,
  setFriends,
  setNotice,
  setTab,
}: UseContactActionsDeps) {
  const moderationActions = useContactModeration({
    apiFetch,
    blockedBusy,
    friendBusyIds,
    refreshConversations,
    refreshFriendConnections,
    session,
    sessionRef,
    setBlockedBusy,
    setBlockedError,
    setBlockedOpen,
    setBlockedUsers,
    setConversations,
    setFriendBusyIds,
    setFriendMenuId,
    setFriendPreview,
    setFriendRequests,
    setFriendResults,
    setFriends,
    setNotice,
  });
  const friendActions = useFriendActions({
    apiFetch,
    friendActionRef,
    friendRelationship,
    friends,
    friendSyncRequest,
    openDirectByUsername,
    refreshFriendConnections,
    session,
    sessionRef,
    setFriendActionBusy,
    setFriendBusyIds,
    setFriendMenuId,
    setFriendPreview,
    setFriendRequests,
    setFriends,
    setNotice,
    openBlockedFriendConversation,
  });

  async function changePersonalContact(
    friend: FriendConnection,
    field: "nickname" | "note" | "favorite",
  ) {
    const sid = session?.sessionId;
    if (!sid || friendBusyIds.has(friend.id)) return;
    const previous = contactMetadata[friend.id] || {
      nickname: "",
      note: "",
      favorite: false,
    };
    const next = { ...previous };
    if (field === "favorite") {
      next.favorite = !next.favorite;
    } else {
      const label =
        field === "nickname"
          ? "Biệt danh riêng (tối đa 60 ký tự)"
          : "Ghi chú riêng (tối đa 1500 ký tự)";
      const answer = window.prompt(label, previous[field]);
      if (answer === null) return;
      next[field] = answer.trim();
      if (next[field].length > (field === "nickname" ? 60 : 1500)) {
        setNotice("Nội dung vượt quá độ dài cho phép.", "warning");
        return;
      }
    }
    setFriendMenuId(null);
    setFriendBusyIds((ids) => new Set(ids).add(friend.id));
    try {
      const response = await updateContactMetadata(apiFetch, friend.id, next);
      const result = (await response.json().catch(() => null)) as {
        error?: string;
        id?: number;
        nickname?: string;
        note?: string;
        favorite?: boolean;
      } | null;
      if (sessionRef.current?.sessionId !== sid) return;
      if (!response.ok || !result || result.id !== friend.id) {
        setNotice(result?.error || "Không lưu được liên hệ.", "error");
        return;
      }
      setContactMetadata((old) => ({ ...old, [friend.id]: next }));
      setNotice("Đã lưu thông tin liên hệ riêng.");
    } catch {
      if (sessionRef.current?.sessionId === sid)
        setNotice("Không thể lưu liên hệ. Hãy thử lại.", "error");
    } finally {
      if (sessionRef.current?.sessionId === sid) {
        setFriendBusyIds((ids) => {
          const nextIDs = new Set(ids);
          nextIDs.delete(friend.id);
          return nextIDs;
        });
      }
    }
  }
  async function openBlockedFriendConversation(userId: number) {
    let direct = conversations.find((item) => item.type === 'direct' && item.otherUserId === userId);
    if (!direct) {
      const username = friends.find((item) => item.id === userId)?.username;
      if (username) {
        try {
          // The chat may be on a later page of the paginated conversation list.
          const response = await findDirectConversation(apiFetch, username);
          if (response.ok) {
            const data = (await response.json()) as Conversation[];
            direct = data.find((item) => item.type === 'direct' && item.otherUserId === userId);
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
    if (!direct) {
      setNotice('Chưa tìm thấy hội thoại cũ để mở.', 'warning');
      return;
    }
    setDesktopSection(null);
    setActiveConversationId(direct.id);
    setTab('chat');
  }

  return {
    ...moderationActions,
    ...friendActions,
    changePersonalContact,
    openBlockedFriendConversation,
  };
}