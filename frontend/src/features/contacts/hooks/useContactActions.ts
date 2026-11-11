import type { FriendSearchResult, FriendConnection } from "../types";
import { type Conversation } from "../../chat/types";
import { type Session } from "../../auth/lib/session";
import { type SetStateAction } from "react";
import { type ToastKind } from "../../notifications/utils/toast";
import type { Tab } from "../../../app/types";
import type { Dispatch, RefObject } from "react";

export type UseContactActionsDeps = {
  apiFetch: (path: string, init?: RequestInit) => Promise<Response>;
  blockedBusy: boolean;
  contactMetadata: Record<number, { nickname: string; note: string; favorite: boolean; }>;
  conversations: Conversation[];
  friendActionRef: RefObject<Set<number>>;
  friendBusyIds: Set<number>;
  friendRelationship: (userId: number) => "accepted" | "incoming" | "outgoing" | "none";
  friends: FriendConnection[];
  friendSyncRequest: RefObject<number>;
  openDirectByUsername: (username: string, mediaType?: "audio" | "video", onOpened?: (conversation: Conversation) => void) => Promise<void>;
  refreshConversations: () => Promise<void>;
  refreshFriendConnections: () => Promise<void>;
  session: Session | null;
  sessionRef: RefObject<Session | null>;
  setActiveConversationId: Dispatch<SetStateAction<number | null>>;
  setBlockedBusy: Dispatch<SetStateAction<boolean>>;
  setBlockedError: Dispatch<SetStateAction<string>>;
  setBlockedOpen: Dispatch<SetStateAction<boolean>>;
  setBlockedUsers: Dispatch<SetStateAction<{ id: number; username: string; displayName: string; }[]>>;
  setContactMetadata: Dispatch<SetStateAction<Record<number, { nickname: string; note: string; favorite: boolean; }>>>;
  setConversations: Dispatch<SetStateAction<Conversation[]>>;
  setDesktopSection: (next: "groups" | "calls" | null) => void;
  setFriendActionBusy: Dispatch<SetStateAction<number | null>>;
  setFriendBusyIds: Dispatch<SetStateAction<Set<number>>>;
  setFriendMenuId: Dispatch<SetStateAction<number | null>>;
  setFriendPreview: (friend: FriendSearchResult | null) => void;
  setFriendRequests: Dispatch<SetStateAction<FriendConnection[]>>;
  setFriendResults: Dispatch<SetStateAction<FriendSearchResult[]>>;
  setFriends: Dispatch<SetStateAction<FriendConnection[]>>;
  setNotice: (message: string, kind?: ToastKind) => void;
  setTab: (next: Tab) => void;
};

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
}: UseContactActionsDeps) {  async function actOnFriend(
    friend: FriendSearchResult | FriendConnection,
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
      const method = removing ? "DELETE" : "POST";
      const path = removing
        ? `/api/friends/${friend.id}?direction=${relationship}`
        : relationship === "incoming"
          ? `/api/friends/${friend.id}/accept`
          : `/api/friends/${friend.id}`;
      const response = await apiFetch(path, { method });
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
      const response = await apiFetch(`/api/contacts/${friend.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
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
      setFriendBusyIds((ids) => {
        const nextIDs = new Set(ids);
        nextIDs.delete(friend.id);
        return nextIDs;
      });
    }
  }
  async function blockContact(friend: Pick<FriendSearchResult, 'id' | 'username' | 'displayName'>) {
    const sid = session?.sessionId;
    if (!sid || friendBusyIds.has(friend.id)) return;
    if (
      !window.confirm(
        `Chặn @${friend.username}? Hai bạn sẽ không thể nhắn tin, gọi điện hoặc kết bạn với nhau.`,
      )
    )
      return;
    setFriendBusyIds((old) => new Set(old).add(friend.id));
    setFriendMenuId(null);
    try {
      const response = await apiFetch(`/api/users/${friend.id}/block`, {
        method: "POST",
      });
      const result = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (sessionRef.current?.sessionId !== sid) return;
      if (!response.ok) {
        setNotice(result?.error || "Không thể chặn người dùng.", "error");
        return;
      }
      // Blocking a contact must not remove an accepted friend from the directory.
      setFriends((old) => old.map((item) => item.id === friend.id
        ? { ...item, blockedByMe: true, online: false }
        : item));
      setFriendRequests((old) => old.filter((item) => item.id !== friend.id));
      setFriendResults((old) => old.filter((item) => item.id !== friend.id));
      setBlockedUsers((old) => [
        ...old.filter((item) => item.id !== friend.id),
        {
          id: friend.id,
          username: friend.username,
          displayName: friend.displayName,
        },
      ]);
      setFriendPreview(null);
      setConversations((old) =>
        old.map((item) => item.type === 'direct' && item.otherUserId === friend.id
          ? { ...item, blockedByMe: true, online: false }
          : item),
      );
      window.dispatchEvent(new Event('chatnet:privacy-updated'));
      setNotice(`Đã chặn @${friend.username}.`);
      await refreshFriendConnections();
      void refreshConversations();
    } catch {
      if (sessionRef.current?.sessionId === sid)
        setNotice("Không thể chặn người dùng. Hãy thử lại.", "error");
    } finally {
      setFriendBusyIds((old) => {
        const next = new Set(old);
        next.delete(friend.id);
        return next;
      });
    }
  }
  async function reportContact(friend: FriendSearchResult | FriendConnection) {
    const sid = session?.sessionId;
    if (!sid) return;
    const answer = window.prompt(
      "Lý do báo cáo: 1 - Spam, 2 - Quấy rối, 3 - Giả mạo, 4 - Khác",
    );
    if (answer === null) return;
    const reason = (
      {
        "1": "spam",
        "2": "harassment",
        "3": "impersonation",
        "4": "other",
      } as Record<string, string>
    )[answer.trim()];
    if (!reason) {
      setNotice("Vui lòng chọn lý do từ 1 đến 4.", "warning");
      return;
    }
    const details = window.prompt(
      "Mô tả sự việc (không quá 1000 ký tự, có thể để trống):",
    );
    if (details === null) return;
    if (details.length > 1000) {
      setNotice("Mô tả không được quá 1000 ký tự.", "warning");
      return;
    }
    setFriendMenuId(null);
    try {
      const response = await apiFetch(`/api/users/${friend.id}/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason, details: details.trim() }),
      });
      const result = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (sessionRef.current?.sessionId !== sid) return;
      setNotice(
        response.ok
          ? "Đã gửi báo cáo. Cảm ơn bạn."
          : result?.error || "Không thể gửi báo cáo.",
        response.ok ? "success" : "error",
      );
    } catch {
      if (sessionRef.current?.sessionId === sid)
        setNotice("Không thể gửi báo cáo. Hãy thử lại.", "error");
    }
  }
  async function loadBlockedUsers() {
    const sid = session?.sessionId;
    if (!sid || blockedBusy) return;
    setBlockedBusy(true);
    setBlockedError("");
    try {
      const response = await apiFetch("/api/users/blocked");
      if (!response.ok) throw new Error();
      const data = (await response.json()) as Array<{
        id: number;
        username: string;
        displayName: string;
      }>;
      if (sessionRef.current?.sessionId === sid) {
        setBlockedUsers(data);
        setBlockedOpen(true);
      }
    } catch {
      if (sessionRef.current?.sessionId === sid)
        setBlockedError("Không tải được danh sách chặn.");
    } finally {
      if (sessionRef.current?.sessionId === sid) setBlockedBusy(false);
    }
  }
  async function unblockContact(userId: number) {
    const sid = session?.sessionId;
    if (!sid || blockedBusy || !window.confirm("Bỏ chặn người dùng này?"))
      return;
    setBlockedBusy(true);
    setBlockedError("");
    try {
      const response = await apiFetch(`/api/users/${userId}/block`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error();
      if (sessionRef.current?.sessionId === sid) {
        setBlockedUsers((old) => old.filter((item) => item.id !== userId));
        setFriends((old) => old.map((item) => item.id === userId
          ? { ...item, blockedByMe: false }
          : item));
        void refreshFriendConnections();
        setConversations((old) => old.map((item) =>
          item.type === 'direct' && item.otherUserId === userId
            ? { ...item, blockedByMe: false }
            : item));
        window.dispatchEvent(new Event('chatnet:privacy-updated'));
        void refreshConversations();
        setNotice("Đã bỏ chặn người dùng.");
      }
    } catch {
      if (sessionRef.current?.sessionId === sid)
        setBlockedError("Không thể bỏ chặn. Hãy thử lại.");
    } finally {
      if (sessionRef.current?.sessionId === sid) setBlockedBusy(false);
    }
  }
  async function declineFriendRequest(friend: FriendConnection) {
    await actOnFriend(friend, true);
  }
  async function removeAcceptedFriend(friend: FriendConnection) {
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
      const response = await apiFetch(
        `/api/friends/${friend.id}?direction=accepted`,
        { method: "DELETE" },
      );
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
        setFriendPreview(null);
        setNotice("Đã hủy kết bạn");
      }
      await refreshFriendConnections();
    } catch {
      if (sessionRef.current?.sessionId === sessionId) {
        setNotice("Mạng gián đoạn. Đang đồng bộ lại danh sách bạn bè.");
        await refreshFriendConnections();
      }
    } finally {
      friendActionRef.current.delete(friend.id);
      if (sessionRef.current?.sessionId === sessionId) {
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
  async function openBlockedFriendConversation(userId: number) {
    let direct = conversations.find((item) => item.type === 'direct' && item.otherUserId === userId);
    if (!direct) {
      const username = friends.find((item) => item.id === userId)?.username;
      if (username) {
        try {
          // The chat may be on a later page of the paginated conversation list.
          const response = await apiFetch(`/api/conversations?type=direct&q=${encodeURIComponent(username)}&limit=100`, { cache: 'no-store' });
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
    actOnFriend,
    blockContact,
    changePersonalContact,
    declineFriendRequest,
    loadBlockedUsers,
    openBlockedFriendConversation,
    removeAcceptedFriend,
    reportContact,
    unblockContact,
  };
}
