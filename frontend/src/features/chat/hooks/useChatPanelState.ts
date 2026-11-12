import { useState } from "react";
import { useScopedState } from "../../../shared/hooks/useScopedState";
import { type GroupChannel } from "../utils/groupChannels";
import { type Message } from "../types";
import { type GroupActivityKind } from "../components/GroupActivities";

export type UseChatPanelStateDeps = {
  activeConversationId: number | null;
};

export function useChatPanelState({
  activeConversationId,
}: UseChatPanelStateDeps) {
  const [channelSelection, setChannelSelection] = useState<{ conversationId: number | null; channelId: number }>({ conversationId: null, channelId: 0 });
  const selectedChannelId = channelSelection.conversationId === activeConversationId ? channelSelection.channelId : 0;
  // UI state below belongs to one conversation (or one channel of it) and starts fresh when it changes.
  const conversationScope = activeConversationId;
  const channelScope = `${activeConversationId ?? 0}:${selectedChannelId}`;
  const [groupMemberViewOpen, setGroupMemberViewOpen] = useScopedState(conversationScope, false);
  const [groupChannelState, setGroupChannelState] = useState<{ conversationId: number | null; channels: GroupChannel[] }>({ conversationId: null, channels: [] });
  const [groupChannelBusy, setGroupChannelBusy] = useState(false);
  const [replyingTo, setReplyingTo] = useScopedState<Message | null>(channelScope, null);
  const [messageActionId, setMessageActionId] = useScopedState<number | null>(channelScope, null);
  const [messageActionMode, setMessageActionMode] = useState<'reactions' | 'actions'>('actions');
  const [conversationActionId, setConversationActionId] = useScopedState<number | null>(conversationScope, null);
  const [conversationMenuPosition, setConversationMenuPosition] = useState<{ x: number; y: number } | null>(null);
  const [pinnedExpanded, setPinnedExpanded] = useScopedState(conversationScope, false);
  const [groupActivityCreateKind, setGroupActivityCreateKind] = useScopedState<GroupActivityKind | null>(conversationScope, null);
  const [groupActivityViewedId, setGroupActivityViewedId] = useScopedState<number | null>(conversationScope, null);
  const [sharedContentOpen, setSharedContentOpen] = useScopedState(channelScope, false);
  const [messageSearchOpen, setMessageSearchOpen] = useScopedState(channelScope, false);
  const [conversationDetailsOpen, setConversationDetailsOpen] = useScopedState(conversationScope, false);
  const [historyActionBusy, setHistoryActionBusy] = useState(false);

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
