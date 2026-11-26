import { updateContactMetadata } from "../api/contacts";
import type { FriendConnection } from "../types";
import type { UseContactActionsDeps } from "./contactActionTypes";

type MetadataDeps = Pick<UseContactActionsDeps,
  "apiFetch" | "contactMetadata" | "friendBusyIds" | "session" | "sessionRef" |
  "setContactMetadata" | "setFriendBusyIds" | "setFriendMenuId" | "setNotice"
>;

/** Owns personal contact metadata mutations independently of friend moderation. */
export function createContactMetadataActions({
  apiFetch, contactMetadata, friendBusyIds, session, sessionRef,
  setContactMetadata, setFriendBusyIds, setFriendMenuId, setNotice,
}: MetadataDeps) {
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
  return { changePersonalContact };
}
