import type { FriendConnection, FriendSearchResult } from "../types";
import type { UseContactActionsDeps } from "./useContactActions";

type UseContactModerationDeps = Pick<UseContactActionsDeps,
  | "apiFetch"
  | "blockedBusy"
  | "friendBusyIds"
  | "refreshConversations"
  | "refreshFriendConnections"
  | "session"
  | "sessionRef"
  | "setBlockedBusy"
  | "setBlockedError"
  | "setBlockedOpen"
  | "setBlockedUsers"
  | "setConversations"
  | "setFriendBusyIds"
  | "setFriendMenuId"
  | "setFriendPreview"
  | "setFriendRequests"
  | "setFriendResults"
  | "setFriends"
  | "setNotice"
>;

export function useContactModeration({
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
}: UseContactModerationDeps) {
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
      if (sessionRef.current?.sessionId === sid) {
        setFriendBusyIds((old) => {
          const next = new Set(old);
          next.delete(friend.id);
          return next;
        });
      }
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

  return { blockContact, loadBlockedUsers, reportContact, unblockContact };
}
