import type { FriendConnection, FriendSearchResult } from "../types";
import { updateFriendRelationship, removeAcceptedFriend as removeFriendRequest } from "../api/contacts";
import type { UseContactActionsDeps } from "./contactActionTypes";

type FriendActionsDeps = Pick<UseContactActionsDeps,
  | "apiFetch"
  | "friendActionRef"
  | "friendRelationship"
  | "friends"
  | "friendSyncRequest"
  | "openDirectByUsername"
  | "refreshFriendConnections"
  | "session"
  | "sessionRef"
  | "setFriendActionBusy"
  | "setFriendBusyIds"
  | "setFriendMenuId"
  | "setFriendPreview"
  | "setFriendRequests"
  | "setFriends"
  | "setNotice"
> & {
  openBlockedFriendConversation: (userId: number) => Promise<void>;
};

export function useFriendActions({
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
}: FriendActionsDeps) {
  async function actOnFriend(    friend: FriendSearchResult | FriendConnection,
    decline = false,
  ) {
    const sessionId = session?.sessionId;
    if (
      !sessionId ||
      friendActionRef.current.has(friend.id) ||
      friend.id === session.user.id
    )
      return;
    const relationship = friendRelationship(friend.id);
    if (decline && relationship !== "incoming") return;
    if (relationship === "accepted") {
      const contact = friends.find((item) => item.id === friend.id);
      if (contact?.blockedByMe || contact?.blockedByOther) {
        await openBlockedFriendConversation(friend.id);
      } else if (friend.username) {
        await openDirectByUsername(friend.username);
      }
      return;
    }

    friendActionRef.current.add(friend.id);
    setFriendBusyIds((current) => new Set(current).add(friend.id));
    ++friendSyncRequest.current;
    setFriendActionBusy(friend.id);
    try {
      const removing = decline || relationship === "outgoing";
      const response = await updateFriendRelationship(apiFetch, friend.id, relationship, removing);
      const result = (await response.json().catch(() => null)) as
        | (FriendConnection & { error?: string })
        | null;
      if (sessionRef.current?.sessionId !== sessionId) return;
      ++friendSyncRequest.current;
      if (!response.ok) {
        setNotice(result?.error || "Không cập nhật được lời mời kết bạn");
        await refreshFriendConnections();
        return;
      }
      const label = friend.displayName || `@${friend.username}`;
      if (removing) {
        setFriendRequests((current) =>
          current.filter((item) => item.id !== friend.id),
        );
        setNotice(
          decline ? "Đã từ chối lời mời kết bạn" : "Đã hủy lời mời kết bạn",
        );
      } else if (result?.id === friend.id && result.status === "accepted") {
        setFriends((current) => [
          ...current.filter((item) => item.id !== friend.id),
          result,
        ]);
        setFriendRequests((current) =>
          current.filter((item) => item.id !== friend.id),
        );
        setNotice(`Đã kết bạn với ${label}`);
      } else if (result?.id === friend.id && result.status === "pending") {
        setFriendRequests((current) => [
          ...current.filter((item) => item.id !== friend.id),
          result,
        ]);
        setNotice(
          result.direction === "incoming"
            ? `${label} cũng đã gửi lời mời. Bạn có thể chấp nhận ngay.`
            : `Đã gửi lời mời kết bạn tới ${label}`,
        );
      } else {
        await refreshFriendConnections();
      }
    } catch {
      if (sessionRef.current?.sessionId === sessionId) {
        setNotice(
          "Không cập nhật được lời mời kết bạn. Kiểm tra kết nối rồi thử lại.",
        );
        await refreshFriendConnections();
      }
    } finally {
      if (sessionRef.current?.sessionId === sessionId) {
        friendActionRef.current.delete(friend.id);
        setFriendBusyIds((current) => {
          const next = new Set(current);
          next.delete(friend.id);
          return next;
        });
        setFriendActionBusy(
          friendActionRef.current.values().next().value ?? null,
        );
      }
    }
  }

  async function declineFriendRequest(friend: FriendConnection) {
    await actOnFriend(friend, true);
  }
  async function removeAcceptedFriend(friend: FriendSearchResult, options?: { keepProfileOpen?: boolean }) {
    const sessionId = session?.sessionId;
    if (
      !sessionId ||
      friendRelationship(friend.id) !== "accepted" ||
      friendActionRef.current.has(friend.id)
    )
      return;
    if (
      !window.confirm(
        `Hủy kết bạn với ${friend.displayName || "@" + friend.username}?`,
      )
    )
      return;
    friendActionRef.current.add(friend.id);
    setFriendBusyIds((current) => new Set(current).add(friend.id));
    setFriendActionBusy(friend.id);
    setFriendMenuId(null);
    try {
      const response = await removeFriendRequest(apiFetch, friend.id);
      const result = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (sessionRef.current?.sessionId !== sessionId) return;
      if (!response.ok) {
        setNotice(result?.error || "Không thể hủy kết bạn. Vui lòng thử lại.");
      } else {
        setFriends((current) =>
          current.filter((item) => item.id !== friend.id),
        );
        if (!options?.keepProfileOpen) setFriendPreview(null);
        setNotice("Đã hủy kết bạn");
      }
      await refreshFriendConnections();
    } catch {
      if (sessionRef.current?.sessionId === sessionId) {
        setNotice("Mạng gián đoạn. Đang đồng bộ lại danh sách bạn bè.");
        await refreshFriendConnections();
      }
    } finally {
      if (sessionRef.current?.sessionId === sessionId) {
        friendActionRef.current.delete(friend.id);
        setFriendBusyIds((current) => {
          const next = new Set(current);
          next.delete(friend.id);
          return next;
        });
        setFriendActionBusy(
          friendActionRef.current.values().next().value ?? null,
        );
      }
    }
  }

  return { actOnFriend, declineFriendRequest, removeAcceptedFriend };
}
