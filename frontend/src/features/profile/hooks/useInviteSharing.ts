import { useSession } from "../../../shared/context/SessionContext";
import { useNotice } from "../../../shared/context/NoticeContext";
import { type SetStateAction } from "react";
import { type NewChatMode } from "../../chat/types";
import type { Tab } from "../../../shared/types/navigation";
import type { Dispatch } from "react";

export type UseInviteSharingDeps = {
  setActiveConversationId: Dispatch<SetStateAction<number | null>>;
  setFriendQuery: Dispatch<SetStateAction<string>>;
  setNewChatMode: Dispatch<SetStateAction<NewChatMode>>;
  setQuickCreateOpen: Dispatch<SetStateAction<boolean>>;
  setTab: Dispatch<SetStateAction<Tab>>;
};

export function useInviteSharing({
  setActiveConversationId,
  setFriendQuery,
  setNewChatMode,
  setQuickCreateOpen,
  setTab,
}: UseInviteSharingDeps) {
  const { session } = useSession();
  const { setNotice } = useNotice();
  function connectUrl(username = session?.user.username || "") {
    const url = new URL(window.location.href);
    url.hash = "";
    url.search = "";
    if (username) url.searchParams.set("connect", username);
    return url.toString();
  }
  function openConnectSurface(query = "") {
    setTab("chat");
    setActiveConversationId(null);
    setQuickCreateOpen(false);
    setNewChatMode("friends");
    if (query) setFriendQuery(query.replace(/^@/, "").trim());
  }
  async function shareMyProfile() {
    if (!session?.user.username) return;
    const url = connectUrl(session.user.username);
    const shareData = {
      title: `Kết nối với @${session.user.username} trên SocCO`,
      text: `Kết nối với ${session.user.displayName || "@" + session.user.username} trên SocCO`,
      url,
    };
    try {
      if (typeof navigator.share === "function") {
        await navigator.share(shareData);
        return;
      }
      await navigator.clipboard.writeText(url);
      setNotice("Đã sao chép link hồ sơ SocCO.", "success");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setNotice("Không thể chia sẻ hồ sơ trên thiết bị này.", "error");
    }
  }
  async function copyInviteLink() {
    if (!session?.user.username) return;
    try {
      await navigator.clipboard.writeText(connectUrl(session.user.username));
      setNotice("Đã sao chép link kết nối SocCO.", "success");
    } catch {
      setNotice("Không sao chép được link trên trình duyệt này.", "error");
    }
  }

  return {
    connectUrl,
    copyInviteLink,
    openConnectSurface,
    shareMyProfile,
  };
}
