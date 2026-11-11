import { useState, useEffect } from "react";
import { type GroupChannel } from "../utils/groupChannels";
import { type Message } from "../types";
import { type GroupActivityKind } from "../components/GroupActivities";

export type UseChatPanelStateDeps = {
  activeConversationId: number | null;
};

export function useChatPanelState({
  activeConversationId,
}: UseChatPanelStateDeps) {  const [groupMemberViewOpen, setGroupMemberViewOpen] = useState(false);
  const [channelSelection, setChannelSelection] = useState<{ conversationId: number | null; channelId: number }>({ conversationId: null, channelId: 0 });
  const [groupChannelState, setGroupChannelState] = useState<{ conversationId: number | null; channels: GroupChannel[] }>({ conversationId: null, channels: [] });
  const [groupChannelBusy, setGroupChannelBusy] = useState(false);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [messageActionId, setMessageActionId] = useState<number | null>(null);
  const [messageActionMode, setMessageActionMode] = useState<'reactions' | 'actions'>('actions');
  const [conversationActionId, setConversationActionId] = useState<number | null>(null);
  const [conversationMenuPosition, setConversationMenuPosition] = useState<{ x: number; y: number } | null>(null);
  const [pinnedExpanded, setPinnedExpanded] = useState(false);
  const [groupActivityCreateKind, setGroupActivityCreateKind] = useState<GroupActivityKind | null>(null);
  const [groupActivityViewedId, setGroupActivityViewedId] = useState<number | null>(null);
  useEffect(() => {
    setGroupActivityCreateKind(null);
    setGroupActivityViewedId(null);
  }, [activeConversationId]);
  const [sharedContentOpen, setSharedContentOpen] = useState(false);
  const [messageSearchOpen, setMessageSearchOpen] = useState(false);
  const [conversationDetailsOpen, setConversationDetailsOpen] = useState(false);
  const [historyActionBusy, setHistoryActionBusy] = useState(false);
  useEffect(() => {
    setMessageSearchOpen(false);
    setConversationDetailsOpen(false);
  }, [activeConversationId]);

  return {
    channelSelection,
    conversationActionId,
    conversationDetailsOpen,
    conversationMenuPosition,
    groupActivityCreateKind,
    groupActivityViewedId,
    groupChannelBusy,
    groupChannelState,
    groupMemberViewOpen,
    historyActionBusy,
    messageActionId,
    messageActionMode,
    messageSearchOpen,
    pinnedExpanded,
    replyingTo,
    setChannelSelection,
    setConversationActionId,
    setConversationDetailsOpen,
    setConversationMenuPosition,
    setGroupActivityCreateKind,
    setGroupActivityViewedId,
    setGroupChannelBusy,
    setGroupChannelState,
    setGroupMemberViewOpen,
    setHistoryActionBusy,
    setMessageActionId,
    setMessageActionMode,
    setMessageSearchOpen,
    setPinnedExpanded,
    setReplyingTo,
    setSharedContentOpen,
    sharedContentOpen,
  };
}
