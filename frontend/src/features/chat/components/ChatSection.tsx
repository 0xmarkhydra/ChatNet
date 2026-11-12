import { Plus, Search, Pin, RefreshCw, Images, Users, Languages, MoreHorizontal, X, UserPlus, Check, SmilePlus, LoaderCircle, Ban, Hash, CornerUpLeft, Forward } from "lucide-react";
import UiIcon from "../../../shared/ui/UiIcon";
import UserAvatar from "../../../shared/ui/UserAvatar";
import { userLabel } from "../../../shared/utils/userLabel";
import ConversationCategories, { CategoryBadge, CategoryAssignment } from "./ConversationCategories";
import { SocoEmptyState, SocoTextAction } from "../../../shared/ui/SocoUI";
import { formatTime, attachmentLabel } from "../../../shared/utils/format";
import { transferHasFiles, chatFilesFromClipboard } from "../utils/chatFileTransfer";
import GroupChannelSidebar from "../GroupChannelSidebar";
import { CallHeaderActions } from "../../calls/components/CallManager";
import { createPortal } from "react-dom";
import SharedContent from "./SharedContent";
import MessageSearchPanel from "./MessageSearchPanel";
import MessageReadersDialog, { MessageReadersInline } from "./MessageReadersDialog";
import { getMessageTranslationView } from "../utils/messageTranslationPresentation";
import { messageReactionLabel } from "../utils/messageReactions";
import { Fragment, FormEvent, useMemo, useState, type SetStateAction } from "react";
import { GroupActivityMarker, GroupActivityComposerMenu, type GroupActivityKind } from "./GroupActivities";
import { messageTextParts, messageLinkHref } from "../lib/messageClipboard";
import LinkPreview from "./LinkPreview";
import MediaAttachmentsView from "../../../shared/ui/MediaAttachmentsView";
import { isDesktopBuild } from "../../../platform/desktop";
import VoiceRecorder from "./VoiceRecorder";
import { shouldSendChatOnEnter } from "../utils/composerKeyboard";
import ConversationDetailsPanel from "./ConversationDetailsPanel";
import GroupSettingsPanel, { type GroupManagementSection } from "./GroupSettingsPanel";
import type { GroupPhotoTarget } from "../GroupAvatarEditor";
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

export type ChatSectionProps = {
  activeChatTranslationSettings: ChatTranslationSettings | undefined;
  activeConversation: Conversation | null;
  activeConversationId: number | null;
  activeConversationIdRef: RefObject<number | null>;
  activeGroupMember: GroupMember | null;
  actOnFriend: (friend: FriendSearchResult | FriendConnection, decline?: boolean) => Promise<void>;
  addChatFiles: (files: File[]) => Promise<void>;
  uploadMediaFiles: (files: File[], scope: 'chat' | 'feed' | 'story' | 'profile') => Promise<MediaAttachment[]>;
  apiFetch: (path: string, init?: RequestInit) => Promise<Response>;
  beginConversationLongPress: (id: number, x: number, y: number) => void;
  beginMessageLongPress: (message: Message, x: number, y: number, button: number, pointerType: string, target: EventTarget | null) => void;
  blockContact: (friend: Pick<FriendSearchResult, "id" | "username" | "displayName">) => Promise<void>;
  blockedBusy: boolean;
  bottomRef: RefObject<HTMLDivElement | null>;
  cancelConversationLongPress: () => void;
  cancelMessageLongPress: () => void;
  canEditGroup: boolean;
  canInviteActiveGroup: boolean;
  canManageActiveGroup: boolean;
  canSend: boolean;
  changeAutoTranslate: (next: boolean) => void;
  changeGroupMemberRole: (member: GroupMember, role: GroupMember["role"]) => Promise<void>;
  changeTargetLanguage: (next: string) => void;
  chatCreateError: string;
  chatDragActive: boolean;
  chatDragDepth: RefObject<number>;
  chatFileInputRef: RefObject<HTMLInputElement | null>;
  chatFiltersPill: { hostRef: (node: HTMLDivElement | null) => void; activeRef: (node: HTMLButtonElement | null) => void; pillRef: (node: HTMLSpanElement | null) => void; };
  chatFriend: { id: number; username: string; displayName: string; online: boolean; } | null;
  chatFriendRelationship: "accepted" | "incoming" | "outgoing" | "none";
  chatListConversations: Conversation[];
  chatListFilter: "all" | "unread" | "groups";
  chatListQuery: string;
  chatOnline: boolean;
  chatOutbox: QueuedChatMessage[];
  chatSearchJumpRevision: RefObject<number>;
  clearActiveConversationHistory: () => Promise<void>;
  conversationBlocked: boolean;
  conversationCategories: { categories: ConversationCategory[]; selected: number | null; select: (id: number | null) => void; items: Conversation[]; hasMore: boolean; loading: boolean; busy: boolean; error: string; listError: string; load: (more?: boolean, force?: boolean) => Promise<void>; save: (value: Omit<ConversationCategory, "id">, id?: number) => Promise<boolean>; remove: (id: number) => Promise<boolean>; assign: (id: number, categoryId: number | null) => Promise<boolean>; refreshCategories: (force?: boolean) => Promise<void>; refreshFiltered: () => void; applyAssignment: (id: number, categoryId: number | null) => void; };
  conversationDetailsOpen: boolean;
  conversationListSearch: { active: boolean; items: Conversation[]; loading: boolean; loadingMore: boolean; hasMore: boolean; error: string; retry: () => void; loadMore: () => Promise<void>; };
  conversationLoadingMore: boolean;
  copyInviteLink: () => Promise<void>;
  createDirect: (event: FormEvent) => Promise<void>;
  createGroupChannel: (name: string, description: string) => Promise<boolean>;
  directUsername: string;
  effectiveAutoTranslate: boolean;
  effectiveTargetLanguage: string;
  friendBusyIds: Set<number>;
  friendQuery: string;
  friendRelationship: (userId: number) => "accepted" | "incoming" | "outgoing" | "none";
  friendResults: FriendSearchResult[];
  friends: FriendConnection[];
  friendSearchError: boolean;
  friendSearching: boolean;
  friendSyncBusy: boolean;
  friendSyncError: string;
  friendSyncSessionId: string;
  groupActivities: { activities: GroupActivity[]; events: GroupActivityEvent[]; error: string; refresh: () => Promise<void>; create: (payload: { kind: GroupActivityKind; title: string; body: string; options: string[]; scheduledAt?: string; pin?: boolean; }) => Promise<void>; vote: (id: number, optionIndex: number) => Promise<void>; setPin: (id: number, pinned: boolean) => Promise<void>; };
  groupBusy: boolean;
  groupChannelBusy: boolean;
  groupChannels: GroupChannel[];
  groupChannelUnreadAvailable: boolean;
  groupInviteCandidates: FriendConnection[];
  groupInviteSearch: string;
  groupInviteSelection: number[];
  groupMembers: GroupMember[];
  groupMemberViewOpen: boolean;
  groupSettingsOpen: boolean;
  hasMoreConversations: boolean;
  hasMoreMessages: boolean;
  historyActionBusy: boolean;
  inviteGroupMembers: () => Promise<void>;
  isProfileDesktop: boolean;
  languageOptions: LanguageOption[];
  languageSearch: string;
  loadMissingMessages: () => Promise<void>;
  loadMoreConversations: () => Promise<void>;
  loadOlderMessages: () => Promise<void>;
  manuallyTranslated: Record<number, boolean>;
  mediaUploading: "chat" | "feed" | "story" | "profile" | null;
  messageAttachments: MediaAttachment[];
  messageGapBefore: number | null;
  messageGapLoading: boolean;
  messageInputRef: RefObject<HTMLTextAreaElement | null>;
  messageScrollAtBottom: RefObject<boolean>;
  messageSearchOpen: boolean;
  messageSending: boolean;
  messagesLoadingMore: boolean;
  messagesScrollRef: RefObject<HTMLDivElement | null>;
  messageText: string;
  moveConversationLongPress: (x: number, y: number) => void;
  moveMessageLongPress: (x: number, y: number) => void;
  newChatMode: NewChatMode;
  openConnectSurface: (query?: string) => void;
  openGroupSettings: (conversation: Conversation) => void;
  openMessageActions: (message: Message, target?: EventTarget | null) => void;
  openMessageReactions: (message: Message) => void;
  onReactionUsers: (message: Message, emoji: string) => void;
  onForwardMessage: (message: Message) => void;
  openVisitor: (username: string) => void;
  pinBusy: boolean;
  pinnedExpanded: boolean;
  pinnedItems: ({ type: "message"; pinnedAt: string; message: Message; } | { type: "activity"; pinnedAt: string; activity: GroupActivity; })[];
  quickSearchControl: ReactNode;
  reactionPreviews: Record<number, MessageReaction[]>;
  refreshFriendConnections: () => Promise<void>;
  refreshGroupMembers: (conversationId?: number | undefined) => Promise<void>;
  removeGroupMember: (member: GroupMember) => Promise<void>;
  replyingTo: Message | null;
  retryQueuedChatMessages: () => Promise<void>;
  searchInConversationList: boolean;
  selectedChannelId: number;
  selectGroupChannel: (channelId: number) => void;
  sendMessage: (event: FormEvent) => void;
  session: Session;
  setActiveConversationId: Dispatch<SetStateAction<number | null>>;
  setChatCreateError: Dispatch<SetStateAction<string>>;
  setChatDragActive: Dispatch<SetStateAction<boolean>>;
  setChatListFilter: Dispatch<SetStateAction<"all" | "unread" | "groups">>;
  setChatListQuery: Dispatch<SetStateAction<string>>;
  setChatSearchJump: Dispatch<SetStateAction<{ conversationId: number; messageId: number; revision: number; } | null>>;
  setConversationActionId: Dispatch<SetStateAction<number | null>>;
  setConversationDetailsOpen: Dispatch<SetStateAction<boolean>>;
  setConversationMenuPosition: Dispatch<SetStateAction<{ x: number; y: number; } | null>>;
  setConversations: Dispatch<SetStateAction<Conversation[]>>;
  setDirectUsername: Dispatch<SetStateAction<string>>;
  setFriendQuery: Dispatch<SetStateAction<string>>;
  setFriendResults: Dispatch<SetStateAction<FriendSearchResult[]>>;
  setFriendSearchRetry: Dispatch<SetStateAction<number>>;
  setGroupActivityCreateKind: Dispatch<SetStateAction<GroupActivityKind | null>>;
  setGroupActivityViewedId: Dispatch<SetStateAction<number | null>>;
  setGroupInviteSearch: Dispatch<SetStateAction<string>>;
  setGroupInviteSelection: Dispatch<SetStateAction<number[]>>;
  setGroupMemberViewOpen: Dispatch<SetStateAction<boolean>>;
  setGroupSettingsOpen: Dispatch<SetStateAction<boolean>>;
  setLanguageSearch: Dispatch<SetStateAction<string>>;
  setManuallyTranslated: Dispatch<SetStateAction<Record<number, boolean>>>;
  setMessageAttachments: (update: SetStateAction<MediaAttachment[]>) => void;
  setMessageSearchOpen: Dispatch<SetStateAction<boolean>>;
  setMessageText: (text: string) => void;
  setNewChatMode: Dispatch<SetStateAction<NewChatMode>>;
  setNotice: (message: string, kind?: ToastKind) => void;
  setPinnedExpanded: Dispatch<SetStateAction<boolean>>;
  setQrOpen: Dispatch<SetStateAction<"mine" | "scan" | null>>;
  setQuickSearchOpen: Dispatch<SetStateAction<boolean>>;
  setReplyingTo: Dispatch<SetStateAction<Message | null>>;
  setSharedContentOpen: Dispatch<SetStateAction<boolean>>;
  setTranslationMenuOpen: Dispatch<SetStateAction<boolean>>;
  setTranslationOriginals: Dispatch<SetStateAction<Record<number, boolean>>>;
  setTranslations: Dispatch<SetStateAction<Record<number, string>>>;
  setTranslationSettingsConversationId: Dispatch<SetStateAction<number | null>>;
  sharedContentOpen: boolean;
  shareMyProfile: () => Promise<void>;
  sortedChatListConversations: Conversation[];
  sortedGroupActivityEvents: GroupActivityEvent[];
  suppressConversationClick: RefObject<number | null>;
  suppressMessageClick: RefObject<number | null>;
  switchTab: (nextTab: Tab) => void;
  t: (key: keyof typeof UI_MESSAGES) => string;
  toggleMessagePin: (message: Message) => Promise<void>;
  toggleReaction: (message: Message, emoji: string) => Promise<void>;
  translateMessage: (message: Message, reveal?: boolean) => Promise<void>;
  translationFailures: Record<number, boolean>;
  translationMenuOpen: boolean;
  translationOriginals: Record<number, boolean>;
  translationPending: Record<number, boolean>;
  translations: Record<number, string>;
  unblockContact: (userId: number) => Promise<void>;
  updateChatOutbox: (transform: (items: QueuedChatMessage[]) => QueuedChatMessage[]) => QueuedChatMessage[];
  visibleConversations: Conversation[];
  visibleLanguageOptions: LanguageOption[];
  visibleMessages: Message[];
};

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
  chatFileInputRef,
  chatFiltersPill,
  chatFriend,
  chatFriendRelationship,
  chatListConversations,
  chatListFilter,
  chatListQuery,
  chatOnline,
  chatOutbox,
  chatSearchJumpRevision,
  clearActiveConversationHistory,
  conversationBlocked,
  conversationCategories,
  conversationDetailsOpen,
  conversationListSearch,
  conversationLoadingMore,
  copyInviteLink,
  createDirect,
  createGroupChannel,
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
  messageScrollAtBottom,
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
  const { hostRef: chatFiltersPillSetHost, activeRef: chatFiltersPillSetActive, pillRef: chatFiltersPillSetPill } = chatFiltersPill;
  const [readersTarget, setReadersTarget] = useState<{ message: Message; sessionId: string } | null>(null);
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
  const [groupPhotoBusy, setGroupPhotoBusy] = useState(false);
  const [channelSidebarOpen, setChannelSidebarOpen] = useState(false);
  const [groupManagementSection, setGroupManagementSection] = useState<GroupManagementSection>('members');
  const [sharedContentInitialTab, setSharedContentInitialTab] = useState<'media' | 'files' | 'links'>('media');

  async function saveGroupPhoto(target: GroupPhotoTarget, file: File | null): Promise<boolean> {
    if (target.kind && target.kind !== 'group') return false;
    if (!activeConversation || activeConversation.type !== 'group' || !canEditGroup || groupPhotoBusy) return false;
    const groupId = activeConversation.id;
    setGroupPhotoBusy(true);
    try {
      const capabilityResponse = await getGroupAvatarCapability(apiFetch, groupId);
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
      const response = await saveGroupAvatar(apiFetch, groupId, attachment ? attachmentRequestBody(attachment) : null);
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
      setConversations(current => current.map(item =>
        item.id === groupId ? { ...item, avatarUrl: data.avatarUrl || undefined } : item,
      ));
      setNotice('Đã cập nhật ảnh nhóm.', 'success');
      return true;
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Không lưu được ảnh.', 'error');
      return false;
    } finally {
      setGroupPhotoBusy(false);
    }
  }

  return (
      <div className={`messenger-layout modern-messenger social-chat-layout ${activeConversation ? 'has-active' : ''}${activeConversation?.type === 'group' ? ' group-channel-workspace' : ''}${conversationDetailsOpen ? ' details-open' : ''}${groupSettingsOpen && activeConversation?.type === 'group' ? ' group-sidebar-open' : ''}`}>
            {activeConversation?.type === 'group' && (
              <>
                <GroupChannelSidebar
                  groupName={activeConversation.name}
                  memberCount={activeConversation.memberCount}
                  groupAvatarUrl={activeConversation.avatarUrl}
                  channels={groupChannels}
                  selectedId={selectedChannelId}
                  unreadAvailable={groupChannelUnreadAvailable}
                  open={channelSidebarOpen}
                  onSelect={selectGroupChannel}
                  onClose={() => setChannelSidebarOpen(false)}
                  onBack={() => {
                    setChannelSidebarOpen(false)
                    setConversationDetailsOpen(false)
                    setActiveConversationId(null)
                  }}
                />
                {channelSidebarOpen && <button type="button" className="group-channel-sidebar-overlay"
                  aria-label="Đóng danh sách kênh" onClick={() => setChannelSidebarOpen(false)} />}
              </>
            )}
            <aside className="conversation-sidebar social-chat-list" aria-label="Danh sách cuộc trò chuyện">
              <div className="social-chat-list-header">
                <div className="social-chat-list-title">
                  <h2>Cuộc trò chuyện</h2>
                  <button type="button" className="social-chat-new" aria-label="Tạo cuộc trò chuyện mới"
                    title="Tạo cuộc trò chuyện" onClick={() => { setChatCreateError(''); setNewChatMode('direct') }}>
                    <Plus size={20} aria-hidden="true" />
                  </button>
                </div>
                {searchInConversationList ? quickSearchControl : (
                  <label className="social-chat-list-search">
                    <Search size={19} aria-hidden="true" />
                    <input type="search" value={chatListQuery} onChange={(event) => setChatListQuery(event.target.value)}
                      maxLength={120} placeholder="Tìm cuộc trò chuyện hoặc tin nhắn..."
                      aria-label="Tìm kiếm toàn bộ cuộc trò chuyện" />
                  </label>
                )}
                <div ref={chatFiltersPillSetHost} className="social-chat-list-filters sliding-pill-host" role="group" aria-label="Lọc cuộc trò chuyện">
                  <span ref={chatFiltersPillSetPill} className="sliding-pill social-chat-active-pill" aria-hidden="true" />
                  {([{ key: 'all', label: 'Tất cả' }, { key: 'unread', label: 'Chưa đọc' }, { key: 'groups', label: 'Nhóm' }] as const).map((filter) => (
                    <button ref={chatListFilter === filter.key ? chatFiltersPillSetActive : undefined} key={filter.key} type="button" aria-pressed={chatListFilter === filter.key}
                      className={chatListFilter === filter.key ? 'is-active' : ''}
                      onClick={() => setChatListFilter(filter.key)}>{filter.label}</button>
                  ))}
                </div>
              </div>
              {newChatMode === 'friends' && (
                <div className="connect-modal-layer">
                  <button
                    type="button"
                    className="connect-modal-scrim"
                    aria-label="Đóng tìm và kết nối"
                    onClick={() => { setNewChatMode('none'); setFriendQuery(''); setFriendResults([]) }}
                  />
                  <section
                    className="friend-search-panel connect-modal"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="connect-modal-title"
                  >
                    <div className="connect-modal-handle" aria-hidden="true" />
                    <div className="connect-ios-header">
                      <div>
                        <strong id="connect-modal-title">Kết nối</strong>
                        <small>Tìm bạn bè trên SocCO</small>
                      </div>
                      <button
                        type="button"
                        className="friend-search-close"
                        onClick={() => { setNewChatMode('none'); setFriendQuery(''); setFriendResults([]) }}
                        aria-label="Đóng tìm và kết nối"
                      >×</button>
                    </div>

                    <label className="friend-search-input-wrap connect-search-input">
                      <UiIcon name="search" size={19} />
                      <input
                        value={friendQuery}
                        onChange={(event) => setFriendQuery(event.target.value)}
                        placeholder="Tên, @username hoặc email"
                        aria-label="Tìm bạn bằng tên, username hoặc email"
                        autoCapitalize="none"
                        autoComplete="off"
                        spellCheck={false}
                        maxLength={254}
                      />
                      {friendQuery && (
                        <button type="button" aria-label="Xóa tìm kiếm" onClick={() => setFriendQuery('')}>×</button>
                      )}
                    </label>

                    <div className="connect-identity-card">
                      <UserAvatar username={session.user.username} name={userLabel(session.user.displayName, session.user.username)} className="connect-identity-avatar" online />
                      <div className="connect-identity-copy">
                        <strong>{session.user.displayName || session.user.username}</strong>
                        <span>@{session.user.username}</span>
                      </div>
                      <div className="connect-identity-actions" aria-label="Chia sẻ hồ sơ">
                        <button type="button" onClick={() => setQrOpen('mine')} aria-label="QR của tôi" title="QR của tôi"><UiIcon name="qr" size={20} /></button>
                        <button type="button" onClick={() => void shareMyProfile()} aria-label="Chia sẻ hồ sơ của tôi" title="Chia sẻ">↗</button>
                        <button type="button" onClick={() => void copyInviteLink()} aria-label="Sao chép link hồ sơ" title="Sao chép link">⧉</button>
                      </div>
                    </div>

                    <div className="friend-search-results connect-results">

                      {!friendSearching && !friendQuery.trim() && friendResults.length > 0 && (
                        <div className="friend-suggestion-label">Người bạn có thể biết</div>
                      )}
                      {friendSearchError && !friendSearching && (
                        <div className="friend-search-state" role="alert">Không tải được kết quả. <button type="button" onClick={() => setFriendSearchRetry((n) => n + 1)}>Thử lại</button></div>
                      )}
                      {!friendSearching && !friendSearchError && friendQuery.trim() && friendResults.length === 0 && (
                        <div className="friend-search-state">
                          <strong>Không tìm thấy người phù hợp</strong>
                          <span>Thử tên khác, @username hoặc email chính xác.</span>
                        </div>
                      )}
                      {friendResults.map((friend) => {
                        const relationship = friendRelationship(friend.id)
                        const actionLabel =
                          relationship === 'accepted'
                            ? 'Nhắn tin'
                            : relationship === 'incoming'
                              ? 'Chấp nhận'
                              : relationship === 'outgoing'
                                ? 'Hủy lời mời'
                                : 'Kết bạn'
                        return (
                          <button
                            type="button"
                            className="friend-result connect-result"
                            key={friend.id}
                            onClick={() => void actOnFriend(friend)}
                            disabled={friendBusyIds.has(friend.id)}
                          >
                            <UserAvatar username={friend.username} name={userLabel(friend.displayName, friend.username)} className="friend-avatar" online={friend.online} />
                            <div className="friend-result-copy">
                              <strong>{friend.displayName || friend.username}</strong>
                              <span>
                                @{friend.username}
                                {friend.reason ? ` · ${friend.reason}` : friend.online ? ' · Đang hoạt động' : ''}
                              </span>
                            </div>
                            <div className={`friend-result-action relationship-${relationship}`}>
                              <small>{actionLabel}</small><span>{relationship === 'none' ? '＋' : '›'}</span>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </section>
                </div>
              )}

              {newChatMode === 'direct' && (
                <form className="new-chat-panel" onSubmit={createDirect}>
                  <div className="panel-line"><strong>Tạo chat riêng</strong><button type="button" onClick={() => setNewChatMode('none')}>×</button></div>
                  <input value={directUsername} onChange={(event) => setDirectUsername(event.target.value)} placeholder="Username người muốn chat" maxLength={64} autoFocus />
                  <button>Tạo cuộc trò chuyện</button>
                </form>
              )}

              {chatCreateError && newChatMode !== 'group' && <div className="inline-error">{chatCreateError}</div>}

              <ConversationCategories key={session.sessionId} model={conversationCategories} />
              <div className="conversation-list zalo-conversation-list" aria-busy={conversationListSearch.active && conversationListSearch.loading}>

                {!conversationListSearch.active && conversationCategories.selected !== null && conversationCategories.listError && <div role="alert" className="category-error">
                  {conversationCategories.listError}<button type="button" onClick={() => void conversationCategories.load(false,true)}>Thử lại</button>
                </div>}

                {conversationListSearch.active && conversationListSearch.error && (
                  <p className="conversation-search-status" role="alert">
                    {conversationListSearch.error}
                    <button type="button" onClick={conversationListSearch.retry}>Thử lại</button>
                  </p>
                )}
                {chatListConversations.length === 0 &&
                  !conversationListSearch.loading && !conversationListSearch.error &&
                  (conversationListSearch.active || (!conversationCategories.loading && !conversationCategories.listError)) && (
                  <div className="conversation-list-empty">
                    <SocoEmptyState
                      kind="chat"
                      title={conversationListSearch.active ? 'Không tìm thấy cuộc trò chuyện'
                        : visibleConversations.length ? 'Không có hội thoại phù hợp' : 'Chưa có cuộc trò chuyện'}
                      description={conversationListSearch.active || visibleConversations.length
                        ? 'Thử thay đổi từ khóa hoặc chọn bộ lọc khác.'
                        : 'Tìm bạn bè để bắt đầu kết nối và trò chuyện.'}
                      action={conversationListSearch.active || visibleConversations.length
                        ? <SocoTextAction onClick={() => { setChatListQuery(''); setChatListFilter('all') }}>Xóa bộ lọc</SocoTextAction>
                        : <SocoTextAction onClick={() => openConnectSurface()}>Tìm bạn bè</SocoTextAction>}
                    />
                  </div>
                )}

                {sortedChatListConversations.map((conversation) => (
                  <div key={conversation.id} className="conversation-pin-entry"
                    onPointerDown={(event) => {
                      if (event.pointerType !== 'mouse') beginConversationLongPress(conversation.id, event.clientX, event.clientY)
                    }}
                    onPointerMove={(event) => moveConversationLongPress(event.clientX, event.clientY)}
                    onPointerUp={cancelConversationLongPress}
                    onPointerCancel={cancelConversationLongPress}
                    onPointerLeave={cancelConversationLongPress}
                    onContextMenu={(event) => {
                      event.preventDefault()
                      cancelConversationLongPress()
                      const touchMenu = 'pointerType' in event.nativeEvent && event.nativeEvent.pointerType !== 'mouse'
                      if (touchMenu) suppressConversationClick.current = conversation.id
                      setConversationMenuPosition(touchMenu ? null : { x: event.clientX, y: event.clientY })
                      setConversationActionId(conversation.id)
                    }}>
                    <button type="button"
                      className={`conversation-item ${activeConversationId === conversation.id ? 'active' : ''} ${conversation.pinnedAt ? 'is-pinned' : ''}`}
                      onClick={() => {
                        if (suppressConversationClick.current === conversation.id) {
                          suppressConversationClick.current = null
                          return
                        }
                        if (conversationListSearch.active) {
                          setConversations((current) => current.some((item) => item.id === conversation.id)
                            ? current : [...current, conversation]);
                        }
                        setChatSearchJump(null)
                        setQuickSearchOpen(false)
                        setActiveConversationId(conversation.id)
                        setTranslations({})
                        setTranslationOriginals({})
                        setTranslationMenuOpen(false)
                      }}
                    >
                      <UserAvatar
                        username={conversation.otherUsername} name={conversation.name}
                        className="conversation-avatar"
                        group={conversation.type === 'group'}
                        online={conversation.type === 'direct' && conversation.online}
                      />
                      <div className="conversation-copy">
                        <div>
                          <span className="conversation-title">
                            {conversation.pinnedAt && <Pin size={13} aria-label="Đã ghim" className="conversation-pin-indicator" />}
                            <strong>{conversation.name}</strong>
                            <CategoryBadge iconOnly category={conversationCategories.categories.find(c => c.id === conversation.categoryId)} />
                          </span>
                          <time>{formatTime(conversation.lastMessageAt) || (conversation.online ? 'online' : '')}</time>
                        </div>
                        <div>
                          <span>{conversation.lastMessage || (conversation.type === 'group' ? `${conversation.memberCount} thành viên` : 'Bắt đầu trò chuyện')}</span>
                          {conversation.unreadCount > 0 && <b>{conversation.unreadCount > 99 ? '99+' : conversation.unreadCount}</b>}
                        </div>
                      </div>
                    </button>
                  </div>
                ))}
                {(conversationListSearch.active ? conversationListSearch.hasMore
                  : conversationCategories.selected === null ? hasMoreConversations : conversationCategories.hasMore) && (
                  <button type="button" className="soco-load-more soco-conversation-load-more"
                    onClick={() => void (conversationListSearch.active ? conversationListSearch.loadMore()
                      : conversationCategories.selected === null ? loadMoreConversations() : conversationCategories.load(true))}
                    disabled={conversationListSearch.active ? conversationListSearch.loadingMore || Boolean(conversationListSearch.error)
                      : conversationLoadingMore || conversationCategories.loading}
                    aria-busy={conversationListSearch.active ? conversationListSearch.loadingMore : conversationLoadingMore || conversationCategories.loading}>
                    <RefreshCw size={15} aria-hidden="true" />
                    Tải thêm hội thoại
                  </button>
                )}
              </div>
            </aside>

            <section
              onDragEnter={(event) => {
                if (!transferHasFiles(event.dataTransfer)) return
                event.preventDefault()
                if (conversationBlocked) return
                chatDragDepth.current += 1
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
                chatDragDepth.current = Math.max(0, chatDragDepth.current - 1)
                if (chatDragDepth.current === 0) setChatDragActive(false)
              }}
              onDrop={(event) => {
                if (!transferHasFiles(event.dataTransfer)) return
                event.preventDefault()
                chatDragDepth.current = 0
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
                  <header className="chat-head">
                    <div className="room-info">
                      <button className="mobile-back" type="button" aria-label="Quay lại danh sách" onClick={() => setActiveConversationId(null)}>‹</button>
                      <UserAvatar
                        username={activeConversation.otherUsername} name={activeConversation.name}
                        className="room-avatar"
                        group={activeConversation.type === 'group'}
                        imageUrl={activeConversation.type === 'group' ? activeConversation.avatarUrl : undefined}
                        online={activeConversation.type === 'direct' && activeConversation.online}
                      />
                      <div className={activeConversation.type === 'group' ? 'group-room-details' : ''}>
                        {activeConversation.type === 'group' ? (
                          <>
                            <div className="group-room-title">
                              <strong title={activeConversation.name}>{activeConversation.name}</strong>
                              <button type="button" className="group-channel-sidebar-toggle"
                                aria-label="Mở danh sách kênh hội thoại"
                                onClick={() => setChannelSidebarOpen(true)}>
                                <Hash size={18} aria-hidden="true" />
                              </button>
                            </div>
                            <div className="room-subtitle group-room-subtitle">
                              <button type="button" className="group-room-member-count"
                                aria-label={`Xem danh sách ${activeConversation.memberCount} thành viên nhóm`}
                                onClick={() => {
                                  if (!groupSettingsOpen) openGroupSettings(activeConversation)
                                  setGroupMemberViewOpen(true)
                                }}>
                                <Users size={15} aria-hidden="true" />
                                <span>{activeConversation.memberCount} thành viên</span>
                              </button>
                              <CategoryAssignment model={conversationCategories}
                                conversationId={activeConversation.id}
                                categoryId={activeConversation.categoryId} />
                            </div>
                          </>
                        ) : (
                          <>
                            <strong>{activeConversation.otherUsername
                              ? <button type="button" className="visitor-name-link"
                                onClick={() => openVisitor(activeConversation.otherUsername!)}
                                aria-label="Xem trang cá nhân">{activeConversation.name}</button>
                              : activeConversation.name}</strong>
                            <small className="room-subtitle">
                              {conversationBlocked ? (activeConversation.blockedByOther ? 'Bạn đã bị chặn' : 'Bạn đã chặn người này') : activeConversation.online ? '● Đang hoạt động' : 'Chat riêng'}
                              <CategoryAssignment model={conversationCategories}
                                conversationId={activeConversation.id}
                                categoryId={activeConversation.categoryId} />
                            </small>
                          </>
                        )}
                      </div>
                    </div>

                    {activeConversation.type === 'group' && (
                      <div className="group-mobile-actions">
                        <CallHeaderActions conversationId={activeConversation.id} disabled={conversationBlocked} />
                        <button type="button" className="group-more-trigger"
                          aria-label="Tìm tin nhắn trong cuộc trò chuyện"
                          onClick={() => setMessageSearchOpen(true)}>
                          <Search size={20} aria-hidden="true" />
                        </button>
                        <div className="translation-hub">
                          <button type="button" className="group-more-trigger translation-toolbar-toggle"
                            aria-label={effectiveAutoTranslate ? 'Cài đặt dịch AI, đang bật' : 'Cài đặt dịch AI, đang tắt'}
                            title="Cài đặt dịch AI"
                            aria-expanded={translationMenuOpen}
                            aria-controls="chat-translation-dialog"
                            onClick={() => {
                              setLanguageSearch('')
                              setTranslationMenuOpen((open) => !open)
                            }}>
                            <Languages size={20} strokeWidth={1.9} aria-hidden="true" />
                          </button>
                        </div>
                        <button type="button" className="group-more-trigger"
                          aria-label="Thông tin hội thoại" aria-controls="conversation-details-panel"
                          aria-expanded={conversationDetailsOpen}
                          onClick={() => { setGroupSettingsOpen(false); setConversationDetailsOpen((open) => !open) }}>
                          <MoreHorizontal size={23} aria-hidden="true" />
                        </button>
                      </div>
                    )}

                    <div className="translate-controls">
                      <CallHeaderActions conversationId={activeConversation.id} disabled={conversationBlocked} />
                      <button type="button" className="group-settings-toggle" onClick={() => setMessageSearchOpen(true)} title="Tìm trong cuộc trò chuyện" aria-label="Tìm tin nhắn trong cuộc trò chuyện"><Search size={19} /></button>
                      <div className="translation-hub">
                        <button
                          type="button"
                          className={translationMenuOpen ? 'group-settings-toggle translation-toolbar-toggle active' : 'group-settings-toggle translation-toolbar-toggle'}
                          aria-expanded={translationMenuOpen}
                          aria-controls="chat-translation-dialog"
                          aria-label={effectiveAutoTranslate ? 'Cài đặt dịch AI, đang bật' : 'Cài đặt dịch AI, đang tắt'}
                          title="Cài đặt dịch AI"
                          onClick={() => {
                            setTranslationMenuOpen((current) => {
                              const next = !current
                              if (next) setLanguageSearch('')
                              return next
                            })
                          }}
                        >
                          <Languages size={21} strokeWidth={1.9} aria-hidden="true" />
                        </button>

                        {translationMenuOpen && createPortal(
                          <>
                            <button
                              type="button"
                              className="translation-hub-scrim"
                              aria-label="Đóng cài đặt dịch"
                              onClick={() => setTranslationMenuOpen(false)}
                            />
                            <div id="chat-translation-dialog" className="translation-hub-popover translation-dialog-modal" role="dialog" aria-modal="true" aria-label="Cài đặt dịch AI">
                              <div className="translation-hub-heading">
                                <div>
                                  <strong>{t('translation.title')}</strong>
                                  <small>{t('translation.subtitle')}</small>
                                </div>
                                <div className="translation-dialog-actions">
                                  <button
                                    type="button"
                                    className={effectiveAutoTranslate ? 'translation-hub-switch active' : 'translation-hub-switch'}
                                    aria-label="Tự động dịch tin nhắn"
                                    role="switch"
                                    aria-checked={effectiveAutoTranslate}
                                    onClick={() => changeAutoTranslate(!effectiveAutoTranslate)}
                                  >
                                    <span />
                                  </button>
                                  <button type="button" className="translation-dialog-close"
                                    aria-label="Đóng cài đặt dịch" onClick={() => setTranslationMenuOpen(false)}>
                                    <X size={19} aria-hidden="true" />
                                  </button>
                                </div>
                              </div>

                              <label className="translation-language-search">
                                <span aria-hidden="true">⌕</span>
                                <input
                                  type="search"
                                  value={languageSearch}
                                  onChange={(event) => setLanguageSearch(event.target.value)}
                                  placeholder={t('translation.searchPlaceholder')}
                                  autoComplete="off"
                                  autoCapitalize="none"
                                  spellCheck={false}
                                  autoFocus
                                />
                                {languageSearch && (
                                  <button type="button" aria-label="Xóa tìm kiếm" onClick={() => setLanguageSearch('')}>×</button>
                                )}
                              </label>

                              <div className="translation-language-count">
                                <span>{visibleLanguageOptions.length} {t('translation.languageCount')}</span>
                                <small>{t('translation.languageHint')}</small>
                              </div>

                              <div className="translation-language-list" aria-label="Chọn ngôn ngữ dịch">
                                {visibleLanguageOptions.map((language) => (
                                  <button
                                    key={language.value}
                                    type="button"
                                    className={effectiveTargetLanguage === language.value ? 'active' : ''}
                                    onClick={() => changeTargetLanguage(language.value)}
                                  >
                                    <span className="translation-language-flag" aria-hidden="true">{language.flag}</span>
                                    <span className="translation-language-copy">
                                      <strong>{language.localizedLanguage}</strong>
                                      <small>{language.nativeLanguage}</small>
                                      <em>{language.localizedRegion} · {language.nativeRegion}</em>
                                    </span>
                                    <b>{language.code}</b>
                                    {effectiveTargetLanguage === language.value && <i aria-hidden="true">✓</i>}
                                  </button>
                                ))}
                                {visibleLanguageOptions.length === 0 && (
                                  <div className="translation-language-empty">
                                    {t('translation.noResults')}
                                  </div>
                                )}
                              </div>
                            </div>
                          </>, document.body
                        )}
                      </div>
                      <button type="button" className={conversationDetailsOpen ? 'group-settings-toggle active' : 'group-settings-toggle'}
                        onClick={() => { setGroupSettingsOpen(false); setConversationDetailsOpen((open) => !open) }}
                        title="Thông tin hội thoại" aria-label="Thông tin hội thoại"
                        aria-controls="conversation-details-panel" aria-expanded={conversationDetailsOpen}>
                        <MoreHorizontal size={22} aria-hidden="true" />
                      </button>
                    </div>
                  </header>

                  {pinnedItems.length > 0 && (
                    <div className="chat-pinned-panel" role="region" aria-label="Nội dung đã ghim">
                      <div className="chat-pinned-heading">
                        <Pin size={16} aria-hidden="true" />
                        <strong>Nội dung đã ghim ({pinnedItems.length})</strong>
                        {pinnedItems.length > 1 && (
                          <button type="button" onClick={() => setPinnedExpanded((value) => !value)}
                            aria-expanded={pinnedExpanded}>
                            {pinnedExpanded ? 'Thu gọn' : 'Xem tất cả'}
                          </button>
                        )}
                      </div>
                      <div className="chat-pinned-items">
                        {pinnedItems.slice(0, pinnedExpanded ? 200 : 1).map((pin) => (
                          pin.type === 'message' ? (
                            <div className="chat-pinned-item" key={`message-${pin.message.id}`}>
                              <button type="button" className="chat-pinned-jump"
                                title="Đi đến tin nhắn đã ghim"
                                onClick={() => setChatSearchJump({
                                  conversationId: activeConversation.id,
                                  messageId: pin.message.id,
                                  revision: ++chatSearchJumpRevision.current,
                                })}>
                                <strong>{userLabel(pin.message.senderDisplayName, pin.message.sender)}</strong>
                                <span>{pin.message.text || attachmentLabel(pin.message.attachments) || 'Tin nhắn'}</span>
                              </button>
                              <button type="button" className="chat-pinned-remove" disabled={pinBusy}
                                aria-label="Bỏ ghim tin nhắn" title="Bỏ ghim tin nhắn"
                                onClick={() => void toggleMessagePin(pin.message)}>
                                <X size={15} aria-hidden="true" />
                              </button>
                            </div>
                          ) : (
                            <div className="chat-pinned-item" key={`activity-${pin.activity.id}`}>
                              <button type="button" className="chat-pinned-jump"
                                title="Xem hoạt động nhóm đã ghim"
                                onClick={() => setGroupActivityViewedId(pin.activity.id)}>
                                <strong>{pin.activity.kind === 'poll' ? 'Bình chọn' : pin.activity.kind === 'note' ? 'Ghi chú' : 'Nhắc hẹn'}</strong>
                                <span>{pin.activity.body || (pin.activity.scheduledAt
                                  ? new Date(pin.activity.scheduledAt).toLocaleString('vi-VN')
                                  : 'Nhấn để xem chi tiết')}</span>
                              </button>
                              <button type="button" className="chat-pinned-remove"
                                aria-label="Bỏ ghim hoạt động nhóm" title="Bỏ ghim hoạt động nhóm"
                                onClick={() => void groupActivities.setPin(pin.activity.id, false)
                                  .catch((error) => setNotice(error instanceof Error ? error.message : 'Không thể bỏ ghim.', 'error'))}>
                                <X size={15} aria-hidden="true" />
                              </button>
                            </div>
                          )
                        ))}
                      </div>
                    </div>
                  )}


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
                          revision: ++chatSearchJumpRevision.current,
                        })
                      }}
                    />
                  )}
                  <div className="messages" ref={messagesScrollRef} onScroll={(event) => {
                    const element = event.currentTarget
                    messageScrollAtBottom.current = element.scrollHeight - element.scrollTop - element.clientHeight < 100
                  }}>
                    {hasMoreMessages && (
                      <button type="button" className="soco-load-more soco-older-messages"
                        onClick={() => void loadOlderMessages()} disabled={messagesLoadingMore}
                        aria-busy={messagesLoadingMore}>
                        <RefreshCw size={16} aria-hidden="true" />
                        Tải thêm tin nhắn cũ
                      </button>
                    )}
                    {visibleMessages.map((message, index) => {
                      const messageDay = new Date(message.createdAt)
                      const previousDay = index > 0 ? new Date(visibleMessages[index - 1].createdAt) : null
                      const displayDay = !previousDay || messageDay.toDateString() !== previousDay.toDateString()
                      const today = new Date()
                      const yesterday = new Date(today)
                      yesterday.setDate(yesterday.getDate() - 1)
                      const dayLabel = messageDay.toDateString() === today.toDateString() ? 'Hôm nay'
                        : messageDay.toDateString() === yesterday.toDateString() ? 'Hôm qua'
                          : new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(messageDay)
                      const mine = message.senderId === session.user.id
                      const translatedText = !message.deleted ? translations[message.id] : ''
                      const photoOnly = !message.deleted && !message.text && message.attachments?.length === 1 && message.attachments[0].kind === 'image' && Boolean(message.attachments[0].url)
                      const originalVisible = Boolean(translationOriginals[message.id])
                      const translatedLanguage = languageOptions.find(option => option.value === effectiveTargetLanguage)?.localizedLanguage || effectiveTargetLanguage.toUpperCase()
                      const translationEnabled = effectiveAutoTranslate || Boolean(manuallyTranslated[message.id])
                      const translationView = getMessageTranslationView({
                        originalText: message.text,
                        translatedText,
                        enabled: translationEnabled,
                        showOriginal: originalVisible,
                        display: activeChatTranslationSettings?.display,
                      })
                      const hasTranslation = Boolean(translatedText?.trim() && translatedText.trim() !== message.text.trim())
                      const longTranslation = hasTranslation && translationEnabled && (activeChatTranslationSettings?.display === 'translated' ||
                        (activeChatTranslationSettings?.display !== 'bilingual' && Array.from(message.text).length > 100))
                      const isTranslating = Boolean(translationPending[message.id])
                      const translationFailed = Boolean(translationFailures[message.id])
                      const reactionControls = !conversationBlocked ? (
                        <div className="message-reactions">
                          {(message.reactions || []).map((reaction) => (
                            <button
                              key={reaction.emoji}
                              type="button"
                              disabled={reactionPreviews[message.id] !== undefined}
                              className={reaction.mine ? 'reaction-chip active' : 'reaction-chip'}
                              onClick={() => onReactionUsers(message, reaction.emoji)}
                              aria-label={`Xem ${reaction.count} người thả ${messageReactionLabel(reaction.emoji)}`}
                            >
                              {reaction.emoji} {reaction.count}
                            </button>
                          ))}
                          <button type="button" className="reaction-add"
                            aria-label="Chọn cảm xúc cho tin nhắn"
                            title="Thả cảm xúc"
                            onClick={() => openMessageReactions(message)}>
                            <SmilePlus size={16} aria-hidden="true" />
                          </button>
                        </div>
                      ) : null
                      return (
                        <Fragment key={message.id}>
                          {displayDay && <div className="day-divider"><span>{dayLabel}</span></div>}
                          {activeConversation.type === 'group' && sortedGroupActivityEvents
                            .filter(event => event.createdAt <= message.createdAt &&
                              (index === 0 || event.createdAt > visibleMessages[index - 1].createdAt))
                            .map(event => <GroupActivityMarker key={`activity-${event.id}`} event={event}
                              activity={groupActivities.activities.find(item => item.id === event.activityId)}
                              onOpen={() => setGroupActivityViewedId(event.activityId)} />)}
                          {messageGapBefore === message.id && (
                            <button type="button" className="soco-load-more soco-middle-messages"
                              onClick={() => void loadMissingMessages()} disabled={messageGapLoading}
                              aria-busy={messageGapLoading}>
                              <RefreshCw size={15} aria-hidden="true" />
                              Tải tin nhắn ở giữa
                            </button>
                          )}
                        <article
                          data-message-id={message.id}
                          className={'message message-press-target' + (mine ? ' mine' : '') + (activeConversation.type === 'group' ? ' channel-message' : '')}
                          onPointerDown={(event) => {
                            suppressMessageClick.current = null
                            if (!conversationBlocked) beginMessageLongPress(message, event.clientX, event.clientY, event.button, event.pointerType, event.target)
                          }}
                          onPointerMove={(event) => moveMessageLongPress(event.clientX, event.clientY)}
                          onPointerUp={cancelMessageLongPress}
                          onPointerCancel={cancelMessageLongPress}
                          onPointerLeave={cancelMessageLongPress}
                          onClickCapture={(event) => {
                            if (suppressMessageClick.current !== message.id) return
                            event.preventDefault()
                            event.stopPropagation()
                            suppressMessageClick.current = null
                          }}
                          onContextMenu={(event) => {
                            if (message.deleted || conversationBlocked) return
                            // Keep native context-copy for text selected inside this message.
                            const selection = window.getSelection()
                            if (event.target instanceof Element &&
                                event.target.closest('.message-selectable-text') &&
                                !event.target.closest('a.message-inline-link') &&
                                selection && !selection.isCollapsed &&
                                event.currentTarget.contains(selection.anchorNode) &&
                                event.currentTarget.contains(selection.focusNode)) return
                            event.preventDefault()
                            openMessageActions(message, event.target)
                          }}
                        >
                          {!mine && (
                            <>
                              <UserAvatar username={message.sender} name={userLabel(message.senderDisplayName, message.sender)}
                                className="chat-message-sender-avatar" online={false} />
                              <div className={activeConversation.type === 'group' ? 'message-meta' : 'message-meta chat-message-meta-direct'}>{userLabel(message.senderDisplayName, message.sender)}</div>
                            </>
                          )}
                          {message.replyToMessageId && (
                            <div className="message-reply-quote">
                              <strong>{userLabel(message.replyToDisplayName, message.replyToSender)}</strong>
                              <span>{message.replyToText || 'Tin nhắn đã thu hồi'}</span>
                            </div>
                          )}
                          {message.deleted ? (
                            <div className="bubble recalled-message">Tin nhắn đã được thu hồi</div>
                          ) : (
                            <div className="message-content">
                              {message.forwarded && (
                                <span className="chat-forwarded-caption">Đã chuyển tiếp 1 tin nhắn</span>
                              )}
                              {message.text && (
                                <div className={`bubble${translationView.mode === 'dual' ? ' chat-translation-dual' : ''}${translationView.mode === 'translated' ? ' translated-bubble translation-flip-bubble' : ''}`}>
                                  <span
                                    key={`${message.id}-${translationView.mode}-${originalVisible ? 'original' : 'translated'}`}
                                    className="translation-flip-content message-selectable-text"
                                  >
                                    {messageTextParts(translationView.primaryText).map((part, index) => part.kind === 'link'
                                      ? <a key={index} className="message-inline-link" href={messageLinkHref(part.text)} target="_blank" rel="noopener noreferrer">{part.text}</a>
                                      : <Fragment key={index}>{part.text}</Fragment>)}
                                  </span>
                                  {translationView.secondaryText !== null && (
                                    <span className="chat-translation-original message-selectable-text">
                                      {messageTextParts(translationView.secondaryText).map((part, index) => part.kind === 'link'
                                        ? <a key={index} className="message-inline-link" href={messageLinkHref(part.text)} target="_blank" rel="noopener noreferrer">{part.text}</a>
                                        : <Fragment key={index}>{part.text}</Fragment>)}
                                    </span>
                                  )}
                                  <LinkPreview text={message.text} cacheScope={session?.sessionId || ""} request={apiFetch} />
                                  {reactionControls}
                                  {!isTranslating && !effectiveAutoTranslate && translationView.mode === 'dual' && (
                                    <button type="button" className="chat-translation-action"
                                      aria-label="Ẩn dịch" title="Ẩn dịch"
                                      onClick={() => setManuallyTranslated((current) => ({ ...current, [message.id]: false }))}>
                                      <Languages size={17} strokeWidth={1.9} aria-hidden="true" />
                                    </button>
                                  )}
                                  {!isTranslating && !effectiveAutoTranslate &&
                                    (!manuallyTranslated[message.id] || !hasTranslation) && (
                                    <button type="button" className="chat-translation-action"
                                      aria-label={translationFailed ? 'Thử dịch lại' : 'Dịch'}
                                      title={translationFailed ? 'Thử dịch lại' : 'Dịch'}
                                      onClick={() => void translateMessage(message)}>
                                      <Languages size={17} strokeWidth={1.9} aria-hidden="true" />
                                    </button>
                                  )}
                                  {!isTranslating && effectiveAutoTranslate && translationFailed && !hasTranslation && (
                                    <button type="button" className="chat-translation-action"
                                      aria-label="Thử dịch lại" title="Thử dịch lại"
                                      onClick={() => void translateMessage(message)}>
                                      <Languages size={17} strokeWidth={1.9} aria-hidden="true" />
                                    </button>
                                  )}
                                </div>
                              )}
                              {longTranslation && (
                                <button
                                  type="button"
                                  className={originalVisible ? 'translation-flip-pill original' : 'translation-flip-pill translated'}
                                  aria-label={originalVisible ? 'Hiện nội dung đã dịch' : 'Hiện tin nhắn gốc'}
                                  onClick={() => setTranslationOriginals((current) => ({
                                    ...current, [message.id]: !current[message.id],
                                  }))}
                                >
                                  <span className="translation-flip-icon" aria-hidden="true">↔</span>
                                  <b>{originalVisible ? 'DỊCH' : 'GỐC'}</b>
                                  <small>{originalVisible ? translatedLanguage : 'Nguyên văn'}</small>
                                  <span className="translation-flip-swap" aria-hidden="true">↔</span>
                                </button>
                              )}
                              {isTranslating && (
                                <span className="chat-translation-loading" role="status" aria-live="polite">
                                  <LoaderCircle size={15} aria-hidden="true" />
                                  Đang dịch tin nhắn…
                                </span>
                              )}
                              {Boolean(message.attachments?.length) && (
                                <div className={photoOnly ? 'chat-message-media chat-message-photo' : 'chat-message-media'}>
                                  <MediaAttachmentsView items={message.attachments} />
                                  {photoOnly && <span className="chat-image-time">{formatTime(message.createdAt)}</span>}
                                </div>
                              )}
                              {!message.text && reactionControls}
                              {!conversationBlocked && (
                                <div className="chat-message-hover-toolbar" role="group" aria-label="Thao tác tin nhắn">
                                  <button type="button" title="Trả lời" aria-label="Trả lời tin nhắn"
                                    onClick={() => { setReplyingTo(message); messageInputRef.current?.focus() }}>
                                    <CornerUpLeft size={18} strokeWidth={2} aria-hidden="true" />
                                  </button>
                                  <button type="button" title="Chuyển tiếp" aria-label="Chuyển tiếp tin nhắn"
                                    onClick={() => onForwardMessage(message)}>
                                    <Forward size={18} aria-hidden="true" />
                                  </button>
                                  {Boolean(message.text.trim()) && (
                                    <button type="button" title="Dịch" aria-label="Dịch tin nhắn"
                                      disabled={isTranslating}
                                      onClick={() => void translateMessage(message)}>
                                      <Languages size={18} aria-hidden="true" />
                                    </button>
                                  )}
                                  <button type="button" title="Thêm tùy chọn" aria-label="Thêm tùy chọn tin nhắn"
                                    onClick={(event) => openMessageActions(message, event.currentTarget)}>
                                    <MoreHorizontal size={18} aria-hidden="true" />
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                          <div className={photoOnly ? 'message-stamp chat-photo-stamp' : 'message-stamp'}>
                            {formatTime(message.createdAt)}
                            {message.editedAt && !message.deleted ? ' · đã sửa' : ''}
                            {mine && (message.readByUserIds?.length || 0) > 0
                              ? <MessageReadersInline
                                  readerIds={message.readByUserIds || []}
                                  members={messageReaderMembers}
                                  onOpen={() => setReadersTarget({ message, sessionId: session.sessionId })}
                                />
                              : ''}
                          </div>
                        </article>
                        </Fragment>
                      )
                    })}
                    {activeConversation.type === 'group' && sortedGroupActivityEvents
                      .filter(event => !visibleMessages.length || event.createdAt > visibleMessages[visibleMessages.length - 1].createdAt)
                      .map(event => <GroupActivityMarker key={`activity-${event.id}`} event={event}
                        activity={groupActivities.activities.find(item => item.id === event.activityId)}
                        onOpen={() => setGroupActivityViewedId(event.activityId)} />)}
                    {activeConversation.type === 'group' && groupActivities.error && (
                      <button type="button" className="group-activity-marker" onClick={() => void groupActivities.refresh()}>
                        Không tải được hoạt động nhóm. Nhấn để thử lại.
                      </button>
                    )}
                    {chatOutbox.filter((item) => item.conversationId === activeConversationId && (item.channelId || 0) === selectedChannelId).map((item) => (
                      <article className="message mine outgoing-preview chat-outbox-message" key={item.clientId} aria-busy={item.status !== 'failed'}>
                        {item.replyToMessageId && (
                          <div className="message-reply-quote">
                            <strong>{item.replyToSender || 'Trả lời'}</strong><span>{item.replyToText}</span>
                          </div>
                        )}
                        {item.text && <div className="bubble"><span className="message-selectable-text">{item.text}</span></div>}
                        <MediaAttachmentsView items={item.attachments} />
                        <div className="chat-outbox-footer">
                          {(item.status === 'failed' || !chatOnline) && (
                            <span className={item.status === 'failed' ? 'message-stamp chat-outbox-error' : 'message-stamp'} role="status">
                              {item.status === 'failed' ? item.error || 'Không gửi được' : 'Chờ có mạng'}
                            </span>
                          )}
                          {!conversationBlocked && (item.status === 'failed' || (item.status === 'unconfirmed' && chatOnline)) && (
                            <button type="button" className="chat-outbox-retry"
                              aria-label={item.status === 'failed' ? 'Gửi lại tin nhắn bị lỗi' : 'Gửi lại tin nhắn đang chờ'}
                              onClick={() => {
                              updateChatOutbox((items) => items.map((old) =>
                                old.clientId === item.clientId ? { ...old, status: 'queued', error: undefined } : old))
                              void retryQueuedChatMessages()
                            }}><RefreshCw size={14} /> Gửi lại</button>
                          )}
                        </div>
                      </article>
                    ))}
                    <div ref={bottomRef} />
                  </div>

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
                  <form className="composer media-composer" onSubmit={(event) => {
                    void sendMessage(event)
                    if (isDesktopBuild) messageInputRef.current?.focus()
                  }}>
                    <input
                      ref={chatFileInputRef}
                      className="hidden-media-input"
                      type="file"
                      multiple
                      accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip"
                      onChange={(event) => {
                        const files = Array.from(event.currentTarget.files || [])
                        event.currentTarget.value = ''
                        void addChatFiles(files)
                      }}
                    />
                    {replyingTo && (
                      <div className="composer-reply-preview">
                        <div>
                          <strong>Đang trả lời {userLabel(replyingTo.senderDisplayName, replyingTo.sender)}</strong>
                          <span>{replyingTo.deleted ? 'Tin nhắn đã thu hồi' : (replyingTo.text || attachmentLabel(replyingTo.attachments))}</span>
                        </div>
                        <button type="button" onClick={() => setReplyingTo(null)} aria-label="Hủy trả lời">×</button>
                      </div>
                    )}
                    {messageAttachments.length > 0 && (
                      <div className="composer-pending">
                        <MediaAttachmentsView
                          items={messageAttachments}
                          pending
                          onRemove={messageSending ? undefined : (index) => setMessageAttachments((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                        />
                      </div>
                    )}
                    <button
                      className="ghost-action attach-button"
                      type="button"
                      onClick={() => chatFileInputRef.current?.click()}
                      disabled={Boolean(mediaUploading) || messageSending}
                      aria-label="Đính kèm file"
                    >
                      <UiIcon name="attach" size={22} />
                      <Plus className="chat-composer-plus" size={21} aria-hidden="true" />
                    </button>
                    <button className="ghost-action chat-composer-image" type="button"
                      onClick={() => chatFileInputRef.current?.click()}
                      disabled={Boolean(mediaUploading) || messageSending}
                      aria-label="Đính kèm ảnh hoặc video" title="Chọn ảnh hoặc video">
                      <Images size={19} aria-hidden="true" />
                    </button>
                    <VoiceRecorder
                      key={`${session.sessionId}:${activeConversationId}`}
                      disabled={Boolean(mediaUploading) || messageSending}
                      onRecorded={(file) => { void addChatFiles([file]) }}
                      onError={(message) => setNotice(message, 'error')}
                    />
                    {activeConversation.type === 'group' && (
                      <GroupActivityComposerMenu
                        key={activeConversation.id}
                        onCreate={setGroupActivityCreateKind}
                      />
                    )}
                    <textarea
                      ref={messageInputRef}
                      className="chat-message-input"
                      rows={1}
                      aria-label="Tin nhắn"
                      placeholder={isProfileDesktop ? 'Nhập tin nhắn...' : activeConversation.type === 'group' ? selectedChannelId ? `Nhắn vào # ${groupChannels.find(channel => channel.id === selectedChannelId)?.name || 'kênh hội thoại'}...` : `Nhắn vào ${activeConversation.name}...` : `Nhắn ${activeConversation.name}...`}
                      value={messageText}
                      onChange={(event) => setMessageText(event.target.value)}
                      onKeyDown={(event) => {
                        if (!shouldSendChatOnEnter(event.nativeEvent)) return;
                        event.preventDefault();
                        event.currentTarget.form?.requestSubmit();
                      }}
                      onPaste={(event) => {
                        const files = chatFilesFromClipboard(event.clipboardData)
                        if (files.length === 0) return // Preserve normal text paste (Cmd/Ctrl+V).
                        event.preventDefault()
                        void addChatFiles(files)
                      }}
                      title="Dán ảnh/tệp bằng Cmd/Ctrl+V hoặc kéo thả vào cuộc trò chuyện"
                      maxLength={4000}
                    />
                    <button className="send-button polished-send" disabled={!canSend} aria-label="Gửi tin nhắn">
                      <><span className="send-label">Gửi</span><UiIcon name="send" size={19} /></>
                    </button>
                  </form>
                  )}
                </>
              )}
            </section>
            {activeConversation && conversationDetailsOpen && (
              <ConversationDetailsPanel
                conversation={activeConversation}
                busy={historyActionBusy || blockedBusy}
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
            {readersMessage && readersMessage.conversationId === activeConversationId && (
              <MessageReadersDialog
                key={readersMessage.id}
                conversationId={readersMessage.conversationId}
                readerIds={readersMessage.readByUserIds || []}
                request={apiFetch}
                onClose={() => setReadersTarget(null)}
              />
            )}
          </div>
  );
}
