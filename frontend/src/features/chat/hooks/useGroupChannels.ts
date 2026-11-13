import type { Dispatch, RefObject, SetStateAction } from "react";
import { useLatest } from "../../../shared/hooks/useLatest";
import { useSession } from "../../../shared/context/SessionContext";
import { useApi } from "../../../shared/context/ApiContext";
import { useNotice } from "../../../shared/context/NoticeContext";
import { createGroupChannel as createGroupChannelRequest } from "../api/conversations";
import { listChannels } from "../api/community";
import { type GroupChannel, validGroupChannels } from "../utils/groupChannels";
import type { GroupMember, Message } from "../types";

export type UseGroupChannelsDeps = {
  activeChannelIdRef: RefObject<number>;
  activeConversation: { name: string; categoryId?: number; pinnedAt?: string; id: number; type: "direct" | "group"; blockedByMe?: boolean; blockedByOther?: boolean; otherUserId?: number; otherUsername?: string; memberCount: number; unreadCount: number; lastMessage: string; lastMessageAt?: string; online: boolean; createdAt: string; } | null;
  activeGroupMember: GroupMember | null;
  groupChannelBusy: boolean;
  groupChannels: GroupChannel[];
  messageScrollAtBottomRef: RefObject<boolean>;
  setChannelSelection: Dispatch<SetStateAction<{ conversationId: number | null; channelId: number; }>>;
  setChatSearchJump: Dispatch<SetStateAction<{ conversationId: number; messageId: number; revision: number; } | null>>;
  setConversationDetailsOpen: Dispatch<SetStateAction<boolean>>;
  setGroupChannelBusy: Dispatch<SetStateAction<boolean>>;
  setGroupChannelState: Dispatch<SetStateAction<{ conversationId: number | null; channels: GroupChannel[]; }>>;
  setHasMoreMessages: Dispatch<SetStateAction<boolean>>;
  setMessageActionId: Dispatch<SetStateAction<number | null>>;
  setMessageSearchOpen: Dispatch<SetStateAction<boolean>>;
  setMessages: Dispatch<SetStateAction<Message[]>>;
  setReplyingTo: Dispatch<SetStateAction<Message | null>>;
};

/** Switches the active channel of a group and creates new channels. */
export function useGroupChannels({
  activeChannelIdRef,
  activeConversation,
  activeGroupMember,
  groupChannelBusy,
  groupChannels,
  messageScrollAtBottomRef,
  setChannelSelection,
  setChatSearchJump,
  setConversationDetailsOpen,
  setGroupChannelBusy,
  setGroupChannelState,
  setHasMoreMessages,
  setMessageActionId,
  setMessageSearchOpen,
  setMessages,
  setReplyingTo,
}: UseGroupChannelsDeps) {
  const { apiFetch } = useApi();
  const { sessionRef } = useSession();
  const { setNotice } = useNotice();
  const activeConversationRef = useLatest(activeConversation);
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
    messageScrollAtBottomRef.current = true;
  }
  async function createGroupChannel(name: string, description: string): Promise<boolean> {
    if (activeConversation?.type !== 'group' || activeGroupMember?.role !== 'owner' || groupChannelBusy) return false;
    const groupId = activeConversation.id;
    const sessionId = sessionRef.current?.sessionId;
    setGroupChannelBusy(true);
    try {
      const response = await createGroupChannelRequest(apiFetch, groupId, { name, description });
      const data = await response.json().catch(() => null) as (GroupChannel & { error?: string }) | null;
      if (sessionRef.current?.sessionId !== sessionId || activeConversationRef.current?.id !== groupId) return false;
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
      if (sessionRef.current?.sessionId === sessionId && activeConversationRef.current?.id === groupId)
        setNotice(error instanceof Error ? error.message : 'Không tạo được kênh.', 'error');
      return false;
    } finally {
      if (sessionRef.current?.sessionId === sessionId) setGroupChannelBusy(false);
    }
  }

  async function refreshGroupChannels() {
    if (activeConversation?.type !== 'group') return;
    const groupId = activeConversation.id;
    const response = await listChannels(apiFetch, groupId);
    if (!response.ok) throw new Error('Không tải lại được danh sách kênh.');
    const items = validGroupChannels(await response.json() as unknown, groupId);
    setGroupChannelState({ conversationId: groupId, channels: items });
    if (!items.some(item => item.id === activeChannelIdRef.current)) selectGroupChannel(0);
  }

  return { createGroupChannel, selectGroupChannel, refreshGroupChannels };
}
