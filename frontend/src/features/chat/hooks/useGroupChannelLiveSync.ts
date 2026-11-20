import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { useLatest } from "../../../shared/hooks/useLatest";
import type { Conversation, Message } from "../types";
import { totalGroupChannelUnread, validGroupChannels, type GroupChannel } from "../utils/groupChannels";

type ChannelState = { conversationId: number | null; channels: GroupChannel[] };
type ChannelSelection = { conversationId: number | null; channelId: number };

/**
 * Own the group-channel subscription, request ordering and unread aggregation.
 * The app shell supplies shared data setters but does not subscribe to chat events.
 */
export function useGroupChannelLiveSync({
  groupConversationId,
  sessionToken,
  request,
  setGroupChannelState,
  setChannelSelection,
  setConversations,
  setNotice,
}: {
  groupConversationId: number | null;
  sessionToken: string | null;
  request: (path: string, init?: RequestInit) => Promise<Response>;
  setGroupChannelState: Dispatch<SetStateAction<ChannelState>>;
  setChannelSelection: Dispatch<SetStateAction<ChannelSelection>>;
  setConversations: Dispatch<SetStateAction<Conversation[]>>;
  setNotice: (message: string, kind?: "info" | "success" | "warning" | "error") => void;
}) {
  // Listen only when the active group/session changes. Keep callbacks fresh
  // without refetching whenever the app shell renders for an unrelated reason.
  const handlers = useLatest({ request, setGroupChannelState, setChannelSelection, setConversations, setNotice });
  const [unreadStatus, setUnreadStatus] = useState<{ conversationId: number; available: boolean } | null>(null);
  const unreadAvailable = unreadStatus?.conversationId === groupConversationId ? unreadStatus.available : true;

  useEffect(() => {
    const id = groupConversationId;
    handlers.current.setGroupChannelState({
      conversationId: id,
      channels: validGroupChannels([], id ?? 0),
    });
    if (!id || !sessionToken) return;

    let activeRequest: AbortController | null = null;
    const reload = async () => {
      activeRequest?.abort();
      const controller = new AbortController();
      activeRequest = controller;
      try {
        const response = await handlers.current.request(`/api/conversations/${id}/channels`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Không tải được kênh hội thoại.");
        const raw: unknown = await response.json();
        const channels = validGroupChannels(raw, id);
        if (controller.signal.aborted) return;

        const unreadAvailable = Array.isArray(raw) && raw.every(
          channel => typeof channel.unreadCount === "number" && Number.isFinite(channel.unreadCount),
        );
        setUnreadStatus({ conversationId: id, available: unreadAvailable });
        handlers.current.setGroupChannelState({ conversationId: id, channels });

        // Do not overwrite the server's unread badge when metadata is absent.
        if (unreadAvailable) {
          const totalUnread = totalGroupChannelUnread(channels);
          handlers.current.setConversations(current => current.map(conversation =>
            conversation.id === id && conversation.type === "group" && conversation.unreadCount !== totalUnread
              ? { ...conversation, unreadCount: totalUnread }
              : conversation,
          ));
        }
        handlers.current.setChannelSelection(current =>
          current.conversationId === id && !channels.some(channel => channel.id === current.channelId)
            ? { conversationId: id, channelId: 0 }
            : current,
        );
      } catch {
        if (!controller.signal.aborted) handlers.current.setNotice("Không tải được kênh hội thoại.", "warning");
      }
    };

    void reload();
    const onUpdate = (event: Event) => {
      const detail = (event as CustomEvent<{ conversationId: number }>).detail;
      if (detail?.conversationId === id) void reload();
    };
    const onChannelEvent = (event: Event) => {
      const detail = (event as CustomEvent<{ message?: Message }>).detail;
      if (detail?.message?.conversationId === id) void reload();
    };
    const onChannelRead = (event: Event) => {
      const detail = (event as CustomEvent<{ conversationId: number; channelId: number }>).detail;
      if (detail?.conversationId !== id) return;
      handlers.current.setGroupChannelState(current => current.conversationId !== id ? current : {
        ...current,
        channels: current.channels.map(channel => channel.id === detail.channelId
          ? { ...channel, unreadCount: 0 } : channel),
      });
      // Acknowledge only the opened channel, then recalculate the group's badge.
      void reload();
    };

    window.addEventListener("chatnet:group-community-updated", onUpdate);
    window.addEventListener("chatnet:group-channel-event", onChannelEvent);
    window.addEventListener("chatnet:channel-read", onChannelRead);
    return () => {
      activeRequest?.abort();
      window.removeEventListener("chatnet:group-community-updated", onUpdate);
      window.removeEventListener("chatnet:group-channel-event", onChannelEvent);
      window.removeEventListener("chatnet:channel-read", onChannelRead);
    };
  }, [groupConversationId, sessionToken, handlers]);

  return { groupChannelUnreadAvailable: unreadAvailable };
}
