import { type GroupChannel, validGroupChannels } from "../utils/groupChannels";
import { type Conversation, type GroupMember, type Message, type NewChatMode } from "../types";
import { FormEvent, type SetStateAction } from "react";
import { type CommunityCreationExtras } from "../components/CommunityGroupWizard";
import { SessionResponseCache } from "../../../shared/lib/sessionCache";
import { type Session } from "../../auth/lib/session";
import type { FriendSearchResult } from "../../contacts/types";
import { type ToastKind } from "../../notifications/utils/toast";
import type { Tab } from "../../../app/types";
import type { Dispatch, RefObject } from "react";

export type UseConversationActionsDeps = {
  actionLocks: RefObject<Set<string>>;
  activeChannelIdRef: RefObject<number>;
  activeConversation: { name: string; categoryId?: number; pinnedAt?: string; id: number; type: "direct" | "group"; blockedByMe?: boolean; blockedByOther?: boolean; otherUserId?: number; otherUsername?: string; memberCount: number; unreadCount: number; lastMessage: string; lastMessageAt?: string; online: boolean; createdAt: string; } | null;
  activeConversationId: number | null;
  activeConversationIdRef: RefObject<number | null>;
  activeGroupMember: GroupMember | null;
  apiFetch: (path: string, init?: RequestInit) => Promise<Response>;
  conversations: Conversation[];
  directUsername: string;
  groupChannelBusy: boolean;
  groupChannels: GroupChannel[];
  historyActionBusy: boolean;
  membershipEventSequence: RefObject<number>;
  membershipSnapshot: RefObject<Set<number> | null>;
  messageScrollAtBottom: RefObject<boolean>;
  refreshConversations: () => Promise<void>;
  responseCache: RefObject<SessionResponseCache>;
  revokedConversationIds: RefObject<Set<number>>;
  session: Session | null;
  sessionRef: RefObject<Session | null>;
  setActiveConversationId: Dispatch<SetStateAction<number | null>>;
  setChannelSelection: Dispatch<SetStateAction<{ conversationId: number | null; channelId: number; }>>;
  setChatCreateError: Dispatch<SetStateAction<string>>;
  setChatSearchJump: Dispatch<SetStateAction<{ conversationId: number; messageId: number; revision: number; } | null>>;
  setConversationDetailsOpen: Dispatch<SetStateAction<boolean>>;
  setConversations: Dispatch<SetStateAction<Conversation[]>>;
  setDesktopSection: Dispatch<SetStateAction<"groups" | "calls" | null>>;
  setDirectUsername: Dispatch<SetStateAction<string>>;
  setFriendQuery: Dispatch<SetStateAction<string>>;
  setFriendResults: Dispatch<SetStateAction<FriendSearchResult[]>>;
  setGlobalSearch: Dispatch<SetStateAction<string>>;
  setGroupChannelBusy: Dispatch<SetStateAction<boolean>>;
  setGroupChannelState: Dispatch<SetStateAction<{ conversationId: number | null; channels: GroupChannel[]; }>>;
  setHasMoreMessages: Dispatch<SetStateAction<boolean>>;
  setHistoryActionBusy: Dispatch<SetStateAction<boolean>>;
  setMessageActionId: Dispatch<SetStateAction<number | null>>;
  setMessages: Dispatch<SetStateAction<Message[]>>;
  setMessageSearchOpen: Dispatch<SetStateAction<boolean>>;
  setNewChatMode: Dispatch<SetStateAction<NewChatMode>>;
  setNotice: (message: string, kind?: ToastKind) => void;
  setReplyingTo: Dispatch<SetStateAction<Message | null>>;
  setSharedContentOpen: Dispatch<SetStateAction<boolean>>;
  setTab: Dispatch<SetStateAction<Tab>>;
  setTranslations: Dispatch<SetStateAction<Record<number, string>>>;
};

export function useConversationActions({
  actionLocks,
  activeChannelIdRef,
  activeConversation,
  activeConversationId,
  activeConversationIdRef,
  activeGroupMember,
  apiFetch,
  conversations,
  directUsername,
  groupChannelBusy,
  groupChannels,
  historyActionBusy,
  membershipEventSequence,
  membershipSnapshot,
  messageScrollAtBottom,
  refreshConversations,
  responseCache,
  revokedConversationIds,
  session,
  sessionRef,
  setActiveConversationId,
  setChannelSelection,
  setChatCreateError,
  setChatSearchJump,
  setConversationDetailsOpen,
  setConversations,
  setDesktopSection,
  setDirectUsername,
  setFriendQuery,
  setFriendResults,
  setGlobalSearch,
  setGroupChannelBusy,
  setGroupChannelState,
  setHasMoreMessages,
  setHistoryActionBusy,
  setMessageActionId,
  setMessages,
  setMessageSearchOpen,
  setNewChatMode,
  setNotice,
  setReplyingTo,
  setSharedContentOpen,
  setTab,
  setTranslations,
}: UseConversationActionsDeps) {
  async function clearActiveConversationHistory() {
    const current = conversations.find((item) => item.id === activeConversationId)
    const sessionId = sessionRef.current?.sessionId
    if (!current || !sessionId || historyActionBusy) return
    if (!window.confirm(`Xóa lịch sử trò chuyện với ${current.name} trên tài khoản của bạn?\nNgười khác vẫn giữ lịch sử của họ. Bạn không thể khôi phục các tin nhắn cũ sau thao tác này.`)) return
    setHistoryActionBusy(true)
    try {
      const response = await apiFetch(`/api/conversations/${current.id}/history`, { method: 'DELETE' })
      if (!response.ok) {
        const data = await response.json().catch(() => null) as { error?: string } | null
        throw new Error(data?.error || 'Không xóa được lịch sử trò chuyện.')
      }
      if (sessionRef.current?.sessionId !== sessionId) return
      responseCache.current.invalidate(['conversations', 'messages'])
      if (activeConversationIdRef.current === current.id) {
        setActiveConversationId(null)
        setMessages([])
        setHasMoreMessages(false)
        setTranslations({})
        setReplyingTo(null)
        setSharedContentOpen(false)
        setMessageSearchOpen(false)
        setConversationDetailsOpen(false)
      }
      setNotice('Đã xóa lịch sử trò chuyện khỏi tài khoản của bạn.', 'success')
      void refreshConversations()
    } catch (error) {
      if (sessionRef.current?.sessionId === sessionId) setNotice(error instanceof Error ? error.message : 'Không xóa được lịch sử trò chuyện.', 'error')
    } finally {
      setHistoryActionBusy(false)
    }
  }
  function selectGroupChannel(channelId: number) {
    if (activeConversation?.type !== 'group' || !groupChannels.some(channel => channel.id === channelId)) return;
    activeChannelIdRef.current = channelId;
    setChannelSelection({ conversationId: activeConversation.id, channelId });
    setMessages([]);
    setHasMoreMessages(false);
    setChatSearchJump(null);
    setReplyingTo(null);
    setMessageActionId(null);
    setConversationDetailsOpen(false);
    setMessageSearchOpen(false);
    messageScrollAtBottom.current = true;
  }
  async function createGroupChannel(name: string, description: string): Promise<boolean> {
    if (activeConversation?.type !== 'group' || activeGroupMember?.role !== 'owner' || groupChannelBusy) return false;
    const groupId = activeConversation.id;
    setGroupChannelBusy(true);
    try {
      const response = await apiFetch(`/api/conversations/${groupId}/channels`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description }),
      });
      const data = await response.json().catch(() => null) as (GroupChannel & { error?: string }) | null;
      if (!response.ok || !data?.id || data.conversationId !== groupId)
        throw new Error(data?.error || 'Không tạo được kênh hội thoại.');
      setGroupChannelState(current => ({
        conversationId: groupId,
        channels: validGroupChannels([...(
          current.conversationId === groupId ? current.channels : []
        ), data], groupId),
      }));
      activeChannelIdRef.current = data.id;
      setChannelSelection({ conversationId: groupId, channelId: data.id });
      setMessages([]);
      setHasMoreMessages(false);
      setReplyingTo(null);
      setChatSearchJump(null);
      setNotice('Đã tạo kênh hội thoại ' + data.name + '.', 'success');
      return true;
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Không tạo được kênh.', 'error');
      return false;
    } finally {
      setGroupChannelBusy(false);
    }
  }
  async function openDirectByUsername(username: string, mediaType?: "audio" | "video", onOpened?: (conversation: Conversation) => void) {
    setChatCreateError("");
    const normalized = username.trim().toLowerCase();
    if (!normalized || actionLocks.current.has("chat:create")) return;
    const sessionId = session?.sessionId;
    actionLocks.current.add("chat:create");
    try {
      const response = await apiFetch("/api/conversations/direct", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: normalized }),
      });
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
      membershipEventSequence.current += 1;
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
  async function createGroup(name: string, usernames: string[], extras?: CommunityCreationExtras): Promise<number | null> {
    if (actionLocks.current.has("chat:create")) return null;
    actionLocks.current.add("chat:create");
    setChatCreateError("");
    const sessionId = session?.sessionId;
    try {
      const response = await apiFetch("/api/conversations/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, usernames, ...extras }),
      });
      const result = await response.json();
      if (sessionRef.current?.sessionId !== sessionId) return null;
      if (!response.ok || !Number.isSafeInteger(result?.id) || result.id <= 0) {
        setChatCreateError(result?.error || "Không thể tạo nhóm");
        return null;
      }
      const created = result as Conversation;
      membershipSnapshot.current?.add(created.id);
      revokedConversationIds.current.delete(created.id);
      membershipEventSequence.current += 1;
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

  return {
    clearActiveConversationHistory,
    createDirect,
    createGroup,
    createGroupChannel,
    openDirectByUsername,
    selectGroupChannel,
  };
}
