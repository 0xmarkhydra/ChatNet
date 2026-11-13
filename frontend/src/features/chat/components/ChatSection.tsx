import { Plus, Search, Pin, RefreshCw, Images, Users, Languages, MoreHorizontal, X, UserPlus, Check, SmilePlus, LoaderCircle, Ban, Hash, CornerUpLeft, Forward } from "lucide-react";
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
import ConversationAvatarRail from "./ConversationAvatarRail";
import ConversationRailControls from "./ConversationRailControls";
import DesktopConversationRail from "./DesktopConversationRail";
import { CallHeaderActions } from "../../calls/components/CallManager";
import { createPortal } from "react-dom";
import SharedContent from "./SharedContent";
import MessageSearchPanel from "./MessageSearchPanel";
import MessageReadersDialog from "./MessageReadersDialog";
import { getMessageTranslationView } from "../utils/messageTranslationPresentation";
import { messageReactionLabel } from "../utils/messageReactions";
import { Fragment, FormEvent, useEffect, useLayoutEffect, useMemo, useRef, useState, type SetStateAction } from "react";
import { GroupActivityMarker, GroupActivityComposerMenu, type GroupActivityKind } from "./GroupActivities";
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
import { type GroupMember, type Message, type Conversation, type NewChatMode, type MessageReaction } from "../types";
import type { FriendSearchResult, FriendConnection } from "../../contacts/types";
import { type QueuedChatMessage } from "../lib/chatOutbox";
import { type GroupChannel } from "../utils/groupChannels";
import { attachmentRequestBody, type MediaAttachment } from "../../../shared/utils/media";
import { type Session } from "../../auth/lib/session";
import { type ToastKind } from "../../../shared/utils/toast";
import type { Tab } from "../../../shared/types/navigation";
import { UI_MESSAGES } from "../../i18n/lib/i18n";
import type { ConversationCategory } from "../hooks/useConversationCategories";
import type { GroupActivity } from "./GroupActivities";
import type { GroupActivityEvent } from "./GroupActivities";
import type { LanguageOption } from "../../i18n/utils/languages";
import type { Dispatch, RefObject, ReactNode } from "react";
import { getGroupAvatarCapability, saveGroupAvatar } from "../api/avatar";
import "../styles/chat-frame-unified.css";
import "../styles/mobile-chat-navigation.css";
import ConversationList from "./ConversationList";
import MessageComposer from "./MessageComposer";
import ConversationHeader from "./ConversationHeader";
import MessageTimeline from "./MessageTimeline";
import PinnedItemsPanel from "./PinnedItemsPanel";
import type { ChatSectionProps } from "./ChatSectionProps";

export type { ChatSectionProps } from "./ChatSectionProps";


export default function ChatSection({
  activeChatTranslationSettings,
  activeConversation,
  activeConversationId,
  activeConversationIdRef,
  activeGroupMember,
  actOnFriend,
  addChatFiles,
  uploadMediaFiles,
  apiFetch,
  beginConversationLongPress,
  beginMessageLongPress,
  blockContact,
  blockedBusy,
  bottomRef,
  cancelConversationLongPress,
  cancelMessageLongPress,
  canEditGroup,
  canInviteActiveGroup,
  canManageActiveGroup,
  canSend,
  changeAutoTranslate,
  changeGroupMemberRole,
  changeTargetLanguage,
  chatCreateError,
  chatDragActive,
  chatDragDepth,
  setChatDragDepth,
  chatFileInputRef,
  chatFiltersPill,
  chatFriend,
  chatFriendRelationship,
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
  groupMemberViewOpen,
  groupSettingsOpen,
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
  messagesScrollRef,
  messageText,
  moveConversationLongPress,
  moveMessageLongPress,
  newChatMode,
  openConnectSurface,
  openGroupSettings,
  openMessageActions,
  openMessageReactions,
  onReactionUsers,
  onForwardMessage,
  openVisitor,
  pinBusy,
  pinnedExpanded,
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
  session,
  setActiveConversationId,
  setChatCreateError,
  setChatDragActive,
  setChatListFilter,
  setChatListQuery,
  setChatSearchJump,
  setConversationActionId,
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
  setGroupMemberViewOpen,
  setGroupSettingsOpen,
  setLanguageSearch,
  setManuallyTranslated,
  setMessageAttachments,
  setMessageSearchOpen,
  setMessageText,
  setNewChatMode,
  setNotice,
  setPinnedExpanded,
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
  suppressConversationClick,
  suppressMessageClick,
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
  const readersScope = `${session.sessionId}:${activeConversationId ?? ''}`;
  const [readersTarget, setReadersTarget] = useScopedState<{ message: Message; readerIds: number[]; sessionId: string } | null>(readersScope, null);
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
  // Keep rail item positions stable even when new messages reorder the full chat list.
  // Append newly discovered conversations, and remove only conversations that no longer exist.
  const railOrderRef = useRef<number[]>([]);
  const stableRailConversations = useMemo(() => {
    const byId = new Map(allChatConversations.map(conversation => [conversation.id, conversation]));
    const previousIds = railOrderRef.current.filter(id => byId.has(id));
    const previousSet = new Set(previousIds);
    const nextIds = [
      ...previousIds,
      ...allChatConversations.filter(conversation => !previousSet.has(conversation.id)).map(conversation => conversation.id),
    ];
    railOrderRef.current = nextIds;
    return nextIds.flatMap(id => {
      const conversation = byId.get(id);
      return conversation ? [conversation] : [];
    });
  }, [allChatConversations]);
  const railConversations = useMemo(() => {
    const ids = new Set(stableRailConversations.map(conversation => conversation.id));
    return [...stableRailConversations,
      ...sortedChatListConversations.filter(conversation => !ids.has(conversation.id))];
  }, [stableRailConversations, sortedChatListConversations]);
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
  const railControls = <ConversationRailControls
    filter={chatListFilter} onFilterChange={setChatListFilter}
    categories={conversationCategories} search={conversationListSearch} mode="filters" />;
  const railCategoryControls = <ConversationRailControls
    filter={chatListFilter} onFilterChange={setChatListFilter}
    categories={conversationCategories} search={conversationListSearch} mode="category" />;
  const [groupPhotoBusy, setGroupPhotoBusy] = useState(false);
  const [railListOpen, setRailListOpen] = useState(false);
  const [notificationBusyId, setNotificationBusyId] = useState<number | null>(null);
  async function toggleConversationNotifications(conversation: Conversation) {
    if (notificationBusyId !== null) return;
    setNotificationBusyId(conversation.id);
    try {
      const muted = !conversation.muted;
      const response = await apiFetch('/api/conversations/' + conversation.id + '/notification-settings', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageNotifications: !muted, mentionNotifications: !muted }),
      });
      const result = await response.json().catch(() => null) as
        { messageNotifications?: boolean; mentionNotifications?: boolean; error?: string } | null;
      if (!response.ok || typeof result?.messageNotifications !== 'boolean') {
        throw new Error(result?.error || 'Không cập nhật được thông báo. Backend cần hỗ trợ thiết lập theo hội thoại.');
      }
      const nextMuted = !result.messageNotifications && !result.mentionNotifications;
      setConversations(current => current.map(item =>
        item.id === conversation.id ? { ...item, muted: nextMuted } : item));
      setNotice(nextMuted ? 'Đã tắt thông báo hội thoại.' : 'Đã bật thông báo hội thoại.', 'success');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Không cập nhật được thông báo.', 'error');
    } finally {
      setNotificationBusyId(null);
    }
  }
  const [desktopChannelPanelOpen, setDesktopChannelPanelOpen] = useState(false);
  const [channelSidebarOpen, setChannelSidebarOpen] = useState(false);
  const [mobileChannelSelected, setMobileChannelSelected] = useState(false);
  useLayoutEffect(() => {
    // Mount the picker off screen, then slide it in from left to right.
    // Cancel any pending animation when switching or leaving conversations.
    setChannelSidebarOpen(false);
    setMobileChannelSelected(false);
    // Telegram-style desktop: direct chats show the info list beside messages;
    // group channels use the compact dock. On mobile, keep chats unobstructed.
    setRailListOpen(!activeConversation ||
      (window.matchMedia('(min-width: 761px)').matches && activeConversation.type === 'direct'));
    setDesktopChannelPanelOpen(false);
    if (window.matchMedia('(min-width: 761px)').matches) {
      const frame = requestAnimationFrame(() => setDesktopChannelPanelOpen(activeConversation?.type === 'group'));
      return () => cancelAnimationFrame(frame);
    }
    if (activeConversation?.type !== 'group') return;
    let secondFrame = 0;
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => setChannelSidebarOpen(true));
    });
    return () => {
      cancelAnimationFrame(firstFrame);
      cancelAnimationFrame(secondFrame);
    };
  }, [activeConversationId, activeConversation?.type]);
  function openConversationFromRail(conversation: Conversation) {
    if (suppressConversationClick.current === conversation.id) {
      suppressConversationClick.current = null;
      return;
    }
    if (conversationListSearch.active) {
      setConversations(current => current.some(item => item.id === conversation.id)
        ? current : [...current, conversation]);
    }
    // The active group avatar doubles as a back action. Tapping it while
    // the channel picker is shown returns to the expanded conversation rail.
    if (conversation.id === activeConversationId && conversation.type === 'group' && !railListOpen) {
      setDesktopChannelPanelOpen(false);
      setChannelSidebarOpen(false);
      setMobileChannelSelected(false);
      setConversationDetailsOpen(false);
      setGroupSettingsOpen(false);
      setRailListOpen(true);
      setActiveConversationId(null);
      return;
    }
    setChatSearchJump(null);
    setQuickSearchOpen(false);
    setActiveConversationId(conversation.id);
    setDesktopChannelPanelOpen(conversation.type === 'group');
    // Expanded direct chat occupies its own desktop grid column, never overlays messages.
    setRailListOpen(conversation.type === 'direct' && window.matchMedia('(min-width: 761px)').matches);
    setConversationDetailsOpen(false);
    setGroupSettingsOpen(false);
    setTranslations({});
    setTranslationOriginals({});
    setTranslationMenuOpen(false);
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

  return (
      <div className={`messenger-layout modern-messenger social-chat-layout avatar-rail-layout ${activeConversation ? 'has-active' : ''}${railListOpen ? ' avatar-rail-expanded' : ''}${newChatMode !== 'none' ? ' avatar-rail-creation-open' : ''}${activeConversation?.type === 'group' && desktopChannelPanelOpen ? ' desktop-channel-panel-open' : ''}${activeConversation?.type === 'group' ? ' group-channel-workspace' : ''}${activeConversation?.type === 'group' && channelSidebarOpen ? ' mobile-channel-picker-open' : ''} mobile-conversation-rail-visible${!activeConversation ? ' mobile-rail-list-view' : activeConversation.type === 'group' && !mobileChannelSelected ? ' mobile-rail-picker-view' : ' mobile-rail-chat-view'}${activeConversation?.type === 'group' && !channelSidebarOpen && !mobileChannelSelected ? ' mobile-channel-awaiting-choice' : ''}${conversationDetailsOpen ? ' details-open' : ''}${groupSettingsOpen && activeConversation?.type === 'group' ? ' group-sidebar-open' : ''}`}>
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
              conversations={railConversations}
              visibleConversationIds={railVisibleConversationIds}
              searchValue={chatListQuery}
              onSearchChange={setChatListQuery}
              controls={railControls}
              categoryControls={railCategoryControls}
              categories={conversationCategories.categories}
              onEntryContextMenu={(conversation, event) => {
                event.preventDefault();
                cancelConversationLongPress();
                const touchMenu = 'pointerType' in event.nativeEvent && event.nativeEvent.pointerType !== 'mouse';
                if (touchMenu) suppressConversationClick.current = conversation.id;
                setConversationMenuPosition(touchMenu ? null : { x: event.clientX, y: event.clientY });
                setConversationActionId(conversation.id);
              }}
              onEntryPointerDown={(conversation, event) => {
                if (event.pointerType !== 'mouse') beginConversationLongPress(conversation.id, event.clientX, event.clientY);
              }}
              onEntryPointerMove={(event) => moveConversationLongPress(event.clientX, event.clientY)}
              onEntryPointerEnd={cancelConversationLongPress}
              selectedId={activeConversationId}
              expanded={railListOpen}
              onSelect={openConversationFromRail}
              onCreate={() => { setChatCreateError(''); setNewChatMode('direct') }}
              onSearchCompact={() => {
                setRailListOpen(true);
                setDesktopChannelPanelOpen(false);
                setChannelSidebarOpen(false);
                setActiveConversationId(null);
              }}
              onCollapse={() => setRailListOpen(false)}
              hasMore={railHasMore}
              loadingMore={railLoadingMore}
              onLoadMore={railLoadMore}
            />

            <ConversationAvatarRail
                conversations={railConversations}
                visibleConversationIds={railVisibleConversationIds}
                searchValue={chatListQuery}
                searchControl={searchInConversationList ? quickSearchControl : undefined}
                onSearchChange={setChatListQuery}
                controls={railControls}
                categoryControls={railCategoryControls}
                categories={conversationCategories.categories}
                onEntryContextMenu={(conversation, event) => {
                  event.preventDefault();
                  cancelConversationLongPress();
                  const touchMenu = 'pointerType' in event.nativeEvent && event.nativeEvent.pointerType !== 'mouse';
                  if (touchMenu) suppressConversationClick.current = conversation.id;
                  setConversationMenuPosition(touchMenu ? null : { x: event.clientX, y: event.clientY });
                  setConversationActionId(conversation.id);
                }}
                onEntryPointerDown={(conversation, event) => {
                  if (event.pointerType !== 'mouse') beginConversationLongPress(conversation.id, event.clientX, event.clientY);
                }}
                onEntryPointerMove={(event) => moveConversationLongPress(event.clientX, event.clientY)}
                onEntryPointerEnd={cancelConversationLongPress}
                selectedId={activeConversationId}
                expanded={railListOpen}
                hasMore={railHasMore}
                loadingMore={railLoadingMore}
                onLoadMore={railLoadMore}
                onSelect={openConversationFromRail}
                onCreate={() => {
                  setChatCreateError('');
                  setNewChatMode('direct');
                }}
                onSearchCompact={() => {
                  setRailListOpen(true);
                  setChannelSidebarOpen(false);
                  setMobileChannelSelected(false);
                  setActiveConversationId(null);
                }}
                onCollapse={() => setRailListOpen(false)}
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
                suppressConversationClick={suppressConversationClick}
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
                  <MessageTimeline
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
                    messagesScrollRef={messagesScrollRef}
                    moveMessageLongPress={moveMessageLongPress}
                    openMessageActions={openMessageActions}
                    openMessageReactions={openMessageReactions}
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
                    setReadersTarget={setReadersTarget}
                  />

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
                  ) : (
                  <MessageComposer
                activeConversation={activeConversation}
                activeConversationId={activeConversationId}
                addChatFiles={addChatFiles}
                canSend={canSend}
                chatFileInputRef={chatFileInputRef}
                groupChannels={groupChannels}
                isProfileDesktop={isProfileDesktop}
                mediaUploading={mediaUploading}
                messageAttachments={messageAttachments}
                messageInputRef={messageInputRef}
                messageSending={messageSending}
                messageText={messageText}
                replyingTo={replyingTo}
                selectedChannelId={selectedChannelId}
                sendMessage={sendMessage}
                session={session}
                setGroupActivityCreateKind={setGroupActivityCreateKind}
                setMessageAttachments={setMessageAttachments}
                setMessageText={setMessageText}
                setNotice={setNotice}
                setReplyingTo={setReplyingTo}
                t={t}
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
                onCreateGroupActivity={setGroupActivityCreateKind}
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
                canManageGroup={canManageActiveGroup}
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
                onSearch={() => { setConversationDetailsOpen(false); setMessageSearchOpen(true) }}
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
                    onOpenShared={() => { setGroupSettingsOpen(false); setSharedContentOpen(true) }}
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
