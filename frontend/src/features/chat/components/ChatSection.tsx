import { Plus, Search, Pin, RefreshCw, Images, Users, Languages, MoreHorizontal, X, UserPlus, Check, SmilePlus, LoaderCircle, Ban, Hash, CornerUpLeft, Forward, ShieldAlert } from "lucide-react";
import UiIcon from "../../../shared/ui/UiIcon";
import UserAvatar from "../../../shared/ui/UserAvatar";
import { useScopedState } from "../../../shared/hooks/useScopedState";
import ConversationAvatar from "./ConversationAvatar";
import { userLabel } from "../../../shared/utils/userLabel";
import ConversationCategories, { CategoryBadge, CategoryAssignment } from "./ConversationCategories";
import { SocoEmptyState, SocoTextAction } from "../../../shared/ui/SocoUI";
import { formatTime, attachmentLabel } from "../../../shared/utils/format";
import { transferHasFiles, chatFilesFromClipboard } from "../utils/chatFileTransfer";
import GroupChannelSidebar from "./GroupChannelSidebar";
import ConversationAvatarRail, { type ConversationRailProps } from "./ConversationAvatarRail";
import ConversationRailControls from "./ConversationRailControls";
import DesktopConversationRail from "./DesktopConversationRail";
import { CallHeaderActions } from "../../calls";
import { createPortal } from "react-dom";
import SharedContent from "./SharedContent";
import MessageSearchPanel from "./MessageSearchPanel";
import MessageReadersDialog from "./MessageReadersDialog";
import { getMessageTranslationView } from "../utils/messageTranslationPresentation";
import { messageReactionLabel } from "../utils/messageReactions";
import { Fragment, FormEvent, useEffect, useLayoutEffect, useMemo, useRef, useState, type SetStateAction } from "react";
import { GroupActivityMarker, type GroupActivityKind } from "./GroupActivities";
import { messageTextParts, messageLinkHref } from "../lib/messageClipboard";
import LinkPreview from "./LinkPreview";
import MediaAttachmentsView from "../../../shared/ui/MediaAttachmentsView";
import { isDesktopBuild } from "../../../platform/desktop";
import VoiceRecorder from "./VoiceRecorder";
import { shouldSendChatOnEnter } from "../utils/composerKeyboard";
import ConversationDetailsPanel from "./ConversationDetailsPanel";
import GroupSettingsPanel, { type GroupManagementSection } from "./GroupSettingsPanel";
import type { GroupPhotoTarget } from "./GroupAvatarEditor";
import { type ChatTranslationSettings } from "../lib/conversationTranslationSettings";
import { type ConversationEncryptionMode, type GroupMember, type Message, type Conversation, type NewChatMode, type MessageReaction } from "../types";
import type { FriendSearchResult, FriendConnection } from "../../contacts";
import { type QueuedChatMessage } from "../lib/chatOutbox";
import { type GroupChannel } from "../utils/groupChannels";
import { attachmentRequestBody, type MediaAttachment } from "../../../shared/utils/media";
import { type Session } from "../../../shared/types/session";
import { type ToastKind } from "../../../shared/utils/toast";
import type { Tab } from "../../../shared/types/navigation";
import { UI_MESSAGES } from "../../i18n";
import type { ConversationCategory } from "../hooks/useConversationCategories";
import type { GroupActivity } from "./GroupActivities";
import type { GroupActivityEvent } from "./GroupActivities";
import type { LanguageOption } from "../../i18n";
import type { Dispatch, RefObject, ReactNode } from "react";
import { getGroupAvatarCapability, saveGroupAvatar } from "../api/avatar";
import "../styles/chat-frame-unified.css";
import "../styles/mobile-chat-navigation.css";
import ConversationList from "./ConversationList";
import MessageComposer from "./MessageComposer";
import E2EEPilotGate from "./E2EEPilotGate";
import ConversationHeader from "./ConversationHeader";
import MessageTimeline from "./MessageTimeline";
import PinnedItemsPanel from "./PinnedItemsPanel";
import type { ChatSectionProps } from "./ChatSectionProps";
import { useChatDragSurface } from "../hooks/useChatDragSurface";
import { useChatSectionPanels } from "../hooks/useChatSectionPanels";
import { useMessageLongPress } from "../hooks/useMessageLongPress";
import useSlidingPill from "../../../shared/ui/useSlidingPill";

export type { ChatSectionProps } from "./ChatSectionProps";


export default function ChatSection({
  notificationBusyId,
  toggleConversationNotifications,
  activeChatTranslationSettings,
  activeConversation,
  activeConversationId,
  activeConversationIdRef,
  activeGroupMember,
  actOnFriend,
  addChatFiles,
  uploadMediaFiles,
  apiFetch,
  blockContact,
  blockedBusy,
  bottomRef,
  canEditGroup,
  canInviteActiveGroup,
  canManageActiveGroup,
  canSend,
  canSendLike,
  changeAutoTranslate,
  changeGroupMemberRole,
  changeTargetLanguage,
  chatCreateError,
  chatFriend,
  chatFriendRelationship,
  prefetchConversation,
  allChatConversations,
  chatListConversations,
  chatListFilter,
  chatListQuery,
  chatOnline,
  chatOutbox,
  nextChatSearchJumpRevision,
  clearActiveConversationHistory,
  conversationBlocked,
  conversationCategories,
  conversationDetailsOpen,
  conversationListSearch,
  conversationLoadingMore,
  conversationListError,
  refreshConversations,
  onContactSaved,
  copyInviteLink,
  createDirect,
  createGroupChannel,
  refreshGroupChannels,
  directUsername,
  effectiveAutoTranslate,
  effectiveTargetLanguage,
  friendBusyIds,
  friendQuery,
  friendRelationship,
  friendResults,
  friends,
  friendSearchError,
  friendSearching,
  friendSyncBusy,
  friendSyncError,
  friendSyncSessionId,
  groupActivities,
  groupBusy,
  groupChannelBusy,
  groupChannels,
  groupChannelUnreadAvailable,
  groupInviteCandidates,
  groupInviteSearch,
  groupInviteSelection,
  groupMembers,
  groupSettingsOpen,
  groupMemberViewOpen,
  hasMoreConversations,
  hasMoreMessages,
  historyActionBusy,
  inviteGroupMembers,
  isProfileDesktop,
  languageOptions,
  languageSearch,
  loadMissingMessages,
  loadMoreConversations,
  loadOlderMessages,
  manuallyTranslated,
  mediaUploading,
  messageAttachments,
  messageGapBefore,
  messageGapLoading,
  messageInputRef,
  setMessageScrollAtBottom,
  messageSearchOpen,
  messageSending,
  messagesLoadingMore,
  messageHistoryLoading,
  unreadMessageId,
  messageHistoryError,
  retryMessageHistory,
  messagesScrollRef,
  chatScrollRefs,
  outgoingMessage,
  messageText,
  newChatMode,
  openConnectSurface,
  openGroupSettings,
  onReactionUsers,
  onForwardMessage,
  openVisitor,
  pinBusy,
  pinnedItems,
  quickSearchControl,
  reactionPreviews,
  refreshFriendConnections,
  refreshGroupMembers,
  removeGroupMember,
  replyingTo,
  retryQueuedChatMessages,
  searchInConversationList,
  selectedChannelId,
  selectGroupChannel,
  sendMessage,
  sendLike,
  session,
  setActiveConversationId,
  setChatCreateError,
  setChatListFilter,
  setChatListQuery,
  setChatSearchJump,
  setConversationActionId,
  setMessageActionId,
  setMessageActionMode,
  setMessageCopyTarget,
  setConversationDetailsOpen,
  setConversationMenuPosition,
  setConversations,
  setDirectUsername,
  setFriendQuery,
  setFriendResults,
  setFriendSearchRetry,
  setGroupActivityCreateKind,
  setGroupActivityViewedId,
  setGroupInviteSearch,
  setGroupInviteSelection,
  setGroupSettingsOpen,
  setGroupMemberViewOpen,
  setLanguageSearch,
  setManuallyTranslated,
  setMessageAttachments,
  setMessageSearchOpen,
  setMessageText,
  setNewChatMode,
  setNotice,
  setQrOpen,
  setQuickSearchOpen,
  setReplyingTo,
  setSharedContentOpen,
  setTranslationMenuOpen,
  setTranslationOriginals,
  setTranslations,
  setTranslationSettingsConversationId,
  sharedContentOpen,
  shareMyProfile,
  sortedChatListConversations,
  sortedGroupActivityEvents,
  switchTab,
  t,
  toggleMessagePin,
  toggleReaction,
  translateMessage,
  translationFailures,
  translationMenuOpen,
  translationOriginals,
  translationPending,
  translations,
  unblockContact,
  updateChatOutbox,
  visibleConversations,
  visibleLanguageOptions,
  visibleMessages,
}: ChatSectionProps) {
  const {
    beginConversationLongPress, beginMessageLongPress, cancelConversationLongPress,
    cancelMessageLongPress, moveConversationLongPress, moveMessageLongPress,
    openMessageActions, openMessageReactions,
    suppressConversationClick: suppressConversationClickRef, suppressMessageClick,
  } = useMessageLongPress({
    activeConversationId, setConversationActionId, setConversationMenuPosition,
    setMessageActionId, setMessageActionMode, setMessageCopyTarget,
  });
  const { pinnedExpanded, setPinnedExpanded } = useChatSectionPanels({ activeConversationId });
  const {
    chatDragActive, chatDragDepth, setChatDragDepth, chatFileInputRef, setChatDragActive,
  } = useChatDragSurface(activeConversationId);
  const chatFiltersPill = useSlidingPill<HTMLDivElement>(chatListFilter);
  const readersScope = `${session.sessionId}:${activeConversationId ?? ''}`;
  const [readersTarget, setReadersTarget] = useScopedState<{ message: Message; readerIds: number[]; sessionId: string } | null>(readersScope, null);
  const encryptionScope = activeConversation?.type === 'direct' && activeConversation.otherUserId && !conversationBlocked
    ? `${session.sessionId}:${session.user.id}:${activeConversation.id}:${activeConversation.otherUserId}`
    : null;
  const [mlsPilotMode, setMlsPilotMode] = useScopedState<ConversationEncryptionMode | 'unknown'>(encryptionScope, 'unknown');
  const readersMessage = readersTarget?.sessionId === session.sessionId ? readersTarget.message : null;
  const messageReaderMembers = useMemo(() => {
    if (!activeConversation) return [];
    if (activeConversation.type === "group") return groupMembers;
    if (!activeConversation.otherUserId) return [];
    const friend = friends.find((item) => item.id === activeConversation.otherUserId);
    if (friend) return [friend];
    return activeConversation.otherUsername
      ? [{
          id: activeConversation.otherUserId,
          username: activeConversation.otherUsername,
          displayName: activeConversation.name || activeConversation.otherUsername,
        }]
      : [];
  }, [activeConversation, friends, groupMembers]);
  // Reorder the avatar dock as soon as a message arrives (including group
  // channels). Keeping a separate stable ID list prevented realtime changes
  // to lastMessageAt from moving conversations up in the compact rail.
  // Include historical groups and any additional search results without
  // duplicating entries; pinned conversations retain their priority.
  const railConversations = useMemo(() => {
    const knownIds = new Set(allChatConversations.map(conversation => conversation.id));
    return [
      ...allChatConversations,
      ...sortedChatListConversations.filter(conversation => !knownIds.has(conversation.id)),
    ].sort((a, b) =>
      Number(Boolean(b.pinnedAt)) - Number(Boolean(a.pinnedAt)) ||
      (b.pinnedAt || '').localeCompare(a.pinnedAt || '') ||
      (b.lastMessageAt || b.createdAt).localeCompare(a.lastMessageAt || a.createdAt),
    );
  }, [allChatConversations, sortedChatListConversations]);
  const railVisibleConversationIds = useMemo(
    () => sortedChatListConversations.map(conversation => conversation.id),
    [sortedChatListConversations],
  );
  const railHasMore = conversationListSearch.active ? conversationListSearch.hasMore
    : conversationCategories.selected === null ? hasMoreConversations : conversationCategories.hasMore;
  const railLoadingMore = conversationListSearch.active ? conversationListSearch.loadingMore
    : conversationCategories.selected === null ? conversationLoadingMore : conversationCategories.loading;
  const railLoadMore = () => conversationListSearch.active ? conversationListSearch.loadMore()
    : conversationCategories.selected === null ? loadMoreConversations() : conversationCategories.load(true);
  const railCategoryControls = <ConversationRailControls
    filter={chatListFilter} onFilterChange={setChatListFilter}
    categories={conversationCategories} search={conversationListSearch} mode="category" />;
  const [groupPhotoBusy, setGroupPhotoBusy] = useState(false);
  const [railListOpen, setRailListOpen] = useState(false);
  const railSelectedLocally = useRef<number | null>(null);
  const splitLayoutRef = useRef<HTMLDivElement>(null);
  const splitExpandedRef = useRef(false);
  const splitEntryPending = useRef(false);
  const groupSwitchRevision = useRef(0);
  const pendingGroupSwitch = useRef<Conversation | null>(null);
  function cancelGroupSwitch() {
    groupSwitchRevision.current++;
    pendingGroupSwitch.current = null;
  }
  const splitFrame = useRef(0);
  function cancelSplitEntry() {
    cancelAnimationFrame(splitFrame.current);
    splitFrame.current = 0;
    splitEntryPending.current = false;
    splitLayoutRef.current?.removeAttribute('data-split-priming');
  }
  /** One target controls both viewports. No data or React updates per frame. */
  function setSplitExpanded(expanded: boolean) {
    splitExpandedRef.current = expanded;
    const layout = splitLayoutRef.current;
    if (!layout) return;
    layout.dataset.splitExpanded = String(expanded);
    // The clipped-out pane must not receive keyboard focus or pointer input.
    const picker = layout.querySelector<HTMLElement>('.group-channel-sidebar');
    if (picker) picker.inert = expanded;
    for (const input of layout.querySelectorAll<HTMLInputElement>('.desktop-conversation-rail-search-field input, .conversation-avatar-rail-search-field input')) {
      input.tabIndex = expanded || !layout.classList.contains('group-channel-workspace') ? 0 : -1;
    }
  }
  function toggleGroupSplit() {
    cancelGroupSwitch();
    cancelSplitEntry();
    setSplitExpanded(!splitExpandedRef.current);
  }
  function openPickerFromExpandedRail() {
    cancelSplitEntry();
    splitEntryPending.current = true;
    setSplitExpanded(true);
    if (splitLayoutRef.current) splitLayoutRef.current.dataset.splitPriming = 'true';
    setRailListOpen(false);
  }
  // Wait for the actual committed picker, not a polling loop or the API.
  useLayoutEffect(() => {
    const layout = splitLayoutRef.current;
    if (!splitEntryPending.current || activeConversation?.type !== 'group' ||
        !layout?.querySelector('.group-channel-sidebar')) return;
    splitEntryPending.current = false;
    setSplitExpanded(true);
    // Establish the initial geometry once, then let the browser interpolate.
    layout.getBoundingClientRect();
    layout.removeAttribute('data-split-priming');
    splitFrame.current = requestAnimationFrame(() => {
      splitFrame.current = 0;
      setSplitExpanded(false);
    });
    return () => cancelAnimationFrame(splitFrame.current);
  }, [activeConversationId, activeConversation?.type]);
  useEffect(() => () => { cancelGroupSwitch(); cancelSplitEntry(); }, []);

  const [desktopChannelPanelOpen, setDesktopChannelPanelOpen] = useState(false);
  const [channelSidebarOpen, setChannelSidebarOpen] = useState(false);
  const [mobileChannelSelected, setMobileChannelSelected] = useState(false);
  function returnFromChannelPicker() {
    if (activeConversation?.type === 'group' && !mobileChannelSelected) {
      toggleGroupSplit();
      return;
    }
    setRailListOpen(true);
    setChannelSidebarOpen(false);
    setMobileChannelSelected(false);
    setActiveConversationId(null);
  }
  function returnFromDesktopChannelPicker() {
    if (activeConversation?.type === 'group' && desktopChannelPanelOpen) {
      toggleGroupSplit();
      return;
    }
    setRailListOpen(true);
    setDesktopChannelPanelOpen(false);
    setChannelSidebarOpen(false);
    setActiveConversationId(null);
  }
  function collapseDesktopChannelPicker() {
    if (activeConversation?.type === 'group' && desktopChannelPanelOpen) {
      toggleGroupSplit();
      return;
    }
    setRailListOpen(false);
  }
  const conversationType = activeConversation?.type;
  useLayoutEffect(() => {
    // Selection via the avatar rail already staged the full-width first
    // frame. Do not override it with a second, out-of-phase rAF reset.
    if (activeConversationId && railSelectedLocally.current === activeConversationId) {
      // Real network data can resolve the conversation type one render later.
      // Consume the local-navigation marker only after that data is present.
      if (conversationType) railSelectedLocally.current = null;
      return;
    }
    // External/deep-link selections initialize the target synchronously.
    cancelGroupSwitch();
    cancelSplitEntry();
    const isDesktop = window.matchMedia('(min-width: 761px)').matches;
    setSplitExpanded(false);
    setChannelSidebarOpen(conversationType === 'group');
    setMobileChannelSelected(false);
    setRailListOpen(!activeConversationId || (isDesktop && conversationType === 'direct'));
    setDesktopChannelPanelOpen(conversationType === 'group');
  }, [activeConversationId, conversationType]);
  function activateConversationFromRail(conversation: Conversation) {
    // The avatar rail also contains historical/membership-recovered chats
    // that may not be in the first active-conversations API page. Hydrate immediately.
    setConversations(current => current.some(item => item.id === conversation.id)
      ? current : [...current, conversation]);
    setChatSearchJump(null);
    setQuickSearchOpen(false);
    railSelectedLocally.current = conversation.id;
    setActiveConversationId(conversation.id);
    setDesktopChannelPanelOpen(conversation.type === 'group');
    setChannelSidebarOpen(conversation.type === 'group');
    if (conversation.type === 'group') {
      setMobileChannelSelected(false);
      openPickerFromExpandedRail();
    } else {
      cancelSplitEntry();
      setSplitExpanded(true);
      // Expanded direct chat occupies its own desktop grid column.
      setRailListOpen(window.matchMedia('(min-width: 761px)').matches);
    }
    setConversationDetailsOpen(false);
    setGroupSettingsOpen(false);
    setTranslations({});
    setTranslationOriginals({});
    setTranslationMenuOpen(false);
  }
  function openConversationFromRail(conversation: Conversation) {
    if (suppressConversationClickRef.current === conversation.id) {
      suppressConversationClickRef.current = null;
      return;
    }
    if (pendingGroupSwitch.current) {
      if (conversation.id === activeConversationId) {
        cancelGroupSwitch();
        setSplitExpanded(false);
        return;
      }
      if (conversation.type === 'group') {
        pendingGroupSwitch.current = conversation;
        prefetchConversation?.(conversation);
        return;
      }
      cancelGroupSwitch();
    }
    if (conversation.id === activeConversationId) {
      if (conversation.type === 'direct') return;
      if (!mobileChannelSelected) {
        toggleGroupSplit();
        return;
      }
    }
    // For group-to-group navigation, retract the current pane and reveal
    // the new one. Use actual transition completion instead of a timer.
    if (conversation.type === 'group' && activeConversation?.type === 'group' &&
        !mobileChannelSelected && splitLayoutRef.current) {
      const layout = splitLayoutRef.current;
      const pane = layout.querySelector<HTMLElement>('.group-channel-sidebar');
      if (pane) {
        cancelSplitEntry();
        pendingGroupSwitch.current = conversation;
        const revision = ++groupSwitchRevision.current;
        prefetchConversation?.(conversation);
        setSplitExpanded(true);
        // Flush styles once so getAnimations observes the current transition,
        // including an interrupted or reversed animation.
        pane.getBoundingClientRect();
        const animations = pane.getAnimations();
        void Promise.allSettled(animations.map(animation => animation.finished)).then(() => {
          if (revision !== groupSwitchRevision.current) return;
          const next = pendingGroupSwitch.current;
          pendingGroupSwitch.current = null;
          if (next) activateConversationFromRail(next);
        });
        return;
      }
    }
    cancelGroupSwitch();
    activateConversationFromRail(conversation);
  }
  const selectedGroupChannel = activeConversation?.type === 'group'
    ? groupChannels.find(channel => channel.id === selectedChannelId)
    : undefined;
  const selectedRoomTitle = activeConversation?.type === 'group' && selectedChannelId === 0
    ? activeConversation.name
    : selectedGroupChannel?.name || activeConversation?.name || '';
  const selectedRoomAvatar = activeConversation?.type === 'group'
    ? (selectedChannelId === 0 ? activeConversation.avatarUrl : selectedGroupChannel?.avatarUrl)
    : undefined;
  const [groupManagementSection, setGroupManagementSection] = useState<GroupManagementSection>('members');
  const [sharedContentInitialTab, setSharedContentInitialTab] = useState<'media' | 'files' | 'links'>('media');

  async function saveGroupPhoto(target: GroupPhotoTarget, file: File | null): Promise<boolean> {
    if (target.kind && target.kind !== 'group' && target.kind !== 'channel') return false;
    const channelId = target.kind === 'channel' ? target.channelId : undefined;
    if (target.kind === 'channel' && (!channelId || channelId < 1)) return false;
    if (!activeConversation || activeConversation.type !== 'group' || !canEditGroup || groupPhotoBusy) return false;
    const groupId = activeConversation.id;
    setGroupPhotoBusy(true);
    try {
      const capabilityResponse = channelId
        ? await apiFetch(`/api/conversations/${groupId}/channels/${channelId}/avatar`, { cache: 'no-store' })
        : await getGroupAvatarCapability(apiFetch, groupId);
      const capability = await capabilityResponse.json().catch(() => null) as
        { canUpdateAvatar?: boolean; error?: string } | null;
      if (capabilityResponse.status === 404 || capabilityResponse.status === 405 ||
          (capabilityResponse.ok && capability?.canUpdateAvatar !== true)) {
        throw new Error('Backend hiện tại chưa hỗ trợ lưu ảnh nhóm. Cần cập nhật backend Railway trước khi đổi ảnh.');
      }
      if (!capabilityResponse.ok) throw new Error(capability?.error ||
        'Không kiểm tra được quyền đổi ảnh nhóm (HTTP ' + capabilityResponse.status + ').');

      const [attachment] = file ? await uploadMediaFiles([file], 'profile') : [null];
      if (file && !attachment) throw new Error('Không tải được ảnh.');
      const response = channelId
        ? await apiFetch(`/api/conversations/${groupId}/channels/${channelId}/avatar`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ attachment: attachment ? attachmentRequestBody(attachment) : null }),
          })
        : await saveGroupAvatar(apiFetch, groupId, attachment ? attachmentRequestBody(attachment) : null);
      const data = await response.json().catch(() => null) as
        { conversationId?: number; avatarUrl?: string; avatarSet?: boolean; error?: string } | null;
      if (response.status === 404 || response.status === 405) {
        throw new Error('Backend chưa hỗ trợ lưu ảnh nhóm hoặc nhóm không còn tồn tại. Hãy kiểm tra bản triển khai Railway.');
      }
      if (!response.ok) throw new Error(data?.error ||
        'Không lưu được ảnh nhóm (HTTP ' + response.status + ').');
      if (data?.conversationId !== groupId || typeof data.avatarSet !== 'boolean') {
        throw new Error('Phản hồi lưu ảnh nhóm không hợp lệ. Vui lòng thử lại.');
      }
      if (channelId) await refreshGroupChannels();
      else setConversations(current => current.map(item =>
        item.id === groupId ? { ...item, avatarUrl: data.avatarUrl || undefined } : item,
      ));
      setNotice(channelId ? 'Đã cập nhật ảnh kênh.' : 'Đã cập nhật ảnh nhóm.', 'success');
      return true;
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Không lưu được ảnh.', 'error');
      return false;
    } finally {
      setGroupPhotoBusy(false);
    }
  }

  const railProps: Omit<ConversationRailProps, 'keepDetailsMounted' | 'onSearchCompact' | 'onCollapse'> = {
    conversations: railConversations,
    onPrefetch: prefetchConversation,
    visibleConversationIds: railVisibleConversationIds,
    loadError: conversationListError,
    onRetry: refreshConversations,
    searchValue: chatListQuery,
    onSearchChange: setChatListQuery,
    categoryControls: railCategoryControls,
    filter: chatListFilter,
    onFilterChange: setChatListFilter,
    categories: conversationCategories.categories,
    onEntryContextMenu: (conversation, event) => {
      event.preventDefault();
      cancelConversationLongPress();
      const touchMenu = 'pointerType' in event.nativeEvent && event.nativeEvent.pointerType !== 'mouse';
      if (touchMenu && event.type !== 'click') suppressConversationClickRef.current = conversation.id;
      const rect = event.currentTarget.getBoundingClientRect();
      setConversationMenuPosition(event.type === 'click' ? { x: rect.right - 244, y: rect.bottom + 4 } : touchMenu ? null : { x: event.clientX, y: event.clientY });
      setConversationActionId(conversation.id);
    },
    onEntryPointerDown: (conversation, event) => {
      if (event.pointerType !== 'mouse') beginConversationLongPress(conversation.id, event.clientX, event.clientY);
    },
    onEntryPointerMove: event => moveConversationLongPress(event.clientX, event.clientY),
    onEntryPointerEnd: cancelConversationLongPress,
    selectedId: activeConversationId,
    expanded: railListOpen,
    onSelect: openConversationFromRail,
    onCreate: () => { setChatCreateError(''); setNewChatMode('direct'); },
    hasMore: railHasMore,
    loadingMore: railLoadingMore,
    onLoadMore: railLoadMore,
  };

  return (
      <div ref={splitLayoutRef} className={`messenger-layout modern-messenger social-chat-layout avatar-rail-layout ${activeConversation ? 'has-active' : ''}${railListOpen ? ' avatar-rail-expanded' : ''}${newChatMode !== 'none' ? ' avatar-rail-creation-open' : ''}${activeConversation?.type === 'group' && desktopChannelPanelOpen ? ' desktop-channel-panel-open' : ''}${activeConversation?.type === 'group' ? ' group-channel-workspace' : ''}${activeConversation?.type === 'group' && channelSidebarOpen ? ' mobile-channel-picker-open' : ''} mobile-conversation-rail-visible${!activeConversation ? ' mobile-rail-list-view' : activeConversation.type === 'group' && !mobileChannelSelected ? ' mobile-rail-picker-view' : ' mobile-rail-chat-view'}${activeConversation?.type === 'group' && !channelSidebarOpen && !mobileChannelSelected ? ' mobile-channel-awaiting-choice' : ''}${conversationDetailsOpen ? ' details-open' : ''}${groupSettingsOpen && activeConversation?.type === 'group' ? ' group-sidebar-open' : ''}`}>
            {activeConversation?.type === 'group' && (
              <>
                <GroupChannelSidebar
                  groupName={activeConversation.name}
                  memberCount={activeConversation.memberCount}
                  groupAvatarUrl={activeConversation.avatarUrl}
                  channels={groupChannels}
                  selectedId={selectedChannelId}
                  unreadAvailable={groupChannelUnreadAvailable}
                  open={channelSidebarOpen || desktopChannelPanelOpen}
                  onSelect={(id) => {
                    selectGroupChannel(id);
                    setMobileChannelSelected(true);
                    setChannelSidebarOpen(false);
                  }}
                  actions={{
                    groupId: activeConversation.id,
                    userId: session.user.id,
                    canEdit: canEditGroup,
                    canLeave: Boolean(activeGroupMember && activeGroupMember.role !== 'owner'),
                    canManage: canManageActiveGroup,
                    canCreateChannel: activeGroupMember?.role === 'owner',
                    channelCreateBusy: groupChannelBusy,
                    groupMuted: activeConversation.muted,
                    request: apiFetch,
                    notify: setNotice,
                    onGroupRenamed: (name) => setConversations(current => current.map(item =>
                      item.id === activeConversation.id ? { ...item, name } : item)),
                    onGroupNotificationChanged: (muted) => setConversations(current => current.map(item =>
                      item.id === activeConversation.id ? { ...item, muted } : item)),
                    onToggleGroupNotifications: () => { void toggleConversationNotifications(activeConversation) },
                    notificationBusy: notificationBusyId === activeConversation.id,
                    onChannelsChanged: refreshGroupChannels,
                    onChannelDeleted: async () => {
                      selectGroupChannel(0);
                      await refreshGroupChannels();
                      setConversationDetailsOpen(false);
                    },
                    onLeftGroup: () => {
                      setConversationDetailsOpen(false);
                      setGroupSettingsOpen(false);
                      setActiveConversationId(null);
                      setConversations(current => current.filter(item => item.id !== activeConversation.id));
                    },
                    onShowGroupInfo: () => {
                      selectGroupChannel(0);
                      setGroupSettingsOpen(false);
                      setConversationDetailsOpen(true);
                    },
                    onShowChannelInfo: (id) => {
                      selectGroupChannel(id);
                      setMobileChannelSelected(true);
                      setChannelSidebarOpen(false);
                      setGroupSettingsOpen(false);
                      setConversationDetailsOpen(true);
                    },
                    onShowGroupManagement: (section) => {
                      setGroupManagementSection(section);
                      setGroupMemberViewOpen(section === 'members');
                      setConversationDetailsOpen(false);
                      setGroupSettingsOpen(true);
                    },
                    onCreateGroupActivity: setGroupActivityCreateKind,
                    onCreateChannel: createGroupChannel,
                  }}
                />
                {channelSidebarOpen && <button type="button" className="group-channel-sidebar-overlay"
                  aria-label="Đóng danh sách kênh" onClick={() => setChannelSidebarOpen(false)} />}
              </>
            )}
            <DesktopConversationRail
              {...railProps}
              keepDetailsMounted={activeConversation?.type === 'group' && desktopChannelPanelOpen}
              onSearchCompact={returnFromDesktopChannelPicker}
              onCollapse={collapseDesktopChannelPicker}
            />
            <ConversationAvatarRail
              {...railProps}
              keepDetailsMounted={activeConversation?.type === 'group' && !mobileChannelSelected}
              onSearchCompact={returnFromChannelPicker}
              onCollapse={() => {
                if (activeConversation?.type === 'group' && !mobileChannelSelected) toggleGroupSplit();
                else setRailListOpen(false);
              }}
            />
            <ConversationList
                activeConversationId={activeConversationId}
                actOnFriend={actOnFriend}
                beginConversationLongPress={beginConversationLongPress}
                cancelConversationLongPress={cancelConversationLongPress}
                chatCreateError={chatCreateError}
                chatListConversations={chatListConversations}
                chatListFilter={chatListFilter}
                chatListQuery={chatListQuery}
                conversationCategories={conversationCategories}
                conversationListSearch={conversationListSearch}
                conversationLoadingMore={conversationLoadingMore}
                copyInviteLink={copyInviteLink}
                createDirect={createDirect}
                directUsername={directUsername}
                friendBusyIds={friendBusyIds}
                friendQuery={friendQuery}
                friendRelationship={friendRelationship}
                friendResults={friendResults}
                friends={friends}
                friendSearchError={friendSearchError}
                friendSearching={friendSearching}
                hasMoreConversations={hasMoreConversations}
                loadMoreConversations={loadMoreConversations}
                moveConversationLongPress={moveConversationLongPress}
                newChatMode={newChatMode}
                openConnectSurface={openConnectSurface}
                quickSearchControl={quickSearchControl}
                searchInConversationList={searchInConversationList}
                session={session}
                setActiveConversationId={setActiveConversationId}
                setChatCreateError={setChatCreateError}
                setChatListFilter={setChatListFilter}
                setChatListQuery={setChatListQuery}
                setChatSearchJump={setChatSearchJump}
                setConversationActionId={setConversationActionId}
                setConversationMenuPosition={setConversationMenuPosition}
                setConversations={setConversations}
                setDirectUsername={setDirectUsername}
                setFriendQuery={setFriendQuery}
                setFriendResults={setFriendResults}
                setFriendSearchRetry={setFriendSearchRetry}
                setNewChatMode={setNewChatMode}
                setQrOpen={setQrOpen}
                setQuickSearchOpen={setQuickSearchOpen}
                setTranslationMenuOpen={setTranslationMenuOpen}
                setTranslationOriginals={setTranslationOriginals}
                setTranslations={setTranslations}
                shareMyProfile={shareMyProfile}
                sortedChatListConversations={sortedChatListConversations}
                suppressConversationClick={suppressConversationClickRef}
                t={t}
                visibleConversations={visibleConversations}
                chatFiltersPill={chatFiltersPill}
              />


            <section
              onDragEnter={(event) => {
                if (!transferHasFiles(event.dataTransfer)) return
                event.preventDefault()
                if (conversationBlocked) return
                setChatDragDepth(chatDragDepth.current + 1)
                if (!chatDragActive) setChatDragActive(true)
              }}
              onDragOver={(event) => {
                if (!transferHasFiles(event.dataTransfer)) return
                event.preventDefault()
                event.dataTransfer.dropEffect = conversationBlocked ? 'none' : 'copy'
              }}
              onDragLeave={(event) => {
                if (chatDragDepth.current === 0) return
                event.preventDefault()
                setChatDragDepth(Math.max(0, chatDragDepth.current - 1))
                if (chatDragDepth.current === 0) setChatDragActive(false)
              }}
              onDrop={(event) => {
                if (!transferHasFiles(event.dataTransfer)) return
                event.preventDefault()
                setChatDragDepth(0)
                setChatDragActive(false)
                if (conversationBlocked) return
                void addChatFiles(Array.from(event.dataTransfer.files))
              }}
              className={`conversation-panel${activeConversation?.type === 'group'
                ? ' group-chat-panel'
                : ''}${chatDragActive ? ' chat-file-drag-active' : ''}`}>
              {chatDragActive && activeConversationId && !conversationBlocked && (
                <div className="chat-file-drop-overlay" role="status" aria-live="polite">
                  <div className="chat-file-drop-card">
                    <Images size={32} aria-hidden="true" />
                    <strong>Thả ảnh hoặc tệp vào đây</strong>
                    <span>Tệp sẽ được thêm vào tin nhắn, chưa gửi ngay · Tối đa 10 tệp</span>
                  </div>
                </div>
              )}
              {!activeConversation ? (
                <div className="conversation-empty">
                  <SocoEmptyState kind="chat" title="Kết nối không biên giới"
                    description="Chọn một cuộc trò chuyện để bắt đầu nhắn tin và dịch AI tự động."
                    action={<SocoTextAction onClick={() => openConnectSurface()}>Tìm bạn mới</SocoTextAction>}
                  />
                </div>
              ) : (
                <>
                  <ConversationHeader
                    activeConversation={activeConversation}
                    changeAutoTranslate={changeAutoTranslate}
                    changeTargetLanguage={changeTargetLanguage}
                    conversationBlocked={conversationBlocked}
                    conversationCategories={conversationCategories}
                    conversationDetailsOpen={conversationDetailsOpen}
                    effectiveAutoTranslate={effectiveAutoTranslate}
                    effectiveTargetLanguage={effectiveTargetLanguage}
                    groupSettingsOpen={groupSettingsOpen}
                    languageSearch={languageSearch}
                    openGroupSettings={openGroupSettings}
                    openVisitor={openVisitor}
                    setActiveConversationId={setActiveConversationId}
                    setConversationDetailsOpen={setConversationDetailsOpen}
                    setGroupMemberViewOpen={setGroupMemberViewOpen}
                    setGroupSettingsOpen={setGroupSettingsOpen}
                    setLanguageSearch={setLanguageSearch}
                    setMessageSearchOpen={setMessageSearchOpen}
                    setTranslationMenuOpen={setTranslationMenuOpen}
                    t={t}
                    translationMenuOpen={translationMenuOpen}
                    visibleLanguageOptions={visibleLanguageOptions}
                    setChannelSidebarOpen={setChannelSidebarOpen}
                    setMobileChannelSelected={setMobileChannelSelected}
                    selectedChannelId={selectedChannelId}
                    selectedRoomTitle={selectedRoomTitle}
                    selectedRoomAvatar={selectedRoomAvatar}
                    selectedChannelDescription={selectedGroupChannel?.description}
                  />


                  <PinnedItemsPanel
                    activeConversation={activeConversation}
                    nextChatSearchJumpRevision={nextChatSearchJumpRevision}
                    groupActivities={groupActivities}
                    pinBusy={pinBusy}
                    pinnedExpanded={pinnedExpanded}
                    pinnedItems={pinnedItems}
                    setChatSearchJump={setChatSearchJump}
                    setGroupActivityViewedId={setGroupActivityViewedId}
                    setNotice={setNotice}
                    setPinnedExpanded={setPinnedExpanded}
                    t={t}
                    toggleMessagePin={toggleMessagePin}
                  />

                  {chatFriend && chatFriendRelationship !== 'accepted' && (friendSyncError || friendSyncSessionId === session?.sessionId) && (
                    <div className={`chat-friend-bar relationship-${chatFriendRelationship}`} aria-label="Kết bạn trong cuộc trò chuyện">
                      <span role="status">
                        <UserPlus size={18} aria-hidden="true" />
                        {friendSyncError || (friendSyncSessionId !== session?.sessionId ? 'Đang tải trạng thái kết bạn...' :
                          chatFriendRelationship === 'incoming' ? 'Bạn nhận được lời mời kết bạn' :
                          chatFriendRelationship === 'outgoing' ? 'Đã gửi lời mời kết bạn' : 'Hai bạn chưa kết bạn')}
                      </span>
                      {friendSyncError ? (
                        <button type="button" disabled={friendSyncBusy} onClick={() => void refreshFriendConnections()}>
                          <RefreshCw size={16} aria-hidden="true" /> Thử lại
                        </button>
                      ) : friendSyncSessionId === session?.sessionId && (
                        <div className="chat-friend-actions">
                          <button
                            type="button"
                            className={chatFriendRelationship === 'outgoing' ? '' : 'primary'}
                            disabled={friendBusyIds.has(chatFriend.id)}
                            onClick={() => void actOnFriend(chatFriend)}
                          >
                            {chatFriendRelationship === 'incoming' ? <Check size={16} aria-hidden="true" /> :
                              chatFriendRelationship === 'outgoing' ? <X size={16} aria-hidden="true" /> : <UserPlus size={16} aria-hidden="true" />}
                            {chatFriendRelationship === 'incoming' ? 'Chấp nhận' : chatFriendRelationship === 'outgoing' ? 'Hủy lời mời' : 'Gửi lời mời kết bạn'}
                          </button>
                          {chatFriendRelationship === 'incoming' && (
                            <button type="button" disabled={friendBusyIds.has(chatFriend.id)} onClick={() => void actOnFriend(chatFriend, true)}>
                              <X size={16} aria-hidden="true" /> Từ chối
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {sharedContentOpen && (
                    <SharedContent
                      conversationId={activeConversation.id}
                      initialTab={sharedContentInitialTab}
                      channelId={selectedChannelId}
                      request={apiFetch}
                      onClose={() => setSharedContentOpen(false)}
                    />
                  )}

                  {messageSearchOpen && (
                    <MessageSearchPanel conversationId={activeConversation.id} channelId={selectedChannelId} request={apiFetch}
                      onClose={() => setMessageSearchOpen(false)}
                      onJump={async (result) => {
                        if (activeConversationIdRef.current !== activeConversation.id) return
                        // Both search entry points use the same history loader; never replace the current timeline.
                        setChatSearchJump({
                          conversationId: activeConversation.id,
                          messageId: result.id,
                          revision: nextChatSearchJumpRevision(),
                        })
                      }}
                    />
                  )}
                  {activeConversation.type === 'direct' && !conversationBlocked && (
                    <div role="status" className="chat-encryption-notice relative flex min-w-0 shrink-0 justify-center gap-1.5 px-3 py-1 text-xs leading-4 text-foreground" aria-live="polite">
                      <ShieldAlert size={14} className="mt-px shrink-0" style={mlsPilotMode === 'unknown' ? { visibility: 'hidden' } : undefined} aria-hidden="true" />
                      <span className="min-w-0 wrap-break-word" style={mlsPilotMode === 'unknown' ? { visibility: 'hidden' } : undefined} aria-hidden={mlsPilotMode === 'unknown'}>
                        <strong className="font-semibold">
                          {(mlsPilotMode === 'legacy' || mlsPilotMode === 'unknown')
                            ? 'Hội thoại chưa mã hóa đầu cuối'
                            : 'Tin nhắn cũ chưa mã hóa đầu cuối'}
                        </strong>{' · '}
                        {(mlsPilotMode === 'legacy' || mlsPilotMode === 'unknown')
                          ? 'Tin nhắn mới vẫn có thể được lưu trên máy chủ.'
                          : 'Tin nhắn mới chỉ được gửi khi phiên MLS sẵn sàng.'}
                      </span>
                      {mlsPilotMode === 'unknown' && <span className="absolute inset-0 flex items-center justify-center px-3 text-xs text-muted-foreground">Đang kiểm tra mã hóa…</span>}
                    </div>
                  )}
                  <MessageTimeline
                     key={`${session.sessionId}:${activeConversationId}:${selectedChannelId}`}
                     unreadMessageId={messageSearchOpen ? null : unreadMessageId}
                    activeChatTranslationSettings={activeChatTranslationSettings}
                    activeConversation={activeConversation}
                    activeConversationId={activeConversationId}
                    apiFetch={apiFetch}
                    beginMessageLongPress={beginMessageLongPress}
                    bottomRef={bottomRef}
                    cancelMessageLongPress={cancelMessageLongPress}
                    chatOnline={chatOnline}
                    chatOutbox={chatOutbox}
                    conversationBlocked={conversationBlocked}
                    effectiveAutoTranslate={effectiveAutoTranslate}
                    effectiveTargetLanguage={effectiveTargetLanguage}
                    groupActivities={groupActivities}
                    hasMoreMessages={hasMoreMessages}
                    languageOptions={languageOptions}
                    loadMissingMessages={loadMissingMessages}
                    loadOlderMessages={loadOlderMessages}
                    manuallyTranslated={manuallyTranslated}
                    messageGapBefore={messageGapBefore}
                    messageGapLoading={messageGapLoading}
                    messageInputRef={messageInputRef}
                    setMessageScrollAtBottom={setMessageScrollAtBottom}
                    messagesLoadingMore={messagesLoadingMore}
                    messageHistoryLoading={messageHistoryLoading}
                    messageHistoryError={messageHistoryError}
                    retryMessageHistory={retryMessageHistory}
                    messagesScrollRef={messagesScrollRef}
                    chatScrollRefs={chatScrollRefs}
                    outgoingMessage={outgoingMessage}
                    moveMessageLongPress={moveMessageLongPress}
                    openMessageActions={openMessageActions}
                    openMessageReactions={openMessageReactions}
                    toggleReaction={toggleReaction}
                    onReactionUsers={onReactionUsers}
                    onForwardMessage={onForwardMessage}
                    reactionPreviews={reactionPreviews}
                    retryQueuedChatMessages={retryQueuedChatMessages}
                    selectedChannelId={selectedChannelId}
                    session={session}
                    setGroupActivityViewedId={setGroupActivityViewedId}
                    setManuallyTranslated={setManuallyTranslated}
                    setReplyingTo={setReplyingTo}
                    setTranslationOriginals={setTranslationOriginals}
                    sortedGroupActivityEvents={sortedGroupActivityEvents}
                    suppressMessageClick={suppressMessageClick}
                    t={t}
                    translateMessage={translateMessage}
                    translationFailures={translationFailures}
                    translationOriginals={translationOriginals}
                    translationPending={translationPending}
                    translations={translations}
                    updateChatOutbox={updateChatOutbox}
                    visibleMessages={visibleMessages}
                    messageReaderMembers={messageReaderMembers}
                    groupMembers={groupMembers}
                    onProfile={openVisitor}
                    setReadersTarget={setReadersTarget}
                  />

                  {activeConversation.type === 'direct' && activeConversation.otherUserId && !conversationBlocked && (
                    <E2EEPilotGate
                      key={encryptionScope}
                      conversationId={activeConversation.id}
                      userId={session.user.id}
                      otherUserId={activeConversation.otherUserId}
                      request={apiFetch}
                      onModeChange={setMlsPilotMode}
                    />
                  )}

                  {conversationBlocked ? (
                    <div className="chat-blocked-composer" role="status" aria-live="polite">
                      <Ban size={20} aria-hidden="true" />
                      <div>
                        <strong>{activeConversation.blockedByOther ? 'Bạn đã bị chặn' : 'Bạn đã chặn người này'}</strong>
                        <span>Không thể nhắn tin, gọi điện hoặc gửi tệp trong cuộc trò chuyện này.</span>
                      </div>
                      {activeConversation.blockedByMe && !activeConversation.blockedByOther && activeConversation.otherUserId && (
                        <button type="button" onClick={() => void unblockContact(activeConversation.otherUserId!)} disabled={blockedBusy}>
                          Bỏ chặn
                        </button>
                      )}
                    </div>
                  ) : (mlsPilotMode === 'e2ee' || mlsPilotMode === 'pending') ? null : (
                  <MessageComposer
                key={`${activeConversationId}:${selectedChannelId}`}
                activeConversation={activeConversation}
                activeConversationId={activeConversationId}
                addChatFiles={addChatFiles}
                apiFetch={apiFetch}
                canSchedule={activeConversation.type !== 'direct' || mlsPilotMode === 'legacy'}
                canSend={canSend}
                canSendLike={canSendLike}
                chatFileInputRef={chatFileInputRef}
                groupMembers={groupMembers}
                mediaUploading={mediaUploading}
                messageAttachments={messageAttachments}
                messageInputRef={messageInputRef}
                messageSending={messageSending}
                messageText={messageText}
                replyingTo={replyingTo}
                selectedChannelId={selectedChannelId}
                sendMessage={sendMessage}
                sendLike={sendLike}
                session={session}
                setGroupActivityCreateKind={setGroupActivityCreateKind}
                setMessageAttachments={setMessageAttachments}
                setMessageText={setMessageText}
                setNotice={setNotice}
                setReplyingTo={setReplyingTo}
              />

                  )}
                </>
              )}
            </section>
            {activeConversation && conversationDetailsOpen && (
              <ConversationDetailsPanel
                conversation={activeConversation}
                busy={historyActionBusy || blockedBusy}
                notificationBusy={notificationBusyId === activeConversation.id}
                onToggleNotifications={() => { void toggleConversationNotifications(activeConversation) }}
                onUnblock={() => { if (activeConversation.otherUserId) void unblockContact(activeConversation.otherUserId) }}
                onClose={() => setConversationDetailsOpen(false)}
                onBlock={() => {
                  if (activeConversation.otherUserId && activeConversation.otherUsername) {
                    void blockContact({
                      id: activeConversation.otherUserId,
                      username: activeConversation.otherUsername,
                      displayName: activeConversation.name,
                    })
                  }
                }}
                onClearHistory={() => { void clearActiveConversationHistory() }}
                activities={groupActivities.activities}
                onActivity={setGroupActivityViewedId}
                onRefresh={refreshConversations}
                onContactSaved={onContactSaved}
                request={apiFetch}
                selectedChannelId={selectedChannelId}
                channel={groupChannels.find(item => item.id === selectedChannelId) || groupChannels[0] || {
                  id: 0, conversationId: activeConversation.id, name: 'Thảo luận chung',
                  description: '', unreadCount: 0, lastMessage: '',
                }}
                userId={session.user.id}
                canLeaveGroup={activeGroupMember?.role !== 'owner'}
                notify={setNotice}
                onGroupRenamed={(name) => setConversations(current => current.map(item =>
                  item.id === activeConversation.id ? { ...item, name } : item))}
                onChannelsChanged={refreshGroupChannels}
                onChannelDeleted={async () => {
                  selectGroupChannel(0);
                  await refreshGroupChannels();
                  setConversationDetailsOpen(false);
                }}
                onLeftGroup={() => {
                  setConversationDetailsOpen(false);
                  setActiveConversationId(null);
                  setConversations(current => current.filter(item => item.id !== activeConversation.id));
                }}
                canCreateChannel={activeGroupMember?.role === 'owner'}
                channelCreateBusy={groupChannelBusy}
                onCreateChannel={createGroupChannel}
                canEditGroupPhotos={canEditGroup}
                photoBusy={groupPhotoBusy}
                onSavePhoto={saveGroupPhoto}
                onGroupManagement={(section) => {
                  setGroupManagementSection(section)
                  setConversationDetailsOpen(false)
                  setGroupSettingsOpen(true)
                }}
                onProfile={() => {
                  if (activeConversation.type === 'group') {
                    setConversationDetailsOpen(false)
                    setGroupMemberViewOpen(false)
                    openGroupSettings(activeConversation)
                  }
                  else if (activeConversation.otherUsername) openVisitor(activeConversation.otherUsername)
                  else setNotice('Không thể mở hồ sơ từ cuộc trò chuyện này.', 'warning')
                }}
                onShared={(tab = 'media') => { setSharedContentInitialTab(tab); setSharedContentOpen(true) }}
              />
            )}
            {groupSettingsOpen && activeConversation?.type === 'group' && (
              <>
                <button type="button" className="group-sidebar-scrim"
                  aria-label="Đóng thanh quản lý nhóm"
                  onClick={() => setGroupSettingsOpen(false)} />
                <aside className="group-settings-sidebar" id="group-settings-sidebar" aria-label="Thanh bên quản lý nhóm">
                  <GroupSettingsPanel
                    key={`${activeConversation.id}:${groupManagementSection}`}
                    initialSection={groupManagementSection}
                    activeGroupMember={activeGroupMember}
                    setGroupSettingsOpen={setGroupSettingsOpen}
                    canManageActiveGroup={canManageActiveGroup}
                    canInviteActiveGroup={canInviteActiveGroup}
                    canEditGroup={canEditGroup}
                    onOpenShared={() => { setGroupSettingsOpen(false); setSharedContentInitialTab('files'); setSharedContentOpen(true) }}
                    onOpenMemberProfile={(username) => {
                      setGroupMemberViewOpen(false)
                      setGroupSettingsOpen(false)
                      openVisitor(username)
                    }}
                    memberFriendRelationship={friendRelationship}
                    onMemberFriendAction={(member) => actOnFriend({
                      id: member.id,
                      username: member.username,
                      displayName: member.displayName,
                      online: member.online,
                    })}
                    friendBusyIds={friendBusyIds}
                    memberViewOpen={groupMemberViewOpen}
                    setMemberViewOpen={setGroupMemberViewOpen}
                    groupBusy={groupBusy}
                    activeConversation={activeConversation}
                    groupInviteSelection={groupInviteSelection}
                    groupInviteSearch={groupInviteSearch}
                    setGroupInviteSearch={setGroupInviteSearch}
                    groupInviteCandidates={groupInviteCandidates}
                    friends={friends}
                    setGroupInviteSelection={setGroupInviteSelection}
                    inviteGroupMembers={inviteGroupMembers}
                    groupMembers={groupMembers}
                    userId={session.user.id}
                    changeGroupMemberRole={changeGroupMemberRole}
                    removeGroupMember={removeGroupMember}
                    request={apiFetch}
                    notify={(message) => setNotice(message)}
                    onMembersChanged={() => refreshGroupMembers(activeConversation.id)}
                  />
                </aside>
              </>
            )}
            {readersMessage && activeConversation?.type === 'group' && readersMessage.conversationId === activeConversationId && (
              <MessageReadersDialog
                key={readersMessage.id}
                conversationId={readersMessage.conversationId}
                readerIds={readersTarget?.readerIds || []}
                request={apiFetch}
                onClose={() => setReadersTarget(null)}
              />
            )}
          </div>
  );
}