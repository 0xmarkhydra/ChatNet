import { useLocation, useNavigate } from "react-router-dom";
import { ROUTE, TAB_PATH, tabFromPath } from "./routes";
import ProfileNote from "../features/profile/ProfileNote";
import ConversationCategories, {
  CategoryAssignment,
  CategoryBadge,
} from "../features/chat/ConversationCategories";
import { useConversationCategories } from "../features/chat/useConversationCategories";
import { SessionResponseCache } from "../shared/lib/sessionCache";
import VisitorProfile from "../features/profile/VisitorProfile";
import { userLabel } from "../shared/lib/userLabel";
import { useMessageData } from "../features/chat/useMessageData";
import { useChatPins } from "../features/chat/useChatPins";
import { shouldSendChatOnEnter } from "../features/chat/composerKeyboard";
import "../features/chat/chat-pins.css";
import { getMessageTranslationView } from "../features/chat/messageTranslationPresentation";
import { useApiRequest } from "./useApiRequest";
import { useAppRealtime } from "./useAppRealtime";
import { useDesktopNotifications } from "../platform/useDesktopNotifications";
import { useConversationData } from "../features/chat/useConversationData";
import { useConversationListSearch } from "../features/chat/useConversationListSearch";
import {
  useChatQuickSearch,
  type ChatQuickContact,
  type ChatQuickHit,
} from "../features/chat/useChatQuickSearch";
import ChatQuickSearch from "../features/chat/ChatQuickSearch";
import AppHeader, { AppHeaderActions } from "./header/AppHeader";
import AppLayout from "./layouts/AppLayout";
import HeaderSearch from "./header/HeaderSearch";
import HeaderActions from "./header/HeaderActions";
import HeaderAccount from "./header/HeaderAccount";
import HeaderTitle from "./header/HeaderTitle";
import { searchLabels } from "./header/headerContext";
import { useContactData } from "../features/contacts/useContactData";
import { useFeedData } from "../features/feed/useFeedData";
import { usePostSearch } from "../features/feed/usePostSearch";
import { useFollowingPosts } from "../features/feed/useFollowingPosts";
import { useFeedInfiniteScroll } from "../features/feed/useFeedInfiniteScroll";

import { useGroupManagement } from "../features/chat/useGroupManagement";
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
} from "../shared/lib/media";
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
import type { Tab } from "./types";
import type {
  FriendSearchResult,
  FriendConnection,
} from "../features/contacts/types";
import type { ManagedAccountSession } from "../features/auth/types";
import type { InstallPromptEvent } from "../features/pwa/types";
import {
  inferToastKind,
  type ToastKind,
  type ToastNotice,
} from "../features/notifications/toast";
import { formatTime, attachmentLabel } from "../shared/lib/format";
import UserAvatar, {
  avatarRefreshVersions,
  profileAssetUrl,
} from "../shared/ui/UserAvatar";
import useSlidingPill from "../shared/ui/useSlidingPill";
import MediaAttachmentsView from "../shared/ui/MediaAttachmentsView";
import UiIcon from "../shared/ui/UiIcon";
import NearbyRadar from "../features/discover/NearbyRadar";
import AuthScreen from "../features/auth/AuthScreen";
import { useAuthFlow } from "../features/auth/useAuthFlow";
import PostComposer from "../features/feed/PostComposer";
import FeedPostCard from "../features/feed/FeedPostCard";
import FeedReactionControl from "../features/feed/FeedReactionControl";
import StoryViewer from "../features/feed/StoryViewer";
import MessageActions from "../features/chat/MessageActions";
import { GroupActivityComposerMenu, GroupActivityDialog, GroupActivityMarker, useGroupActivities, type GroupActivityKind } from "../features/chat/GroupActivities";
import { messageReactionLabel } from "../features/chat/messageReactions";
import {
  copyChatImage,
  messageLinkHref,
  messageTextParts,
} from "../features/chat/messageClipboard";
import {
  resolveMessageCopyTarget,
  type MessageCopyTarget,
} from "../features/chat/messageCopyTarget";
import MessageSearchPanel from "../features/chat/MessageSearchPanel";
import ProfileIdentityForm from "../features/profile/ProfileIdentityForm";
import BottomNavigation from "./navigation/BottomNavigation";
import AppSidebar from "./navigation/AppSidebar";
import { countNotificationItems, formatNotificationBadge } from "../features/notifications/notification-count";
import NotificationsPage from "../features/notifications/NotificationsPage";
import ConversationDetailsPanel from "../features/chat/ConversationDetailsPanel";
import ChatTranslationSettingsPage from '../features/chat/ChatTranslationSettingsPage';
import {
  readConversationTranslationSettings,
  persistConversationTranslationSettings,
  type ChatTranslationSettings,
  type ConversationTranslationSettingsMap,
} from '../features/chat/conversationTranslationSettings';
import ProfilePage from "../features/profile/ProfilePage";
import ProfileEditorPage from "../features/profile/ProfileEditorPage";
import SettingsWorkspace from "../features/settings/SettingsWorkspace";
import SocialFeedComposer from "../features/feed/SocialFeedComposer";
import SocialFeedSidebar from "../features/feed/SocialFeedSidebar";
import SocialFeedStories from "../features/feed/SocialFeedStories";
import PostCommentsPage from "../features/feed/PostCommentsPage";
import CommunicationHub from "../features/chat/CommunicationHub";
import CallCenter from "../features/calls/CallCenter";
import type { GroupWorkspaceMode } from "../features/chat/CommunityGroupsPage";
import FeedCommunitiesList from "../features/feed/FeedCommunitiesList";
import "../features/chat/community-groups.css";
import CommunityGroupWizard, { type CommunityCreationExtras } from "../features/chat/CommunityGroupWizard";
import GroupSettingsPanel from "../features/chat/GroupSettingsPanel";
import GroupChannelPicker from "../features/chat/GroupChannelPicker";
import { validGroupChannels, type GroupChannel } from "../features/chat/groupChannels";
import GroupInviteJoinDialog from "../features/chat/GroupInviteJoinDialog";
import ContactsView, { type FriendsScreen } from "../features/contacts/ContactsView";
import PrivacyControls from "../features/profile/PrivacyControls";
import AccountSessionsPanel from "../features/auth/AccountSessionsPanel";
import BlockedUsersPanel from "../features/contacts/BlockedUsersPanel";
import {
  FormEvent,
  Fragment,
  lazy,
  Suspense,
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
} from "../features/feed/FeedDiscussion";
import FeedModeration from "../features/feed/FeedModeration";
import ProfileOverlay from "../features/profile/ProfileOverlay";
import type { NearbyUser } from "../features/discover/NearbyExplorer";
import GroupCreator from "../features/chat/GroupCreator";
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
} from "../features/notifications/incomingSound";
import {
  createSessionClient,
  loadSession,
  type Session,
} from "../features/auth/session";
import {
  clearChatPersistence,
  clearPendingSend,
  loadChatDrafts,
  loadPendingSend,
  saveChatDrafts,
} from "../features/chat/chatPersistence";
import { restoreChatOutbox } from "../features/chat/outboxRecovery";
import {
  clearChatOutbox,
  confirmChatMessage,
  enqueueChatMessage,
  persistChatOutboxChange,
  retryableChatMessages,
  type QueuedChatMessage,
} from "../features/chat/chatOutbox";
import { uploadPresignedFile } from "../features/chat/mediaUpload";
import {
  chatFilesFromClipboard,
  transferHasFiles,
} from "../features/chat/chatFileTransfer";
import { canMarkConversationRead } from "../features/chat/conversationRead";
import { mergeById, toggleMessageReactionCount } from "../shared/lib/optimistic";
import CallManager, { CallHeaderActions } from "../features/calls/CallManager";
import SharedContent from "../features/chat/SharedContent";
import VoiceRecorder from "../features/chat/VoiceRecorder";
import { SocoEmptyState, SocoTextAction } from "../shared/ui/SocoUI";
import {
  getCurrentPositionSmart,
  geolocationErrorMessage,
} from "../features/discover/geolocation";

const NearbyExplorer = lazy(
  () => import("../features/discover/NearbyExplorer"),
);
const Marketplace = lazy(() => import("../features/discover/Marketplace"));
const ProfileQr = lazy(() => import("../features/profile/ProfileQr"));
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
} from "../features/i18n/i18n";
import {
  buildLanguageOptions,
  filterLanguageOptions,
  isSupportedLanguageCode,
} from "../features/i18n/languages";
import {
  disableOneSignalPush,
  enableOneSignalPush,
  getOneSignalPushState,
  isPushDisabled,
  setupOneSignal,
  type PushState,
} from "../features/notifications/onesignal";

import { desktopBridge, isDesktopBuild } from "../platform/desktop";
import NotificationsSection from "../features/notifications/NotificationsSection";
import DiscoverSection from "../features/discover/DiscoverSection";
import MarketSection from "../features/discover/MarketSection";
import CallsSection from "../features/calls/CallsSection";
import ChatTranslationSection from "../features/chat/ChatTranslationSection";
import FeedPostDetail from "../features/feed/FeedPostDetail";
import FeedSection from "../features/feed/FeedSection";
import ConversationActionDialog from "../features/chat/ConversationActionDialog";
import MessageActionDialog from "../features/chat/MessageActionDialog";
import PostDetailOverlay from "../features/feed/PostDetailOverlay";
import StoryOverlay from "../features/feed/StoryOverlay";
import ProfileOverviewSection from "../features/profile/ProfileOverviewSection";
import ProfileSection from "../features/profile/ProfileSection";
import ChatSection from "../features/chat/ChatSection";
import FeedComposerOverlay from "../features/feed/FeedComposerOverlay";

export default function App({
  initialSession,
}: {
  initialSession?: Session | null;
}) {
  const [session, setSession] = useState<Session | null>(() =>
    isDesktopBuild ? (initialSession ?? null) : loadSession(),
  );
  const sessionRef = useRef(session);
  const responseCache = useRef(new SessionResponseCache());
  const [sessionClient] = useState(() =>
    createSessionClient(
      API,
      {
        get: () => sessionRef.current,
        save: saveSession,
        expire: () => logout(false),
      },
      isDesktopBuild ? desktopBridge().auth : undefined,
    ),
  );
  const auth = useAuthFlow((next) => {
    setAppLocale(loadAppLocalePreference());
    saveSession(next);
  });

  const location = useLocation();
  const navigate = useNavigate();
  const pathnameRef = useRef(location.pathname);
  pathnameRef.current = location.pathname;
  // Path requested earlier in the same event; lets sequential setters coalesce
  // into a single history entry before the router has re-rendered.
  const pendingPathRef = useRef<string | null>(null);
  pendingPathRef.current = null;
  const currentPath = () => pendingPathRef.current ?? pathnameRef.current;
  const navigateTo = (path: string) => {
    if (currentPath() === path) return;
    pendingPathRef.current = path;
    navigate(path);
  };
  const tab: Tab = tabFromPath(location.pathname) ?? "chat";
  const setTab = (next: Tab) => navigateTo(TAB_PATH[next]);
  const desktopSection: "groups" | "calls" | null =
    location.pathname === ROUTE.calls ? ("calls" as const) : (null as "groups" | null);
  const setDesktopSection = (next: "groups" | "calls" | null) => {
    if (next === "calls") navigateTo(ROUTE.calls);
    else if (currentPath() === ROUTE.calls) navigateTo(TAB_PATH.chat);
  };
  const desktopProfileSettings = location.pathname === ROUTE.settings;
  const setDesktopProfileSettings = (next: boolean) => {
    if (next) navigateTo(ROUTE.settings);
    else if (currentPath() === ROUTE.settings) navigateTo(TAB_PATH.profile);
  };
  useEffect(() => {
    if (tabFromPath(location.pathname) !== null) return;
    navigate(
      { pathname: TAB_PATH.chat, search: location.search, hash: location.hash },
      { replace: true },
    );
  }, [location.pathname]);
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
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);
  useEffect(() => {
    if (!quickCreateOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setQuickCreateOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [quickCreateOpen]);
  const [activeConversationId, setActiveConversationId] = useState<
    number | null
  >(null);
  const [groupMemberViewOpen, setGroupMemberViewOpen] = useState(false);
  const activeConversationIdRef = useRef<number | null>(null);
  const [channelSelection, setChannelSelection] = useState<{ conversationId: number | null; channelId: number }>({ conversationId: null, channelId: 0 });
  const selectedChannelId = channelSelection.conversationId === activeConversationId ? channelSelection.channelId : 0;
  const activeChannelIdRef = useRef(selectedChannelId);
  activeChannelIdRef.current = selectedChannelId;
  const [groupChannelState, setGroupChannelState] = useState<{ conversationId: number | null; channels: GroupChannel[] }>({ conversationId: null, channels: [] });
  const [groupChannelBusy, setGroupChannelBusy] = useState(false);
  const groupChannels = groupChannelState.conversationId === activeConversationId
    ? groupChannelState.channels
    : validGroupChannels([], activeConversationId ?? 0);
  const messagesScrollRef = useRef<HTMLDivElement>(null);
  const messageScrollAtBottom = useRef(true);
  const ownSendScrollConversation = useRef<number | null>(null);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [messageActionId, setMessageActionId] = useState<number | null>(null);
  const [messageActionMode, setMessageActionMode] = useState<'reactions' | 'actions'>('actions');
  const [conversationActionId, setConversationActionId] = useState<number | null>(null);
  const [conversationMenuPosition, setConversationMenuPosition] = useState<{ x: number; y: number } | null>(null);
  const [pinnedExpanded, setPinnedExpanded] = useState(false);
  const conversationLongPress = useRef<{ id: number; x: number; y: number; timer: number } | null>(null);
  const suppressConversationClick = useRef<number | null>(null);
  const [groupActivityCreateKind, setGroupActivityCreateKind] = useState<GroupActivityKind | null>(null);
  const [groupActivityViewedId, setGroupActivityViewedId] = useState<number | null>(null);
  useEffect(() => {
    setGroupActivityCreateKind(null);
    setGroupActivityViewedId(null);
  }, [activeConversationId]);
  const [messageCopyTarget, setMessageCopyTarget] =
    useState<MessageCopyTarget | null>(null);
  const messageLongPressTimer = useRef<number | null>(null);
  const messageLongPressStart = useRef<{
    x: number;
    y: number;
    messageId: number;
  } | null>(null);
  const suppressMessageClick = useRef<number | null>(null);

  const [sharedContentOpen, setSharedContentOpen] = useState(false);
  const [messageSearchOpen, setMessageSearchOpen] = useState(false);
  const [conversationDetailsOpen, setConversationDetailsOpen] = useState(false);
  const [historyActionBusy, setHistoryActionBusy] = useState(false);
  useEffect(() => {
    setMessageSearchOpen(false);
    setConversationDetailsOpen(false);
  }, [activeConversationId]);

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
  const preferenceQueue = useRef(Promise.resolve());
  const preferenceRevision = useRef(0);
  const [newChatMode, setNewChatMode] = useState<NewChatMode>("none");
  const [friendQuery, setFriendQuery] = useState("");
  const [localContactsScreen, setLocalContactsScreen] = useState<FriendsScreen>("directory");
  // On the contacts route the screen lives in the URL; inside Calls it stays local.
  const contactsScreen: FriendsScreen =
    tab === "contacts"
      ? location.pathname === ROUTE.invitations ? "invitations" : "directory"
      : localContactsScreen;
  const setContactsScreen = (next: FriendsScreen) => {
    if (tab === "contacts") navigateTo(next === "invitations" ? ROUTE.invitations : TAB_PATH.contacts);
    else setLocalContactsScreen(next);
  };
  const [friendResults, setFriendResults] = useState<FriendSearchResult[]>([]);
  const [friendSearching, setFriendSearching] = useState(false);
  const [friendSearchError, setFriendSearchError] = useState(false);
  const [friendSearchRetry, setFriendSearchRetry] = useState(0);
  const [friendActionBusy, setFriendActionBusy] = useState<number | null>(null);
  const friendActionRef = useRef(new Set<number>());
  const [friendBusyIds, setFriendBusyIds] = useState<Set<number>>(
    () => new Set(),
  );
  const [friendMenuId, setFriendMenuId] = useState<number | null>(null);
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
  const [blockedUsers, setBlockedUsers] = useState<
    Array<{ id: number; username: string; displayName: string }>
  >([]);
  const [blockedOpen, setBlockedOpen] = useState(false);
  const [blockedBusy, setBlockedBusy] = useState(false);
  const [blockedError, setBlockedError] = useState("");
  const [directUsername, setDirectUsername] = useState("");
  const [qrOpen, setQrOpen] = useState<"mine" | "scan" | null>(null);
  const [translationSettingsConversationId, setTranslationSettingsConversationId] = useState<number | null>(null);
  useEffect(() => {
    if (translationSettingsConversationId !== null &&
        translationSettingsConversationId !== activeConversationId) {
      setTranslationSettingsConversationId(null);
    }
  }, [translationSettingsConversationId, activeConversationId]);
  const [groupWorkspaceMode, setGroupWorkspaceMode] = useState<GroupWorkspaceMode>("list");
  const [feedCommunitiesOpen, setFeedCommunitiesOpen] = useState(false);
  const [groupCreateStep, setGroupCreateStep] = useState<1 | 2 | 3>(1);
  const [chatCreateError, setChatCreateError] = useState("");
  const [nearbyUsers, setNearbyUsers] = useState<FriendSearchResult[]>([]);
  const [nearbyBusy, setNearbyBusy] = useState(false);
  const [nearbyScanning, setNearbyScanning] = useState(false);
  const [nearbyUntil, setNearbyUntil] = useState(0);
  const [nearbyResultRadiusKm, setNearbyResultRadiusKm] = useState(5);
  const [nearbyRadiusKm, setNearbyRadiusKm] = useState(5);
  const nearbyRequest = useRef(0);

  const [profileTimelineOpen, setProfileTimelineOpen] = useState(false);
  const [isProfileDesktop, setIsProfileDesktop] = useState(
    () => window.matchMedia("(min-width: 761px)").matches,
  );
  useEffect(() => {
    const query = window.matchMedia("(min-width: 761px)");
    const onResize = (event: MediaQueryListEvent) =>
      setIsProfileDesktop(event.matches);
    query.addEventListener("change", onResize);
    return () => query.removeEventListener("change", onResize);
  }, []);
  const desktopProfileOverview = isProfileDesktop && !desktopProfileSettings;
  const [profileComposerOpen, setProfileComposerOpen] = useState(false);
  const [profileEditorOpen, setProfileEditorOpen] = useState(false);
  const [postSubmitError, setPostSubmitError] = useState("");
  useEffect(() => {
    if (
      tab !== "profile" ||
      (!profileTimelineOpen && !desktopProfileOverview)
    ) {
      setProfileComposerOpen(false);
      setProfileEditorOpen(false);
    }
  }, [tab, profileTimelineOpen, desktopProfileOverview]);
  const [profilePosts, setProfilePosts] = useState<Post[]>([]);
  const [profilePostsBusy, setProfilePostsBusy] = useState(false);
  const [profilePostsError, setProfilePostsError] = useState("");
  const [profileHasMore, setProfileHasMore] = useState(false);
  const profileLoadSequence = useRef(0);
  const profilePagingBusy = useRef(false);
  const profileIdentityRef = useRef<HTMLButtonElement>(null);
  const profileHeadingRef = useRef<HTMLHeadingElement>(null);
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

  const [feedFilter, setFeedFilter] = useState<
    "all" | "following" | "latest" | "saved"
  >("all");
  const feedFiltersPill = useSlidingPill<HTMLDivElement>(feedFilter);
  const [feedComposerOpen, setFeedComposerOpen] = useState(false);
  const [feedCheckInOpen, setFeedCheckInOpen] = useState(false);
  const [feedCheckInLocation, setFeedCheckInLocation] = useState("");
  useEffect(() => {
    if (tab !== "feed") {
      setFeedComposerOpen(false);
      setFeedCheckInOpen(false);
      setFeedCheckInLocation("");
    }
  }, [tab]);
  const feedViewRef = useRef<HTMLDivElement>(null);
  const [searchHasScrolled, setSearchHasScrolled] = useState(false);
  useLayoutEffect(() => {
    if (tab !== "feed") return;
    if (feedViewRef.current) feedViewRef.current.scrollTop = 0;
    setSearchHasScrolled(false);
  }, [tab, globalSearch.trim().toLocaleLowerCase("vi-VN"), feedFilter]);
  const [activePostId, setActivePostId] = useState<number | null>(null);
  const [commentSortOrder, setCommentSortOrder] = useState<'newest' | 'oldest'>('newest');
  const feedScrollBeforeComments = useRef<number | null>(null);
  useLayoutEffect(() => {
    if (tab === "feed" && activePostId === null && feedScrollBeforeComments.current !== null && feedViewRef.current) {
      feedViewRef.current.scrollTop = feedScrollBeforeComments.current;
      feedScrollBeforeComments.current = null;
    }
  }, [activePostId, tab]);
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
  const [activeStoryId, setActiveStoryId] = useState<number | null>(null);
  const [storyBusy, setStoryBusy] = useState(false);
  const [commentEditors, setCommentEditors] = useState<
    Record<number, DiscussionDraft>
  >({});
  const [postText, setPostText] = useState("");
  const [postVisibility, setPostVisibility] = useState<
    "public" | "friends" | "private"
  >("public");
  const [postBackground, setPostBackground] = useState("");
  const [showPostBackgrounds, setShowPostBackgrounds] = useState(false);
  const [postAttachments, setPostAttachments] = useState<MediaAttachment[]>([]);
  const [mediaUploading, setMediaUploading] = useState<
    "chat" | "feed" | "story" | "profile" | null
  >(null);
  const [mediaUploadProgress, setMediaUploadProgress] = useState<{
    loaded: number;
    total: number;
  } | null>(null);
  const mediaUploadAbort = useRef<AbortController | null>(null);
  const [profileMedia, setProfileMedia] = useState<ProfileMediaState | null>(
    null,
  );
  const [profileBusy, setProfileBusy] = useState<"avatar" | "cover" | null>(
    null,
  );
  const [profileDisplayNameDraft, setProfileDisplayNameDraft] = useState("");
  const [profileUsernameDraft, setProfileUsernameDraft] = useState("");
  const [profileBioDraft, setProfileBioDraft] = useState("");
  const [profileCityDraft, setProfileCityDraft] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [privacy, setPrivacy] = useState<UserPrivacy | null>(null);
  const [privacyBusy, setPrivacyBusy] = useState(false);
  const [privacyLoading, setPrivacyLoading] = useState(false);
  const [privacyError, setPrivacyError] = useState("");
  const [privacyRetry, setPrivacyRetry] = useState(0);
  const [sessionsOpen, setSessionsOpen] = useState(false);
  const [managedSessions, setManagedSessions] = useState<
    ManagedAccountSession[]
  >([]);
  const [sessionsBusy, setSessionsBusy] = useState(false);
  const [sessionsError, setSessionsError] = useState("");
  const [translations, setTranslations] = useState<Record<number, string>>({});
  const [translationOriginals, setTranslationOriginals] = useState<
    Record<number, boolean>
  >({});
  const [manuallyTranslated, setManuallyTranslated] = useState<Record<number, boolean>>({});
  const [translationPending, setTranslationPending] = useState<Record<number, boolean>>({});
  const [translationFailures, setTranslationFailures] = useState<Record<number, boolean>>({});
  const translationInFlight = useRef(new Set<string>());
  const translationAttempted = useRef(new Set<string>());
  const [translationMenuOpen, setTranslationMenuOpen] = useState(false);
  useEffect(() => {
    if (!translationMenuOpen) return;
    const onOutsidePointer = (event: PointerEvent) => {
      if (
        event.target instanceof Element &&
        !event.target.closest(".translation-hub, .translation-dialog-modal, .translation-hub-scrim")
      ) {
        setTranslationMenuOpen(false);
      }
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setTranslationMenuOpen(false);
    };
    document.addEventListener("pointerdown", onOutsidePointer, true);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("pointerdown", onOutsidePointer, true);
      document.removeEventListener("keydown", onEscape);
    };
  }, [translationMenuOpen]);
  const [languageSearch, setLanguageSearch] = useState("");
  const [appLocale, setAppLocale] = useState(loadAppLocalePreference);
  const [uiBundle, setUiBundle] = useState<UIBundle>(defaultBundle);
  const [uiLocaleLoading, setUiLocaleLoading] = useState(false);
  const [localePickerOpen, setLocalePickerOpen] = useState(false);
  const [localeSearch, setLocaleSearch] = useState("");
  const [translationPickerOpen, setTranslationPickerOpen] = useState(false);
  const [translationSettingsSearch, setTranslationSettingsSearch] =
    useState("");
  const [targetLanguage, setTargetLanguage] = useState("en");
  const translationLanguageRef = useRef(targetLanguage);

  useEffect(() => {
    translationAttempted.current.clear();
    setManuallyTranslated({});
    setTranslationPending({});
    setTranslationFailures({});
    setTranslationOriginals({});
  }, [session?.sessionId, targetLanguage]);
  const [autoTranslate, setAutoTranslate] = useState(true);
  const [conversationTranslationOverrides, setConversationTranslationOverrides] = useState<ConversationTranslationSettingsMap>(
    () => session?.user.id ? readConversationTranslationSettings(session.user.id) : {},
  );
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
  const [notice, setNoticeState] = useState<ToastNotice | null>(null);
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(
    null,
  );
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
  const feedImageInputRef = useRef<HTMLInputElement>(null);
  const feedVideoInputRef = useRef<HTMLInputElement>(null);
  const feedAlbumInputRef = useRef<HTMLInputElement>(null);
  const storyFileInputRef = useRef<HTMLInputElement>(null);
  const avatarFileInputRef = useRef<HTMLInputElement>(null);
  const coverFileInputRef = useRef<HTMLInputElement>(null);

  const {
    apiFetch,
    pendingRequests,
    mutationRequests,
  } = useApiRequest({ session, sessionRef, sessionClient, responseCache });

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
        const channels = validGroupChannels(await response.json(), id);
        if (!controller.signal.aborted) {
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
    window.addEventListener('chatnet:group-community-updated', onUpdate);
    return () => {
      controller.abort();
      window.removeEventListener('chatnet:group-community-updated', onUpdate);
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

  function setNotice(message: string, kind?: ToastKind) {
    const clean = message.trim();
    if (!clean) {
      setNoticeState(null);
      return;
    }
    setNoticeState({
      id: Date.now(),
      message: clean,
      kind: kind || inferToastKind(clean),
    });
  }

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

  function cancelConversationLongPress() {
    if (conversationLongPress.current) {
      window.clearTimeout(conversationLongPress.current.timer);
      conversationLongPress.current = null;
    }
  }

  function beginConversationLongPress(id: number, x: number, y: number) {
    cancelConversationLongPress();
    suppressConversationClick.current = null;
    const timer = window.setTimeout(() => {
      if (conversationLongPress.current?.id !== id) return;
      conversationLongPress.current = null;
      suppressConversationClick.current = id;
      setConversationMenuPosition(null);
      setConversationActionId(id);
    }, 550);
    conversationLongPress.current = { id, x, y, timer };
  }

  function moveConversationLongPress(x: number, y: number) {
    const start = conversationLongPress.current;
    if (start && Math.hypot(x - start.x, y - start.y) > 12) cancelConversationLongPress();
  }

  function cancelMessageLongPress() {
    if (messageLongPressTimer.current !== null) {
      window.clearTimeout(messageLongPressTimer.current);
      messageLongPressTimer.current = null;
    }
    messageLongPressStart.current = null;
  }

  function openMessageActions(
    message: Message,
    target: EventTarget | null = null,
  ) {
    if (message.deleted) return;
    cancelMessageLongPress();
    const element =
      target instanceof Element
        ? target
        : target instanceof Node
          ? target.parentElement
          : null;
    setMessageCopyTarget(resolveMessageCopyTarget(message, element));
    setMessageActionMode('actions');
    setMessageActionId(message.id);
    navigator.vibrate?.(24);
  }

  function openMessageReactions(message: Message) {
    if (message.deleted) return;
    cancelMessageLongPress();
    setMessageCopyTarget(null);
    setMessageActionMode('reactions');
    setMessageActionId(message.id);
  }

  function beginMessageLongPress(
    message: Message,
    x: number,
    y: number,
    button: number,
    pointerType: string,
    target: EventTarget | null,
  ) {
    // Mouse users keep native text selection and the existing right-click menu.
    if (message.deleted || button !== 0 || pointerType === "mouse") return;
    const element =
      target instanceof Element
        ? target
        : target instanceof Node
          ? target.parentElement
          : null;
    if (element?.closest("button,input,textarea,select,video,audio")) return;
    // Only touch-holding the bubble (including text, links and attachments)
    // opens the sheet; holding the avatar or empty timeline does not.
    if (!element?.closest(".bubble, .chat-message-media, .message-reply-quote")) return;
    if (element.closest("a") && !element.closest("a.message-inline-link, .media-item")) return;
    cancelMessageLongPress();
    suppressMessageClick.current = null;
    messageLongPressStart.current = { x, y, messageId: message.id };
    messageLongPressTimer.current = window.setTimeout(() => {
      if (messageLongPressStart.current?.messageId === message.id) {
        suppressMessageClick.current = message.id;
        openMessageActions(message, target);
      }
    }, 500);
  }

  function moveMessageLongPress(x: number, y: number) {
    const start = messageLongPressStart.current;
    if (!start) return;
    if (Math.hypot(x - start.x, y - start.y) > 12) cancelMessageLongPress();
  }

  async function copyMessage(message: Message) {
    const content = message.text.trim();
    setMessageActionId(null);
    if (!content) return;
    try {
      await navigator.clipboard.writeText(content);
      setNotice("Đã sao chép tin nhắn.", "success");
    } catch {
      setNotice("Không sao chép được tin nhắn trên trình duyệt này.", "error");
    }
  }

  async function copyMessageImage(attachment: MediaAttachment) {
    setMessageActionId(null);
    if (!attachment.url) return;
    try {
      await copyChatImage(attachment.url);
      setNotice("Đã sao chép ảnh. Bạn có thể dán bằng Cmd/Ctrl+V.", "success");
    } catch (error) {
      const reason =
        error instanceof Error
          ? error.message
          : "Trình duyệt không cho phép đọc hoặc sao chép ảnh.";
      setNotice(`Không sao chép được ảnh. ${reason}`, "error");
    }
  }

  async function copyMessageLink(link: string) {
    setMessageActionId(null);
    try {
      await navigator.clipboard.writeText(link);
      setNotice("Đã sao chép liên kết.", "success");
    } catch {
      setNotice("Không sao chép được liên kết trên trình duyệt này.", "error");
    }
  }

  async function copyMessageContent(
    message: Message,
    target: MessageCopyTarget,
  ) {
    if (target.kind === "image") return copyMessageImage(target.attachment);
    if (target.kind === "unavailable-link") {
      setMessageActionId(null);
      setNotice(
        `Tệp "${target.name}" hiện không có liên kết tải xuống.`,
        "warning",
      );
      return;
    }
    if (target.kind === "file-name") {
      setMessageActionId(null);
      try {
        await navigator.clipboard.writeText(target.name);
        setNotice("Đã sao chép tên tệp.", "success");
      } catch {
        setNotice("Không sao chép được tên tệp.", "error");
      }
      return;
    }
    if (target.kind === "link") {
      await copyMessageLink(target.url);
      if (target.temporary)
        setNotice(
          "Đã sao chép liên kết tải tệp. Liên kết này có thời hạn.",
          "success",
        );
      return;
    }
    return copyMessage(message);
  }

  useEffect(() => {
    if (!notice) return;
    const timeout =
      notice.kind === "error" ? 8000 : notice.kind === "warning" ? 6000 : 4500;
    const timer = window.setTimeout(() => {
      setNoticeState((current) => (current?.id === notice.id ? null : current));
    }, timeout);
    return () => window.clearTimeout(timer);
  }, [notice]);

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
    navigate(
      {
        pathname: pathnameRef.current,
        search: nextSearch ? "?" + nextSearch : "",
        hash: window.location.hash,
      },
      { replace: true },
    );
  }, [session?.token]);

  useEffect(() => {
    activeConversationIdRef.current = activeConversationId;
    messageScrollAtBottom.current = true;
    cancelMessageLongPress();
    setMessageActionId(null);
    setConversationActionId(null);
    setPinnedExpanded(false);
    setMessages([]);
    setHasMoreMessages(false);
    setMessagesLoadingMore(false);
    messagesPagingBusy.current = false;
    setReplyingTo(null);
    setGroupSettingsOpen(false);
    setGroupMemberViewOpen(false);
    setSharedContentOpen(false);
    setGroupMembers([]);
    setGroupInviteSearch("");
    setGroupInviteSelection([]);
  }, [activeConversationId]);

  useEffect(() => {
    setReplyingTo(null);
    setMessageActionId(null);
    setMessageSearchOpen(false);
    setSharedContentOpen(false);
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

  function setMessageAttachments(update: SetStateAction<MediaAttachment[]>) {
    if (!activeConversationId) return;
    if (selectedChannelId > 0) {
      setChannelDrafts(current => {
        const previous = current[channelDraftKey] ?? emptyDraft;
        return {
          ...current,
          [channelDraftKey]: {
            ...previous,
            attachments: typeof update === 'function' ? update(previous.attachments) : update,
          },
        };
      });
      return;
    }
    setMessageDrafts((current) => {
      const previous = current[activeConversationId] ?? emptyDraft;
      return {
        ...current,
        [activeConversationId]: {
          ...previous,
          attachments:
            typeof update === "function"
              ? update(previous.attachments)
              : update,
        },
      };
    });
  }

  useEffect(() => {
    const navigatorWithStandalone = navigator as Navigator & {
      standalone?: boolean;
    };
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      navigatorWithStandalone.standalone === true;
    setIsStandalone(standalone);

    const handleBeforeInstall = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    const handleInstalled = () => {
      setInstallPrompt(null);
      setIsStandalone(true);
      setNotice("SocCO đã được cài vào thiết bị");
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    window.addEventListener("appinstalled", handleInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  async function installApp() {
    if (isStandalone) return;

    if (installPrompt) {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice.outcome === "accepted") {
        setInstallPrompt(null);
      }
      return;
    }

    const isiOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    setNotice(
      isiOS
        ? "Trên iPhone: bấm Chia sẻ trong Safari → Thêm vào Màn hình chính"
        : "Mở menu trình duyệt → Cài đặt ứng dụng / Add to Home screen",
    );
  }

  function saveSession(next: Session) {
    if (isDesktopBuild) {
      if (next.refreshToken !== undefined)
        throw new Error("Desktop credential boundary violation");
      localStorage.removeItem("chatnet-session");
    } else {
      localStorage.setItem("chatnet-session", JSON.stringify(next));
    }
    sessionRef.current = next;
    setSession(next);
  }

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

  async function updateProfileImage(kind: "avatar" | "cover", file?: File) {
    if (!session || profileBusy) return;
    if (!file || !file.type.toLowerCase().startsWith("image/")) {
      setNotice("Chỉ hỗ trợ file ảnh cho ảnh đại diện và ảnh bìa.", "error");
      return;
    }
    setProfileBusy(kind);
    try {
      const [attachment] = await uploadMediaFiles([file], "profile");
      if (sessionRef.current?.sessionId !== session.sessionId) return;
      if (!attachment) throw new Error("Không upload được ảnh.");

      const response = await apiFetch("/api/profile/media", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          attachment: {
            storageRef: attachment.storageRef,
            name: attachment.name,
            sizeBytes: attachment.sizeBytes,
            contentType: attachment.contentType,
            kind: attachment.kind,
          },
        }),
      });
      const result = (await response.json().catch(() => null)) as
        | (ProfileMediaState & { error?: string })
        | null;
      if (sessionRef.current?.sessionId !== session.sessionId) return;
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
    } catch (error) {
      if (sessionRef.current?.sessionId === session.sessionId)
        setNotice(
          error instanceof Error
            ? error.message
            : "Không cập nhật được ảnh hồ sơ.",
          "error",
        );
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

  async function findNearby() {
    if (!session || nearbyBusy) return;
    const request = ++nearbyRequest.current;
    const sessionId = session.sessionId;
    setNearbyBusy(true);
    setNearbyScanning(true);
    try {
      const position = await getCurrentPositionSmart();
      if (
        request !== nearbyRequest.current ||
        sessionRef.current?.sessionId !== sessionId
      )
        return;
      const { latitude, longitude } = position.coords;
      if (
        !Number.isFinite(latitude) ||
        !Number.isFinite(longitude) ||
        Math.abs(latitude) > 85.05112878 ||
        Math.abs(longitude) > 180
      ) {
        throw new Error(
          "Tọa độ trình duyệt không hợp lệ. Kiểm tra Latitude (vĩ độ) và Longitude (kinh độ) trong cài đặt vị trí giả lập nếu đang dùng.",
        );
      }
      const response = await apiFetch("/api/users/nearby", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          latitude,
          longitude,
          radiusKm: nearbyRadiusKm,
        }),
      });
      if (
        request !== nearbyRequest.current ||
        sessionRef.current?.sessionId !== sessionId
      )
        return;
      if (!response.ok)
        throw new Error(
          response.status === 429
            ? "Chờ 10 giây trước khi tìm lại."
            : "Không tìm được bạn quanh đây. Thử lại sau.",
        );
      const result = (await response.json()) as {
        users: FriendSearchResult[];
        expiresAt: string;
        cacheExpiresAt?: string;
        radiusKm?: number;
      };
      if (
        request !== nearbyRequest.current ||
        sessionRef.current?.sessionId !== sessionId
      )
        return;
      setNearbyUsers(result.users);
      setNearbyResultRadiusKm(nearbyRadiusKm);
      setNearbyUntil(Date.parse(result.expiresAt));
      setNotice(
        result.users.length
          ? `Quét thành công: tìm thấy ${result.users.length} người trong bán kính ${nearbyRadiusKm} km.`
          : `Quét thành công nhưng chưa tìm thấy người dùng trong bán kính ${nearbyRadiusKm} km.`,
        result.users.length ? "success" : "info",
      );
    } catch (error) {
      if (request !== nearbyRequest.current) return;
      setNotice(await geolocationErrorMessage(error), "error");
    } finally {
      if (request === nearbyRequest.current) {
        setNearbyBusy(false);
        setNearbyScanning(false);
      }
    }
  }

  async function stopNearby() {
    if (!session || nearbyBusy) return;
    const request = ++nearbyRequest.current;
    setNearbyBusy(true);
    try {
      const response = await apiFetch("/api/users/nearby", {
        method: "DELETE",
      });
      if (request !== nearbyRequest.current) return;
      if (!response.ok)
        throw new Error("Chưa tắt được Quanh đây. Thử lại sau.");
      setNearbyUntil(0);
      setNearbyUsers([]);
      setNotice("Đã tắt Quanh đây và xóa cache vị trí gần nhất.", "success");
    } catch (error) {
      if (request !== nearbyRequest.current) return;
      setNotice(
        error instanceof Error
          ? error.message
          : "Mất kết nối. Chưa xác nhận đã tắt Quanh đây.",
        "error",
      );
    } finally {
      if (request === nearbyRequest.current) setNearbyBusy(false);
    }
  }

  useEffect(() => {
    if (!nearbyUntil) return;
    const timer = window.setTimeout(
      () => {
        // Keep the last scan results visible from the longer server-side cache.
        // Only the short "active nearby" lease expires here.
        setNearbyUntil(0);
      },
      Math.max(0, nearbyUntil - Date.now()),
    );
    return () => window.clearTimeout(timer);
  }, [nearbyUntil]);


  async function uploadMediaFiles(
    files: File[],
    scope: "chat" | "feed" | "story" | "profile",
  ) {
    if (!files.length) return [] as MediaAttachment[];
    if (mediaUploadAbort.current)
      throw new Error(
        "Đang tải tệp khác. Hãy hoàn tất hoặc hủy trước khi tải tiếp.",
      );
    const sessionId = session?.sessionId;
    const controller = new AbortController();
    mediaUploadAbort.current = controller;
    setMediaUploading(scope);
    const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
    const loadedBytes = files.map(() => 0);
    setMediaUploadProgress({ loaded: 0, total: Math.max(1, totalBytes) });
    let lastReport = 0;

    function trackProgress(index: number, loaded: number) {
      if (mediaUploadAbort.current !== controller) return;
      loadedBytes[index] = Math.min(files[index].size, Math.max(0, loaded));
      const now = performance.now();
      if (loadedBytes[index] < files[index].size && now - lastReport < 120)
        return;
      lastReport = now;
      setMediaUploadProgress({
        loaded: loadedBytes.reduce((sum, value) => sum + value, 0),
        total: Math.max(1, totalBytes),
      });
    }

    try {
      const result = new Array<MediaAttachment>(files.length);
      let nextIndex = 0;
      const workerCount = Math.min(4, files.length);

      async function worker() {
        try {
          while (true) {
            if (controller.signal.aborted)
              throw new DOMException("Đã hủy tải tệp.", "AbortError");
            const index = nextIndex++;
            if (index >= files.length) return;

            const file = files[index];
            const contentType = file.type || "application/octet-stream";
            const presignResponse = await apiFetch("/api/media/presign", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                scope,
                name: file.name,
                sizeBytes: file.size,
                contentType,
              }),
              signal: controller.signal,
            });
            if (controller.signal.aborted)
              throw new DOMException("Đã hủy tải tệp.", "AbortError");
            const ticket = (await presignResponse.json().catch(() => null)) as
              | (PresignedUpload & { error?: string })
              | null;
            if (!presignResponse.ok || !ticket?.uploadUrl) {
              throw new Error(
                ticket?.error ||
                  "Không cấp được quyền upload file. Hãy kiểm tra cấu hình S3.",
              );
            }

            await uploadPresignedFile(
              ticket.uploadUrl,
              file,
              contentType,
              controller.signal,
              (loaded) => trackProgress(index, loaded),
            );
            if (controller.signal.aborted)
              throw new DOMException("Đã hủy tải tệp.", "AbortError");
            result[index] = {
              storageRef: ticket.storageRef,
              name: file.name,
              sizeBytes: file.size,
              contentType,
              kind: ticket.kind,
              // Pending chat media uses a local preview. Never persist/reuse
              // the raw S3 GET URL from the upload ticket.
              url: scope === "chat" ? URL.createObjectURL(file) : ticket.downloadUrl,
            };
          }
        } catch (error) {
          controller.abort();
          throw error;
        }
      }

      const outcomes = await Promise.allSettled(
        Array.from({ length: workerCount }, () => worker()),
      );
      const errors = outcomes.filter(
        (outcome): outcome is PromiseRejectedResult =>
          outcome.status === "rejected",
      );
      const firstError =
        errors.find(
          (item) =>
            !(
              item.reason instanceof DOMException &&
              item.reason.name === "AbortError"
            ),
        ) ?? errors[0];
      if (firstError) throw firstError.reason;
      return result;
    } finally {
      if (mediaUploadAbort.current === controller) {
        mediaUploadAbort.current = null;
        setMediaUploadProgress(null);
        if (sessionRef.current?.sessionId === sessionId)
          setMediaUploading(null);
      }
    }
  }

  async function addChatFiles(files: File[]) {
    if (!files.length) return;
    if (!activeConversationId) {
      setNotice("Chọn hội thoại trước khi đính kèm tệp.", "warning");
      return;
    }
    if (mediaUploading || messageSending || mediaUploadAbort.current) {
      setNotice(
        "Hãy hoàn tất hoặc hủy tác vụ hiện tại trước khi thêm tệp.",
        "warning",
      );
      return;
    }
    const conversationId = activeConversationId;
    const channelId = selectedChannelId;
    const channelKey = channelDraftKey;
    const sessionId = session?.sessionId;
    const remaining = Math.max(0, 10 - messageAttachments.length);
    if (remaining === 0) {
      setNotice("Mỗi tin nhắn tối đa 10 file đính kèm.");
      return;
    }
    const selected = files.slice(0, remaining);
    if (selected.length < files.length)
      setNotice("Mỗi tin nhắn tối đa 10 file đính kèm.");
    try {
      const uploaded = await uploadMediaFiles(selected, "chat");
      if (sessionRef.current?.sessionId !== sessionId) return;
      if (channelId > 0) {
        setChannelDrafts(current => {
          const previous = current[channelKey] ?? emptyDraft;
          return {
            ...current,
            [channelKey]: { ...previous, attachments: [...previous.attachments, ...uploaded].slice(0, 10) },
          };
        });
      } else {
        setMessageDrafts((current) => {
          const previous = current[conversationId] ?? emptyDraft;
          return {
            ...current,
            [conversationId]: {
              ...previous,
              attachments: [...previous.attachments, ...uploaded].slice(0, 10),
            },
          };
        });
      }
    } catch (error) {
      if (sessionRef.current?.sessionId === sessionId)
        setNotice(
          error instanceof Error ? error.message : "Không upload được file",
        );
    }
  }

  async function addFeedFiles(files: File[]) {
    if (!files.length || pendingPost || mediaUploading) return;
    const sessionId = session?.sessionId;
    const remaining = Math.max(0, 12 - postAttachments.length);
    if (remaining === 0) {
      setNotice("Mỗi bài viết tối đa 12 ảnh/video.");
      return;
    }
    const selected = files.slice(0, remaining);
    if (selected.length < files.length)
      setNotice("Mỗi bài viết tối đa 12 ảnh/video.");
    try {
      const uploaded = await uploadMediaFiles(selected, "feed");
      if (sessionRef.current?.sessionId !== sessionId) return;
      setPostAttachments((current) => [...current, ...uploaded].slice(0, 12));
    } catch (error) {
      if (sessionRef.current?.sessionId === sessionId)
        setNotice(
          error instanceof Error ? error.message : "Không upload được media",
        );
    }
  }

  async function createStory(file?: File) {
    if (!file || storyBusy || mediaUploading) return;
    const sessionId = session?.sessionId;
    setStoryBusy(true);
    try {
      const [attachment] = await uploadMediaFiles([file], "story");
      if (sessionRef.current?.sessionId !== sessionId) return;
      const response = await apiFetch("/api/stories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attachment: attachmentRequestBody(attachment) }),
      });
      const result = (await response.json().catch(() => null)) as
        | (Story & { error?: string })
        | null;
      if (sessionRef.current?.sessionId !== sessionId) return;
      if (!response.ok || !result?.id || !result.attachment)
        throw new Error(result?.error || "Không đăng được Story");
      setStories((current) => [
        result,
        ...current.filter((item) => item.id !== result.id),
      ]);
      setActiveStoryId(result.id);
    } catch (error) {
      if (sessionRef.current?.sessionId === sessionId)
        setNotice(
          error instanceof Error ? error.message : "Không đăng được Story",
        );
    } finally {
      if (sessionRef.current?.sessionId === sessionId) setStoryBusy(false);
    }
  }

  async function deleteStory(story: Story) {
    if (story.author !== name || storyBusy || !window.confirm("Xóa Story này?"))
      return;
    const sessionId = session?.sessionId;
    setStoryBusy(true);
    try {
      const response = await apiFetch(`/api/stories/${story.id}`, {
        method: "DELETE",
      });
      if (sessionRef.current?.sessionId !== sessionId) return;
      if (!response.ok) throw new Error("Không xóa được Story");
      setStories((current) => current.filter((item) => item.id !== story.id));
      setActiveStoryId((current) => (current === story.id ? null : current));
    } catch (error) {
      if (sessionRef.current?.sessionId === sessionId)
        setNotice(
          error instanceof Error ? error.message : "Không xóa được Story",
        );
    } finally {
      if (sessionRef.current?.sessionId === sessionId) setStoryBusy(false);
    }
  }

  async function replyToStory(story: Story, message: string): Promise<boolean> {
    const content = message.trim();
    if (!content || !sessionRef.current || story.author === sessionRef.current.user.username)
      return false;

    let queued = false;
    await openDirectByUsername(story.author, undefined, (conversation) => {
      const item: QueuedChatMessage = {
        clientId: crypto.randomUUID(),
        conversationId: conversation.id,
        text: `↪️ Trả lời Story (${new Date(story.createdAt).toLocaleString("vi-VN", {
          day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
        })})\n${content}`,
        attachments: [],
        createdAt: new Date().toISOString(),
        status: "queued",
      };
      const next = updateChatOutbox((items) => enqueueChatMessage(items, item));
      if (!next.some((pending) => pending.clientId === item.clientId)) {
        setNotice("Không thể lưu phản hồi Story vào hàng đợi. Nội dung vẫn được giữ lại.", "warning");
        return;
      }
      queued = true;
      ownSendScrollConversation.current = conversation.id;
      setActiveStoryId(null);
      if (navigator.onLine) void retryQueuedChatMessages();
      else setChatOnline(false);
    });
    return queued;
  }

  async function shareStory(story: Story) {
    const url = story.attachment.url;
    if (!url) {
      setNotice("Không có đường dẫn Story để chia sẻ.");
      return;
    }
    try {
      if (navigator.share) {
        await navigator.share({
          title: "Khoảnh khắc của " + userLabel(story.authorDisplayName, story.author),
          url,
        });
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        setNotice("Đã sao chép liên kết media của Story (liên kết có thể hết hạn).");
      } else {
        setNotice("Trình duyệt không hỗ trợ chia sẻ liên kết Story.");
      }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError"))
        setNotice("Không thể chia sẻ Story. Vui lòng thử lại.");
    }
  }

  async function reportStory(story: Story) {
    const answer = window.prompt("Nhập lý do báo cáo Story (5–500 ký tự):");
    if (answer === null) return;
    const reason = answer.trim();
    const length = Array.from(reason).length;
    if (length < 5 || length > 500) {
      setNotice("Lý do báo cáo cần từ 5 đến 500 ký tự.");
      return;
    }
    try {
      const response = await apiFetch("/api/feed/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetType: "story",
          targetId: story.id,
          reason,
        }),
      });
      if (!response.ok) throw new Error("Không gửi được báo cáo Story.");
      setNotice("Đã gửi báo cáo Story.");
    } catch {
      setNotice("Không thể báo cáo Story. Vui lòng thử lại.");
    }
  }

  async function syncPushState(state: PushState) {
    if (!session?.token || !state.subscriptionId) return;

    const response = await apiFetch("/api/push/subscription", {
      method: state.optedIn ? "POST" : "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subscriptionId: state.subscriptionId }),
    });
    if (!response.ok) throw new Error("Không lưu được đăng ký thông báo.");
  }

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

  async function savePreferences(
    nextTarget: string,
    nextAuto: boolean,
    nextAppLocale: string,
  ) {
    if (!session?.token) return;
    const sessionId = session.sessionId;
    const revision = ++preferenceRevision.current;
    const preferenceKey = `chatnet-preferences:${session.user.id}`;
    localStorage.setItem(
      preferenceKey,
      JSON.stringify({
        targetLanguage: nextTarget,
        autoTranslate: nextAuto,
        appLocale: nextAppLocale,
      }),
    );
    const save = async () => {
      if (
        sessionRef.current?.sessionId !== sessionId ||
        revision !== preferenceRevision.current
      )
        return;
      const response = await apiFetch("/api/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetLanguage: nextTarget,
          autoTranslate: nextAuto,
          appLocale: nextAppLocale,
        }),
      });
      if (
        !response.ok &&
        sessionRef.current?.sessionId === sessionId &&
        revision === preferenceRevision.current
      ) {
        setNotice(
          "Cài đặt đã áp dụng trên máy này nhưng chưa đồng bộ được. Chọn lại cài đặt để thử lại.",
          "warning",
        );
      }
    };
    preferenceQueue.current = preferenceQueue.current
      .catch(() => undefined)
      .then(save);
    await preferenceQueue.current;
  }

  async function saveTranslationPreferences(
    nextTarget: string,
    nextAuto: boolean,
  ) {
    await savePreferences(nextTarget, nextAuto, appLocale);
  }

  async function changeAppLocale(nextLocale: string) {
    const normalized =
      nextLocale === "auto" ? "auto" : nextLocale.toLowerCase().split("-")[0];
    if (normalized !== "auto" && !isSupportedLanguageCode(normalized)) return;
    setAppLocale(normalized);
    saveAppLocalePreference(normalized);
    setLocalePickerOpen(false);
    setLocaleSearch("");
    if (session?.token) {
      await savePreferences(targetLanguage, autoTranslate, normalized);
    }
  }

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
      let targetPath = pathnameRef.current;
      if (params.get("tab") === "feed") {
        targetPath = TAB_PATH.feed;
      } else if (params.get("tab") === "contacts") {
        targetPath = TAB_PATH.contacts;
      }
      const conversationID = Number(params.get("conversation"));
      const messageID = Number(params.get("message"));
      if (Number.isSafeInteger(conversationID) && conversationID > 0) {
        targetPath = TAB_PATH.chat;
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
        const search = params.toString();
        navigate(
          { pathname: targetPath, search: search ? "?" + search : "", hash: url.hash },
          { replace: true },
        );
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

  async function sendTestPush(silent = false, force = false) {
    if (!pushConfigured || (!pushEnabled && !force) || (pushBusy && !force))
      return false;

    const response = await apiFetch("/api/push/test", { method: "POST" });
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      if (!silent) {
        setNotice(
          result.error === "no push subscription registered"
            ? "Thiết bị chưa có Push Subscription hợp lệ."
            : result.error || "Không gửi được thông báo test.",
        );
      }
      return false;
    }

    if (!silent) {
      setNotice(
        `Đã gửi thông báo test tới ${result.recipients || 1} thiết bị.`,
      );
    }
    return true;
  }

  async function previewMessageSound() {
    const played = await messageSound.current?.preview();
    if (!played)
      setNotice(
        "Trình duyệt chưa cho phép phát âm thanh. Hãy thử lại sau khi chạm vào SocCO.",
        "warning",
      );
  }

  function toggleMessageSound() {
    const enabled = !messageSoundEnabledRef.current;
    messageSoundEnabledRef.current = enabled;
    setMessageSoundEnabled(enabled);
    persistMessageSoundEnabled(enabled);
    if (enabled) void previewMessageSound();
  }

  async function togglePush() {
    if (pushBusy) return;

    if (!pushConfigured || !pushAppId) {
      setNotice(
        "Hệ thống thông báo chưa sẵn sàng. Vui lòng thử lại sau vài giây.",
      );
      return;
    }

    if (pushInitFailed) {
      try {
        const state = await setupOneSignal(pushAppId, async (nextState) => {
          setPushEnabled(nextState.optedIn);
          await syncPushState(nextState);
        });
        setPushInitFailed(false);
        setPushEnabled(state.optedIn);
        await syncPushState(state);
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        setNotice(`Không khởi tạo được Push Notification: ${detail}`);
        return;
      }
    }

    const isiOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    if (isiOS && !isStandalone && !pushEnabled) {
      setNotice(
        "Trên iPhone: thêm SocCO vào Màn hình chính trước, rồi mở app và bật thông báo.",
      );
      return;
    }

    setPushBusy(true);
    try {
      const state = pushEnabled
        ? await disableOneSignalPush()
        : await enableOneSignalPush();

      setPushEnabled(state.optedIn);
      setPushPrompt(
        state.supported && state.permission === "default" && !isPushDisabled(),
      );
      await syncPushState(state);

      if (state.permission === "denied") {
        setNotice(
          "Thông báo đang bị chặn. Hãy mở cài đặt của trình duyệt/PWA → Notifications → Allow rồi quay lại SocCO.",
        );
      } else if (state.permission === "unsupported") {
        setNotice("Thiết bị hoặc trình duyệt này chưa hỗ trợ Web Push.");
      } else if (!pushEnabled && !state.optedIn) {
        setNotice(
          "Chưa bật được thông báo. Vui lòng thử lại và chọn Cho phép.",
        );
      } else if (state.optedIn) {
        setNotice("Đã bật thông báo SocCO.");
      } else {
        setNotice("Đã tắt thông báo SocCO");
      }
    } catch {
      setNotice(
        "Không thể bật thông báo. Kiểm tra quyền Notification của trình duyệt/PWA rồi thử lại.",
      );
    } finally {
      setPushBusy(false);
    }
  }

  useEffect(() => {
    if (!session?.token) {
      setPrivacy(null);
      setPrivacyError("");
      setPrivacyLoading(false);
      return;
    }
    const controller = new AbortController();
    setPrivacy(null);
    setPrivacyBusy(false);
    setPrivacyLoading(true);
    setPrivacyError("");
    apiFetch("/api/privacy", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Không thể tải quyền riêng tư.");
        return response.json() as Promise<UserPrivacy>;
      })
      .then((value) => {
        if (!controller.signal.aborted) setPrivacy(value);
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setPrivacyError("Không thể tải cài đặt riêng tư.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setPrivacyLoading(false);
      });
    return () => controller.abort();
  }, [session?.sessionId, privacyRetry]);

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

  useEffect(() => {
    setManagedSessions([]);
    setSessionsOpen(false);
    setSessionsBusy(false);
    setSessionsError("");
  }, [session?.sessionId]);

  async function fetchAccountSessions() {
    const current = sessionRef.current;
    if (!current || (!isDesktopBuild && !current.refreshToken) || sessionsBusy)
      return;
    const identity = current.sessionId;
    setSessionsBusy(true);
    setSessionsError("");
    try {
      let data: ManagedAccountSession[];
      if (isDesktopBuild) {
        data = await desktopBridge().auth.listSessions(identity);
      } else {
        const response = await fetch(`${API}/api/auth/sessions/list`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
          body: JSON.stringify({ refreshToken: current.refreshToken }),
        });
        if (!response.ok) throw new Error("Không tải được phiên đăng nhập.");
        data = (await response.json()) as ManagedAccountSession[];
      }
      if (sessionRef.current?.sessionId === identity) {
        setManagedSessions(data);
        setSessionsOpen(true);
      }
    } catch {
      if (sessionRef.current?.sessionId === identity) {
        setSessionsError("Không thể tải các thiết bị. Vui lòng thử lại.");
      }
    } finally {
      if (sessionRef.current?.sessionId === identity) setSessionsBusy(false);
    }
  }

  async function revokeAccountSessions(sessionID?: string) {
    const current = sessionRef.current;
    if (!current || (!isDesktopBuild && !current.refreshToken) || sessionsBusy)
      return;
    const identity = current.sessionId;
    const selected = managedSessions.find((item) => item.id === sessionID);
    if (sessionID && !selected) return;
    const message = sessionID
      ? selected?.current
        ? "Bạn muốn đăng xuất khỏi thiết bị này?"
        : "Bạn muốn thu hồi phiên đăng nhập trên thiết bị đã chọn?"
      : "Bạn muốn đăng xuất tất cả thiết bị khác?";
    if (!window.confirm(message)) return;
    setSessionsBusy(true);
    setSessionsError("");
    try {
      if (isDesktopBuild) {
        const nativeAuth = desktopBridge().auth;
        const revoked = sessionID
          ? await nativeAuth.revokeSession(identity, sessionID)
          : await nativeAuth.revokeOthers(identity);
        if (!revoked) throw new Error("Không thu hồi được phiên đăng nhập.");
      } else {
        const response = await fetch(
          `${API}/api/auth/sessions/${sessionID ? "revoke" : "revoke-others"}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            cache: "no-store",
            body: JSON.stringify({
              refreshToken: current.refreshToken,
              ...(sessionID ? { sessionId: sessionID } : {}),
            }),
          },
        );
        if (!response.ok)
          throw new Error("Không thu hồi được phiên đăng nhập.");
      }
      if (sessionRef.current?.sessionId !== identity) return;
      if (selected?.current) {
        logout(false);
      } else {
        setManagedSessions((items) =>
          sessionID
            ? items.filter((item) => item.id !== sessionID)
            : items.filter((item) => item.current),
        );
        setNotice("Đã thu hồi phiên đăng nhập được chọn.");
      }
    } catch {
      if (sessionRef.current?.sessionId === identity) {
        setSessionsError("Không thu hồi được phiên. Vui lòng thử lại.");
      }
    } finally {
      if (sessionRef.current?.sessionId === identity) setSessionsBusy(false);
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

  async function actOnFriend(
    friend: FriendSearchResult | FriendConnection,
    decline = false,
  ) {
    const sessionId = session?.sessionId;
    if (
      !sessionId ||
      friendActionRef.current.has(friend.id) ||
      friend.id === session.user.id
    )
      return;
    const relationship = friendRelationship(friend.id);
    if (decline && relationship !== "incoming") return;
    if (relationship === "accepted") {
      const contact = friends.find((item) => item.id === friend.id);
      if (contact?.blockedByMe || contact?.blockedByOther) {
        await openBlockedFriendConversation(friend.id);
      } else if (friend.username) {
        await openDirectByUsername(friend.username);
      }
      return;
    }

    friendActionRef.current.add(friend.id);
    setFriendBusyIds((current) => new Set(current).add(friend.id));
    ++friendSyncRequest.current;
    setFriendActionBusy(friend.id);
    try {
      const removing = decline || relationship === "outgoing";
      const method = removing ? "DELETE" : "POST";
      const path = removing
        ? `/api/friends/${friend.id}?direction=${relationship}`
        : relationship === "incoming"
          ? `/api/friends/${friend.id}/accept`
          : `/api/friends/${friend.id}`;
      const response = await apiFetch(path, { method });
      const result = (await response.json().catch(() => null)) as
        | (FriendConnection & { error?: string })
        | null;
      if (sessionRef.current?.sessionId !== sessionId) return;
      ++friendSyncRequest.current;
      if (!response.ok) {
        setNotice(result?.error || "Không cập nhật được lời mời kết bạn");
        await refreshFriendConnections();
        return;
      }
      const label = friend.displayName || `@${friend.username}`;
      if (removing) {
        setFriendRequests((current) =>
          current.filter((item) => item.id !== friend.id),
        );
        setNotice(
          decline ? "Đã từ chối lời mời kết bạn" : "Đã hủy lời mời kết bạn",
        );
      } else if (result?.id === friend.id && result.status === "accepted") {
        setFriends((current) => [
          ...current.filter((item) => item.id !== friend.id),
          result,
        ]);
        setFriendRequests((current) =>
          current.filter((item) => item.id !== friend.id),
        );
        setNotice(`Đã kết bạn với ${label}`);
      } else if (result?.id === friend.id && result.status === "pending") {
        setFriendRequests((current) => [
          ...current.filter((item) => item.id !== friend.id),
          result,
        ]);
        setNotice(
          result.direction === "incoming"
            ? `${label} cũng đã gửi lời mời. Bạn có thể chấp nhận ngay.`
            : `Đã gửi lời mời kết bạn tới ${label}`,
        );
      } else {
        await refreshFriendConnections();
      }
    } catch {
      if (sessionRef.current?.sessionId === sessionId) {
        setNotice(
          "Không cập nhật được lời mời kết bạn. Kiểm tra kết nối rồi thử lại.",
        );
        await refreshFriendConnections();
      }
    } finally {
      if (sessionRef.current?.sessionId === sessionId) {
        friendActionRef.current.delete(friend.id);
        setFriendBusyIds((current) => {
          const next = new Set(current);
          next.delete(friend.id);
          return next;
        });
        setFriendActionBusy(
          friendActionRef.current.values().next().value ?? null,
        );
      }
    }
  }

  async function changePersonalContact(
    friend: FriendConnection,
    field: "nickname" | "note" | "favorite",
  ) {
    const sid = session?.sessionId;
    if (!sid || friendBusyIds.has(friend.id)) return;
    const previous = contactMetadata[friend.id] || {
      nickname: "",
      note: "",
      favorite: false,
    };
    const next = { ...previous };
    if (field === "favorite") {
      next.favorite = !next.favorite;
    } else {
      const label =
        field === "nickname"
          ? "Biệt danh riêng (tối đa 60 ký tự)"
          : "Ghi chú riêng (tối đa 1500 ký tự)";
      const answer = window.prompt(label, previous[field]);
      if (answer === null) return;
      next[field] = answer.trim();
      if (next[field].length > (field === "nickname" ? 60 : 1500)) {
        setNotice("Nội dung vượt quá độ dài cho phép.", "warning");
        return;
      }
    }
    setFriendMenuId(null);
    setFriendBusyIds((ids) => new Set(ids).add(friend.id));
    try {
      const response = await apiFetch(`/api/contacts/${friend.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      const result = (await response.json().catch(() => null)) as {
        error?: string;
        id?: number;
        nickname?: string;
        note?: string;
        favorite?: boolean;
      } | null;
      if (sessionRef.current?.sessionId !== sid) return;
      if (!response.ok || !result || result.id !== friend.id) {
        setNotice(result?.error || "Không lưu được liên hệ.", "error");
        return;
      }
      setContactMetadata((old) => ({ ...old, [friend.id]: next }));
      setNotice("Đã lưu thông tin liên hệ riêng.");
    } catch {
      if (sessionRef.current?.sessionId === sid)
        setNotice("Không thể lưu liên hệ. Hãy thử lại.", "error");
    } finally {
      setFriendBusyIds((ids) => {
        const nextIDs = new Set(ids);
        nextIDs.delete(friend.id);
        return nextIDs;
      });
    }
  }

  async function blockContact(friend: Pick<FriendSearchResult, 'id' | 'username' | 'displayName'>) {
    const sid = session?.sessionId;
    if (!sid || friendBusyIds.has(friend.id)) return;
    if (
      !window.confirm(
        `Chặn @${friend.username}? Hai bạn sẽ không thể nhắn tin, gọi điện hoặc kết bạn với nhau.`,
      )
    )
      return;
    setFriendBusyIds((old) => new Set(old).add(friend.id));
    setFriendMenuId(null);
    try {
      const response = await apiFetch(`/api/users/${friend.id}/block`, {
        method: "POST",
      });
      const result = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (sessionRef.current?.sessionId !== sid) return;
      if (!response.ok) {
        setNotice(result?.error || "Không thể chặn người dùng.", "error");
        return;
      }
      // Blocking a contact must not remove an accepted friend from the directory.
      setFriends((old) => old.map((item) => item.id === friend.id
        ? { ...item, blockedByMe: true, online: false }
        : item));
      setFriendRequests((old) => old.filter((item) => item.id !== friend.id));
      setFriendResults((old) => old.filter((item) => item.id !== friend.id));
      setBlockedUsers((old) => [
        ...old.filter((item) => item.id !== friend.id),
        {
          id: friend.id,
          username: friend.username,
          displayName: friend.displayName,
        },
      ]);
      setFriendPreview(null);
      setConversations((old) =>
        old.map((item) => item.type === 'direct' && item.otherUserId === friend.id
          ? { ...item, blockedByMe: true, online: false }
          : item),
      );
      window.dispatchEvent(new Event('chatnet:privacy-updated'));
      setNotice(`Đã chặn @${friend.username}.`);
      await refreshFriendConnections();
      void refreshConversations();
    } catch {
      if (sessionRef.current?.sessionId === sid)
        setNotice("Không thể chặn người dùng. Hãy thử lại.", "error");
    } finally {
      setFriendBusyIds((old) => {
        const next = new Set(old);
        next.delete(friend.id);
        return next;
      });
    }
  }

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


  async function reportContact(friend: FriendSearchResult | FriendConnection) {
    const sid = session?.sessionId;
    if (!sid) return;
    const answer = window.prompt(
      "Lý do báo cáo: 1 - Spam, 2 - Quấy rối, 3 - Giả mạo, 4 - Khác",
    );
    if (answer === null) return;
    const reason = (
      {
        "1": "spam",
        "2": "harassment",
        "3": "impersonation",
        "4": "other",
      } as Record<string, string>
    )[answer.trim()];
    if (!reason) {
      setNotice("Vui lòng chọn lý do từ 1 đến 4.", "warning");
      return;
    }
    const details = window.prompt(
      "Mô tả sự việc (không quá 1000 ký tự, có thể để trống):",
    );
    if (details === null) return;
    if (details.length > 1000) {
      setNotice("Mô tả không được quá 1000 ký tự.", "warning");
      return;
    }
    setFriendMenuId(null);
    try {
      const response = await apiFetch(`/api/users/${friend.id}/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason, details: details.trim() }),
      });
      const result = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (sessionRef.current?.sessionId !== sid) return;
      setNotice(
        response.ok
          ? "Đã gửi báo cáo. Cảm ơn bạn."
          : result?.error || "Không thể gửi báo cáo.",
        response.ok ? "success" : "error",
      );
    } catch {
      if (sessionRef.current?.sessionId === sid)
        setNotice("Không thể gửi báo cáo. Hãy thử lại.", "error");
    }
  }

  async function loadBlockedUsers() {
    const sid = session?.sessionId;
    if (!sid || blockedBusy) return;
    setBlockedBusy(true);
    setBlockedError("");
    try {
      const response = await apiFetch("/api/users/blocked");
      if (!response.ok) throw new Error();
      const data = (await response.json()) as Array<{
        id: number;
        username: string;
        displayName: string;
      }>;
      if (sessionRef.current?.sessionId === sid) {
        setBlockedUsers(data);
        setBlockedOpen(true);
      }
    } catch {
      if (sessionRef.current?.sessionId === sid)
        setBlockedError("Không tải được danh sách chặn.");
    } finally {
      if (sessionRef.current?.sessionId === sid) setBlockedBusy(false);
    }
  }

  async function unblockContact(userId: number) {
    const sid = session?.sessionId;
    if (!sid || blockedBusy || !window.confirm("Bỏ chặn người dùng này?"))
      return;
    setBlockedBusy(true);
    setBlockedError("");
    try {
      const response = await apiFetch(`/api/users/${userId}/block`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error();
      if (sessionRef.current?.sessionId === sid) {
        setBlockedUsers((old) => old.filter((item) => item.id !== userId));
        setFriends((old) => old.map((item) => item.id === userId
          ? { ...item, blockedByMe: false }
          : item));
        void refreshFriendConnections();
        setConversations((old) => old.map((item) =>
          item.type === 'direct' && item.otherUserId === userId
            ? { ...item, blockedByMe: false }
            : item));
        window.dispatchEvent(new Event('chatnet:privacy-updated'));
        void refreshConversations();
        setNotice("Đã bỏ chặn người dùng.");
      }
    } catch {
      if (sessionRef.current?.sessionId === sid)
        setBlockedError("Không thể bỏ chặn. Hãy thử lại.");
    } finally {
      if (sessionRef.current?.sessionId === sid) setBlockedBusy(false);
    }
  }

  async function declineFriendRequest(friend: FriendConnection) {
    await actOnFriend(friend, true);
  }

  async function removeAcceptedFriend(friend: FriendConnection) {
    const sessionId = session?.sessionId;
    if (
      !sessionId ||
      friendRelationship(friend.id) !== "accepted" ||
      friendActionRef.current.has(friend.id)
    )
      return;
    if (
      !window.confirm(
        `Hủy kết bạn với ${friend.displayName || "@" + friend.username}?`,
      )
    )
      return;
    friendActionRef.current.add(friend.id);
    setFriendBusyIds((current) => new Set(current).add(friend.id));
    setFriendActionBusy(friend.id);
    setFriendMenuId(null);
    try {
      const response = await apiFetch(
        `/api/friends/${friend.id}?direction=accepted`,
        { method: "DELETE" },
      );
      const result = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (sessionRef.current?.sessionId !== sessionId) return;
      if (!response.ok) {
        setNotice(result?.error || "Không thể hủy kết bạn. Vui lòng thử lại.");
      } else {
        setFriends((current) =>
          current.filter((item) => item.id !== friend.id),
        );
        setFriendPreview(null);
        setNotice("Đã hủy kết bạn");
      }
      await refreshFriendConnections();
    } catch {
      if (sessionRef.current?.sessionId === sessionId) {
        setNotice("Mạng gián đoạn. Đang đồng bộ lại danh sách bạn bè.");
        await refreshFriendConnections();
      }
    } finally {
      friendActionRef.current.delete(friend.id);
      if (sessionRef.current?.sessionId === sessionId) {
        setFriendBusyIds((current) => {
          const next = new Set(current);
          next.delete(friend.id);
          return next;
        });
        setFriendActionBusy(
          friendActionRef.current.values().next().value ?? null,
        );
      }
    }
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

  function syncFeedPost(updated: Post) {
    ++feedRevision.current;
    setProfilePosts((current) =>
      current.map((p) => (p.id === updated.id ? updated : p)),
    );
    syncFeedDataPost(updated);
    followingFeed.syncPost(updated);
    postSearch.syncPost(updated);
  }

  function removeFeedPost(id: number) {
    ++feedRevision.current;
    setProfilePosts((current) => current.filter((p) => p.id !== id));
    removeFeedDataPost(id);
    followingFeed.removePost(id);
    postSearch.removePost(id);
  }

  async function loadProfilePosts(more = false, force = false) {
    if (!session || profilePagingBusy.current) return;
    const sessionId = session.sessionId;
    const sequence = ++profileLoadSequence.current;
    const revision = feedRevision.current;
    const before =
      more && profilePosts.length
        ? Math.min(...profilePosts.map((post) => post.id))
        : 0;
    profilePagingBusy.current = true;
    setProfilePostsBusy(true);
    setProfilePostsError("");
    try {
      const response = await apiFetch(
        `/api/posts?scope=mine&limit=${FEED_PAGE_SIZE}${before ? "&before=" + before : ""}`,
        force ? { cache: "reload" } : {},
      );
      if (!response.ok)
        throw new Error("Không tải được dòng thời gian. Hãy thử lại.");
      const data = (await response.json()) as Post[];
      if (
        sessionRef.current?.sessionId !== sessionId ||
        sequence !== profileLoadSequence.current
      )
        return;
      if (revision !== feedRevision.current)
        throw new Error(
          "Dòng thời gian vừa thay đổi. Hãy tải lại để cập nhật.",
        );
      if (
        !Array.isArray(data) ||
        data.some(
          (post) =>
            !Number.isSafeInteger(post.id) ||
            post.id <= 0 ||
            post.author !== sessionRef.current?.user.username,
        )
      ) {
        throw new Error("Dữ liệu dòng thời gian không hợp lệ. Hãy tải lại.");
      }
      setProfilePosts((current) =>
        more
          ? data.reduce((items, post) => mergeById(items, post), current)
          : data,
      );
      setProfileHasMore(data.length === FEED_PAGE_SIZE);
    } catch (error) {
      if (
        sessionRef.current?.sessionId === sessionId &&
        sequence === profileLoadSequence.current
      ) {
        setProfilePostsError(
          error instanceof Error
            ? error.message
            : "Không tải được dòng thời gian. Hãy thử lại.",
        );
      }
    } finally {
      if (sequence === profileLoadSequence.current) {
        profilePagingBusy.current = false;
        if (sessionRef.current?.sessionId === sessionId)
          setProfilePostsBusy(false);
      }
    }
  }

  function closeProfileTimeline() {
    setProfileTimelineOpen(false);
    requestAnimationFrame(() => profileIdentityRef.current?.focus());
  }

  function logout(revoke = true, clearStorage = true) {
    responseCache.current.clear();
    setVisitorUsername(null);
    const current = sessionRef.current;
    const currentToken = current?.token;
    if (isDesktopBuild) {
      void desktopBridge()
        .auth.logout({ sessionId: current?.sessionId ?? null, revoke })
        .then((result) => {
          if (!result.revoked)
            setNotice(
              "Đã đăng xuất trên máy này. Chưa thu hồi được phiên trên server.",
              "warning",
            );
        })
        .catch(() =>
          setNotice(
            "Không xóa hoặc thu hồi được phiên an toàn. Hãy thu hồi thiết bị này từ một phiên khác.",
            "error",
          ),
        );
    } else if (revoke && current?.refreshToken) {
      void fetch(`${API}/api/auth/logout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: current.refreshToken }),
        keepalive: true,
      })
        .then((response) => {
          if (!response.ok) throw new Error("revocation failed");
        })
        .catch(() =>
          setNotice(
            "Đã đăng xuất trên máy này. Không kết nối được server để thu hồi phiên.",
            "warning",
          ),
        );
    }
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

    if (current?.user.id) {
      clearChatPersistence(current.user.id);
      clearChatOutbox(current.user.id);
    }
    chatOutboxRef.current = [];
    setChatOutbox([]);
    chatOutboxSession.current = "";
    sendingClientIDs.current.clear();
    pendingSend.current = null;
    if (clearStorage) localStorage.removeItem("chatnet-session");
    sessionRef.current = null;
    auth.resetRegistration();
    auth.setAuthMode("login");
    setSession(null);
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

  useEffect(() => {
    if (isDesktopBuild) {
      return desktopBridge().auth.onExpired((sessionId) => {
        if (sessionRef.current?.sessionId === sessionId) logout(false);
      });
    }
    const sync = (event: StorageEvent) => {
      if (event.key !== "chatnet-session" && event.key !== null) return;
      const next = loadSession();
      if (sessionRef.current?.sessionId !== next?.sessionId)
        logout(false, false);
      sessionRef.current = next;
      setSession(next);
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

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

  function saveConversationTranslationSettings(conversationId: number, settings: ChatTranslationSettings) {
    if (!session?.user.id || !Number.isSafeInteger(conversationId)) return false;
    const updated = { ...conversationTranslationOverrides, [conversationId]: settings };
    if (!persistConversationTranslationSettings(session.user.id, updated)) {
      setNotice('Không lưu được cài đặt dịch trên thiết bị này.', 'error');
      return false;
    }
    setConversationTranslationOverrides(updated);
    setTranslations({});
    setTranslationOriginals({});
    setManuallyTranslated({});
    setTranslationPending({});
    setTranslationFailures({});
    translationAttempted.current.clear();
    return true;
  }

  function changeAutoTranslate(next: boolean) {
    if (activeConversationId !== null && activeChatTranslationSettings) {
      saveConversationTranslationSettings(activeConversationId, { ...activeChatTranslationSettings, enabled: next });
      return;
    }
    setAutoTranslate(next);
    void saveTranslationPreferences(targetLanguage, next);
  }

  function changeTargetLanguage(next: string) {
    if (activeConversationId !== null && activeChatTranslationSettings) {
      saveConversationTranslationSettings(activeConversationId, { ...activeChatTranslationSettings, targetLanguage: next });
      setTranslationMenuOpen(false);
      setLanguageSearch('');
      return;
    }
    setTargetLanguage(next);
    setTranslations({});
    setTranslationOriginals({});
    setManuallyTranslated({});
    setTranslationPending({});
    setTranslationFailures({});
    translationAttempted.current.clear();
    setTranslationMenuOpen(false);
    setTranslationPickerOpen(false);
    setLanguageSearch("");
    setTranslationSettingsSearch("");
    void saveTranslationPreferences(next, autoTranslate);
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

  async function deliverQueuedChatMessage(item: QueuedChatMessage) {
    const identity = sessionRef.current;
    if (
      !identity ||
      chatOutboxSession.current !== identity.sessionId ||
      !navigator.onLine ||
      sendingClientIDs.current.has(item.clientId) ||
      !chatOutboxRef.current.some(
        (pending) =>
          pending.clientId === item.clientId &&
          pending.conversationId === item.conversationId &&
          pending.status !== "failed",
      )
    )
      return;
    sendingClientIDs.current.add(item.clientId);
    try {
      const response = await apiFetch(
        `/api/conversations/${item.conversationId}/messages`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: item.text,
            attachments: item.attachments,
            clientId: item.clientId,
            ...(item.channelId ? { channelId: item.channelId } : {}),
            ...(item.replyToMessageId
              ? { replyToMessageId: item.replyToMessageId }
              : {}),
          }),
        },
      );
      if (sessionRef.current?.sessionId !== identity.sessionId) return;
      if (!response.ok) {
        const permanent =
          response.status >= 400 &&
          response.status < 500 &&
          response.status !== 408 &&
          response.status !== 429;
        const error = permanent
          ? (
              (await response.json().catch(() => null)) as {
                error?: string;
              } | null
            )?.error
          : undefined;
        updateChatOutbox((items) =>
          items.map((pending) =>
            pending.clientId === item.clientId &&
            pending.conversationId === item.conversationId
              ? {
                  ...pending,
                  status: permanent ? "failed" : "unconfirmed",
                  error: permanent
                    ? error || "Không gửi được. Kiểm tra quyền hoặc nội dung."
                    : undefined,
                }
              : pending,
          ),
        );
        return;
      }
      const confirmed = (await response.json()) as Message;
      if (
        !Number.isSafeInteger(confirmed.id) ||
        confirmed.id <= 0 ||
        confirmed.clientId !== item.clientId ||
        confirmed.conversationId !== item.conversationId ||
        confirmed.senderId !== identity.user.id
      )
        throw new Error("Unexpected send receipt");
      updateChatOutbox((items) =>
        confirmChatMessage(items, item.clientId, item.conversationId),
      );
      if (activeConversationIdRef.current === item.conversationId &&
          activeChannelIdRef.current === (item.channelId || 0)) {
        messageChanges.current.add(confirmed.id);
        setMessages((current) =>
          mergeById(current, confirmed).sort((a, b) => a.id - b.id),
        );
      }
      void refreshConversations();
    } catch {
      if (sessionRef.current?.sessionId === identity.sessionId) {
        // The HTTP ACK might be lost after the database commit. Reuse the same clientId.
        updateChatOutbox((items) =>
          items.map((pending) =>
            pending.clientId === item.clientId &&
            pending.conversationId === item.conversationId
              ? { ...pending, status: "unconfirmed", error: undefined }
              : pending,
          ),
        );
      }
    } finally {
      sendingClientIDs.current.delete(item.clientId);
    }
  }

  async function retryQueuedChatMessages() {
    if (!navigator.onLine || retryOutboxBusy.current || !sessionRef.current)
      return;
    retryOutboxBusy.current = true;
    try {
      while (navigator.onLine) {
        const item = retryableChatMessages(chatOutboxRef.current)[0];
        if (!item) break;
        await deliverQueuedChatMessage(item);
        const remaining = chatOutboxRef.current.find(
          (pending) =>
            pending.clientId === item.clientId &&
            pending.conversationId === item.conversationId,
        );
        if (remaining && remaining.status !== "failed") break;
      }
    } finally {
      retryOutboxBusy.current = false;
    }
  }

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

  function sendMessage(event: FormEvent) {
    event.preventDefault();
    if (!canSend || !activeConversationId || sendingRef.current || !session)
      return;
    sendingRef.current = true;
    window.setTimeout(() => {
      sendingRef.current = false;
    }, 0);

    const conversationId = activeConversationId;
    const channelId = selectedChannelId;
    const draftKey = channelDraftKey;
    const submittedDraft = draft;
    const reply = replyingTo;
    const item: QueuedChatMessage = {
      ...(channelId > 0 ? { channelId } : {}),
      clientId: crypto.randomUUID(),
      conversationId,
      text: messageText.trim(),
      attachments: messageAttachments.map(attachmentRequestBody),
      ...(reply
        ? {
            replyToMessageId: reply.id,
            replyToSender: reply.sender,
            replyToText: reply.text,
          }
        : {}),
      createdAt: new Date().toISOString(),
      status: "queued",
    };
    const next = updateChatOutbox((items) => enqueueChatMessage(items, item));
    if (!next.some((pending) => pending.clientId === item.clientId)) {
      setNotice(
        "Hàng đợi tin nhắn đã đầy. Nội dung vẫn ở ô nhập; hãy thử lại sau.",
        "warning",
      );
      return;
    }
    ownSendScrollConversation.current = conversationId;
    if (channelId > 0) {
      setChannelDrafts(current => {
        if (current[draftKey] !== submittedDraft) return current;
        const next = { ...current };
        delete next[draftKey];
        return next;
      });
    } else {
      setMessageDrafts((current) => {
        if (current[conversationId] !== submittedDraft) return current;
        const updated = { ...current };
        delete updated[conversationId];
        return updated;
      });
    }
    setReplyingTo((current) => (current === reply ? null : current));
    if (navigator.onLine) void retryQueuedChatMessages();
    else setChatOnline(false);
  }

  async function editOwnMessage(message: Message) {
    const key = `message:${message.id}`;
    if (
      message.deleted ||
      message.senderId !== session?.user.id ||
      actionLocks.current.has(key)
    )
      return;
    const next = window.prompt("Sửa tin nhắn", message.text);
    if (next === null || next.trim() === message.text.trim()) return;
    if (!next.trim()) {
      setNotice("Tin nhắn sau khi sửa không được để trống.");
      return;
    }

    const sessionId = session?.sessionId;
    actionLocks.current.add(key);
    try {
      const response = await apiFetch(`/api/messages/${message.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: next.trim() }),
      });
      const result = (await response.json().catch(() => null)) as
        | Message
        | { error?: string }
        | null;
      if (sessionRef.current?.sessionId !== sessionId) return;
      if (
        !response.ok ||
        !result ||
        !("id" in result) ||
        result.id !== message.id ||
        typeof result.text !== "string"
      ) {
        setNotice(
          (result as { error?: string } | null)?.error ||
            "Không sửa được tin nhắn",
        );
        return;
      }
      const updated = result as Message;
      if (activeConversationIdRef.current !== message.conversationId) return;
      messageChanges.current.add(updated.id);
      setMessages((current) =>
        current.map((item) =>
          item.id === updated.id
            ? {
                ...item,
                text: updated.text,
                editedAt: updated.editedAt,
              }
            : item,
        ),
      );
      setTranslations((current) => {
        const nextTranslations = { ...current };
        delete nextTranslations[message.id];
        return nextTranslations;
      });
    } finally {
      if (sessionRef.current?.sessionId === sessionId)
        actionLocks.current.delete(key);
    }
  }

  async function recallOwnMessage(message: Message) {
    const key = `message:${message.id}`;
    if (
      message.deleted ||
      message.senderId !== session?.user.id ||
      actionLocks.current.has(key)
    )
      return;
    if (!window.confirm("Thu hồi tin nhắn này?")) return;
    const sessionId = session?.sessionId;
    actionLocks.current.add(key);
    try {
      const response = await apiFetch(`/api/messages/${message.id}`, {
        method: "DELETE",
      });
      const result = (await response.json().catch(() => null)) as
        | Message
        | { error?: string }
        | null;
      if (sessionRef.current?.sessionId !== sessionId) return;
      if (
        !response.ok ||
        !result ||
        !("id" in result) ||
        result.id !== message.id ||
        !result.deleted
      ) {
        setNotice(
          (result as { error?: string } | null)?.error ||
            "Không thu hồi được tin nhắn",
        );
        return;
      }
      const updated = result as Message;
      if (activeConversationIdRef.current !== message.conversationId) return;
      messageChanges.current.add(updated.id);
      setMessages((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
      setTranslations((current) => {
        const next = { ...current };
        delete next[message.id];
        return next;
      });
      setReplyingTo((current) => (current?.id === message.id ? null : current));
    } finally {
      if (sessionRef.current?.sessionId === sessionId)
        actionLocks.current.delete(key);
    }
  }

  async function toggleReaction(message: Message, emoji: string) {
    const key = `message:${message.id}`;
    if (message.deleted || actionLocks.current.has(key)) return;
    const sessionId = session?.sessionId;
    actionLocks.current.add(key);
    setReactionPreviews((current) => ({
      ...current,
      [message.id]: toggleMessageReactionCount(message.reactions || [], emoji),
    }));
    try {
      const response = await apiFetch(`/api/messages/${message.id}/reactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emoji }),
      });
      const result = (await response.json()) as Message & { error?: string };
      if (sessionRef.current?.sessionId !== sessionId) return;
      if (!response.ok || result.id !== message.id)
        throw new Error(result.error || "Không thả cảm xúc được");
      if (activeConversationIdRef.current === message.conversationId) {
        messageChanges.current.add(result.id);
        setMessages((current) =>
          current.map((item) =>
            item.id === result.id
              ? { ...item, reactions: result.reactions }
              : item,
          ),
        );
      }
    } catch (error) {
      if (sessionRef.current?.sessionId === sessionId)
        setNotice(
          error instanceof Error ? error.message : "Không thả cảm xúc được",
          "error",
        );
    } finally {
      if (sessionRef.current?.sessionId === sessionId) {
        actionLocks.current.delete(key);
        setReactionPreviews((current) => {
          const next = { ...current };
          delete next[message.id];
          return next;
        });
      }
    }
  }

  async function requestTranslation(text: string, messageId?: number, showError = true) {
    const response = await apiFetch("/api/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        target: effectiveTargetLanguage,
        ...(messageId ? { messageId } : {}),
      }),
    });
    const result = await response.json().catch(() => null);
    if (sessionRef.current?.sessionId !== session?.sessionId) return null;
    if (!response.ok || typeof result?.translatedText !== "string") {
      // A proxy or unavailable AI service may return HTML/empty text instead of JSON.
      // Do not leak message contents or provider credentials into diagnostics.
      console.warn("Translation request failed", {
        status: response.status,
        error: typeof result?.error === "string" ? result.error : "invalid response",
      });
      if (showError) {
        const serverError = typeof result?.error === "string" ? result.error : "";
        const message = /not configured|missing_ai_config/i.test(serverError)
          ? "Dịch vụ AI trên máy chủ chưa được cấu hình. Kiểm tra AI_API_KEY, AI_BASE_URL và AI_MODEL."
          : response.status === 401 || response.status === 403
            ? "Phiên đăng nhập hoặc quyền truy cập dịch AI không hợp lệ."
            : response.status === 429
              ? "Dịch vụ AI đang giới hạn yêu cầu (HTTP 429). Hãy thử lại sau."
              : response.status === 502 && /service unavailable/i.test(serverError)
                ? "Gateway không kết nối được đến dịch vụ translate (HTTP 502). Kiểm tra dịch vụ translate trên Railway."
                : response.status === 502 && /AI translation failed/i.test(serverError)
                  ? "Dịch vụ translate không nhận được bản dịch từ nhà cung cấp AI (HTTP 502). Kiểm tra log AI provider."
                  : response.status >= 500
                    ? `Dịch vụ AI hoặc backend không phản hồi (HTTP ${response.status}). Kiểm tra dịch vụ translate và nhà cung cấp AI.`
                    : response.status === 404
                  ? "Không tìm thấy tin nhắn hoặc API dịch AI (HTTP 404)."
                  : response.ok
                    ? "Dịch vụ AI trả dữ liệu không hợp lệ."
                    : `Không dịch được tin nhắn (HTTP ${response.status})${serverError ? `: ${serverError}` : "."}`;
        setNotice(message, "error");
      }
      return null;
    }
    return result as { translatedText: string };
  }

  async function translateMessage(message: Message, reveal = true) {
    if (message.deleted || !message.text.trim()) return;
    const sessionId = sessionRef.current?.sessionId;
    if (!sessionId) return;
    const language = effectiveTargetLanguage;
    const conversationId = activeConversationIdRef.current;
    const requestKey = `${sessionId}:${language}:${message.id}:${message.editedAt ?? ""}`;
    if (reveal) {
      setManuallyTranslated((current) => ({ ...current, [message.id]: true }));
    }
    if (translations[message.id] && !translationFailures[message.id]) return;
    if (translationInFlight.current.has(requestKey)) return;
    // An automatic failure must not re-trigger for every incoming event.
    // A manual retry remains available when translation fails.
    if (!reveal && translationAttempted.current.has(requestKey)) return;
    translationAttempted.current.add(requestKey);
    translationInFlight.current.add(requestKey);
    setTranslationPending((current) => ({ ...current, [message.id]: true }));
    setTranslationFailures((current) => ({ ...current, [message.id]: false }));
    try {
      const result = await requestTranslation(message.text, message.id, reveal);
      if (sessionRef.current?.sessionId !== sessionId ||
          translationLanguageRef.current !== language ||
          activeConversationIdRef.current !== conversationId) return;
      if (!result?.translatedText.trim()) {
        setTranslationFailures((current) => ({ ...current, [message.id]: true }));
        return;
      }
      setTranslations((current) => ({ ...current, [message.id]: result.translatedText }));
    } catch (error) {
      if (sessionRef.current?.sessionId === sessionId &&
          translationLanguageRef.current === language &&
          activeConversationIdRef.current === conversationId) {
        setTranslationFailures((current) => ({ ...current, [message.id]: true }));
        if (reveal) setNotice(
          error instanceof TypeError
            ? "Không kết nối được API dịch AI. Kiểm tra kết nối tới backend cloud."
            : error instanceof Error ? error.message : "Không dịch được tin nhắn",
          "error",
        );
      }
    } finally {
      translationInFlight.current.delete(requestKey);
      if (sessionRef.current?.sessionId === sessionId &&
          translationLanguageRef.current === language &&
          activeConversationIdRef.current === conversationId) {
        setTranslationPending((current) => ({ ...current, [message.id]: false }));
      }
    }
  }

  async function createPost(event: FormEvent) {
    event.preventDefault();
    if (
      !session ||
      actionLocks.current.has("feed:create") ||
      mediaUploading ||
      (!postText.trim() &&
        postAttachments.length === 0 &&
        !(feedCheckInOpen && feedCheckInLocation.trim()))
    )
      return;

    setPostSubmitError("");
    const locationText = feedCheckInOpen ? feedCheckInLocation.trim() : "";
    const content = [locationText ? `📍 ${locationText}` : "", postText.trim()]
      .filter(Boolean)
      .join("\n");
    const attachments = postAttachments;
    const visibility = postVisibility;
    const background = postBackground;
    const sessionId = session.sessionId;
    actionLocks.current.add("feed:create");
    ++feedRevision.current;
    setPendingPost({
      id: -1,
      author: name,
      authorDisplayName: session?.user.displayName,
      content,
      visibility,
      background,
      attachments,
      likes: 0,
      liked: false,
      comments: [],
      createdAt: new Date().toISOString(),
    });
    try {
      const response = await apiFetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content,
          attachments: attachments.map(attachmentRequestBody),
          visibility,
          background,
        }),
      });
      const post = (await response.json()) as Post & { error?: string };
      if (sessionRef.current?.sessionId !== sessionId) return;
      if (!response.ok || !Number.isSafeInteger(post.id) || post.id <= 0)
        throw new Error(post.error || "Không đăng được bài viết");
      setPosts((current) => [
        post,
        ...current.filter((item) => item.id !== post.id),
      ]);
      setProfilePosts((current) => [
        post,
        ...current.filter((item) => item.id !== post.id),
      ]);
      setPostText("");
      setPostAttachments([]);
      setPostBackground("");
      setShowPostBackgrounds(false);
      setProfileComposerOpen(false);
      setFeedComposerOpen(false);
      setFeedCheckInOpen(false);
      setFeedCheckInLocation("");
      setNotice("Đã đăng bài viết.", "success");
    } catch (error) {
      if (sessionRef.current?.sessionId === sessionId) {
        const message =
          error instanceof Error
            ? error.message
            : "Không đăng được bài viết. Bản nháp được giữ lại.";
        setPostSubmitError(message);
        setNotice(message, "error");
      }
    } finally {
      if (sessionRef.current?.sessionId === sessionId) {
        ++feedRevision.current;
        actionLocks.current.delete("feed:create");
        setPendingPost(null);
      }
    }
  }

  async function like(post: Post, emoji = "👍") {
    const key = `feed:like:${post.id}`;
    if (actionLocks.current.has(key)) return;
    const sessionId = session?.sessionId;
    actionLocks.current.add(key);
    ++feedRevision.current;
    setLikePreviews((current) => ({ ...current, [post.id]: (post.myReaction || (post.liked ? "👍" : "")) !== emoji }));
    try {
      const response = await apiFetch(`/api/posts/${post.id}/${emoji === "👍" ? "like" : "reactions"}`, {
        method: "POST",
        ...(emoji !== "👍" ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify({ emoji }) } : {}),
      });
      const updated = (await response.json()) as Post & { error?: string };
      if (sessionRef.current?.sessionId !== sessionId) return;
      if (
        !response.ok ||
        updated.id !== post.id ||
        typeof updated.liked !== "boolean" ||
        !Number.isFinite(updated.likes)
      ) {
        throw new Error(updated.error || "Không cập nhật được lượt thích.");
      }
      setPosts((current) =>
        current.map((item) =>
          item.id === updated.id
            ? { ...item, liked: updated.liked, likes: updated.likes, myReaction: updated.myReaction, reactions: updated.reactions }
            : item,
        ),
      );
      setSavedPosts((current) =>
        current.map((item) =>
          item.id === updated.id
            ? { ...item, liked: updated.liked, likes: updated.likes, myReaction: updated.myReaction, reactions: updated.reactions }
            : item,
        ),
      );
      setProfilePosts((current) =>
        current.map((item) =>
          item.id === updated.id
            ? { ...item, liked: updated.liked, likes: updated.likes, myReaction: updated.myReaction, reactions: updated.reactions }
            : item,
        ),
      );
      followingFeed.syncPost({
        ...post,
        liked: updated.liked,
        likes: updated.likes,
        myReaction: updated.myReaction,
        reactions: updated.reactions,
      });
      postSearch.syncPost({
        ...post,
        liked: updated.liked,
        likes: updated.likes,
        myReaction: updated.myReaction,
        reactions: updated.reactions,
      });
    } catch (error) {
      if (sessionRef.current?.sessionId === sessionId) void refreshPosts();
      if (sessionRef.current?.sessionId === sessionId)
        setNotice(
          error instanceof Error
            ? error.message
            : "Không cập nhật được lượt thích.",
          "error",
        );
    } finally {
      if (sessionRef.current?.sessionId === sessionId) {
        ++feedRevision.current;
        actionLocks.current.delete(key);
        setLikePreviews((current) => {
          const next = { ...current };
          delete next[post.id];
          return next;
        });
      }
    }
  }

  async function manageFeedComment(
    post: Post,
    commentId: number,
    method: "PATCH" | "DELETE",
    content?: string,
  ) {
    const response = await apiFetch(
      "/api/posts/" + post.id + "/comments/" + commentId,
      {
        method,
        ...(method === "PATCH"
          ? {
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ content }),
            }
          : {}),
      },
    );
    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      throw new Error(data.error || "Không cập nhật được bình luận");
    }
    const updated = (await response.json()) as Post;
    syncFeedPost(updated);
    setNotice(
      method === "PATCH" ? "Đã sửa bình luận." : "Đã xóa bình luận.",
      "success",
    );
  }
  async function reportFeedComment(commentId: number, reason: string) {
    const response = await apiFetch("/api/feed/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        targetType: "comment",
        targetId: commentId,
        reason,
      }),
    });
    if (!response.ok) throw new Error("Không thể gửi báo cáo bình luận.");
    setNotice("Đã gửi báo cáo bình luận.", "success");
  }

  async function addComment(post: Post, content: string, parentId?: number) {
    const sessionId = session?.sessionId;
    const key = `feed:comment:${post.id}`;
    if (actionLocks.current.has(key))
      throw new Error("Bình luận đang được gửi.");
    actionLocks.current.add(key);
    ++feedRevision.current;
    setPendingComments((current) => ({
      ...current,
      [post.id]: {
        id: -1,
        parentId,
        author: name,
        authorDisplayName: session?.user.displayName,
        content,
        createdAt: new Date().toISOString(),
      },
    }));
    try {
      const response = await apiFetch(`/api/posts/${post.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, parentId }),
      });
      if (!response.ok)
        throw new Error(
          "Chưa xác nhận được bình luận. Bản nháp được giữ lại; kiểm tra bài viết trước khi gửi lại.",
        );
      const updated = (await response.json()) as Post;
      if (sessionRef.current?.sessionId !== sessionId) return;
      if (updated.id !== post.id || !Array.isArray(updated.comments))
        throw new Error("Phản hồi không hợp lệ. Bản nháp được giữ lại.");
      setPosts((current) =>
        current.map((item) =>
          item.id === updated.id
            ? { ...item, comments: updated.comments }
            : item,
        ),
      );
      setSavedPosts((current) =>
        current.map((item) =>
          item.id === updated.id
            ? { ...item, comments: updated.comments }
            : item,
        ),
      );
      setProfilePosts((current) =>
        current.map((item) =>
          item.id === updated.id
            ? { ...item, comments: updated.comments }
            : item,
        ),
      );
      followingFeed.syncPost({ ...post, comments: updated.comments });
      postSearch.syncPost({ ...post, comments: updated.comments });
    } finally {
      if (sessionRef.current?.sessionId === sessionId) {
        ++feedRevision.current;
        actionLocks.current.delete(key);
        setPendingComments((current) => {
          const next = { ...current };
          delete next[post.id];
          return next;
        });
      }
    }
  }

  if (!session) return <AuthScreen {...auth} />;

  const unreadTotal = conversations.reduce(
    (sum, conversation) => sum + conversation.unreadCount,
    0,
  );
  const notificationItemCount = countNotificationItems(friendRequests, conversations);
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
  const switchTab = (nextTab: Tab, path: string = TAB_PATH[nextTab]) => {
    setFeedCommunitiesOpen(false);
    setTranslationSettingsConversationId(null);
    if (nextTab === "profile") setProfileEditorOpen(false);
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
    navigateTo(path);
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
      postComposerRef={postComposerRef}
      postBackground={postBackground}
      pendingPost={pendingPost}
      postText={postText}
      setPostText={setPostText}
      feedImageInputRef={feedImageInputRef}
      feedVideoInputRef={feedVideoInputRef}
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
      checkInOpen={feedComposerOpen && feedCheckInOpen}
      checkInLocation={feedCheckInLocation}
      setCheckInLocation={setFeedCheckInLocation}
    />
  );
  function openFeedPostDetails(id: number) {
    if (tab === "feed" && isProfileDesktop) {
      feedScrollBeforeComments.current = feedViewRef.current?.scrollTop ?? 0;
      const url = new URL(window.location.href);
      if (url.searchParams.get("post") !== String(id)) {
        url.searchParams.set("tab", "feed");
        url.searchParams.set("post", String(id));
        window.history.pushState({ ...window.history.state, postId: id }, "", url);
      }
    }
    setActivePostId(id);
  }

  function closeFeedPostDetails() {
    setActivePostId(null);
    const url = new URL(window.location.href);
    if (url.searchParams.has("post")) {
      url.searchParams.delete("post");
      window.history.replaceState(window.history.state, "", url);
    }
  }

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
      />
    ));

  async function openBlockedFriendConversation(userId: number) {
    let direct = conversations.find((item) => item.type === 'direct' && item.otherUserId === userId);
    if (!direct) {
      const username = friends.find((item) => item.id === userId)?.username;
      if (username) {
        try {
          // The chat may be on a later page of the paginated conversation list.
          const response = await apiFetch(`/api/conversations?type=direct&q=${encodeURIComponent(username)}&limit=100`, { cache: 'no-store' });
          if (response.ok) {
            const data = (await response.json()) as Conversation[];
            direct = data.find((item) => item.type === 'direct' && item.otherUserId === userId);
            if (direct) {
              const found = direct;
              setConversations((current) => [found, ...current.filter((item) => item.id !== found.id)]);
            }
          }
        } catch {
          // A connectivity problem must not remove the contact from the directory.
        }
      }
    }
    if (!direct) {
      setNotice('Chưa tìm thấy hội thoại cũ để mở.', 'warning');
      return;
    }
    setDesktopSection(null);
    setActiveConversationId(direct.id);
    setTab('chat');
  }

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
        onCalls={() => switchTab("chat", ROUTE.calls)}
        onSaved={() => {
          switchTab("feed");
          setFeedFilter("saved");
          void loadSavedPosts();
        }}
        onSettings={() => {
          switchTab("profile", ROUTE.settings);
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
          onPostOpen={(post) => {
            setPosts((current) => [
              post,
              ...current.filter((item) => item.id !== post.id),
            ]);
            setActivePostId(post.id);
          }}
          onUpdated={syncFeedPost}
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
    >

      {pushPrompt && !pushPromptDismissed && !pushEnabled && (
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
            onClick={() => setNoticeState(null)}
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
          openVisitor={openVisitor}
          setActiveConversationId={setActiveConversationId}
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
          like={like}
          likePreviews={likePreviews}
          name={name}
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
          apiFetch={apiFetch}
          conversationLoadingMore={conversationLoadingMore}
          conversations={conversations}
          createStory={createStory}
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
          postComposer={postComposer}
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

      {feedComposerOpen && tab === "feed" && isProfileDesktop && (
          <FeedComposerOverlay
          mediaUploading={mediaUploading}
          pendingPost={pendingPost}
          postComposer={postComposer}
          setFeedCheckInOpen={setFeedCheckInOpen}
          setFeedComposerOpen={setFeedComposerOpen}
        />
        )}
      {profileComposerOpen &&
        tab === "profile" &&
        (profileTimelineOpen || desktopProfileOverview) && (
          <ProfileOverlay
            title="Tạo bài viết"
            busy={!!pendingPost || mediaUploading === "feed"}
            onClose={() => setProfileComposerOpen(false)}
          >
            {postComposer}
          </ProfileOverlay>
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
        onCalls={() => switchTab("chat", ROUTE.calls)}
        callsActive={tab === "chat" && desktopSection === "calls"}
        unreadTotal={unreadTotal}
        pushEnabled={pushEnabled}
      />
    </AppLayout>
  );
}