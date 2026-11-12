import ProfileNote from "../features/profile/components/ProfileNote";
import ConversationCategories, {
  CategoryAssignment,
  CategoryBadge,
} from "../features/chat/components/ConversationCategories";
import { useConversationCategories } from "../features/chat/hooks/useConversationCategories";
import { SessionResponseCache } from "../shared/lib/sessionCache";
import VisitorProfile from "../features/profile/components/VisitorProfile";
import { userLabel } from "../shared/utils/userLabel";
import { useMessageData } from "../features/chat/hooks/useMessageData";
import { useChatPins } from "../features/chat/hooks/useChatPins";
import { shouldSendChatOnEnter } from "../features/chat/utils/composerKeyboard";
import "../features/chat/styles/chat-pins.css";
import { getMessageTranslationView } from "../features/chat/utils/messageTranslationPresentation";
import { useSession } from "../shared/context/SessionContext";
import { useApi } from "../shared/context/ApiContext";
import { useNotice } from "../shared/context/NoticeContext";
import { useAppRealtime } from "./hooks/useAppRealtime";
import { useDesktopNotifications } from "../features/chat/hooks/useDesktopNotifications";
import { useConversationData } from "../features/chat/hooks/useConversationData";
import { useConversationListSearch } from "../features/chat/hooks/useConversationListSearch";
import {
  useChatQuickSearch,
  type ChatQuickContact,
  type ChatQuickHit,
} from "../features/chat/hooks/useChatQuickSearch";
import ChatQuickSearch from "../features/chat/components/ChatQuickSearch";
import { useContactData } from "../features/contacts/hooks/useContactData";
import { useFeedData } from "../features/feed/hooks/useFeedData";
import { usePostSearch } from "../features/feed/hooks/usePostSearch";
import { useFollowingPosts } from "../features/feed/hooks/useFollowingPosts";
import { useFeedInfiniteScroll } from "../features/feed/hooks/useFeedInfiniteScroll";

import { useGroupManagement } from "../features/chat/hooks/useGroupManagement";
import { API } from "../shared/lib/config";
import type {
  ProfileMediaState,
  ProfileUpdateResponse,
  UserPrivacy,
} from "../features/profile/types";
import {
  attachmentRequestBody,
  type MediaAttachment,
  type PresignedUpload,
} from "../shared/utils/media";
import {
  emptyDraft,
  CHAT_LIST_PAGE_SIZE,
  MESSAGE_PAGE_SIZE,
  type Message,
  type MessageReaction,
  type MessageDraft,
  type Conversation,
  type RealtimeEvent,
  type GroupMember,
  type NewChatMode,
} from "../features/chat/types";
import { FEED_PAGE_SIZE, type Post, type Story } from "../features/feed/types";
import type { Tab } from "../shared/types/navigation";
import type {
  FriendSearchResult,
  FriendConnection,
} from "../features/contacts/types";
import type { ManagedAccountSession } from "../features/auth/types";
import type { InstallPromptEvent } from "../features/pwa/types";
import {
  type ToastKind,
} from "../shared/utils/toast";
import { formatTime, attachmentLabel } from "../shared/utils/format";
import UserAvatar, {
  avatarRefreshVersions,
  profileAssetUrl,
} from "../shared/ui/UserAvatar";
import useSlidingPill from "../shared/ui/useSlidingPill";
import MediaAttachmentsView from "../shared/ui/MediaAttachmentsView";
import UiIcon from "../shared/ui/UiIcon";
import NearbyRadar from "../features/discover/components/NearbyRadar";
import PostComposer from "../features/feed/components/PostComposer";
import FeedPostCard from "../features/feed/components/FeedPostCard";
import ReactionParticipantsDialog from "../shared/ui/ReactionParticipantsDialog";
import MessageForwardPicker from "../features/chat/components/MessageForwardPicker";
import FeedReactionControl from "../features/feed/components/FeedReactionControl";
import StoryViewer from "../features/feed/components/StoryViewer";
import MessageActions from "../features/chat/components/MessageActions";
import LinkPreview from "../features/chat/components/LinkPreview";
import { GroupActivityComposerMenu, GroupActivityDialog, GroupActivityMarker, useGroupActivities, type GroupActivityKind } from "../features/chat/components/GroupActivities";
import { messageReactionLabel } from "../features/chat/utils/messageReactions";
import {
  copyChatImage,
  messageLinkHref,
  messageTextParts,
} from "../features/chat/lib/messageClipboard";
import {
  resolveMessageCopyTarget,
  type MessageCopyTarget,
} from "../features/chat/utils/messageCopyTarget";
import MessageSearchPanel from "../features/chat/components/MessageSearchPanel";
import ProfileIdentityForm from "../features/profile/components/ProfileIdentityForm";
import BottomNavigation from "./navigation/BottomNavigation";
import AppSidebar from "./navigation/AppSidebar";
import { countNotificationItems, formatNotificationBadge } from "../features/notifications/utils/notification-count";
import NotificationsPage from "../features/notifications/components/NotificationsPage";
import type { PostMentionNotification } from "../features/feed/utils/postMentionNotifications";
import ConversationDetailsPanel from "../features/chat/components/ConversationDetailsPanel";
import ChatTranslationSettingsPage from '../features/chat/components/ChatTranslationSettingsPage';
import {
  readConversationTranslationSettings,
  persistConversationTranslationSettings,
  type ChatTranslationSettings,
  type ConversationTranslationSettingsMap,
} from '../features/chat/lib/conversationTranslationSettings';
import ProfilePage from "../features/profile/components/ProfilePage";
import ProfileEditorPage from "../features/profile/components/ProfileEditorPage";
import SettingsWorkspace from "../features/settings/components/SettingsWorkspace";
import SocialFeedComposer from "../features/feed/components/SocialFeedComposer";
import SocialFeedSidebar from "../features/feed/components/SocialFeedSidebar";
import SocialFeedStories from "../features/feed/components/SocialFeedStories";
import StoryComposer from "../features/feed/components/StoryComposer";
import { parsePostExtras, composePostContent } from "../features/feed/utils/postExtras";
import PostCommentsPage from "../features/feed/components/PostCommentsPage";
import CommunicationHub from "../features/chat/components/CommunicationHub";
import CallCenter from "../features/calls/components/CallCenter";
import type { GroupWorkspaceMode } from "../features/chat/components/CommunityGroupsPage";
import FeedCommunitiesList from "../features/feed/components/FeedCommunitiesList";
import "../features/chat/styles/community-groups.css";
import CommunityGroupWizard, { type CommunityCreationExtras } from "../features/chat/components/CommunityGroupWizard";
import GroupSettingsPanel from "../features/chat/components/GroupSettingsPanel";
import GroupChannelPicker from "../features/chat/components/GroupChannelPicker";
import { validGroupChannels, type GroupChannel } from "../features/chat/utils/groupChannels";
import GroupInviteJoinDialog from "../features/chat/components/GroupInviteJoinDialog";
import ContactsView, { type FriendsScreen } from "../features/contacts/components/ContactsView";
import PrivacyControls from "../features/profile/components/PrivacyControls";
import AccountSessionsPanel from "../features/auth/components/AccountSessionsPanel";
import BlockedUsersPanel from "../features/contacts/components/BlockedUsersPanel";
import {
  FormEvent,
  Fragment,
  lazy,
  Suspense,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import {
  FeedDiscussion,
  FeedText,
  type FeedComment,
  type DiscussionDraft,
} from "../features/feed/components/FeedDiscussion";
import FeedModeration from "../features/feed/components/FeedModeration";
import ProfileOverlay from "../features/profile/components/ProfileOverlay";
import type { NearbyUser } from "../features/discover/components/NearbyExplorer";
import GroupCreator from "../features/chat/components/GroupCreator";
import {
  Ban,
  Bell,
  Check,
  Images,
  Languages,
  LoaderCircle,
  ChevronDown,
  Plus,
  LogOut,
  MoreHorizontal,
  Pin,
  ArrowLeft,
  Settings,
  PencilLine,
  RefreshCw,
  Search,
  SmilePlus,
  UserCheck,
  UserPlus,
  Users,
  Volume2,
  X,
  Download,
} from "lucide-react";
import {
  IncomingMessageSound,
  MESSAGE_SOUND_SETTING_KEY,
  persistMessageSoundEnabled,
  readMessageSoundEnabled,
} from "../features/notifications/lib/incomingSound";
import {
  createSessionClient,
  type Session,
} from "../features/auth/lib/session";
import {
  clearPendingSend,
  loadChatDrafts,
  loadPendingSend,
  saveChatDrafts,
} from "../features/chat/lib/chatPersistence";
import { restoreChatOutbox } from "../features/chat/utils/outboxRecovery";
import {
  confirmChatMessage,
  enqueueChatMessage,
  persistChatOutboxChange,
  retryableChatMessages,
  type QueuedChatMessage,
} from "../features/chat/lib/chatOutbox";
import { uploadPresignedFile } from "../features/chat/lib/mediaUpload";
import {
  chatFilesFromClipboard,
  transferHasFiles,
} from "../features/chat/utils/chatFileTransfer";
import { canMarkConversationRead } from "../features/chat/utils/conversationRead";
import { mergeById, toggleMessageReactionCount } from "../shared/utils/optimistic";
import CallManager, { CallHeaderActions } from "../features/calls/components/CallManager";
import SharedContent from "../features/chat/components/SharedContent";
import VoiceRecorder from "../features/chat/components/VoiceRecorder";
import { SocoEmptyState, SocoTextAction } from "../shared/ui/SocoUI";
import {
  getCurrentPositionSmart,
  geolocationErrorMessage,
} from "../features/discover/lib/geolocation";

const NearbyExplorer = lazy(
  () => import("../features/discover/components/NearbyExplorer"),
);
const Marketplace = lazy(() => import("../features/discover/components/Marketplace"));
const ProfileQr = lazy(() => import("../features/profile/components/ProfileQr"));
import {
  defaultBundle,
  loadAppLocalePreference,
  loadCachedBundle,
  resolveEffectiveLocale,
  saveAppLocalePreference,
  saveCachedBundle,
  translateUI,
  UI_BUNDLE_VERSION,
  UI_MESSAGES,
  type UIBundle,
} from "../features/i18n/lib/i18n";
import {
  buildLanguageOptions,
  filterLanguageOptions,
  isSupportedLanguageCode,
} from "../features/i18n/utils/languages";
import {
  disableOneSignalPush,
  enableOneSignalPush,
  getOneSignalPushState,
  isPushDisabled,
  setupOneSignal,
  type PushState,
} from "../features/notifications/lib/onesignal";

import { isDesktopBuild } from "../platform/desktop";
import AppHeader, { AppHeaderActions } from "./header/AppHeader";
import AppLayout from "./layouts/AppLayout";
import HeaderSearch from "./header/HeaderSearch";
import HeaderActions from "./header/HeaderActions";
import HeaderAccount from "./header/HeaderAccount";
import HeaderTitle from "./header/HeaderTitle";
import { searchLabels } from "./header/headerContext";
import NotificationsSection from "../features/notifications/components/NotificationsSection";
import DiscoverSection from "../features/discover/components/DiscoverSection";
import MarketSection from "../features/discover/components/MarketSection";
import CallsSection from "../features/calls/components/CallsSection";
import ChatTranslationSection from "../features/chat/components/ChatTranslationSection";
import FeedPostDetail from "../features/feed/components/FeedPostDetail";
import FeedSection from "../features/feed/components/FeedSection";
import ConversationActionDialog from "../features/chat/components/ConversationActionDialog";
import MessageActionDialog from "../features/chat/components/MessageActionDialog";
import PostDetailOverlay from "../features/feed/components/PostDetailOverlay";
import StoryOverlay from "../features/feed/components/StoryOverlay";
import ProfileOverviewSection from "../features/profile/components/ProfileOverviewSection";
import ProfileSection from "../features/profile/components/ProfileSection";
import ChatSection from "../features/chat/components/ChatSection";
import StoryDraftOverlay from "../features/feed/components/StoryDraftOverlay";
import FeedComposerOverlay from "../features/feed/components/FeedComposerOverlay";
import ProfileComposerOverlay from "../features/profile/components/ProfileComposerOverlay";
import { useNearbyDiscovery } from "../features/discover/hooks/useNearbyDiscovery";
import { useAccountSessions } from "../features/auth/hooks/useAccountSessions";
import { usePushSettings } from "../features/notifications/hooks/usePushSettings";
import { useMessageLongPress } from "../features/chat/hooks/useMessageLongPress";
import { useMessageClipboard } from "../features/chat/hooks/useMessageClipboard";
import { useMediaUploads } from "../features/chat/hooks/useMediaUploads";
import { useContactActions } from "../features/contacts/hooks/useContactActions";
import { useTranslationActions } from "../features/chat/hooks/useTranslationActions";
import { useMessageEdits } from "../features/chat/hooks/useMessageEdits";
import { useMessageReactions } from "../features/chat/hooks/useMessageReactions";
import { useMessageSender } from "../features/chat/hooks/useMessageSender";
import { useOutboxDelivery } from "../features/chat/hooks/useOutboxDelivery";
import { useConversationHistory } from "../features/chat/hooks/useConversationHistory";
import { useGroupChannels } from "../features/chat/hooks/useGroupChannels";
import { useDirectConversations } from "../features/chat/hooks/useDirectConversations";
import { useGroupCreation } from "../features/chat/hooks/useGroupCreation";
import { usePostSync } from "../features/feed/hooks/usePostSync";
import { useProfilePosts } from "../features/feed/hooks/useProfilePosts";
import { usePostComposer } from "../features/feed/hooks/usePostComposer";
import { usePostReactions } from "../features/feed/hooks/usePostReactions";
import { usePostComments } from "../features/feed/hooks/usePostComments";
import { usePostDetailNavigation } from "../features/feed/hooks/usePostDetailNavigation";
import { useInviteSharing } from "../features/profile/hooks/useInviteSharing";
import { useStoryActions } from "../features/feed/hooks/useStoryActions";
import { usePrivacySettings } from "../features/settings/hooks/usePrivacySettings";
import { useNearbyState } from "../features/discover/hooks/useNearbyState";
import { useBlockedUsers } from "../features/contacts/hooks/useBlockedUsers";
import { useFriendSearch } from "../features/contacts/hooks/useFriendSearch";
import { useAppLocaleState } from "../features/i18n/hooks/useAppLocaleState";
import { useTranslationState } from "../features/chat/hooks/useTranslationState";
import { useProfileState } from "../features/profile/hooks/useProfileState";
import { useFeedUiState } from "../features/feed/hooks/useFeedUiState";
import { useChatPanelState } from "../features/chat/hooks/useChatPanelState";
import { useScopedState } from "../shared/hooks/useScopedState";
import { useGroupWorkspaceState } from "../features/chat/hooks/useGroupWorkspaceState";
import { useSessionsPanel } from "../features/auth/hooks/useSessionsPanel";

export type AuthedAppProps = {
  responseCache: MutableRefObject<SessionResponseCache>;
  sessionClient: ReturnType<typeof createSessionClient>;
  saveSession: (next: Session) => void;
  endSession: (
    revoke?: boolean,
    clearStorage?: boolean,
    notify?: (message: string, kind?: ToastKind) => void,
  ) => void;
  installPrompt: InstallPromptEvent | null;
  setInstallPrompt: Dispatch<SetStateAction<InstallPromptEvent | null>>;
};

export default function AuthedApp({
  responseCache,
  sessionClient,
  saveSession,
  endSession,
  installPrompt,
  setInstallPrompt,
}: AuthedAppProps) {
  const { session, sessionRef } = useSession();
  const { apiFetch, pendingRequests, mutationRequests } = useApi();
  const { notice, setNotice, dismissNotice } = useNotice();
  const { chatCreateError, directUsername, groupCreateStep, groupWorkspaceMode, newChatMode, quickCreateOpen, setChatCreateError, setDirectUsername, setGroupCreateStep, setGroupWorkspaceMode, setNewChatMode, setQuickCreateOpen } = useGroupWorkspaceState({  });

  const { isProfileDesktop, postSubmitError, profileBioDraft, profileBusy, profileCityDraft, profileComposerOpen, profileDisplayNameDraft, profileEditorOpen, profileHasMore, profileHeadingRef, profileIdentityRef, profileLoadSequence, profileMedia, profilePagingBusy, profilePosts, profilePostsBusy, profilePostsError, profileSaving, profileTimelineOpen, profileUsernameDraft, setPostSubmitError, setProfileBioDraft, setProfileBusy, setProfileCityDraft, setProfileComposerOpen, setProfileDisplayNameDraft, setProfileEditorOpen, setProfileHasMore, setProfileMedia, setProfilePosts, setProfilePostsBusy, setProfilePostsError, setProfileSaving, setProfileTimelineOpen, setProfileUsernameDraft } = useProfileState({  });

  const { appLocale, languageSearch, localePickerOpen, localeSearch, setAppLocale, setLanguageSearch, setLocalePickerOpen, setLocaleSearch, setTranslationPickerOpen, setUiBundle, setUiLocaleLoading, translationPickerOpen, uiBundle, uiLocaleLoading } = useAppLocaleState({  });

  const { friendActionBusy, friendActionRef, friendBusyIds, friendMenuId, friendQuery, friendResults, friendSearchError, friendSearchRetry, friendSearching, setFriendActionBusy, setFriendBusyIds, setFriendMenuId, setFriendQuery, setFriendResults, setFriendSearchError, setFriendSearchRetry, setFriendSearching } = useFriendSearch({  });

  const { blockedBusy, blockedError, blockedOpen, blockedUsers, setBlockedBusy, setBlockedError, setBlockedOpen, setBlockedUsers } = useBlockedUsers({  });

  const { nearbyBusy, nearbyRadiusKm, nearbyRequest, nearbyResultRadiusKm, nearbyScanning, nearbyUntil, nearbyUsers, setNearbyBusy, setNearbyRadiusKm, setNearbyResultRadiusKm, setNearbyScanning, setNearbyUntil, setNearbyUsers } = useNearbyState({  });

  const { managedSessions, sessionsBusy, sessionsError, sessionsOpen, setManagedSessions, setSessionsBusy, setSessionsError, setSessionsOpen } = useSessionsPanel({ session });

  const { autoTranslate, conversationTranslationOverrides, manuallyTranslated, setAutoTranslate, setConversationTranslationOverrides, setManuallyTranslated, setTargetLanguage, setTranslationFailures, setTranslationMenuOpen, setTranslationOriginals, setTranslationPending, setTranslations, targetLanguage, translationAttempted, translationFailures, translationLanguageRef, translationMenuOpen, translationOriginals, translationPending, translations } = useTranslationState({ session });


  const [tab, setTab] = useState<Tab>("chat");
  const { activePostId, activeStoryId, commentEditors, commentSortOrder, feedCheckInLocation, feedCheckInOpen, feedCommunitiesOpen, feedComposerOpen, feedFilter, feedScrollBeforeComments, feedViewRef, searchHasScrolled, setActivePostId, setActiveStoryId, setCommentEditors, setCommentSortOrder, setFeedCheckInLocation, setFeedCheckInOpen, setFeedCommunitiesOpen, setFeedComposerOpen, setFeedFilter, setSearchHasScrolled, setStoryBusy, setStoryDraftFile, storyBusy, storyDraftFile } = useFeedUiState({ tab });

  const tabRef = useRef(tab);
  tabRef.current = tab;
  const [globalSearch, setGlobalSearch] = useState("");
  const [chatListQuery, setChatListQuery] = useState('');
  const [chatListFilter, setChatListFilter] = useState<'all' | 'unread' | 'groups'>('all');
  const chatFiltersPill = useSlidingPill<HTMLDivElement>(chatListFilter);
  const [quickSearchOpen, setQuickSearchOpen] = useState(false);
  const [phoneSearchLayout, setPhoneSearchLayout] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(max-width: 760px)").matches,
  );
  useEffect(() => {
    const media = window.matchMedia("(max-width: 760px)");
    const update = () => setPhoneSearchLayout(media.matches);
    media.addEventListener("change", update);
    update();
    return () => media.removeEventListener("change", update);
  }, []);
  const quickSearchAnchorRef = useRef<HTMLDivElement>(null);
  const [chatSearchJump, setChatSearchJump] = useState<{
    conversationId: number;
    messageId: number;
    revision: number;
  } | null>(null);
  const chatSearchJumpRevision = useRef(0);
  const lastScrolledSearchJump = useRef(0);
  useEffect(() => {
    if (!quickSearchOpen) return;
    const outside = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !quickSearchAnchorRef.current?.contains(event.target)
      )
        setQuickSearchOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setQuickSearchOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [quickSearchOpen]);
  const [activeConversationId, setActiveConversationId] = useState<
    number | null
  >(null);
  const { channelSelection, conversationActionId, conversationDetailsOpen, conversationMenuPosition, groupActivityCreateKind, groupActivityViewedId, groupChannelBusy, groupChannelState, groupMemberViewOpen, historyActionBusy, messageActionId, messageActionMode, messageSearchOpen, pinnedExpanded, replyingTo, setChannelSelection, setConversationActionId, setConversationDetailsOpen, setConversationMenuPosition, setGroupActivityCreateKind, setGroupActivityViewedId, setGroupChannelBusy, setGroupChannelState, setGroupMemberViewOpen, setHistoryActionBusy, setMessageActionId, setMessageActionMode, setMessageSearchOpen, setPinnedExpanded, setReplyingTo, setSharedContentOpen, sharedContentOpen } = useChatPanelState({ activeConversationId });

  const activeConversationIdRef = useRef<number | null>(null);
  const selectedChannelId = channelSelection.conversationId === activeConversationId ? channelSelection.channelId : 0;
  const activeChannelIdRef = useRef(selectedChannelId);
  activeChannelIdRef.current = selectedChannelId;
  const activeConversationTypeRef = useRef<'group' | 'direct' | null>(null);
  const [groupChannelUnreadStatus, setGroupChannelUnreadStatus] = useState<{ conversationId: number; available: boolean } | null>(null);
  const groupChannelUnreadAvailable = groupChannelUnreadStatus?.conversationId === activeConversationId
    ? groupChannelUnreadStatus.available : true;
  const groupChannels = groupChannelState.conversationId === activeConversationId
    ? groupChannelState.channels
    : validGroupChannels([], activeConversationId ?? 0);
  const messagesScrollRef = useRef<HTMLDivElement>(null);
  const messageScrollAtBottom = useRef(true);
  const ownSendScrollConversation = useRef<number | null>(null);
  const suppressConversationClick = useRef<number | null>(null);
  const [messageCopyTarget, setMessageCopyTarget] =
    useState<MessageCopyTarget | null>(null);
  const suppressMessageClick = useRef<number | null>(null);
  const { beginConversationLongPress, beginMessageLongPress, cancelConversationLongPress, cancelMessageLongPress, moveConversationLongPress, moveMessageLongPress, openMessageActions, openMessageReactions } = useMessageLongPress({ setConversationActionId, setConversationMenuPosition, setMessageActionId, setMessageActionMode, setMessageCopyTarget, suppressConversationClick, suppressMessageClick });

  // Only text is kept in this tab's session storage. Media URLs/tokens are never persisted.
  const [messageDrafts, setMessageDrafts] = useState<
    Record<number, MessageDraft>
  >(() => {
    const saved = loadChatDrafts(session?.user.id ?? 0);
    return Object.fromEntries(
      Object.entries(saved).map(([id, item]) => [
        Number(id),
        { text: item.text, attachments: [] },
      ]),
    );
  });
  useEffect(() => {
    if (session?.user.id && sessionRef.current?.user.id === session.user.id) {
      saveChatDrafts(session.user.id, messageDrafts);
    }
  }, [session?.user.id, messageDrafts]);
  const [channelDrafts, setChannelDrafts] = useState<Record<string, MessageDraft>>({});
  const channelDraftKey = `${activeConversationId ?? 0}:${selectedChannelId}`;
  const draft = selectedChannelId > 0 ? channelDrafts[channelDraftKey] ?? emptyDraft : messageDrafts[activeConversationId ?? 0] ?? emptyDraft;
  const messageText = draft.text;
  const messageAttachments = draft.attachments;
  const [messageSending, setMessageSending] = useState(false);
  const sendingRef = useRef(false);
  const [outgoingMessage, setOutgoingMessage] = useState<Message | null>(null);
  const [pendingPost, setPendingPost] = useState<Post | null>(null);
  const [pendingComments, setPendingComments] = useState<
    Record<number, FeedComment>
  >({});
  const [likePreviews, setLikePreviews] = useState<Record<number, boolean>>({});
  const [reactionPreviews, setReactionPreviews] = useState<
    Record<number, MessageReaction[]>
  >({});
  const [forwardSource, setForwardSource] = useScopedState<Message | null>(session?.sessionId ?? null, null);
  const [reactionTarget, setReactionTarget] = useScopedState<{
    kind: "message" | "post"; id: number; initialEmoji?: string;
    reactions?: { emoji: string; count: number }[];
  } | null>(session?.sessionId ?? null, null);
  const messageChanges = useRef(new Set<number>());
  const actionLocks = useRef(new Set<string>());
  const messageReceipts = useRef(new Map<string, Message | null>());
  // Preserve the request ID for an ambiguous send so a retry cannot create another row.
  const pendingSend = useRef<{
    sessionId: string;
    conversationId: number;
    signature: string;
    clientId: string;
    draft: MessageDraft;
  } | null>(null);
  const [chatOutbox, setChatOutbox] = useState<QueuedChatMessage[]>(() =>
    restoreChatOutbox(session?.user.id ?? 0, session?.sessionId ?? ""),
  );
  const chatOutboxRef = useRef(chatOutbox);
  const chatOutboxSession = useRef(session?.sessionId ?? "");
  const sendingClientIDs = useRef(new Set<string>());
  const retryOutboxBusy = useRef(false);
  const [chatOnline, setChatOnline] = useState(() => navigator.onLine);

  function updateChatOutbox(
    transform: (items: QueuedChatMessage[]) => QueuedChatMessage[],
  ) {
    const current = sessionRef.current;
    if (!current || current.sessionId !== chatOutboxSession.current)
      return chatOutboxRef.current;
    const previous = chatOutboxRef.current;
    const next = transform(previous);
    if (previous === next) return next;
    if (
      !persistChatOutboxChange(
        current.user.id,
        current.sessionId,
        previous,
        next,
      )
    ) {
      setNotice(
        "Không lưu được hàng đợi tin nhắn trên thiết bị này.",
        "warning",
      );
      return previous;
    }
    chatOutboxRef.current = next;
    setChatOutbox(next);
    return next;
  }
  useEffect(() => {
    const nextSessionId = session?.sessionId ?? "";
    if (nextSessionId === chatOutboxSession.current) return;
    chatOutboxSession.current = nextSessionId;
    const restored = restoreChatOutbox(session?.user.id ?? 0, nextSessionId);
    chatOutboxRef.current = restored;
    setChatOutbox(restored);
    sendingClientIDs.current.clear();
    retryOutboxBusy.current = false;
  }, [session?.sessionId]);
  const preferenceRevision = useRef(0);
  const [contactsScreen, setContactsScreen] = useState<FriendsScreen>("directory");
  const [visitorUsername, setVisitorUsername] = useState<string | null>(null);
  function openVisitor(username: string) {
    if (username === sessionRef.current?.user.username) {
      setTab("profile");
      setDesktopProfileSettings(false);
      setProfileTimelineOpen(true);
      return;
    }
    setVisitorUsername(username);
  }
  function setFriendPreview(friend: FriendSearchResult | null) {
    if (friend) openVisitor(friend.username);
    else setVisitorUsername(null);
  }
  const [qrOpen, setQrOpen] = useState<"mine" | "scan" | null>(null);
  const [desktopSection, setDesktopSection] = useState<
    "groups" | "calls" | null
  >(null);
  const [translationSettingsConversationId, setTranslationSettingsConversationId] = useState<number | null>(null);
  useEffect(() => {
    if (translationSettingsConversationId !== null &&
        translationSettingsConversationId !== activeConversationId) {
      setTranslationSettingsConversationId(null);
    }
  }, [translationSettingsConversationId, activeConversationId]);
  const [desktopProfileSettings, setDesktopProfileSettings] = useState(false);
  const desktopProfileOverview = isProfileDesktop && !desktopProfileSettings;
  useEffect(() => {
    if (
      tab !== "profile" ||
      (!profileTimelineOpen && !desktopProfileOverview)
    ) {
      setProfileComposerOpen(false);
      setProfileEditorOpen(false);
    }
  }, [tab, profileTimelineOpen, desktopProfileOverview]);
  useEffect(() => {
    if (
      (!profileTimelineOpen && !desktopProfileOverview) ||
      tab !== "profile" ||
      !session?.sessionId
    )
      return;
    void loadProfilePosts();
    profileHeadingRef.current?.focus();
    return () => {
      ++profileLoadSequence.current;
      profilePagingBusy.current = false;
    };
  }, [
    profileTimelineOpen,
    desktopProfileOverview,
    tab,
    session?.sessionId,
    session?.user.username,
  ]);
  const feedFiltersPill = useSlidingPill<HTMLDivElement>(feedFilter);
  const [postMentions, setPostMentions] = useState<PostMentionNotification[]>([]);
  useEffect(() => {
    if (!session?.sessionId) {
      setPostMentions([]);
      return;
    }
    let live = true;
    const controller = new AbortController();
    const refresh = async () => {
      try {
        const response = await apiFetch("/api/feed/mentions", { signal: controller.signal, cache: "no-store" });
        if (!response.ok) return;
        const items: unknown = await response.json();
        if (live && Array.isArray(items)) {
          setPostMentions(items.filter((item): item is PostMentionNotification =>
            item && Number.isSafeInteger(item.id) && Number.isSafeInteger(item.postId)
            && typeof item.author === "string" && typeof item.createdAt === "string"));
        }
      } catch {
        // A temporary network outage must not clear already received alerts.
      }
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    void refresh();
    const interval = window.setInterval(() => void refresh(), tab === "notifications" ? 12000 : 30000);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      live = false;
      controller.abort();
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [session?.sessionId, tab === "notifications"]);
  useLayoutEffect(() => {
    if (tab !== "feed") return;
    if (feedViewRef.current) feedViewRef.current.scrollTop = 0;
    setSearchHasScrolled(false);
  }, [tab, globalSearch.trim().toLocaleLowerCase("vi-VN"), feedFilter]);
  // The desktop comments view is a real in-app page with a shareable post URL.
  // Popstate keeps the browser Back button in sync with the SPA.
  useEffect(() => {
    const onPopState = () => {
      if (tabRef.current !== "feed") return;
      const id = Number(new URLSearchParams(window.location.search).get("post"));
      setActivePostId(Number.isSafeInteger(id) && id > 0 ? id : null);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);
  useEffect(() => {
    if (!session?.token) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("tab") !== "feed") return;
    setTab("feed");
    const id = Number(params.get("post"));
    if (!Number.isSafeInteger(id) || id <= 0) return;
    let cancelled = false;
    void apiFetch("/api/posts/" + id)
      .then(async (response) => {
        if (!response.ok)
          throw new Error(
            response.status === 404
              ? "Bài viết không tồn tại hoặc bạn không có quyền xem."
              : "Không thể mở bài viết.",
          );
        return response.json() as Promise<Post>;
      })
      .then((post) => {
        if (cancelled) return;
        setPosts((current) => [
          post,
          ...current.filter((item) => item.id !== post.id),
        ]);
        setActivePostId(post.id);
      })
      .catch((error) => {
        if (!cancelled)
          setNotice(
            error instanceof Error ? error.message : "Không thể mở bài viết.",
            "error",
          );
      });
    return () => {
      cancelled = true;
    };
  }, [session?.token]);
  const [mediaUploading, setMediaUploading] = useState<
    "chat" | "feed" | "story" | "profile" | null
  >(null);
  const [mediaUploadProgress, setMediaUploadProgress] = useState<{
    loaded: number;
    total: number;
  } | null>(null);
  const mediaUploadAbort = useRef<AbortController | null>(null);
  const [translationSettingsSearch, setTranslationSettingsSearch] =
    useState("");
  useEffect(() => {
    setConversationTranslationOverrides(
      session?.user.id ? readConversationTranslationSettings(session.user.id) : {},
    );
    setTranslationSettingsConversationId(null);
  }, [session?.user.id]);
  const activeChatTranslationSettings = activeConversationId === null
    ? undefined : conversationTranslationOverrides[activeConversationId];
  const effectiveAutoTranslate = activeChatTranslationSettings?.enabled ?? autoTranslate;
  const effectiveTargetLanguage = activeChatTranslationSettings?.targetLanguage ?? targetLanguage;
  translationLanguageRef.current = effectiveTargetLanguage;
  const [translationPreferencesLoaded, setTranslationPreferencesLoaded] =
    useState(false);
  const [status, setStatus] = useState("Đang kết nối...");
  const [isStandalone, setIsStandalone] = useState(false);
  const [pushConfigured, setPushConfigured] = useState(false);
  const [pushAppId, setPushAppId] = useState("");
  const [pushEnabled, setPushEnabled] = useState(false);
  const [messageSoundEnabled, setMessageSoundEnabled] = useState(
    readMessageSoundEnabled,
  );
  const messageSoundEnabledRef = useRef(messageSoundEnabled);
  messageSoundEnabledRef.current = messageSoundEnabled;
  const messageSound = useRef<IncomingMessageSound | null>(null);
  if (!messageSound.current) messageSound.current = new IncomingMessageSound();
  useEffect(() => {
    // Browsers permit sound only after an interaction. Warm up Web Audio on a
    // real user gesture, without playing a notification just for opening SocCO.
    const unlockAudio = () => {
      if (messageSoundEnabledRef.current) messageSound.current?.unlock();
    };
    const syncPreference = (event: StorageEvent) => {
      if (event.key !== MESSAGE_SOUND_SETTING_KEY && event.key !== null) return;
      const enabled = readMessageSoundEnabled();
      messageSoundEnabledRef.current = enabled;
      setMessageSoundEnabled(enabled);
    };
    window.addEventListener("pointerdown", unlockAudio, { passive: true });
    window.addEventListener("keydown", unlockAudio);
    window.addEventListener("storage", syncPreference);
    return () => {
      window.removeEventListener("pointerdown", unlockAudio);
      window.removeEventListener("keydown", unlockAudio);
      window.removeEventListener("storage", syncPreference);
    };
  }, []);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushInitFailed, setPushInitFailed] = useState(false);
  const [pushPrompt, setPushPrompt] = useState(false);
  const [pushPromptDismissed, setPushPromptDismissed] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const postComposerRef = useRef<HTMLTextAreaElement>(null);
  const messageInputRef = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const input = messageInputRef.current;
    if (!input) return;
    input.style.height = 'auto';
    input.style.height = `${Math.min(input.scrollHeight, 154)}px`;
  }, [messageText, activeConversationId, tab, desktopSection]);
  const chatDragDepth = useRef(0);
  const [chatDragActive, setChatDragActive] = useState(false);
  useEffect(() => {
    chatDragDepth.current = 0;
    setChatDragActive(false);
  }, [activeConversationId, tab]);

  useEffect(() => {
    const preventFileNavigation = (event: DragEvent) => {
      // Never navigate away from the chat when a file is dropped outside it.
      if (transferHasFiles(event.dataTransfer)) event.preventDefault();
    };
    const keyboard = (event: KeyboardEvent) => {
      if (
        !sessionRef.current ||
        event.isComposing ||
        event.altKey ||
        !(event.ctrlKey || event.metaKey) ||
        document.querySelector('[role="dialog"][aria-modal="true"]')
      )
        return;
      if (event.key.toLowerCase() === "k" && !event.shiftKey) {
        event.preventDefault();
        setTab("chat");
        requestAnimationFrame(() =>
          document
            .querySelector<HTMLInputElement>(".appbar-search input")
            ?.focus(),
        );
      } else if (event.key.toLowerCase() === "l" && event.shiftKey) {
        event.preventDefault();
        messageInputRef.current?.focus();
      }
    };
    document.addEventListener("dragover", preventFileNavigation);
    document.addEventListener("drop", preventFileNavigation);
    if (isDesktopBuild) window.addEventListener("keydown", keyboard);
    return () => {
      document.removeEventListener("dragover", preventFileNavigation);
      document.removeEventListener("drop", preventFileNavigation);
      if (isDesktopBuild) window.removeEventListener("keydown", keyboard);
    };
  }, []);
  const chatFileInputRef = useRef<HTMLInputElement>(null);
  const feedAlbumInputRef = useRef<HTMLInputElement>(null);
  const storyFileInputRef = useRef<HTMLInputElement>(null);
  const avatarFileInputRef = useRef<HTMLInputElement>(null);
  const coverFileInputRef = useRef<HTMLInputElement>(null);

  const { privacy, privacyBusy, privacyError, privacyLoading, setPrivacy, setPrivacyBusy, setPrivacyError, setPrivacyRetry } = usePrivacySettings({ apiFetch, session });


  const {
    conversations,
    setConversations,
    revokedConversationIds,
    membershipSnapshot,
    membershipSyncSequence,
    membershipEventSequence,
    hasMoreConversations,
    setHasMoreConversations,
    conversationLoadingMore,
    setConversationLoadingMore,
    conversationPagingBusy,
    conversationOffset,
    reconcileConversationMemberships,
    refreshConversations,
    loadMoreConversations,
  } = useConversationData({
    session,
    sessionRef,
    apiFetch,
    setStatus,
    setNotice,
    activeConversationIdRef,
    setMessageDrafts,
    purgeConversation,
  });

  const conversationCategories = useConversationCategories({
    session,
    sessionRef,
    apiFetch,
    setStatus,
    setNotice,
    mergeConversations: (items) =>
      setConversations((current) => {
        const fresh = new Map(
          items
            .filter((c) => !revokedConversationIds.current.has(c.id))
            .map((c) => [c.id, c]),
        );
        return [
          ...current.map((c) => fresh.get(c.id) || c),
          ...[...fresh.values()].filter(
            (c) => !current.some((p) => p.id === c.id),
          ),
        ];
      }),
    setCategory: (id, categoryId) =>
      setConversations((current) =>
        current.map((c) =>
          c.id === id ? { ...c, categoryId: categoryId || undefined } : c,
        ),
      ),
    clearCategory: (id) =>
      setConversations((current) =>
        current.map((c) =>
          c.categoryId === id ? { ...c, categoryId: undefined } : c,
        ),
      ),
  });

  const {
    friends,
    setFriends,
    friendRequests,
    setFriendRequests,
    contactMetadata,
    setContactMetadata,
    friendSyncRequest,
    friendSyncSessionId,
    setFriendSyncSessionId,
    friendSyncError,
    setFriendSyncError,
    friendSyncBusy,
    setFriendSyncBusy,
    refreshFriendConnections,
  } = useContactData({
    session,
    sessionRef,
    apiFetch,
    setStatus,
    setNotice,
  });

  const {
    feedRevision,
    feedLoads,
    posts,
    setPosts,
    savedPosts,
    setSavedPosts,
    hasMoreSavedPosts,
    setHasMoreSavedPosts,
    savedPostsBusy,
    setSavedPostsBusy,
    savedPagingBusy,
    hasMorePosts,
    setHasMorePosts,
    postsLoadingMore,
    setPostsLoadingMore,
    postsPagingError,
    savedPagingError,
    postsPagingBusy,
    stories,
    setStories,
    refreshPosts,
    loadMorePosts,
    loadSavedPosts,
    syncFeedPost: syncFeedDataPost,
    removeFeedPost: removeFeedDataPost,
    refreshStories,
  } = useFeedData({
    session,
    sessionRef,
    apiFetch,
    setStatus,
    setNotice,
    actionLocks,
    setActivePostId,
  });

  const followingFeed = useFollowingPosts({
    sessionId: session?.sessionId,
    enabled: tab === "feed" && feedFilter === "following",
    request: apiFetch,
  });
  const feedSearchActive = tab === "feed" && globalSearch.trim().length > 0;
  const postSearch = usePostSearch({
    query: globalSearch,
    scope: feedFilter,
    enabled: tab === "feed",
    sessionId: session?.sessionId,
    request: apiFetch,
  });
  const feedLoadingMore = feedSearchActive
    ? postSearch.loadingMore
    : feedFilter === "saved"
      ? savedPostsBusy
      : feedFilter === "following"
        ? followingFeed.loadingMore
        : postsLoadingMore;
  const feedPagingError = feedSearchActive
    ? Boolean(postSearch.error)
    : feedFilter === "saved"
      ? savedPagingError
      : feedFilter === "following"
        ? Boolean(followingFeed.error)
        : postsPagingError;
  const feedInfiniteScrollRef = useFeedInfiniteScroll({
    enabled: tab === "feed" && (!feedSearchActive || searchHasScrolled),
    hasMore: feedSearchActive
      ? postSearch.hasMore
      : feedFilter === "saved"
        ? hasMoreSavedPosts
        : feedFilter === "following"
          ? followingFeed.hasMore
          : hasMorePosts,
    loading:
      (feedSearchActive && postSearch.loading) ||
      (feedFilter === "following" && followingFeed.loading) ||
      feedLoadingMore,
    error: feedPagingError,
    onLoadMore: () => {
      if (feedSearchActive) void postSearch.loadMore();
      else if (feedFilter === "saved") void loadSavedPosts(true);
      else if (feedFilter === "following") void followingFeed.loadMore();
      else void loadMorePosts();
    },
  });

  const {
    messages,
    setMessages,
    hasMoreMessages,
    setHasMoreMessages,
    messagesLoadingMore,
    setMessagesLoadingMore,
    messageGapBefore,
    messageGapLoading,
    loadMissingMessages,
    messagesPagingBusy,
    pendingMessageScrollRestore,
    loadOlderMessages,
  } = useMessageData({
    session,
    sessionRef,
    apiFetch,
    setNotice,
    activeConversationId,
    activeChannelId: selectedChannelId,
    activeChannelIdRef,
    activeConversationIdRef,
    translationPreferencesLoaded,
    targetLanguage: effectiveTargetLanguage,
    setTranslations,
    messageChanges,
    pendingSend,
    setMessageDrafts,
    setConversations,
    refreshConversations,
    activeConversationType: conversations.find((item) => item.id === activeConversationId)?.type ?? null,
    tabRef,
    messagesScrollRef,
    purgeConversation,
    jumpToMessage: chatSearchJump,
  });

  const {
    groupSettingsOpen,
    setGroupSettingsOpen,
    groupMembers,
    setGroupMembers,
    groupInviteSearch,
    setGroupInviteSearch,
    groupInviteSelection,
    setGroupInviteSelection,
    groupBusy,
    setGroupBusy,
    activeGroupMember,
    canManageActiveGroup,
    canInviteActiveGroup,
    canEditGroup,
    groupInviteCandidates,
    openGroupSettings,
    launchGroupCall,
    refreshGroupMembers,
    inviteGroupMembers,
    changeGroupMemberRole,
    removeGroupMember,
  } = useGroupManagement({
    session,
    sessionRef,
    tab,
    communityWorkspaceOpen: false,
    activeConversationId,
    activeConversationType: conversations.find(
      (conversation) => conversation.id === activeConversationId,
    )?.type,
    activeConversationIdRef,
    friends,
    apiFetch,
    refreshFriendConnections,
    refreshConversations,
    setActiveConversationId,
    setNotice,
    actionLocks,
  });

  const {
    pinnedMessages, pinBusy, refreshPinnedMessages, clearPinnedMessages, toggleMessagePin, toggleConversationPin,
  } = useChatPins({
    session, sessionRef, activeConversationId, activeConversationIdRef,
    apiFetch, setConversations, refreshConversations, setNotice,
  })

  useEffect(() => {
    if (!groupSettingsOpen) setGroupMemberViewOpen(false);
  }, [groupSettingsOpen]);

  useEffect(() => {
    if (!groupSettingsOpen) return;
    const onEscape = (event: KeyboardEvent) => {
      if (
        event.key === "Escape" &&
        !document.querySelector("dialog[open]")
      )
        setGroupSettingsOpen(false);
    };
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, [groupSettingsOpen, setGroupSettingsOpen]);

  const conversationListSearch = useConversationListSearch({
    query: chatListQuery,
    filter: chatListFilter,
    categoryId: conversationCategories.selected,
    sessionId: session?.sessionId,
    enabled: tab === 'chat',
    request: apiFetch,
  });
  const conversationSearching =
    tab === "chat" && globalSearch.trim().length > 0;
  const chatQuickSearch = useChatQuickSearch({
    keyword: globalSearch,
    sessionId: session?.sessionId,
    enabled: tab === "chat",
    request: apiFetch,
  });
  useEffect(() => {
    const jump = chatSearchJump;
    if (
      !jump ||
      jump.conversationId !== activeConversationId ||
      lastScrolledSearchJump.current === jump.revision ||
      !messages.some((item) => item.id === jump.messageId)
    )
      return;
    const frame = window.requestAnimationFrame(() => {
      const target = document.querySelector(
        `[data-message-id="${jump.messageId}"]`,
      );
      if (!target) return;
      target.scrollIntoView({
        block: "center",
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
      });
      // A transient highlight makes the notification's exact message easy to locate.
      if (target instanceof HTMLElement && typeof target.animate === "function") {
        target.animate(
          [
            { outline: "2px solid var(--accent, #318a65)", outlineOffset: "3px", backgroundColor: "rgba(49,138,101,0.16)" },
            { outline: "2px solid transparent", outlineOffset: "3px", backgroundColor: "transparent" },
          ],
          { duration: 2200, easing: "ease-out" },
        );
      }
      lastScrolledSearchJump.current = jump.revision;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [messages, activeConversationId, chatSearchJump]);
  const name = session?.user.username || "";
  const displayConversations = useMemo(
    () =>
      conversations.map((conversation) => ({
        ...conversation,
        name:
          conversation.type === "direct" && conversation.otherUserId
            ? contactMetadata[conversation.otherUserId]?.nickname ||
              conversation.name
            : conversation.name,
      })),
    [conversations, contactMetadata],
  );
  const activeConversation =
    displayConversations.find((item) => item.id === activeConversationId) ||
    null;
  activeConversationTypeRef.current = activeConversation?.type ?? null;

  // Channel selection stays inside the active group and never leaks into another conversation.
  useEffect(() => {
    const id = activeConversation?.type === 'group' ? activeConversation.id : null;
    setGroupChannelState({ conversationId: id, channels: validGroupChannels([], id ?? 0) });
    if (!id || !session?.token) return;
    const controller = new AbortController();
    const reload = async () => {
      try {
        const response = await apiFetch(`/api/conversations/${id}/channels`, { signal: controller.signal });
        if (!response.ok) throw new Error('Không tải được kênh hội thoại.');
        const raw = await response.json();
        const channels = validGroupChannels(raw, id);
        if (!controller.signal.aborted) {
          setGroupChannelUnreadStatus({ conversationId: id, available: Array.isArray(raw) && raw.every(channel => typeof channel.unreadCount === 'number') });
          setGroupChannelState({ conversationId: id, channels });
          if (channelSelection.conversationId === id && !channels.some(channel => channel.id === channelSelection.channelId))
            setChannelSelection({ conversationId: id, channelId: 0 });
        }
      } catch {
        if (!controller.signal.aborted) setNotice('Không tải được kênh hội thoại.', 'warning');
      }
    };
    void reload();
    const onUpdate = (event: Event) => {
      const value = (event as CustomEvent<{ conversationId: number }>).detail;
      if (value?.conversationId === id) void reload();
    };
    const onChannelEvent = (event: Event) => {
      const detail = (event as CustomEvent<{ message?: Message }>).detail;
      if (detail?.message?.conversationId === id) void reload();
    };
    const onChannelRead = (event: Event) => {
      const detail = (event as CustomEvent<{ conversationId: number; channelId: number }>).detail;
      if (detail?.conversationId !== id) return;
      setGroupChannelState(current => current.conversationId !== id ? current : {
        ...current,
        channels: current.channels.map(channel => channel.id === detail.channelId
          ? { ...channel, unreadCount: 0 } : channel),
      });
    };
    window.addEventListener('chatnet:group-community-updated', onUpdate);
    window.addEventListener('chatnet:group-channel-event', onChannelEvent);
    window.addEventListener('chatnet:channel-read', onChannelRead);
    return () => {
      controller.abort();
      window.removeEventListener('chatnet:group-community-updated', onUpdate);
      window.removeEventListener('chatnet:group-channel-event', onChannelEvent);
      window.removeEventListener('chatnet:channel-read', onChannelRead);
    };
  }, [activeConversation?.id, activeConversation?.type, session?.token]);
  const conversationBlocked = Boolean(activeConversation?.type === 'direct' &&
    (activeConversation.blockedByMe || activeConversation.blockedByOther));
  const groupActivities = useGroupActivities(activeConversation?.type === 'group' ? activeConversation.id : null, session?.sessionId, apiFetch);
  const pinnedItems = [
    ...pinnedMessages.filter(item => (item.message.channelId || 0) === selectedChannelId).map((item) => ({ type: 'message' as const, pinnedAt: item.pinnedAt, message: item.message })),
    ...(activeConversation?.type === 'group' && selectedChannelId === 0
      ? groupActivities.activities.filter((item) => Boolean(item.pinnedAt))
        .map((activity) => ({ type: 'activity' as const, pinnedAt: activity.pinnedAt!, activity }))
      : []),
  ].sort((a, b) => Date.parse(b.pinnedAt) - Date.parse(a.pinnedAt));
  const sortedGroupActivityEvents = groupActivities.events.slice().reverse();
  const viewedGroupActivity = groupActivities.activities.find(activity => activity.id === groupActivityViewedId) || null;
  const chatFriend =
    activeConversation?.type === "direct" &&
    activeConversation.otherUserId &&
    activeConversation.otherUserId !== session?.user.id
      ? {
          id: activeConversation.otherUserId,
          username: activeConversation.otherUsername || "",
          displayName: activeConversation.name,
          online: activeConversation.online,
        }
      : null;
  const chatFriendRelationship = chatFriend
    ? friendRelationship(chatFriend.id)
    : "none";

  const friendTaggedNames = useMemo(
    () => Object.fromEntries(friends.map(friend => [friend.username, friend.displayName || friend.username])),
    [friends],
  );
  const visiblePosts = posts.map((post) =>
    likePreviews[post.id] === undefined
      ? post
      : {
          ...post,
          liked: likePreviews[post.id],
          likes: Math.max(
            0,
            post.likes +
              (likePreviews[post.id] === post.liked
                ? 0
                : likePreviews[post.id]
                  ? 1
                  : -1),
          ),
        },
  );
  const visibleMessages = messages.filter(message => (message.channelId || 0) === selectedChannelId).map((message) =>
    reactionPreviews[message.id]
      ? {
          ...message,
          reactions: message.deleted ? [] : reactionPreviews[message.id],
        }
      : message,
  );
  const visibleProfilePosts = profilePosts.map((post) =>
    likePreviews[post.id] === undefined
      ? post
      : {
          ...post,
          liked: likePreviews[post.id],
          likes: Math.max(
            0,
            post.likes +
              (likePreviews[post.id] === post.liked
                ? 0
                : likePreviews[post.id]
                  ? 1
                  : -1),
          ),
        },
  );
  const activePost = activePostId
    ? [
        ...visibleProfilePosts,
        ...visiblePosts,
        ...savedPosts,
        ...postSearch.posts,
        ...followingFeed.posts,
      ].find((item) => item.id === activePostId) || null
    : null;
  const activeConversationAction = conversationActionId
    ? displayConversations.find((item) => item.id === conversationActionId) || null : null;
  const activeMessageAction = messageActionId
    ? messages.find((item) => item.id === messageActionId) || null
    : null;
  const activeStoryIndex = stories.findIndex(
    (item) => item.id === activeStoryId,
  );
  const activeStory = activeStoryIndex < 0 ? null : stories[activeStoryIndex];
  const effectiveAppLocale = resolveEffectiveLocale(
    appLocale,
    isSupportedLanguageCode,
  );
  const interfaceLocale = effectiveAppLocale || "vi";
  const languageOptions = useMemo(
    () => buildLanguageOptions(interfaceLocale),
    [interfaceLocale],
  );
  const selectedLanguage =
    languageOptions.find((language) => language.value === targetLanguage) ||
    languageOptions[0];
  const visibleLanguageOptions = useMemo(
    () => filterLanguageOptions(languageOptions, languageSearch),
    [languageOptions, languageSearch],
  );
  const visibleLocaleOptions = useMemo(
    () => filterLanguageOptions(languageOptions, localeSearch),
    [languageOptions, localeSearch],
  );
  const visibleTranslationSettingsOptions = useMemo(
    () => filterLanguageOptions(languageOptions, translationSettingsSearch),
    [languageOptions, translationSettingsSearch],
  );
  const selectedAppLanguage =
    languageOptions.find((language) => language.value === effectiveAppLocale) ||
    languageOptions[0];
  const t = (key: keyof typeof UI_MESSAGES) => translateUI(uiBundle, key);

  const { connectUrl, copyInviteLink, openConnectSurface, shareMyProfile } = useInviteSharing({ setActiveConversationId, setFriendQuery, setNewChatMode, setQuickCreateOpen, setTab });

  const { removeFeedPost, syncFeedPost } = usePostSync({ feedRevisionRef: feedRevision, followingFeed, postSearch, removeFeedDataPost, setProfilePosts, syncFeedDataPost });
  const { loadProfilePosts } = useProfilePosts({ feedRevisionRef: feedRevision, profileLoadSequenceRef: profileLoadSequence, profilePagingBusyRef: profilePagingBusy, profilePosts, setProfileHasMore, setProfilePosts, setProfilePostsBusy, setProfilePostsError });
  const { createPost, draftBeforeEdit, editingPost, openEditPost, postAttachments, postBackground, postEditBusy, postFeelingId, postTaggedFriends, postText, postVisibility, restoreDraftAfterEdit, setEditingPost, setPostAttachments, setPostBackground, setPostEditBusy, setPostFeelingId, setPostTaggedFriends, setPostText, setPostVisibility, setShowPostBackgrounds, showPostBackgrounds } = usePostComposer({ actionLocks, feedCheckInLocation, feedCheckInOpen, feedRevisionRef: feedRevision, friends, mediaUploading, name, pendingPost, setFeedCheckInLocation, setFeedCheckInOpen, setFeedComposerOpen, setPendingPost, setPosts, setPostSubmitError, setProfileComposerOpen, setProfilePosts, syncFeedPost, tab });
  const { like } = usePostReactions({ actionLocks, feedRevisionRef: feedRevision, followingFeed, postSearch, refreshPosts, setLikePreviews, setPosts, setProfilePosts, setSavedPosts });
  const { addComment, manageFeedComment, reportFeedComment } = usePostComments({ actionLocks, feedRevisionRef: feedRevision, followingFeed, name, postSearch, setPendingComments, setPosts, setProfilePosts, setSavedPosts, syncFeedPost });
  const { closeFeedPostDetails, openFeedPostDetails } = usePostDetailNavigation({ feedScrollBeforeComments, feedViewRef, isProfileDesktop, setActivePostId, tab });

  const { clearActiveConversationHistory } = useConversationHistory({ activeConversationId, activeConversationIdRef, conversations, historyActionBusy, refreshConversations, responseCache, setActiveConversationId, setConversationDetailsOpen, setHasMoreMessages, setHistoryActionBusy, setMessageSearchOpen, setMessages, setReplyingTo, setSharedContentOpen, setTranslations });
  const { createGroupChannel, selectGroupChannel } = useGroupChannels({ activeChannelIdRef, activeConversation, activeGroupMember, groupChannelBusy, groupChannels, messageScrollAtBottomRef: messageScrollAtBottom, setChannelSelection, setChatSearchJump, setConversationDetailsOpen, setGroupChannelBusy, setGroupChannelState, setHasMoreMessages, setMessageActionId, setMessageSearchOpen, setMessages, setReplyingTo });
  const { createDirect, openDirectByUsername } = useDirectConversations({ actionLocks, directUsername, membershipEventSequenceRef: membershipEventSequence, membershipSnapshot, refreshConversations, revokedConversationIds, setActiveConversationId, setChatCreateError, setConversations, setDesktopSection, setDirectUsername, setFriendQuery, setFriendResults, setGlobalSearch, setNewChatMode, setTab, setTranslations });
  const { createGroup } = useGroupCreation({ actionLocks, membershipEventSequenceRef: membershipEventSequence, membershipSnapshot, refreshConversations, revokedConversationIds, setActiveConversationId, setChatCreateError, setConversations, setFriendQuery, setNewChatMode, setTab });

  const { changeAppLocale, changeAutoTranslate, changeTargetLanguage, saveConversationTranslationSettings, translateMessage } = useTranslationActions({ activeChatTranslationSettings, activeConversationId, activeConversationIdRef, apiFetch, appLocale, autoTranslate, conversationTranslationOverrides, effectiveTargetLanguage, preferenceRevision, session, sessionRef, setAppLocale, setAutoTranslate, setConversationTranslationOverrides, setLanguageSearch, setLocalePickerOpen, setLocaleSearch, setManuallyTranslated, setNotice, setTargetLanguage, setTranslationFailures, setTranslationMenuOpen, setTranslationOriginals, setTranslationPending, setTranslationPickerOpen, setTranslations, setTranslationSettingsSearch, targetLanguage, translationAttempted, translationFailures, translationLanguageRef, translations });

  const { addChatFiles, addFeedFiles, setMessageAttachments, uploadMediaFiles } = useMediaUploads({ activeConversationId, apiFetch, channelDraftKey, mediaUploadAbort, mediaUploading, messageAttachments, messageSending, pendingPost, postAttachments, selectedChannelId, session, sessionRef, setChannelDrafts, setMediaUploading, setMediaUploadProgress, setMessageDrafts, setNotice, setPostAttachments });

  const { copyMessageContent } = useMessageClipboard({ setMessageActionId, setNotice });

  const { installApp, previewMessageSound, sendTestPush, syncPushState, toggleMessageSound, togglePush } = usePushSettings({ apiFetch, installPrompt, isStandalone, messageSound, messageSoundEnabledRef, pushAppId, pushBusy, pushConfigured, pushEnabled, pushInitFailed, session, setInstallPrompt, setMessageSoundEnabled, setNotice, setPushBusy, setPushEnabled, setPushInitFailed, setPushPrompt });

  const { findNearby, stopNearby } = useNearbyDiscovery({ apiFetch, nearbyBusy, nearbyRadiusKm, nearbyRequest, session, sessionRef, setNearbyBusy, setNearbyResultRadiusKm, setNearbyScanning, setNearbyUntil, setNearbyUsers, setNotice });

  useEffect(() => {
    if (!session?.token) return;
    const params = new URLSearchParams(window.location.search);
    const requestedUser = (params.get("connect") || params.get("invite") || "")
      .replace(/^@/, "")
      .trim();
    if (!requestedUser) return;

    if (
      requestedUser.toLocaleLowerCase("vi-VN") !==
      session.user.username.toLocaleLowerCase("vi-VN")
    ) {
      openVisitor(requestedUser);
    }

    params.delete("connect");
    params.delete("invite");
    const nextSearch = params.toString();
    window.history.replaceState(
      {},
      "",
      `${window.location.pathname}${nextSearch ? "?" + nextSearch : ""}${window.location.hash}`,
    );
  }, [session?.token]);

  useEffect(() => {
    activeConversationIdRef.current = activeConversationId;
    messageScrollAtBottom.current = true;
    cancelMessageLongPress();
    setMessages([]);
    setHasMoreMessages(false);
    setMessagesLoadingMore(false);
    messagesPagingBusy.current = false;
    setGroupMembers([]);
  }, [activeConversationId]);

  useEffect(() => {
    messageScrollAtBottom.current = true;
  }, [selectedChannelId]);

  function setMessageText(text: string) {
    if (!activeConversationId) return;
    if (selectedChannelId > 0) {
      setChannelDrafts(current => ({
        ...current,
        [channelDraftKey]: { ...(current[channelDraftKey] ?? emptyDraft), text },
      }));
      return;
    }
    setMessageDrafts((current) => ({
      ...current,
      [activeConversationId]: {
        ...(current[activeConversationId] ?? emptyDraft),
        text,
      },
    }));
  }

  useEffect(() => {
    const navigatorWithStandalone = navigator as Navigator & {
      standalone?: boolean;
    };
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      navigatorWithStandalone.standalone === true;
    setIsStandalone(standalone);

    const handleInstalled = () => {
      setInstallPrompt(null);
      setIsStandalone(true);
      setNotice("SocCO đã được cài vào thiết bị");
    };

    window.addEventListener("appinstalled", handleInstalled);
    return () => {
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);


  async function loadProfileMedia() {
    if (!session?.token) return;
    const sessionId = session.sessionId;
    const response = await apiFetch("/api/profile");
    if (!response.ok) return;
    const profile = (await response.json()) as ProfileMediaState;
    if (sessionRef.current?.sessionId !== sessionId) return;
    avatarRefreshVersions.set(profile.username, profile.updatedAt);
    setProfileMedia(profile);
    setProfileDisplayNameDraft(profile.displayName);
    setProfileUsernameDraft(profile.username);
    setProfileBioDraft(profile.bio ?? "");
    setProfileCityDraft(profile.city ?? "");
  }

  async function saveProfileIdentity(event: FormEvent) {
    event.preventDefault();
    if (!session || profileSaving) return;

    const displayName = profileDisplayNameDraft.trim();
    const username = profileUsernameDraft.trim().toLowerCase();
    const bio = profileBioDraft.trim();
    const city = profileCityDraft.trim();
    if (!displayName || !username) {
      setNotice("Tên hiển thị và username không được để trống.", "error");
      return;
    }

    setProfileSaving(true);
    try {
      const response = await apiFetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName, username, bio, city }),
      });
      const result = (await response.json().catch(() => null)) as
        | (ProfileUpdateResponse & { error?: string })
        | null;
      if (sessionRef.current?.sessionId !== session.sessionId) return;
      if (!response.ok || !result?.token) {
        throw new Error(
          result?.error || "Không cập nhật được thông tin cá nhân.",
        );
      }

      const previousUsername = session.user.username;
      avatarRefreshVersions.delete(previousUsername);
      avatarRefreshVersions.set(result.username, result.updatedAt);
      setProfileMedia({
        username: result.username,
        displayName: result.displayName,
        bio: result.bio ?? "",
        city: result.city ?? "",
        avatarSet: result.avatarSet,
        coverSet: result.coverSet,
        updatedAt: result.updatedAt,
      });
      setProfileDisplayNameDraft(result.displayName);
      setProfileUsernameDraft(result.username);
      setProfileBioDraft(result.bio ?? "");
      setProfileCityDraft(result.city ?? "");

      const nextSession: Session = {
        ...sessionRef.current,
        token: result.token,
        user: {
          ...session.user,
          username: result.username,
          displayName: result.displayName,
        },
      };
      saveSession(nextSession);
      setNotice("Đã lưu thông tin hồ sơ.", "success");
      if (isProfileDesktop) setProfileEditorOpen(false);
    } catch (error) {
      if (sessionRef.current?.sessionId === session.sessionId)
        setNotice(
          error instanceof Error
            ? error.message
            : "Không cập nhật được thông tin cá nhân.",
          "error",
        );
    } finally {
      if (sessionRef.current?.sessionId === session.sessionId)
        setProfileSaving(false);
    }
  }

  async function updateProfileImage(kind: "avatar" | "cover", file?: File | null) {
    if (!session || profileBusy) return false;
    if (file === undefined) return false;
    if (file && !file.type.toLowerCase().startsWith("image/")) {
      setNotice("Chỉ hỗ trợ file ảnh cho ảnh đại diện và ảnh bìa.", "error");
      return false;
    }
    setProfileBusy(kind);
    try {
      const [attachment] = file ? await uploadMediaFiles([file], "profile") : [null];
      if (sessionRef.current?.sessionId !== session.sessionId) return false;
      if (file && !attachment) throw new Error("Không upload được ảnh.");

      const response = await apiFetch("/api/profile/media", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          attachment: attachment ? attachmentRequestBody(attachment) : null,
        }),
      });
      const result = (await response.json().catch(() => null)) as
        | (ProfileMediaState & { error?: string })
        | null;
      if (sessionRef.current?.sessionId !== session.sessionId) return false;
      if (!response.ok || !result) {
        throw new Error(result?.error || "Không cập nhật được ảnh hồ sơ.");
      }
      avatarRefreshVersions.set(result.username, result.updatedAt);
      setProfileMedia(result);
      setNotice(
        kind === "avatar"
          ? "Đã cập nhật ảnh đại diện."
          : "Đã cập nhật ảnh bìa.",
        "success",
      );
      return true;
    } catch (error) {
      if (sessionRef.current?.sessionId === session.sessionId)
        setNotice(
          error instanceof Error
            ? error.message
            : "Không cập nhật được ảnh hồ sơ.",
          "error",
        );
      return false;
    } finally {
      if (sessionRef.current?.sessionId === session.sessionId)
        setProfileBusy(null);
    }
  }

  useEffect(() => {
    if (!session?.token) {
      setProfileMedia(null);
      return;
    }
    void loadProfileMedia().catch(() => setStatus("Đang kết nối lại..."));
  }, [session?.sessionId]);

  useEffect(() => {
    if (!session?.token) {
      setTranslationPreferencesLoaded(false);
      setAutoTranslate(true);
      setTargetLanguage("en");
      setAppLocale(loadAppLocalePreference());
      return;
    }

    let cancelled = false;
    const revision = preferenceRevision.current;
    const preferenceKey = `chatnet-preferences:${session.user.id}`;
    try {
      const cached = JSON.parse(
        localStorage.getItem(preferenceKey) || "null",
      ) as {
        targetLanguage?: string;
        autoTranslate?: boolean;
        appLocale?: string;
      } | null;
      if (
        cached?.targetLanguage &&
        isSupportedLanguageCode(cached.targetLanguage)
      ) {
        setTargetLanguage(cached.targetLanguage);
      }
      if (typeof cached?.autoTranslate === "boolean")
        setAutoTranslate(cached.autoTranslate);
      if (
        cached?.appLocale === "auto" ||
        (cached?.appLocale && isSupportedLanguageCode(cached.appLocale))
      ) {
        setAppLocale(cached.appLocale);
        saveAppLocalePreference(cached.appLocale);
      }
    } catch {
      // Ignore malformed local fallback; server preferences remain authoritative.
    }

    apiFetch("/api/preferences")
      .then(async (response) => {
        if (!response.ok) return null;
        return response.json() as Promise<{
          targetLanguage: string;
          autoTranslate: boolean;
          appLocale: string;
        }>;
      })
      .then(async (preferences) => {
        if (cancelled || revision !== preferenceRevision.current || !preferences) return;
        const nextTarget = isSupportedLanguageCode(preferences.targetLanguage)
          ? preferences.targetLanguage
          : "en";
        const nextAuto = preferences.autoTranslate !== false;
        const serverLocale =
          preferences.appLocale === "auto" ||
          isSupportedLanguageCode(preferences.appLocale)
            ? preferences.appLocale
            : "auto";

        // First-use language selection takes priority over the default server value.
        const setupLocaleKey = `chatnet-setup-locale:${session.user.id}`;
        const pendingLocale = localStorage.getItem(setupLocaleKey);
        const validPendingLocale = pendingLocale === "auto" ||
          (pendingLocale !== null && isSupportedLanguageCode(pendingLocale));
        const nextLocale = validPendingLocale && pendingLocale ? pendingLocale : serverLocale;

        if (validPendingLocale && pendingLocale) {
          if (serverLocale === pendingLocale) {
            localStorage.removeItem(setupLocaleKey);
          } else {
            try {
              const response = await apiFetch("/api/preferences", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  targetLanguage: nextTarget,
                  autoTranslate: nextAuto,
                  appLocale: nextLocale,
                }),
              });
              if (!response.ok) throw new Error("preference sync failed");
              localStorage.removeItem(setupLocaleKey);
            } catch {
              // Keep the chosen language locally and retry sync on the next login.
            }
          }
        }
        if (cancelled || revision !== preferenceRevision.current) return;
        setTargetLanguage(nextTarget);
        setAutoTranslate(nextAuto);
        setAppLocale(nextLocale);
        saveAppLocalePreference(nextLocale);
        localStorage.setItem(
          preferenceKey,
          JSON.stringify({
            targetLanguage: nextTarget,
            autoTranslate: nextAuto,
            appLocale: nextLocale,
          }),
        );
      })
      .catch(() => {
        // Keep local/device preferences when the network is unavailable.
      })
      .finally(() => {
        if (!cancelled) setTranslationPreferencesLoaded(true);
      });

    return () => {
      cancelled = true;
    };
  }, [session?.sessionId]);

  useEffect(() => {
    document.documentElement.lang = effectiveAppLocale;

    const cached = loadCachedBundle(effectiveAppLocale);
    if (cached) {
      setUiBundle(cached);
    } else {
      setUiBundle(defaultBundle());
    }

    if (effectiveAppLocale === "vi" || !session?.token) {
      setUiLocaleLoading(false);
      return;
    }

    const sessionId = session.sessionId;
    let cancelled = false;
    setUiLocaleLoading(true);

    apiFetch("/api/i18n/bundle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        locale: effectiveAppLocale,
        version: UI_BUNDLE_VERSION,
        messages: UI_MESSAGES,
      }),
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("cannot load UI locale");
        return response.json() as Promise<{
          locale: string;
          messages: UIBundle;
        }>;
      })
      .then((result) => {
        if (
          cancelled ||
          sessionRef.current?.sessionId !== sessionId ||
          result.locale !== effectiveAppLocale
        )
          return;
        const bundle = { ...defaultBundle(), ...result.messages };
        setUiBundle(bundle);
        saveCachedBundle(effectiveAppLocale, bundle);
      })
      .catch(() => {
        // Cached bundle or Vietnamese source remains available as a safe fallback.
      })
      .finally(() => {
        if (!cancelled) setUiLocaleLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [effectiveAppLocale, session?.token]);

  useEffect(() => {
    if (!session?.token) return;

    const openNotificationTarget = () => {
      const url = new URL(window.location.href);
      const params = url.searchParams;
      if (params.get("tab") === "feed") {
        setTab("feed");
      } else if (params.get("tab") === "contacts") {
        setTab("contacts");
      }
      const conversationID = Number(params.get("conversation"));
      const messageID = Number(params.get("message"));
      if (Number.isSafeInteger(conversationID) && conversationID > 0) {
        setTab("chat");
        setDesktopSection(null);
        setChatSearchJump(
          Number.isSafeInteger(messageID) && messageID > 0
            ? {
                conversationId: conversationID,
                messageId: messageID,
                revision: ++chatSearchJumpRevision.current,
              }
            : null,
        );
        setActiveConversationId(conversationID);
      }
      // Keep unrelated query parameters (e.g., invite links) intact.
      if (params.has("tab") || params.has("conversation") || params.has("message")) {
        params.delete("tab");
        params.delete("conversation");
        params.delete("message");
        window.history.replaceState({}, "", url.pathname + url.search + url.hash);
      }
    };
    openNotificationTarget();
    window.addEventListener("popstate", openNotificationTarget);
    window.addEventListener("pageshow", openNotificationTarget);
    return () => {
      window.removeEventListener("popstate", openNotificationTarget);
      window.removeEventListener("pageshow", openNotificationTarget);
    };
  }, [session?.token]);

  useEffect(() => {
    setPushPrompt(false);
    setPushPromptDismissed(false);
    if (!session?.token) {
      setPushConfigured(false);
      setPushAppId("");
      setPushEnabled(false);
      setPushInitFailed(false);
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const response = await apiFetch("/api/push/config");
        if (!response.ok) {
          if (!cancelled) setPushConfigured(false);
          return;
        }

        const config = (await response.json()) as {
          configured: boolean;
          appId: string;
        };
        if (cancelled) return;

        setPushConfigured(config.configured);
        setPushAppId(config.appId || "");
        setPushInitFailed(false);

        if (!config.configured || !config.appId) return;

        try {
          const state = await setupOneSignal(
            config.appId,
            async (nextState) => {
              if (cancelled) return;
              setPushEnabled(nextState.optedIn);
              setPushPrompt(
                nextState.supported &&
                  nextState.permission === "default" &&
                  !isPushDisabled(),
              );
              await syncPushState(nextState);
            },
          );

          if (!cancelled) {
            setPushEnabled(state.optedIn);
            setPushPrompt(
              state.supported &&
                state.permission === "default" &&
                !isPushDisabled(),
            );
            await syncPushState(state);
          }
        } catch (error) {
          if (!cancelled) {
            setPushEnabled(false);
            setPushInitFailed(true);
            const detail =
              error instanceof Error ? error.message : String(error);
            console.warn("OneSignal init failed:", detail);
          }
        }
      } catch {
        if (!cancelled) setPushConfigured(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [session?.sessionId]);

  async function changePrivacy(key: keyof UserPrivacy) {
    if (!privacy || privacyBusy) return;
    await savePrivacy({ ...privacy, [key]: !privacy[key] });
  }

  async function savePrivacy(next: UserPrivacy) {
    if (!privacy || privacyBusy || !session?.sessionId) return;
    const sessionId = session.sessionId;
    setPrivacyBusy(true);
    try {
      const response = await apiFetch("/api/privacy", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      const result = (await response
        .json()
        .catch(() => null)) as UserPrivacy | null;
      if (sessionRef.current?.sessionId !== sessionId) return;
      if (!response.ok || !result)
        throw new Error("Không lưu được quyền riêng tư.");
      setPrivacy(result);
      setPrivacyError("");
      setNotice("Đã lưu cài đặt riêng tư");
    } catch {
      if (sessionRef.current?.sessionId === sessionId) {
        setPrivacyError("Lưu thất bại. Cài đặt trước đó vẫn được giữ.");
        setNotice("Không thể lưu quyền riêng tư. Vui lòng thử lại.", "error");
      }
    } finally {
      if (sessionRef.current?.sessionId === sessionId) setPrivacyBusy(false);
    }
  }

  const contactQuery = friendQuery
    .trim()
    .replace(/^@/, "")
    .toLocaleLowerCase("vi-VN");
  const localContactMatches = [...friends, ...friendRequests].filter((friend) =>
    `${friend.displayName} ${friend.username}`
      .toLocaleLowerCase("vi-VN")
      .includes(contactQuery),
  );
  const localContactIds = new Set(
    localContactMatches.map((friend) => friend.id),
  );
  const contactSearchResults = [
    ...localContactMatches,
    ...friendResults.filter((friend) => !localContactIds.has(friend.id)),
  ];

  function friendRelationship(userId: number) {
    if (friends.some((item) => item.id === userId)) return "accepted" as const;
    const request = friendRequests.find((item) => item.id === userId);
    if (request?.direction === "incoming") return "incoming" as const;
    if (request?.direction === "outgoing") return "outgoing" as const;
    return "none" as const;
  }

  useEffect(() => {
    if (!session?.token) {
      setFriends([]);
      setFriendRequests([]);
      setContactMetadata({});
      setFriendSyncSessionId("");
      setFriendSyncError("");
      setBlockedUsers([]);
      setBlockedOpen(false);
      setBlockedError("");
      ++friendSyncRequest.current;
      return;
    }
    if (
      tab === "contacts" ||
      (tab === "chat" && desktopSection === "calls") ||
      newChatMode === "friends" ||
      newChatMode === "group" ||
      chatFriend
    ) {
      void refreshFriendConnections();
    }
  }, [session?.token, tab, desktopSection, newChatMode, chatFriend?.id]);

  useEffect(() => {
    const friendSurfaceOpen = newChatMode === "friends" || tab === "contacts";
    if (!session?.token || !friendSurfaceOpen) {
      setFriendResults([]);
      setFriendSearching(false);
      setFriendSearchError(false);
      return;
    }

    const controller = new AbortController();
    const query = friendQuery.trim();
    setFriendResults([]);
    setFriendSearching(true);
    setFriendSearchError(false);

    if (!query) {
      apiFetch("/api/users/suggestions", { signal: controller.signal })
        .then(async (response) => {
          if (!response.ok) throw new Error("Cannot load suggestions");
          return response.json() as Promise<FriendSearchResult[]>;
        })
        .then((items) => {
          if (!controller.signal.aborted) setFriendResults(items);
        })
        .catch(() => {
          if (!controller.signal.aborted) {
            setFriendResults([]);
            setFriendSearchError(true);
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) setFriendSearching(false);
        });

      return () => controller.abort();
    }

    const timer = window.setTimeout(async () => {
      setFriendSearching(true);
      try {
        const response = await apiFetch(
          `/api/users/search?q=${encodeURIComponent(query)}`,
          { signal: controller.signal },
        );
        if (!response.ok) throw new Error("Cannot search users");
        const items = (await response.json()) as FriendSearchResult[];
        if (!controller.signal.aborted) setFriendResults(items);
      } catch {
        if (!controller.signal.aborted) {
          setFriendResults([]);
          setFriendSearchError(true);
        }
      } finally {
        if (!controller.signal.aborted) setFriendSearching(false);
      }
    }, 250);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [friendQuery, friendSearchRetry, newChatMode, session?.token, tab, desktopSection]);

  function purgeConversation(id: number) {
    responseCache.current.invalidate(["conversations", "messages"]);
    revokedConversationIds.current.add(id);
    membershipSnapshot.current?.delete(id);
    membershipEventSequence.current += 1;
    setConversations((current) => current.filter((item) => item.id !== id));
    setMessageDrafts((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
    if (activeConversationIdRef.current === id) {
      activeConversationIdRef.current = null;
      setActiveConversationId(null);
      setMessages([]);
      setHasMoreMessages(false);
      setGroupMembers([]);
      setGroupSettingsOpen(false);
      setSharedContentOpen(false);
      setTranslations({});
      setReplyingTo(null);
      setMessageActionId(null);
      setNotice("Bạn không còn là thành viên của nhóm này.");
    }
  }

  function closeProfileTimeline() {
    setProfileTimelineOpen(false);
    requestAnimationFrame(() => profileIdentityRef.current?.focus());
  }

  function logout(revoke = true, clearStorage = true) {
    setVisitorUsername(null);
    const current = sessionRef.current;
    const currentToken = current?.token;
    ++nearbyRequest.current;
    setNearbyUsers([]);
    setNearbyUntil(0);
    setNearbyBusy(false);
    setNearbyScanning(false);
    if (currentToken) {
      void fetch(`${API}/api/users/nearby`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${currentToken}` },
        keepalive: true,
      }).catch(() => undefined);
    }
    void getOneSignalPushState()
      .then(async (state) => {
        if (!currentToken || !state.subscriptionId) return;
        await fetch(`${API}/api/push/subscription`, {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${currentToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ subscriptionId: state.subscriptionId }),
        });
      })
      .catch(() => undefined);

    chatOutboxRef.current = [];
    setChatOutbox([]);
    chatOutboxSession.current = "";
    sendingClientIDs.current.clear();
    pendingSend.current = null;
    endSession(revoke, clearStorage, setNotice);
    setConversations([]);
    revokedConversationIds.current.clear();
    membershipSnapshot.current = null;
    membershipSyncSequence.current += 1;
    membershipEventSequence.current += 1;
    setHasMoreConversations(false);
    setConversationLoadingMore(false);
    conversationOffset.current = 0;
    conversationPagingBusy.current = false;
    setActiveConversationId(null);
    setMessages([]);
    setHasMoreMessages(false);
    setMessagesLoadingMore(false);
    messagesPagingBusy.current = false;
    setOutgoingMessage(null);
    setPendingPost(null);
    setPendingComments({});
    setLikePreviews({});
    setReactionPreviews({});
    actionLocks.current.clear();
    pendingRequests.current.clear();
    mutationRequests.current.clear();
    messageReceipts.current.clear();
    messageSound.current?.clearSeen();
    ++preferenceRevision.current;
    sendingRef.current = false;
    setMessageSending(false);
    setGroupBusy(false);
    setProfileBusy(null);
    setProfileSaving(false);
    setStoryBusy(false);
    mediaUploadAbort.current?.abort();
    mediaUploadAbort.current = null;
    setMediaUploading(null);
    setMediaUploadProgress(null);
    friendActionRef.current.clear();
    setFriendBusyIds(new Set());
    setFriendActionBusy(null);
    ++feedRevision.current;
    setMessageDrafts({});
    setFriends([]);
    setFriendRequests([]);
    setFriendMenuId(null);
    setFriendPreview(null);
    setPostText("");
    setPostTaggedFriends([]);
    setPostFeelingId("");
    setEditingPost(null);
    setPostEditBusy(false);
    draftBeforeEdit.current = null;
    setPosts([]);
    setSavedPosts([]);
    setHasMoreSavedPosts(false);
    ++profileLoadSequence.current;
    profilePagingBusy.current = false;
    setProfileTimelineOpen(false);
    setProfileComposerOpen(false);
    setFeedComposerOpen(false);
    setProfileEditorOpen(false);
    setPostSubmitError("");
    setProfilePosts([]);
    setProfileHasMore(false);
    setProfilePostsBusy(false);
    setProfilePostsError("");
    setHasMorePosts(false);
    setPostsLoadingMore(false);
    postsPagingBusy.current = false;
    setStories([]);
    setActiveStoryId(null);
    setCommentEditors({});
    setPostAttachments([]);
    setTranslations({});
  }
  const { fetchAccountSessions, revokeAccountSessions } = useAccountSessions({ logout, managedSessions, sessionRef, sessionsBusy, setManagedSessions, setNotice, setSessionsBusy, setSessionsError, setSessionsOpen });



  useEffect(() => {
    if (!session) return;
    const refresh = () => {
      if (!isDesktopBuild && document.visibilityState === "hidden") return;
      void sessionClient
        .refresh()
        .then((current) => {
          if (isDesktopBuild && current) return sessionClient.check();
        })
        .catch(() => setStatus("Đang kết nối lại..."));
    };
    refresh();
    const timer = window.setInterval(refresh, 60_000);
    window.addEventListener("focus", refresh);
    window.addEventListener("online", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("online", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [session?.sessionId, sessionClient]);

  const nativeNotifications = useDesktopNotifications({
    session,
    sessionRef,
    apiFetch,
    checkSession: sessionClient.check,
    activeConversationId,
    tab,
    sound: messageSoundEnabled,
    onError: (message) => setNotice(message, "warning"),
    onOpen: (conversation) => {
      revokedConversationIds.current.delete(conversation.id);
      membershipSnapshot.current?.add(conversation.id);
      setConversations((current) => [
        conversation,
        ...current.filter((item) => item.id !== conversation.id),
      ]);
      if (activeConversationIdRef.current !== conversation.id) setMessages([]);
      switchTab("chat");
      setActiveConversationId(conversation.id);
    },
  });

  useAppRealtime({
    onCategoryAssignmentChanged: conversationCategories.applyAssignment,
    onCategoriesChanged: () => {
      void conversationCategories.refreshCategories();
      conversationCategories.refreshFiltered();
    },
    refreshCategoryConversations: conversationCategories.refreshFiltered,
    responseCache,
    expireSession: () => {
      logout(false);
      setNotice(
        "Phiên đăng nhập đã bị thu hồi. Vui lòng đăng nhập lại.",
        "warning",
      );
    },
    checkSession: sessionClient.check,
    session,
    sessionRef,
    apiFetch,
    setStatus,
    refreshConversations,
    refreshPosts,
    refreshStories,
    refreshFriendConnections,
    reconcileConversationMemberships,
    purgeConversation,
    revokedConversationIds,
    membershipSnapshot,
    membershipEventSequence,
    membershipSyncSequence,
    groupSettingsOpen,
    activeConversationIdRef,
    activeChannelIdRef,
    activeConversationTypeRef,
    refreshGroupMembers,
    refreshPinnedMessages,
    clearPinnedMessages,
    setMessages,
    messageChanges,
    setTranslations,
    messageSound,
    messageSoundEnabledRef,
    tabRef,
    pendingSend,
    setMessageDrafts,
    messageReceipts,
    setOutgoingMessage,
    setConversations,
    onMessageConfirmed: (message) => {
      if (!message.clientId || message.senderId !== sessionRef.current?.user.id)
        return;
      updateChatOutbox((items) => {
        if (
          !items.some(
            (item) =>
              item.clientId === message.clientId &&
              item.conversationId === message.conversationId,
          )
        )
          return items;
        return confirmChatMessage(
          items,
          message.clientId!,
          message.conversationId,
        );
      });
    },
  });

  useEffect(() => {
    if (!session?.token || tab !== "feed") return;
    void refreshPosts();
    void refreshStories();
    const timer = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      void refreshPosts();
      void refreshStories();
    }, 12000);
    return () => window.clearInterval(timer);
  }, [tab, session?.token]);

  useLayoutEffect(() => {
    const container = messagesScrollRef.current;
    if (ownSendScrollConversation.current !== null) {
      const sentInCurrentConversation =
        ownSendScrollConversation.current === activeConversationId;
      ownSendScrollConversation.current = null;
      if (sentInCurrentConversation && container) {
        // Only a local send overrides the reader's position; incoming messages never do.
        pendingMessageScrollRestore.current = null;
        container.scrollTop = container.scrollHeight;
        messageScrollAtBottom.current = true;
        return;
      }
    }
    const restore = pendingMessageScrollRestore.current;
    if (restore && container) {
      container.scrollTop =
        restore.top + container.scrollHeight - restore.height;
      pendingMessageScrollRestore.current = null;
      return;
    }
    // Preserve scroll position when reading history; only follow new messages
    // when the reader was already near the bottom of the conversation.
    if (container && messageScrollAtBottom.current)
      container.scrollTop = container.scrollHeight;
  }, [messages, outgoingMessage, chatOutbox]);

  useEffect(() => {
    if (
      !translationPreferencesLoaded ||
      !effectiveAutoTranslate ||
      !session ||
      !activeConversationId
    )
      return;
    const missing = messages.filter(
      (message) =>
        !message.deleted &&
        message.senderId !== session.user.id &&
        Boolean(message.text.trim()) &&
        !translations[message.id] &&
        !translationAttempted.current.has(`${session.sessionId}:${effectiveTargetLanguage}:${message.id}:${message.editedAt ?? ""}`),
    );
    missing.forEach((message) => void translateMessage(message, false));
  }, [
    effectiveAutoTranslate,
    translationPreferencesLoaded,
    messages,
    effectiveTargetLanguage,
    session?.user.id,
    session?.sessionId,
    activeConversationId,
  ]);

  const canSend = useMemo(
    () =>
      Boolean(
        activeConversationId &&
        !conversationBlocked &&
        !mediaUploading &&
        !messageSending &&
        (messageText.trim() || messageAttachments.length > 0),
      ),
    [
      activeConversationId,
      conversationBlocked,
      messageText,
      messageAttachments.length,
      mediaUploading,
      messageSending,
    ],
  );
  const { retryQueuedChatMessages } = useOutboxDelivery({ activeChannelIdRef, activeConversationIdRef, chatOutboxRef, chatOutboxSession, messageChanges, refreshConversations, retryOutboxBusyRef: retryOutboxBusy, sendingClientIDs, setMessages, updateChatOutbox });
  const { sendMessage } = useMessageSender({ activeConversationId, canSend, channelDraftKey, draft, messageAttachments, messageText, ownSendScrollConversationRef: ownSendScrollConversation, replyingTo, retryQueuedChatMessages, selectedChannelId, sendingRef, setChannelDrafts, setChatOnline, setMessageDrafts, setReplyingTo, updateChatOutbox });
  const { editOwnMessage, recallOwnMessage } = useMessageEdits({ actionLocks, activeConversationIdRef, messageChanges, setMessages, setReplyingTo, setTranslations });
  const { toggleReaction } = useMessageReactions({ actionLocks, activeConversationIdRef, messageChanges, setMessages, setReactionPreviews });
  const { createStory, deleteStory, replyToStory, reportStory, shareStory } = useStoryActions({ mediaUploading, name, openDirectByUsername, ownSendScrollConversation, retryQueuedChatMessages, setActiveStoryId, setChatOnline, setStories, setStoryBusy, setStoryDraftFile, storyBusy, updateChatOutbox, uploadMediaFiles });

  const { actOnFriend, blockContact, changePersonalContact, declineFriendRequest, loadBlockedUsers, openBlockedFriendConversation, removeAcceptedFriend, reportContact, unblockContact } = useContactActions({ apiFetch, blockedBusy, contactMetadata, conversations, friendActionRef, friendBusyIds, friendRelationship, friends, friendSyncRequest, openDirectByUsername, refreshConversations, refreshFriendConnections, session, sessionRef, setActiveConversationId, setBlockedBusy, setBlockedError, setBlockedOpen, setBlockedUsers, setContactMetadata, setConversations, setDesktopSection, setFriendActionBusy, setFriendBusyIds, setFriendMenuId, setFriendPreview, setFriendRequests, setFriendResults, setFriends, setNotice, setTab });

  useEffect(() => {
    if (!session?.sessionId) return;
    const onOnline = () => {
      setChatOnline(true);
      void retryQueuedChatMessages();
    };
    const onOffline = () => setChatOnline(false);
    const onVisible = () => {
      if (document.visibilityState === "visible") onOnline();
    };
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    document.addEventListener("visibilitychange", onVisible);
    const timer = window.setInterval(
      () => void retryQueuedChatMessages(),
      15_000,
    );
    const initial = window.setTimeout(
      () => void retryQueuedChatMessages(),
      250,
    );
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(timer);
      window.clearTimeout(initial);
    };
  }, [session?.sessionId]);

  useEffect(() => {
    if (!session || !messages.length || !chatOutboxRef.current.length) return;
    const delivered = new Set(
      messages
        .filter(
          (message) =>
            message.senderId === session.user.id && Boolean(message.clientId),
        )
        .map((message) => `${message.conversationId}:${message.clientId}`),
    );
    if (!delivered.size) return;
    updateChatOutbox((items) => {
      if (
        !items.some((item) =>
          delivered.has(`${item.conversationId}:${item.clientId}`),
        )
      )
        return items;
      return items.filter(
        (item) => !delivered.has(`${item.conversationId}:${item.clientId}`),
      );
    });
  }, [messages, session?.sessionId]);


  const unreadTotal = conversations.reduce(
    (sum, conversation) => sum + conversation.unreadCount,
    0,
  );
  const notificationItemCount = countNotificationItems(friendRequests, conversations)
    + postMentions.filter(mention => !mention.readAt).length;
  const notificationBadgeText = formatNotificationBadge(notificationItemCount);
  const normalizedSearch = globalSearch.trim().toLocaleLowerCase("vi-VN");
  // The conversation sidebar is independent of the keyword. Only the dropdown searches.
  const visibleConversations =
    conversationCategories.selected === null
      ? displayConversations
      : conversationCategories.items
          .map(
            (item) =>
              displayConversations.find((c) => c.id === item.id) || item,
          )
          .filter(
            (item) =>
              !revokedConversationIds.current.has(item.id) &&
              (!membershipSnapshot.current ||
                membershipSnapshot.current.has(item.id)),
          );
  // Search uses the backend's authorized, accent-insensitive full-history query.
  // Keep the normal paginated list intact when the search is cleared.
  const chatListConversations = conversationListSearch.active
    ? conversationListSearch.items
        .filter((conversation) => !revokedConversationIds.current.has(conversation.id))
        .map((conversation) => ({
          ...conversation,
          name: conversation.type === 'direct' && conversation.otherUserId
            ? contactMetadata[conversation.otherUserId]?.nickname || conversation.name
            : conversation.name,
        }))
    : visibleConversations.filter((conversation) => {
        if (chatListFilter === 'unread' && conversation.unreadCount <= 0) return false
        if (chatListFilter === 'groups' && conversation.type !== 'group') return false
        return true
      })

  const searchedPosts = feedSearchActive
    ? postSearch.posts.map((post) =>
        likePreviews[post.id] === undefined
          ? post
          : {
              ...post,
              liked: likePreviews[post.id],
              likes: Math.max(
                0,
                post.likes +
                  (likePreviews[post.id] === post.liked
                    ? 0
                    : likePreviews[post.id]
                      ? 1
                      : -1),
              ),
            },
      )
    : feedFilter === "saved"
      ? savedPosts
      : feedFilter === "following"
        ? followingFeed.posts.map((post) =>
            likePreviews[post.id] === undefined
              ? post
              : {
                  ...post,
                  liked: likePreviews[post.id],
                  likes: Math.max(
                    0,
                    post.likes +
                      (likePreviews[post.id] === post.liked
                        ? 0
                        : likePreviews[post.id]
                          ? 1
                          : -1),
                  ),
                },
          )
        : feedFilter === "latest"
          ? [...visiblePosts].sort(
              (a, b) =>
                Date.parse(b.createdAt) - Date.parse(a.createdAt) ||
                b.id - a.id,
            )
          : visiblePosts;
  const sortedChatListConversations = [...chatListConversations].sort((a, b) =>
    Number(Boolean(b.pinnedAt)) - Number(Boolean(a.pinnedAt)) ||
    (b.pinnedAt || '').localeCompare(a.pinnedAt || '') ||
    (b.lastMessageAt || b.createdAt).localeCompare(a.lastMessageAt || a.createdAt)
  );
  const openChatQuickContact = (contact: ChatQuickContact) => {
    setQuickSearchOpen(false);
    setGlobalSearch("");
    setChatSearchJump(null);
    if (contact.conversation) {
      const selected = contact.conversation;
      setConversations((current) =>
        current.some((item) => item.id === selected.id)
          ? current
          : [...current, selected],
      );
      setActiveConversationId(selected.id);
    } else if (contact.username) {
      void openDirectByUsername(contact.username);
    }
  };
  const openChatQuickHit = (hit: ChatQuickHit) => {
    setQuickSearchOpen(false);
    setGlobalSearch("");
    setConversations((current) =>
      current.some((item) => item.id === hit.conversation.id)
        ? current
        : [...current, hit.conversation],
    );
    setChatSearchJump({
      conversationId: hit.conversation.id,
      messageId: hit.id,
      revision: ++chatSearchJumpRevision.current,
    });
    setActiveConversationId(hit.conversation.id);
    setTranslations({});
    setTranslationOriginals({});
  };
  async function readPostMention(id: number) {
    const mention = postMentions.find(item => item.id === id);
    if (!mention || mention.readAt) return;
    try {
      const response = await apiFetch(`/api/feed/mentions/${id}/read`, { method: "POST" });
      if (!response.ok) throw new Error("Không đánh dấu được thông báo.");
      setPostMentions(current => current.map(item => item.id === id
        ? { ...item, readAt: new Date().toISOString() } : item));
    } catch {
      setNotice("Không đánh dấu được thông báo. Vui lòng thử lại.", "error");
    }
  }

  async function openMentionPost(mention: PostMentionNotification) {
    try {
      const response = await apiFetch(`/api/posts/${mention.postId}`, { cache: "no-store" });
      if (!response.ok) throw new Error(response.status === 404
        ? "Bài viết không tồn tại hoặc bạn không còn quyền xem."
        : "Không mở được bài viết.");
      const post = await response.json() as Post;
      setPosts(current => [post, ...current.filter(item => item.id !== post.id)]);
      setFeedCommunitiesOpen(false);
      setTab("feed");
      setActivePostId(post.id);
      const url = new URL(window.location.href);
      url.searchParams.set("tab", "feed");
      url.searchParams.set("post", String(post.id));
      window.history.pushState({ ...window.history.state, postId: post.id }, "", url);
      void readPostMention(mention.id);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Không mở được bài viết.", "error");
    }
  }

  const switchTab = (nextTab: Tab) => {
    setDesktopSection(null);
    setFeedCommunitiesOpen(false);
    setTranslationSettingsConversationId(null);
    if (nextTab === "contacts") setContactsScreen("directory");
    if (nextTab === "profile") {
      setDesktopProfileSettings(false);
      setProfileEditorOpen(false);
    }
    if (activePostId !== null) {
      setActivePostId(null);
      feedScrollBeforeComments.current = null;
      const url = new URL(window.location.href);
      if (url.searchParams.has("post")) {
        url.searchParams.delete("post");
        window.history.replaceState(window.history.state, "", url);
      }
    }
    if (nextTab === "feed") setFeedFilter("all");
    setQuickSearchOpen(false);
    setTab(nextTab);
    setQuickCreateOpen(false);
    setGlobalSearch("");
    if (nextTab !== "chat") setActiveConversationId(null);
    if (nextTab !== "contacts") setFriendQuery("");
  };

  const discardDesktopProfileEdits = () => {
    setProfileDisplayNameDraft(
      profileMedia?.displayName ?? session.user.displayName ?? name,
    );
    setProfileUsernameDraft(profileMedia?.username ?? name);
    setProfileBioDraft(profileMedia?.bio ?? "");
    setProfileCityDraft(profileMedia?.city ?? "");
    setProfileEditorOpen(false);
  };

  const profileIdentityForm = (
    <ProfileIdentityForm
      saveProfileIdentity={saveProfileIdentity}
      t={t}
      profileDisplayNameDraft={profileDisplayNameDraft}
      setProfileDisplayNameDraft={setProfileDisplayNameDraft}
      profileUsernameDraft={profileUsernameDraft}
      setProfileUsernameDraft={setProfileUsernameDraft}
      profileSaving={profileSaving}
      profileMedia={profileMedia}
    />
  );
  const profilePrivacyControls = (
    <PrivacyControls
      privacyLoading={privacyLoading}
      privacyError={privacyError}
      setPrivacyRetry={setPrivacyRetry}
      privacy={privacy}
      privacyBusy={privacyBusy}
      changePrivacy={changePrivacy}
    />
  );
  const postComposer = (
    <PostComposer
      name={name}
      createPost={createPost}
      editingPost={editingPost}
      editBusy={postEditBusy}
      postComposerRef={postComposerRef}
      postBackground={postBackground}
      pendingPost={pendingPost}
      postText={postText}
      setPostText={setPostText}
      taggableFriends={friends.filter((friend) => friend.status === "accepted" && !friend.blockedByMe && !friend.blockedByOther)}
      taggedFriends={postTaggedFriends}
      setTaggedFriends={setPostTaggedFriends}
      feelingId={postFeelingId}
      setFeelingId={setPostFeelingId}
      feedAlbumInputRef={feedAlbumInputRef}
      addFeedFiles={addFeedFiles}
      postAttachments={postAttachments}
      setPostAttachments={setPostAttachments}
      mediaUploading={mediaUploading}
      showPostBackgrounds={showPostBackgrounds}
      setShowPostBackgrounds={setShowPostBackgrounds}
      postVisibility={postVisibility}
      setPostVisibility={setPostVisibility}
      setPostBackground={setPostBackground}
      popup={profileComposerOpen || feedComposerOpen}
      displayName={
        profileMedia?.displayName || session.user.displayName || name
      }
      submitError={postSubmitError}
      checkInOpen={feedCheckInOpen}
      checkInLocation={feedCheckInLocation}
      setCheckInLocation={setFeedCheckInLocation}
      setCheckInOpen={setFeedCheckInOpen}
      uploadProgress={mediaUploadProgress}
      cancelUpload={() => mediaUploadAbort.current?.abort()}
    />
  );

  const postDiscussion = activePost ? (
                    <FeedDiscussion
                      key={activePost.id}
                      variant={tab === 'feed' && isProfileDesktop ? 'post-page' : 'default'}
                      sortOrder={commentSortOrder}
                      pending={pendingComments[activePost.id]}
                      comments={activePost.comments || []}
                      editor={
                        commentEditors[activePost.id] || {
                          replyTo: null,
                          drafts: {},
                        }
                      }
                      updateEditor={(editor) => {
                        if (
                          sessionRef.current?.sessionId === session.sessionId
                        ) {
                          setCommentEditors((current) => ({
                            ...current,
                            [activePost.id]: editor,
                          }));
                        }
                      }}
                      api={API}
                      token={session.token}
                      target={
                        translationPreferencesLoaded ? targetLanguage : ""
                      }
                      submit={(content, parentId) =>
                        addComment(activePost, content, parentId)
                      }
                      currentUser={name}
                      onEdit={(commentId, content) =>
                        manageFeedComment(
                          activePost,
                          commentId,
                          "PATCH",
                          content,
                        )
                      }
                      onDelete={(commentId) =>
                        manageFeedComment(activePost, commentId, "DELETE")
                      }
                      onReport={reportFeedComment}
                    />
  ) : null;

  const renderPosts = (items: Post[], showSave = false) =>
    items.map((post) => (
      <FeedPostCard
        key={post.id}
        post={post}
        name={name}
        onAuthorOpen={openVisitor}
        ownDisplayName={
          profileMedia?.displayName || session.user.displayName || name
        }
        apiFetch={apiFetch}
        syncFeedPost={syncFeedPost}
        removeFeedPost={removeFeedPost}
        setNotice={setNotice}
        token={session.token}
        translationPreferencesLoaded={translationPreferencesLoaded}
        targetLanguage={targetLanguage}
        setActivePostId={openFeedPostDetails}
        showSave={showSave}
        likePreviews={likePreviews}
        like={like}
        onReactionUsers={(post) => setReactionTarget({kind: "post", id: post.id, reactions: post.reactions})}
        onEditPost={openEditPost}
        taggedNames={friendTaggedNames}
      />
    ));

  const contactsContent = (
    <ContactsView
      screen={contactsScreen}
      onScreenChange={setContactsScreen}
      friendQuery={friendQuery}
      setFriendQuery={setFriendQuery}
      friendSearching={friendSearching}
      friendSearchError={friendSearchError}
      setFriendSearchRetry={setFriendSearchRetry}
      contactSearchResults={contactSearchResults}
      friendRelationship={friendRelationship}
      friendBusyIds={friendBusyIds}
      actOnFriend={actOnFriend}
      setFriendMenuId={setFriendMenuId}
      friendMenuId={friendMenuId}
      blockContact={blockContact}
      unblockContact={unblockContact}
      onOpenBlockedChat={(id) => { void openBlockedFriendConversation(id) }}
      reportContact={reportContact}
      friendRequests={friendRequests}
      declineFriendRequest={declineFriendRequest}
      friends={friends}
      friendsLoading={friendSyncBusy}
      friendsError={friendSyncError}
      onRetryFriends={() => void refreshFriendConnections()}
      contactMetadata={contactMetadata}
      openDirectByUsername={openDirectByUsername}
      setFriendPreview={setFriendPreview}
      changePersonalContact={changePersonalContact}
      removeAcceptedFriend={removeAcceptedFriend}
      connectionUrl={connectUrl()}
      onScanQr={() => setQrOpen("scan")}
      embeddedInCalls={tab === "chat" && desktopSection === "calls"}
      callConversations={tab === "chat" && desktopSection === "calls" ? displayConversations : undefined}
      onOpenCallChat={(id) => { setDesktopSection(null); setActiveConversationId(id); }}
    />
  );

  const searchInConversationList = phoneSearchLayout && tab === "chat" &&
    desktopSection === null && translationSettingsConversationId === null;
  const showHeaderAccount =
    tab === "profile" ||
    tab === "feed" ||
    tab === "notifications" ||
    (tab === "chat" && desktopSection === "groups");
  const searchText = searchLabels(tab);
  const quickSearchControl = (
    <HeaderSearch
      anchorRef={quickSearchAnchorRef}
      icon={<UiIcon name="search" size={27} />}
      value={tab === "contacts" ? friendQuery : globalSearch}
      maxLength={tab === "feed" || tab === "chat" ? 120 : undefined}
      placeholder={searchText.placeholder}
      ariaLabel={searchText.ariaLabel}
      expanded={tab === "chat" && conversationSearching && quickSearchOpen}
      controls={tab === "chat" ? "chat-quick-search-results" : undefined}
      onKeyDown={(event) => {
        if (tab === "chat" && event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          setQuickSearchOpen(false);
        }
      }}
      onFocus={() => {
        if (tab === "chat" && globalSearch.trim()) setQuickSearchOpen(true);
      }}
      onClick={() => {
        if (tab === "chat" && globalSearch.trim()) setQuickSearchOpen(true);
      }}
      onChange={(value) => {
        if (tab === "contacts") setFriendQuery(value);
        else if (tab === "profile") {
          setFeedFilter("all");
          setGlobalSearch(value);
          setTab("feed");
        } else {
          setGlobalSearch(value);
          if (tab === "chat") setQuickSearchOpen(Boolean(value.trim()));
        }
      }}
      results={
        tab === "chat" && conversationSearching && quickSearchOpen ? (
          <ChatQuickSearch
            results={chatQuickSearch.results}
            loading={chatQuickSearch.loading}
            error={chatQuickSearch.error}
            onRetry={chatQuickSearch.retry}
            onClose={() => setQuickSearchOpen(false)}
            onContact={openChatQuickContact}
            onHit={openChatQuickHit}
          />
        ) : undefined
      }
    />
  );

  return (
    <AppLayout
      className={`app-shell modern-shell app-layout ${tab === "contacts" || tab === "notifications" ? "friends-layout-active" : ""} ${tab === "chat" && activeConversation && !desktopSection ? "conversation-open" : ""}`}
      sidebar={
        <AppSidebar
        tab={tab}
        section={tab === "chat" ? desktopSection : null}
        username={session.user.username}
        displayName={
          profileMedia?.displayName ||
          session.user.displayName ||
          session.user.username
        }
        unreadTotal={unreadTotal}
        feedSaved={feedFilter === "saved"}
        onNavigate={switchTab}
        onCalls={() => {
          switchTab("chat");
          setDesktopSection("calls");
        }}
        onSaved={() => {
          switchTab("feed");
          setFeedFilter("saved");
          void loadSavedPosts();
        }}
        onSettings={() => {
          switchTab("profile");
          setDesktopProfileSettings(true);
          setProfileTimelineOpen(false);
        }}
      />
      }
      overlays={
        <>
          {qrOpen && (
        <Suspense fallback={null}>
          <ProfileQr
            username={session.user.username}
            displayName={session.user.displayName || session.user.username}
            url={connectUrl()}
            initialMode={qrOpen}
            onClose={() => setQrOpen(null)}
            onConnect={(username) => {
              setQrOpen(null);
              openVisitor(username);
            }}
          />
        </Suspense>
      )}
          {mediaUploading && mediaUploadProgress && (
        <div className="media-upload-progress" role="status" aria-live="polite">
          <span>
            Đang tải tệp:{" "}
            {Math.round(
              (mediaUploadProgress.loaded /
                Math.max(1, mediaUploadProgress.total)) *
                100,
            )}
            %
          </span>
          <progress
            value={mediaUploadProgress.loaded}
            max={mediaUploadProgress.total}
            aria-label="Tiến độ tải tệp"
          />
          <button
            type="button"
            onClick={() => mediaUploadAbort.current?.abort()}
          >
            Hủy tải
          </button>
        </div>
      )}
          {visitorUsername && (
        <VisitorProfile
          key={session.sessionId + ":" + visitorUsername}
          username={visitorUsername}
          request={apiFetch}
          currentUser={name}
          token={session.token}
          targetLanguage={translationPreferencesLoaded ? targetLanguage : ""}
          relationship={friendRelationship}
          friendBusy={friendActionBusy}
          onFriend={actOnFriend}
          onMessage={async (username) => {
            await openDirectByUsername(username);
            setVisitorUsername(null);
          }}
          onClose={() => setVisitorUsername(null)}
          onReactionUsers={(post) => setReactionTarget({kind: "post", id: post.id, reactions: post.reactions})}
          onPostOpen={(post) => {
            setPosts((current) => [
              post,
              ...current.filter((item) => item.id !== post.id),
            ]);
            setActivePostId(post.id);
          }}
          onUpdated={syncFeedPost}
          onUserOpen={openVisitor}
          onEditPost={openEditPost}
          taggedNames={friendTaggedNames}
          updates={posts}
          onDeleted={removeFeedPost}
          feedback={setNotice}
        />
      )}
          {newChatMode === "group" && (
        <GroupCreator
          ownerId={session.user.id}
          friends={friends.filter((friend) => friend.status === "accepted")}
          query={friendQuery}
          onQuery={setFriendQuery}
          onCreate={async (groupName, usernames) => { await createGroup(groupName, usernames); }}
          error={chatCreateError}
          onClose={() => {
            setNewChatMode("none");
            setFriendQuery("");
            setChatCreateError("");
          }}
        />
      )}
        </>
      }
      header={
        <AppHeader
          className={`chatnet-appbar ${tab === "chat" && desktopSection === null && translationSettingsConversationId === null ? "mobile-chat-appbar" : ""} ${searchInConversationList ? "mobile-search-in-list" : ""} ${tab === "profile" ? "app-section-header" : tab === "discover" || tab === "market" ? "app-section-header app-header-no-search" : ""}`}
        >
          <HeaderTitle
            tab={tab}
            desktopSection={desktopSection}
            translationSettingsOpen={translationSettingsConversationId !== null}
            groupWorkspaceMode={groupWorkspaceMode}
            groupCreateStep={groupCreateStep}
            activeConversationName={activeConversation?.name}
            contactsDirectory={contactsScreen === "directory"}
            feedPostOpenOnDesktop={Boolean(isProfileDesktop && activePost)}
            profileSettings={desktopProfileSettings}
            profileDesktop={isProfileDesktop}
            profileEditing={Boolean(desktopProfileOverview && profileEditorOpen)}
          />
          <div className="appbar-brand">
            <img src="/soco-mark.svg" width="32" height="32" alt="" />
            <strong>SocCO</strong>
          </div>
          {!searchInConversationList && quickSearchControl}
          <AppHeaderActions
            account={
              showHeaderAccount ? (
              <HeaderAccount
                variant={tab === "profile" ? "settings" : "profile"}
                username={name}
                displayName={userLabel(profileMedia?.displayName || session.user.displayName, name)}
                onClick={
                  tab === "profile"
                    ? () => {
                        setDesktopProfileSettings(true);
                        setProfileTimelineOpen(false);
                      }
                    : () => switchTab("profile")
                }
              />
              ) : null
            }
          >
            <HeaderActions
              tab={tab}
              desktopSection={desktopSection}
              notificationCount={notificationItemCount}
              notificationBadgeText={notificationBadgeText}
              onOpenNotifications={() => switchTab("notifications")}
              chat={{
                quickCreateOpen,
                onScanQr: () => setQrOpen("scan"),
                onCreateCommunity: () => {
                  setChatCreateError("");
                  setGroupCreateStep(1);
                  setGroupWorkspaceMode("create");
                  setQuickCreateOpen(false);
                },
                onToggleQuickCreate: () => setQuickCreateOpen((current) => !current),
                onCloseQuickCreate: () => setQuickCreateOpen(false),
                onConnect: () => openConnectSurface(),
                onNewDirect: () => {
                  setNewChatMode("direct");
                  setQuickCreateOpen(false);
                },
                onNewGroup: () => {
                  setFriendQuery("");
                  setChatCreateError("");
                  setNewChatMode("group");
                  setQuickCreateOpen(false);
                },
              }}
              feed={{
                communitiesOpen: feedCommunitiesOpen,
                onToggleCommunities: () => {
                  if (!feedCommunitiesOpen) {
                    setActivePostId(null);
                    setFeedComposerOpen(false);
                    setFeedCheckInOpen(false);
                  }
                  setFeedCommunitiesOpen((current) => !current);
                },
              }}
              profile={{
                onNewPost: () => {
                  setDesktopProfileSettings(false);
                  setProfileComposerOpen(true);
                },
              }}
              notifications={{
                onNewPost: () => {
                  switchTab("feed");
                  setFeedComposerOpen(true);
                },
              }}
              contacts={{
                onAddFriend: () => {
                  setTab("chat");
                  setNewChatMode("friends");
                },
              }}
            />
          </AppHeaderActions>
        </AppHeader>
      }
    >{pushPrompt && !pushPromptDismissed && !pushEnabled && (
        <section
          className="push-onboarding"
          aria-label="Thông báo tin nhắn"
          aria-live="polite"
        >
          <Bell size={22} aria-hidden="true" />
          <strong>Nhận thông báo tin nhắn mới?</strong>
          <div className="push-onboarding-actions">
            <button
              type="button"
              onClick={() => setPushPromptDismissed(true)}
              disabled={pushBusy}
            >
              Để sau
            </button>
            <button
              className="push-onboarding-enable"
              type="button"
              onClick={() => void togglePush()}
              disabled={pushBusy}
            >
              Bật thông báo
            </button>
          </div>
        </section>
      )}

      {notice && (
        <div
          className={`notice toast toast-${notice.kind}`}
          role={notice.kind === "error" ? "alert" : "status"}
          aria-live={notice.kind === "error" ? "assertive" : "polite"}
        >
          <span className="toast-icon" aria-hidden="true">
            {notice.kind === "success"
              ? "✓"
              : notice.kind === "error"
                ? "!"
                : notice.kind === "warning"
                  ? "!"
                  : "i"}
          </span>
          <div className="toast-copy">
            <strong>
              {notice.kind === "success"
                ? "Thành công"
                : notice.kind === "error"
                  ? "Có lỗi"
                  : notice.kind === "warning"
                    ? "Lưu ý"
                    : "Thông báo"}
            </strong>
            <span>{notice.message}</span>
          </div>
          <button
            type="button"
            aria-label="Đóng thông báo"
            onClick={dismissNotice}
          >
            ×
          </button>
        </div>
      )}
      <section
        className={`phone-frame modern-frame ${tab === "chat" && activeConversation ? "mobile-conversation-open" : ""}`}
      >
        {tab === 'chat' && desktopSection === null && translationSettingsConversationId === null && (
          <ChatSection
          activeChatTranslationSettings={activeChatTranslationSettings}
          activeConversation={activeConversation}
          activeConversationId={activeConversationId}
          activeConversationIdRef={activeConversationIdRef}
          activeGroupMember={activeGroupMember}
          actOnFriend={actOnFriend}
          addChatFiles={addChatFiles}
          uploadMediaFiles={uploadMediaFiles}
          apiFetch={apiFetch}
          beginConversationLongPress={beginConversationLongPress}
          beginMessageLongPress={beginMessageLongPress}
          blockContact={blockContact}
          blockedBusy={blockedBusy}
          bottomRef={bottomRef}
          cancelConversationLongPress={cancelConversationLongPress}
          cancelMessageLongPress={cancelMessageLongPress}
          canEditGroup={canEditGroup}
          canInviteActiveGroup={canInviteActiveGroup}
          canManageActiveGroup={canManageActiveGroup}
          canSend={canSend}
          changeAutoTranslate={changeAutoTranslate}
          changeGroupMemberRole={changeGroupMemberRole}
          changeTargetLanguage={changeTargetLanguage}
          chatCreateError={chatCreateError}
          chatDragActive={chatDragActive}
          chatDragDepth={chatDragDepth}
          chatFileInputRef={chatFileInputRef}
          chatFiltersPill={chatFiltersPill}
          chatFriend={chatFriend}
          chatFriendRelationship={chatFriendRelationship}
          chatListConversations={chatListConversations}
          chatListFilter={chatListFilter}
          chatListQuery={chatListQuery}
          chatOnline={chatOnline}
          chatOutbox={chatOutbox}
          chatSearchJumpRevision={chatSearchJumpRevision}
          clearActiveConversationHistory={clearActiveConversationHistory}
          conversationBlocked={conversationBlocked}
          conversationCategories={conversationCategories}
          conversationDetailsOpen={conversationDetailsOpen}
          conversationListSearch={conversationListSearch}
          conversationLoadingMore={conversationLoadingMore}
          copyInviteLink={copyInviteLink}
          createDirect={createDirect}
          createGroupChannel={createGroupChannel}
          directUsername={directUsername}
          effectiveAutoTranslate={effectiveAutoTranslate}
          effectiveTargetLanguage={effectiveTargetLanguage}
          friendBusyIds={friendBusyIds}
          friendQuery={friendQuery}
          friendRelationship={friendRelationship}
          friendResults={friendResults}
          friends={friends}
          friendSearchError={friendSearchError}
          friendSearching={friendSearching}
          friendSyncBusy={friendSyncBusy}
          friendSyncError={friendSyncError}
          friendSyncSessionId={friendSyncSessionId}
          groupActivities={groupActivities}
          groupBusy={groupBusy}
          groupChannelBusy={groupChannelBusy}
          groupChannels={groupChannels}
          groupChannelUnreadAvailable={groupChannelUnreadAvailable}
          groupInviteCandidates={groupInviteCandidates}
          groupInviteSearch={groupInviteSearch}
          groupInviteSelection={groupInviteSelection}
          groupMembers={groupMembers}
          groupMemberViewOpen={groupMemberViewOpen}
          groupSettingsOpen={groupSettingsOpen}
          hasMoreConversations={hasMoreConversations}
          hasMoreMessages={hasMoreMessages}
          historyActionBusy={historyActionBusy}
          inviteGroupMembers={inviteGroupMembers}
          isProfileDesktop={isProfileDesktop}
          languageOptions={languageOptions}
          languageSearch={languageSearch}
          loadMissingMessages={loadMissingMessages}
          loadMoreConversations={loadMoreConversations}
          loadOlderMessages={loadOlderMessages}
          manuallyTranslated={manuallyTranslated}
          mediaUploading={mediaUploading}
          messageAttachments={messageAttachments}
          messageGapBefore={messageGapBefore}
          messageGapLoading={messageGapLoading}
          messageInputRef={messageInputRef}
          messageScrollAtBottom={messageScrollAtBottom}
          messageSearchOpen={messageSearchOpen}
          messageSending={messageSending}
          messagesLoadingMore={messagesLoadingMore}
          messagesScrollRef={messagesScrollRef}
          messageText={messageText}
          moveConversationLongPress={moveConversationLongPress}
          moveMessageLongPress={moveMessageLongPress}
          newChatMode={newChatMode}
          openConnectSurface={openConnectSurface}
          openGroupSettings={openGroupSettings}
          openMessageActions={openMessageActions}
          openMessageReactions={openMessageReactions}
          onReactionUsers={(message, emoji) => setReactionTarget({kind: "message", id: message.id, initialEmoji: emoji, reactions: message.reactions})}
          onForwardMessage={setForwardSource}
          openVisitor={openVisitor}
          pinBusy={pinBusy}
          pinnedExpanded={pinnedExpanded}
          pinnedItems={pinnedItems}
          quickSearchControl={quickSearchControl}
          reactionPreviews={reactionPreviews}
          refreshFriendConnections={refreshFriendConnections}
          refreshGroupMembers={refreshGroupMembers}
          removeGroupMember={removeGroupMember}
          replyingTo={replyingTo}
          retryQueuedChatMessages={retryQueuedChatMessages}
          searchInConversationList={searchInConversationList}
          selectedChannelId={selectedChannelId}
          selectGroupChannel={selectGroupChannel}
          sendMessage={sendMessage}
          session={session}
          setActiveConversationId={setActiveConversationId}
          setChatCreateError={setChatCreateError}
          setChatDragActive={setChatDragActive}
          setChatListFilter={setChatListFilter}
          setChatListQuery={setChatListQuery}
          setChatSearchJump={setChatSearchJump}
          setConversationActionId={setConversationActionId}
          setConversationDetailsOpen={setConversationDetailsOpen}
          setConversationMenuPosition={setConversationMenuPosition}
          setConversations={setConversations}
          setDirectUsername={setDirectUsername}
          setFriendQuery={setFriendQuery}
          setFriendResults={setFriendResults}
          setFriendSearchRetry={setFriendSearchRetry}
          setGroupActivityCreateKind={setGroupActivityCreateKind}
          setGroupActivityViewedId={setGroupActivityViewedId}
          setGroupInviteSearch={setGroupInviteSearch}
          setGroupInviteSelection={setGroupInviteSelection}
          setGroupMemberViewOpen={setGroupMemberViewOpen}
          setGroupSettingsOpen={setGroupSettingsOpen}
          setLanguageSearch={setLanguageSearch}
          setManuallyTranslated={setManuallyTranslated}
          setMessageAttachments={setMessageAttachments}
          setMessageSearchOpen={setMessageSearchOpen}
          setMessageText={setMessageText}
          setNewChatMode={setNewChatMode}
          setNotice={setNotice}
          setPinnedExpanded={setPinnedExpanded}
          setQrOpen={setQrOpen}
          setQuickSearchOpen={setQuickSearchOpen}
          setReplyingTo={setReplyingTo}
          setSharedContentOpen={setSharedContentOpen}
          setTranslationMenuOpen={setTranslationMenuOpen}
          setTranslationOriginals={setTranslationOriginals}
          setTranslations={setTranslations}
          setTranslationSettingsConversationId={setTranslationSettingsConversationId}
          sharedContentOpen={sharedContentOpen}
          shareMyProfile={shareMyProfile}
          sortedChatListConversations={sortedChatListConversations}
          sortedGroupActivityEvents={sortedGroupActivityEvents}
          suppressConversationClick={suppressConversationClick}
          suppressMessageClick={suppressMessageClick}
          switchTab={switchTab}
          t={t}
          toggleMessagePin={toggleMessagePin}
          toggleReaction={toggleReaction}
          translateMessage={translateMessage}
          translationFailures={translationFailures}
          translationMenuOpen={translationMenuOpen}
          translationOriginals={translationOriginals}
          translationPending={translationPending}
          translations={translations}
          unblockContact={unblockContact}
          updateChatOutbox={updateChatOutbox}
          visibleConversations={visibleConversations}
          visibleLanguageOptions={visibleLanguageOptions}
          visibleMessages={visibleMessages}
        />
        )}


        {tab === 'chat' && translationSettingsConversationId !== null &&
          activeConversation?.id === translationSettingsConversationId && (
          <ChatTranslationSection
          activeChatTranslationSettings={activeChatTranslationSettings}
          activeConversation={activeConversation}
          autoTranslate={autoTranslate}
          languageOptions={languageOptions}
          saveConversationTranslationSettings={saveConversationTranslationSettings}
          session={session}
          setNotice={setNotice}
          setTranslationSettingsConversationId={setTranslationSettingsConversationId}
          targetLanguage={targetLanguage}
          translationSettingsConversationId={translationSettingsConversationId}
        />
        )}


        {tab === "chat" && desktopSection === "calls" && (
          <CallsSection
          apiFetch={apiFetch}
          contactsContent={contactsContent}
          displayConversations={displayConversations}
          friendQuery={friendQuery}
          session={session}
          setActiveConversationId={setActiveConversationId}
          setContactsScreen={setContactsScreen}
          setDesktopSection={setDesktopSection}
          setFriendQuery={setFriendQuery}
          switchTab={switchTab}
          targetLanguage={targetLanguage}
        />
        )}

        {tab === "notifications" && (
          <NotificationsSection
          actOnFriend={actOnFriend}
          conversations={conversations}
          declineFriendRequest={declineFriendRequest}
          friendBusyIds={friendBusyIds}
          friendRequests={friendRequests}
          globalSearch={globalSearch}
          openMentionPost={openMentionPost}
          openVisitor={openVisitor}
          postMentions={postMentions}
          readPostMention={readPostMention}
          setActiveConversationId={setActiveConversationId}
          setContactsScreen={setContactsScreen}
          setDesktopProfileSettings={setDesktopProfileSettings}
          setProfileTimelineOpen={setProfileTimelineOpen}
          switchTab={switchTab}
        />
        )}

        {tab === "contacts" && contactsContent}

        {tab === "discover" && (
          <DiscoverSection
          actOnFriend={actOnFriend}
          findNearby={findNearby}
          friendActionBusy={friendActionBusy}
          friendRelationship={friendRelationship}
          globalSearch={globalSearch}
          nearbyBusy={nearbyBusy}
          nearbyRadiusKm={nearbyRadiusKm}
          nearbyResultRadiusKm={nearbyResultRadiusKm}
          nearbyScanning={nearbyScanning}
          nearbyUntil={nearbyUntil}
          nearbyUsers={nearbyUsers}
          setGlobalSearch={setGlobalSearch}
          setNearbyRadiusKm={setNearbyRadiusKm}
          stopNearby={stopNearby}
        />
        )}

        {tab === "market" && (
          <MarketSection
          apiFetch={apiFetch}
          session={session}
          switchTab={switchTab}
        />
        )}

        {tab === "feed" && isProfileDesktop && activePost && (
          <FeedPostDetail
          activePost={activePost}
          apiFetch={apiFetch}
          closeFeedPostDetails={closeFeedPostDetails}
          commentSortOrder={commentSortOrder}
          friendTaggedNames={friendTaggedNames}
          like={like}
          likePreviews={likePreviews}
          onReactionUsers={(post) => setReactionTarget({kind: "post", id: post.id, reactions: post.reactions})}
          name={name}
          openEditPost={openEditPost}
          openVisitor={openVisitor}
          postDiscussion={postDiscussion}
          profileMedia={profileMedia}
          removeFeedPost={removeFeedPost}
          session={session}
          setCommentSortOrder={setCommentSortOrder}
          setNotice={setNotice}
          syncFeedPost={syncFeedPost}
          targetLanguage={targetLanguage}
          translationPreferencesLoaded={translationPreferencesLoaded}
        />
        )}

        {tab === "feed" && (!isProfileDesktop || !activePost || feedCommunitiesOpen) && (
          <FeedSection
          activePostId={activePostId}
          activeStoryId={activeStoryId}
          actOnFriend={actOnFriend}
          addFeedFiles={addFeedFiles}
          apiFetch={apiFetch}
          conversationLoadingMore={conversationLoadingMore}
          conversations={conversations}
          feedCommunitiesOpen={feedCommunitiesOpen}
          feedFilter={feedFilter}
          feedFiltersPill={feedFiltersPill}
          feedInfiniteScrollRef={feedInfiniteScrollRef}
          feedLoadingMore={feedLoadingMore}
          feedPagingError={feedPagingError}
          feedSearchActive={feedSearchActive}
          feedViewRef={feedViewRef}
          followingFeed={followingFeed}
          friendBusyIds={friendBusyIds}
          friendRequests={friendRequests}
          friends={friends}
          hasMoreConversations={hasMoreConversations}
          isProfileDesktop={isProfileDesktop}
          loadMoreConversations={loadMoreConversations}
          loadMorePosts={loadMorePosts}
          loadSavedPosts={loadSavedPosts}
          mediaUploading={mediaUploading}
          name={name}
          normalizedSearch={normalizedSearch}
          openVisitor={openVisitor}
          pendingPost={pendingPost}
          postComposerRef={postComposerRef}
          posts={posts}
          postSearch={postSearch}
          postText={postText}
          profileMedia={profileMedia}
          refreshPosts={refreshPosts}
          renderPosts={renderPosts}
          savedPosts={savedPosts}
          searchedPosts={searchedPosts}
          session={session}
          setActiveConversationId={setActiveConversationId}
          setActivePostId={setActivePostId}
          setActiveStoryId={setActiveStoryId}
          setChatListFilter={setChatListFilter}
          setFeedCheckInOpen={setFeedCheckInOpen}
          setFeedCommunitiesOpen={setFeedCommunitiesOpen}
          setFeedComposerOpen={setFeedComposerOpen}
          setFeedFilter={setFeedFilter}
          setGlobalSearch={setGlobalSearch}
          setPosts={setPosts}
          setSavedPosts={setSavedPosts}
          setSearchHasScrolled={setSearchHasScrolled}
          setStories={setStories}
          setStoryDraftFile={setStoryDraftFile}
          stories={stories}
          storyBusy={storyBusy}
          storyFileInputRef={storyFileInputRef}
          switchTab={switchTab}
        />
        )}

        {activeConversationAction && (
          <ConversationActionDialog
          activeConversationAction={activeConversationAction}
          conversationMenuPosition={conversationMenuPosition}
          pinBusy={pinBusy}
          setConversationActionId={setConversationActionId}
          toggleConversationPin={toggleConversationPin}
        />
        )}

        {activeConversation?.type === 'group' && (groupActivityCreateKind !== null || groupActivityViewedId !== null) && (
          <GroupActivityDialog
            key={`${activeConversation.id}-${groupActivityCreateKind || 'view'}-${groupActivityViewedId ?? ''}`}
            kind={groupActivityCreateKind}
            activity={viewedGroupActivity}
            onClose={() => { setGroupActivityCreateKind(null); setGroupActivityViewedId(null) }}
            onCreate={groupActivities.create}
            onVote={groupActivities.vote}
            onTogglePin={groupActivities.setPin}
          />
        )}
        {activeMessageAction && (
          <MessageActionDialog
          activeMessageAction={activeMessageAction}
          onForwardMessage={setForwardSource}
          copyMessageContent={copyMessageContent}
          editOwnMessage={editOwnMessage}
          messageActionMode={messageActionMode}
          messageCopyTarget={messageCopyTarget}
          pinnedMessages={pinnedMessages}
          recallOwnMessage={recallOwnMessage}
          session={session}
          setMessageActionId={setMessageActionId}
          setReplyingTo={setReplyingTo}
          toggleMessagePin={toggleMessagePin}
          toggleReaction={toggleReaction}
          translateMessage={translateMessage}
        />
        )}

        {activePost && !(tab === "feed" && isProfileDesktop) && (
          <PostDetailOverlay
          activePost={activePost}
          like={like}
          likePreviews={likePreviews}
          onReactionUsers={(post) => setReactionTarget({kind: "post", id: post.id, reactions: post.reactions})}
          postDiscussion={postDiscussion}
          session={session}
          setActivePostId={setActivePostId}
          targetLanguage={targetLanguage}
          translationPreferencesLoaded={translationPreferencesLoaded}
        />
        )}

        {activeStory && (
          <StoryOverlay
          activeStory={activeStory}
          deleteStory={deleteStory}
          name={name}
          openVisitor={openVisitor}
          replyToStory={replyToStory}
          reportStory={reportStory}
          setActiveStoryId={setActiveStoryId}
          shareStory={shareStory}
          stories={stories}
          storyBusy={storyBusy}
        />
        )}

        {tab === "profile" && desktopProfileOverview && (
          <ProfileOverviewSection
          apiFetch={apiFetch}
          avatarFileInputRef={avatarFileInputRef}
          changePrivacy={changePrivacy}
          coverFileInputRef={coverFileInputRef}
          discardDesktopProfileEdits={discardDesktopProfileEdits}
          friends={friends}
          loadProfilePosts={loadProfilePosts}
          mediaUploading={mediaUploading}
          name={name}
          openVisitor={openVisitor}
          pendingPost={pendingPost}
          privacy={privacy}
          privacyBusy={privacyBusy}
          privacyError={privacyError}
          privacyLoading={privacyLoading}
          profileBioDraft={profileBioDraft}
          profileBusy={profileBusy}
          profileCityDraft={profileCityDraft}
          profileDisplayNameDraft={profileDisplayNameDraft}
          profileEditorOpen={profileEditorOpen}
          profileHasMore={profileHasMore}
          profileMedia={profileMedia}
          profilePosts={profilePosts}
          profilePostsBusy={profilePostsBusy}
          profilePostsError={profilePostsError}
          profileSaving={profileSaving}
          profileUsernameDraft={profileUsernameDraft}
          renderPosts={renderPosts}
          saveProfileIdentity={saveProfileIdentity}
          session={session}
          setActivePostId={setActivePostId}
          setPrivacyRetry={setPrivacyRetry}
          setProfileBioDraft={setProfileBioDraft}
          setProfileCityDraft={setProfileCityDraft}
          setProfileComposerOpen={setProfileComposerOpen}
          setProfileDisplayNameDraft={setProfileDisplayNameDraft}
          setProfileEditorOpen={setProfileEditorOpen}
          setProfileUsernameDraft={setProfileUsernameDraft}
          switchTab={switchTab}
          updateProfileImage={updateProfileImage}
          visibleProfilePosts={visibleProfilePosts}
        />
        )}

        {tab === "profile" && !desktopProfileOverview && (
          <ProfileSection
          apiFetch={apiFetch}
          appLocale={appLocale}
          autoTranslate={autoTranslate}
          avatarFileInputRef={avatarFileInputRef}
          blockedBusy={blockedBusy}
          blockedError={blockedError}
          blockedOpen={blockedOpen}
          blockedUsers={blockedUsers}
          changeAppLocale={changeAppLocale}
          changeAutoTranslate={changeAutoTranslate}
          changeTargetLanguage={changeTargetLanguage}
          closeProfileTimeline={closeProfileTimeline}
          coverFileInputRef={coverFileInputRef}
          desktopProfileSettings={desktopProfileSettings}
          fetchAccountSessions={fetchAccountSessions}
          installApp={installApp}
          isProfileDesktop={isProfileDesktop}
          isStandalone={isStandalone}
          loadBlockedUsers={loadBlockedUsers}
          loadProfilePosts={loadProfilePosts}
          localePickerOpen={localePickerOpen}
          localeSearch={localeSearch}
          logout={logout}
          managedSessions={managedSessions}
          mediaUploading={mediaUploading}
          messageSoundEnabled={messageSoundEnabled}
          name={name}
          nativeNotifications={nativeNotifications}
          pendingPost={pendingPost}
          postText={postText}
          previewMessageSound={previewMessageSound}
          privacy={privacy}
          privacyBusy={privacyBusy}
          privacyError={privacyError}
          privacyLoading={privacyLoading}
          profileBusy={profileBusy}
          profileHasMore={profileHasMore}
          profileHeadingRef={profileHeadingRef}
          profileIdentityForm={profileIdentityForm}
          profileIdentityRef={profileIdentityRef}
          profileMedia={profileMedia}
          profilePosts={profilePosts}
          profilePostsBusy={profilePostsBusy}
          profilePostsError={profilePostsError}
          profilePrivacyControls={profilePrivacyControls}
          profileTimelineOpen={profileTimelineOpen}
          pushBusy={pushBusy}
          pushEnabled={pushEnabled}
          renderPosts={renderPosts}
          revokeAccountSessions={revokeAccountSessions}
          savePrivacy={savePrivacy}
          selectedAppLanguage={selectedAppLanguage}
          selectedLanguage={selectedLanguage}
          sendTestPush={sendTestPush}
          session={session}
          sessionsBusy={sessionsBusy}
          sessionsError={sessionsError}
          sessionsOpen={sessionsOpen}
          setBlockedOpen={setBlockedOpen}
          setDesktopProfileSettings={setDesktopProfileSettings}
          setGlobalSearch={setGlobalSearch}
          setLocalePickerOpen={setLocalePickerOpen}
          setLocaleSearch={setLocaleSearch}
          setPrivacyRetry={setPrivacyRetry}
          setProfileComposerOpen={setProfileComposerOpen}
          setProfileEditorOpen={setProfileEditorOpen}
          setProfileTimelineOpen={setProfileTimelineOpen}
          setSessionsOpen={setSessionsOpen}
          setTranslationPickerOpen={setTranslationPickerOpen}
          setTranslationSettingsSearch={setTranslationSettingsSearch}
          switchTab={switchTab}
          t={t}
          targetLanguage={targetLanguage}
          toggleMessageSound={toggleMessageSound}
          togglePush={togglePush}
          translationPickerOpen={translationPickerOpen}
          translationSettingsSearch={translationSettingsSearch}
          uiLocaleLoading={uiLocaleLoading}
          unblockContact={unblockContact}
          updateProfileImage={updateProfileImage}
          visibleLocaleOptions={visibleLocaleOptions}
          visibleProfilePosts={visibleProfilePosts}
          visibleTranslationSettingsOptions={visibleTranslationSettingsOptions}
        />
        )}
      </section>

      {storyDraftFile && tab === "feed" && (
          <StoryDraftOverlay
          createStory={createStory}
          mediaUploading={mediaUploading}
          setStoryDraftFile={setStoryDraftFile}
          storyBusy={storyBusy}
          storyDraftFile={storyDraftFile}
        />
        )}
      {feedComposerOpen && tab === "feed" && (
          <FeedComposerOverlay
          editingPost={editingPost}
          mediaUploading={mediaUploading}
          pendingPost={pendingPost}
          postComposer={postComposer}
          postEditBusy={postEditBusy}
          restoreDraftAfterEdit={restoreDraftAfterEdit}
          setFeedCheckInOpen={setFeedCheckInOpen}
          setFeedComposerOpen={setFeedComposerOpen}
        />
        )}
      {profileComposerOpen &&
        tab === "profile" &&
        (profileTimelineOpen || desktopProfileOverview) && (
          <ProfileComposerOverlay
          editingPost={editingPost}
          mediaUploading={mediaUploading}
          pendingPost={pendingPost}
          postComposer={postComposer}
          postEditBusy={postEditBusy}
          restoreDraftAfterEdit={restoreDraftAfterEdit}
          setProfileComposerOpen={setProfileComposerOpen}
        />
        )}
      {profileEditorOpen &&
        !isProfileDesktop &&
        tab === "profile" &&
        profileTimelineOpen && (
          <ProfileOverlay
            title="Chỉnh sửa hồ sơ"
            drawer
            busy={profileSaving || privacyBusy}
            onClose={() => setProfileEditorOpen(false)}
          >
            {profileIdentityForm}
            <section
              className="settings-card profile-field-permissions"
              aria-label="Quyền trường thông tin"
            >
              <h3>Quyền trường thông tin</h3>
              {profilePrivacyControls}
            </section>
          </ProfileOverlay>
        )}

      {forwardSource && (
        <MessageForwardPicker
          message={forwardSource}
          conversations={conversations}
          request={apiFetch}
          uploadFiles={uploadMediaFiles}
          onClose={() => setForwardSource(null)}
          onFeedback={setNotice}
        />
      )}
      {reactionTarget && (
        <ReactionParticipantsDialog
          key={`${session.sessionId}:${reactionTarget.kind}:${reactionTarget.id}`}
          kind={reactionTarget.kind}
          id={reactionTarget.id}
          initialEmoji={reactionTarget.initialEmoji}
          reactions={reactionTarget.reactions}
          request={apiFetch}
          onClose={() => setReactionTarget(null)}
        />
      )}

      <GroupInviteJoinDialog
        request={apiFetch}
        notify={(message) => setNotice(message)}
        onJoined={async (id) => {
          await refreshConversations();
          setActiveConversationId(id);
          setTab("chat");
        }}
      />

      <CallManager
        request={apiFetch}
        apiBase={API}
        token={session.token}
        sessionId={session.sessionId}
        userId={session.user.id}
        sourceLanguage={effectiveAppLocale}
        targetLanguage={targetLanguage}
        conversations={displayConversations.map(({ id, name, type, otherUsername, blockedByMe, blockedByOther }) => ({
          id,
          name,
          type,
          otherUsername,
          blocked: Boolean(blockedByMe || blockedByOther),
        }))}
      />

      <BottomNavigation
        tab={tab}
        t={t}
        switchTab={switchTab}
        onCalls={() => { switchTab("chat"); setDesktopSection("calls"); }}
        callsActive={tab === "chat" && desktopSection === "calls"}
        unreadTotal={unreadTotal}
        pushEnabled={pushEnabled}
      />
    </AppLayout>
  );
}