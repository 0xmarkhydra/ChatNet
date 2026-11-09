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
import BottomNavigation from "./BottomNavigation";
import AppSidebar from "./AppSidebar";
import { countNotificationItems, formatNotificationBadge } from "./notification-count";
import NotificationsPage from "./NotificationsPage";
import ConversationDetailsPanel from "./ConversationDetailsPanel";
import ChatTranslationSettingsPage from './ChatTranslationSettingsPage';
import {
  readConversationTranslationSettings,
  persistConversationTranslationSettings,
  type ChatTranslationSettings,
  type ConversationTranslationSettingsMap,
} from '../features/chat/conversationTranslationSettings';
import ProfilePage from "./ProfilePage";
import ProfileEditorPage from "./ProfileEditorPage";
import SettingsWorkspace from "./SettingsWorkspace";
import SocialFeedComposer from "./SocialFeedComposer";
import SocialFeedSidebar from "./SocialFeedSidebar";
import SocialFeedStories from "./SocialFeedStories";
import PostCommentsPage from "./PostCommentsPage";
import CommunicationHub from "./CommunicationHub";
import CallCenter from "../features/calls/CallCenter";
import CommunityGroupsPage, { type GroupWorkspaceMode } from "./CommunityGroupsPage";
import CommunityGroupWizard, { type CommunityCreationExtras } from "./CommunityGroupWizard";
import GroupSettingsPanel from "../features/chat/GroupSettingsPanel";
import GroupRenameDialog from "../features/chat/GroupRenameDialog";
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
  Bell,
  Check,
  Images,
  Languages,
  LoaderCircle,
  ChevronDown,
  Plus,
  LogOut,
  MessageCircle,
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
} from "../chatOutbox";
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
const Marketplace = lazy(() => import("../Marketplace"));
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

  const [tab, setTab] = useState<Tab>("chat");
  const tabRef = useRef(tab);
  tabRef.current = tab;
  const [globalSearch, setGlobalSearch] = useState("");
  const [chatListQuery, setChatListQuery] = useState('');
  const [chatListFilter, setChatListFilter] = useState<'all' | 'unread' | 'groups'>('all');
  const [quickSearchOpen, setQuickSearchOpen] = useState(false);
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
  const [groupNameEditing, setGroupNameEditing] = useState(false);
  const [groupMemberViewOpen, setGroupMemberViewOpen] = useState(false);
  const activeConversationIdRef = useRef<number | null>(null);
  const messagesScrollRef = useRef<HTMLDivElement>(null);
  const messageScrollAtBottom = useRef(true);
  const ownSendScrollConversation = useRef<number | null>(null);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [messageActionId, setMessageActionId] = useState<number | null>(null);
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
  const draft = messageDrafts[activeConversationId ?? 0] ?? emptyDraft;
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
  const [contactsScreen, setContactsScreen] = useState<FriendsScreen>("directory");
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
  const [groupWorkspaceMode, setGroupWorkspaceMode] = useState<GroupWorkspaceMode>("list");
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
  const [desktopProfileSettings, setDesktopProfileSettings] = useState(false);
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
  const messageInputRef = useRef<HTMLInputElement>(null);
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
    setPendingActions,
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
    groupNameDraft,
    setGroupNameDraft,
    groupInviteSearch,
    setGroupInviteSearch,
    groupInviteSelection,
    setGroupInviteSelection,
    groupBusy,
    setGroupBusy,
    activeGroupMember,
    canManageActiveGroup,
    canInviteActiveGroup,
    canEditActiveGroup,
    groupInviteCandidates,
    openGroupSettings,
    launchGroupCall,
    refreshGroupMembers,
    renameActiveGroup,
    inviteGroupMembers,
    changeGroupMemberRole,
    removeGroupMember,
  } = useGroupManagement({
    session,
    sessionRef,
    tab,
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
        !groupNameEditing &&
        !document.querySelector("dialog[open]")
      )
        setGroupSettingsOpen(false);
    };
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, [groupSettingsOpen, groupNameEditing, setGroupSettingsOpen]);

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
      target.scrollIntoView({ block: "center", behavior: "smooth" });
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
  const groupActivities = useGroupActivities(activeConversation?.type === 'group' ? activeConversation.id : null, session?.sessionId, apiFetch);
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
  const visibleMessages = messages.map((message) =>
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
  const selectedConversationLanguage =
    languageOptions.find(language => language.value === effectiveTargetLanguage) || selectedLanguage;
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
    setMessageActionId(message.id);
    navigator.vibrate?.(24);
  }

  function beginMessageLongPress(
    message: Message,
    x: number,
    y: number,
    button: number,
    target: EventTarget | null,
  ) {
    if (message.deleted || button !== 0) return;
    const element =
      target instanceof Element
        ? target
        : target instanceof Node
          ? target.parentElement
          : null;
    if (element?.closest("button,input,textarea,select,video,audio")) return;
    // Long-press on a link or an image should offer the same chat copy action.
    if (
      element?.closest("a") &&
      !element.closest("a.message-inline-link, .media-item")
    )
      return;
    // Keep native selection when long-pressing ordinary message text.
    if (
      element?.closest(".message-selectable-text") &&
      !element.closest("a.message-inline-link")
    )
      return;
    cancelMessageLongPress();
    messageLongPressStart.current = { x, y, messageId: message.id };
    messageLongPressTimer.current = window.setTimeout(() => {
      if (messageLongPressStart.current?.messageId === message.id)
        openMessageActions(message, target);
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
    setMessageActionId(null);
    setConversationActionId(null);
    setPinnedExpanded(false);
    setMessages([]);
    setHasMoreMessages(false);
    setMessagesLoadingMore(false);
    messagesPagingBusy.current = false;
    setReplyingTo(null);
    setGroupSettingsOpen(false);
    setGroupNameEditing(false);
    setGroupMemberViewOpen(false);
    setSharedContentOpen(false);
    setGroupMembers([]);
    setGroupInviteSearch("");
    setGroupInviteSelection([]);
  }, [activeConversationId]);

  function setMessageText(text: string) {
    if (!activeConversationId) return;
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

  useEffect(() => {
    if (!activeStory) {
      if (activeStoryId !== null) setActiveStoryId(null);
      return;
    }
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setActiveStoryId(null);
      if (event.key === "ArrowLeft") previousStory();
      if (event.key === "ArrowRight") nextStory();
    };
    window.addEventListener("keydown", handleKey);
    const timer =
      activeStory.attachment.kind === "image"
        ? window.setTimeout(nextStory, 7000)
        : undefined;
    return () => {
      window.removeEventListener("keydown", handleKey);
      if (timer) window.clearTimeout(timer);
    };
  }, [activeStory?.id, activeStoryId, stories.length]);

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
              url: ticket.downloadUrl,
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

  function nextStory() {
    const next = stories[activeStoryIndex + 1];
    setActiveStoryId(next?.id ?? null);
  }

  function previousStory() {
    const previous = stories[activeStoryIndex - 1];
    if (previous) setActiveStoryId(previous.id);
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

    const params = new URLSearchParams(window.location.search);
    if (params.get("tab") === "feed") {
      setTab("feed");
    } else if (params.get("tab") === "contacts") {
      setTab("contacts");
    }
    const conversationID = Number(params.get("conversation"));
    if (Number.isInteger(conversationID) && conversationID > 0) {
      setTab("chat");
      setActiveConversationId(conversationID);
    }
    if (params.has("tab") || params.has("conversation")) {
      window.history.replaceState({}, "", window.location.pathname);
    }
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
      if (friend.username) await openDirectByUsername(friend.username);
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
      setFriends((old) => old.filter((item) => item.id !== friend.id));
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
        old.filter((item) => item.otherUserId !== friend.id),
      );
      const currentConversation = conversations.find(
        (item) => item.id === activeConversationId,
      );
      if (currentConversation?.otherUserId === friend.id)
        setActiveConversationId(null);
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
      newChatMode === "friends" ||
      newChatMode === "group" ||
      chatFriend
    ) {
      void refreshFriendConnections();
    }
  }, [session?.token, tab, newChatMode, chatFriend?.id]);

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
  }, [friendQuery, friendSearchRetry, newChatMode, session?.token, tab]);

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
    setPendingActions(0);
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

  const canSend = useMemo(
    () =>
      Boolean(
        activeConversationId &&
        !mediaUploading &&
        !messageSending &&
        (messageText.trim() || messageAttachments.length > 0),
      ),
    [
      activeConversationId,
      messageText,
      messageAttachments.length,
      mediaUploading,
      messageSending,
    ],
  );

  async function openDirectByUsername(username: string, mediaType?: "audio" | "video") {
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
      if (desktopSection === "groups" && groupWorkspaceMode === "create") {
        setGroupWorkspaceMode("channel");
      }
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
      if (activeConversationIdRef.current === item.conversationId) {
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
    const submittedDraft = draft;
    const reply = replyingTo;
    const item: QueuedChatMessage = {
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
    setMessageDrafts((current) => {
      if (current[conversationId] !== submittedDraft) return current;
      const updated = { ...current };
      delete updated[conversationId];
      return updated;
    });
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

  async function requestTranslation(text: string, messageId?: number) {
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
      setNotice(result?.error || "AI dịch thất bại");
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
      const result = await requestTranslation(message.text, message.id);
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
        setNotice(error instanceof Error ? error.message : "Không dịch được tin nhắn", "error");
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
  const switchTab = (nextTab: Tab) => {
    setDesktopSection(null);
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

  return (
    <main
      className={`app-shell modern-shell app-layout ${tab === "contacts" || tab === "notifications" ? "friends-layout-active" : ""} ${tab === "chat" && activeConversation && !desktopSection ? "conversation-open" : ""}`}
    >
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
        onGroups={() => {
          switchTab("chat");
          setDesktopSection("groups");
          setGroupWorkspaceMode("list");
        }}
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
      {qrOpen && (
        <Suspense fallback={<div role="status">Đang mở QR...</div>}>
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
      {groupNameEditing &&
        activeConversation?.type === "group" &&
        canEditActiveGroup && (
          <GroupRenameDialog
            key={activeConversation.id}
            currentName={activeConversation.name}
            draft={groupNameDraft}
            onDraftChange={setGroupNameDraft}
            onConfirm={renameActiveGroup}
            onClose={() => {
              setGroupNameEditing(false);
              setGroupNameDraft(activeConversation.name);
            }}
            busy={groupBusy}
          />
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
      <header
        className={`chatnet-appbar ${tab === "chat" && desktopSection === null && translationSettingsConversationId === null ? "mobile-chat-appbar" : ""} ${tab === "profile" ? "app-section-header" : tab === "discover" || tab === "market" ? "app-section-header app-header-no-search" : ""}`}
      >
        <div className="app-page-heading">
          <strong>
            {tab === "chat" && translationSettingsConversationId !== null
              ? "Ngôn ngữ & dịch AI"
              : tab === "chat" && desktopSection === "groups"
                ? groupWorkspaceMode === "create" ? groupCreateStep === 1 ? "Tạo cộng đồng mới" : "Tạo nhóm mới" : groupWorkspaceMode === "manage" ? "Quản trị nhóm" : groupWorkspaceMode === "channel" ? activeConversation?.name || "Kênh trò chuyện nhóm" : "Nhóm & cộng đồng"
              : tab === "chat" && desktopSection === "calls"
                ? "Cuộc gọi"
                : (
                    {
                      chat: "Tin nhắn",
                      contacts: contactsScreen === "directory" ? "Danh bạ" : "Lời mời kết bạn",
                      notifications: "Thông báo",
                      discover: "Khám phá",
                      market: "Marketplace",
                      feed: isProfileDesktop && activePost ? "Bình luận" : "Bảng tin",
                      profile:
                        desktopProfileSettings && isProfileDesktop
                          ? "Cài đặt"
                          : desktopProfileOverview && profileEditorOpen
                            ? "Chỉnh sửa hồ sơ"
                            : "Hồ sơ cá nhân",
                    } as Record<Tab, string>
                  )[tab]}
          </strong>
          <small>
            {
              (
                {
                  chat: translationSettingsConversationId !== null
                    ? "Chọn ngôn ngữ và quyền dịch của cuộc trò chuyện"
                    : desktopSection === "groups" ? (groupWorkspaceMode === "create" ? groupCreateStep === 1 ? "Thiết lập không gian riêng cho nhóm" : "Bước " + groupCreateStep + "/3 · Chọn thành viên và xác nhận" : groupWorkspaceMode === "manage" ? "Phân quyền, thành viên và cài đặt cộng đồng" : groupWorkspaceMode === "channel" ? "Kênh và trò chuyện nhóm" : "Quản lý các nhóm của bạn") : "Trò chuyện gần đây và kết nối bạn bè",
                  contacts: contactsScreen === "directory" ? "Tìm kiếm và kết nối với bạn bè" : "Gửi, nhận và quản lý yêu cầu kết nối",
                  notifications: "Cập nhật những hoạt động quan trọng",
                  discover: "Khám phá và kết nối cộng đồng",
                  market: "Khám phá sản phẩm và cửa hàng",
                  feed: isProfileDesktop && activePost ? "Tương tác với mọi người trong cộng đồng" : "Khoảnh khắc và cộng đồng dành cho bạn",
                  profile: desktopProfileSettings
                    ? "Cài đặt tài khoản và quyền riêng tư"
                    : desktopProfileOverview && profileEditorOpen
                      ? "Thông tin cá nhân và quyền hiển thị"
                      : "Trang cá nhân, bài viết và thông tin của bạn",
                } as Record<Tab, string>
              )[tab]
            }
          </small>
        </div>
        <div className="appbar-brand">
          <img src="/soco-mark.svg" width="32" height="32" alt="" />
          <strong>SocCO</strong>
        </div>
        <div className="appbar-search-anchor" ref={quickSearchAnchorRef}>
          <label className="appbar-search">
            <UiIcon name="search" size={27} />
            <input
              value={tab === "contacts" ? friendQuery : globalSearch}
              maxLength={tab === "feed" || tab === "chat" ? 120 : undefined}
              type="search"
              onKeyDown={(event) => {
                if (tab === "chat" && event.key === "Escape") {
                  event.preventDefault();
                  event.stopPropagation();
                  setQuickSearchOpen(false);
                }
              }}
              aria-expanded={
                tab === "chat" && conversationSearching && quickSearchOpen
              }
              aria-controls={
                tab === "chat" ? "chat-quick-search-results" : undefined
              }
              onFocus={() => {
                if (tab === "chat" && globalSearch.trim())
                  setQuickSearchOpen(true);
              }}
              onClick={() => {
                if (tab === "chat" && globalSearch.trim())
                  setQuickSearchOpen(true);
              }}
              onChange={(event) => {
                if (tab === "contacts") setFriendQuery(event.target.value);
                else if (tab === "profile") {
                  setFeedFilter("all");
                  setGlobalSearch(event.target.value);
                  setTab("feed");
                } else {
                  setGlobalSearch(event.target.value);
                  if (tab === "chat")
                    setQuickSearchOpen(Boolean(event.target.value.trim()));
                }
              }}
              placeholder={
                tab === "notifications"
                  ? "Tìm kiếm thông báo..."
                  : tab === "contacts"
                  ? "Tên, @username hoặc email"
                  : tab === "profile"
                    ? "Tìm kiếm trên SocCo..."
                    : tab === "feed"
                      ? "Tìm tác giả hoặc nội dung bài viết"
                      : "Tìm liên hệ, tin nhắn, file"
              }
              aria-label={
                tab === "notifications"
                  ? "Tìm thông báo..."
                  : tab === "contacts"
                  ? "Tìm bạn bằng tên, username hoặc email"
                  : tab === "profile"
                    ? "Tìm bài viết trên SocCo"
                    : tab === "feed"
                      ? "Tìm bài viết"
                      : "Tìm cuộc trò chuyện"
              }
            />
          </label>
          {tab === "chat" && conversationSearching && quickSearchOpen && (
            <ChatQuickSearch
              results={chatQuickSearch.results}
              loading={chatQuickSearch.loading}
              error={chatQuickSearch.error}
              onRetry={chatQuickSearch.retry}
              onClose={() => setQuickSearchOpen(false)}
              onContact={openChatQuickContact}
              onHit={openChatQuickHit}
            />
          )}
        </div>
        <div className="appbar-actions">
          {tab === "chat" && (
            <>
              {desktopSection === "groups" && <button type="button" className="appbar-icon-button notification-appbar" aria-label="Mở thông báo" onClick={() => switchTab("notifications")}>
                <Bell size={22} aria-hidden="true" />
                {notificationItemCount > 0 && <span className="appbar-badge appbar-badge-count" aria-hidden="true">{notificationBadgeText}</span>}
              </button>}
              {desktopSection !== "groups" && <button
                className="appbar-icon-button"
                type="button"
                aria-label="Quét QR"
                onClick={() => setQrOpen("scan")}
              >
                <UiIcon name="qr" size={28} />
              </button>}
              <div className="appbar-create-anchor">
                <button
                  className={
                    quickCreateOpen
                      ? "appbar-icon-button appbar-create-trigger active"
                      : "appbar-icon-button appbar-create-trigger"
                  }
                  type="button"
                  aria-label={desktopSection === "groups" ? "Tạo cộng đồng mới" : "Tạo mới"}
                  aria-expanded={desktopSection === "groups" ? false : quickCreateOpen}
                  aria-haspopup={desktopSection === "groups" ? undefined : "menu"}
                  onClick={() => { if (desktopSection === "groups") { setChatCreateError(""); setGroupCreateStep(1); setGroupWorkspaceMode("create"); setQuickCreateOpen(false); } else setQuickCreateOpen((current) => !current); }}
                >
                  <UiIcon name="plus" size={29} />
                </button>
                {quickCreateOpen && desktopSection !== "groups" && (
                  <>
                    <button
                      type="button"
                      className="quick-create-dismiss"
                      aria-label="Đóng menu tạo mới"
                      onClick={() => setQuickCreateOpen(false)}
                    />
                    <div
                      className="quick-create-menu"
                      role="menu"
                      aria-label="Tạo cuộc trò chuyện mới"
                    >
                      <div className="quick-create-caption">TẠO MỚI</div>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => openConnectSurface()}
                      >
                        <span className="quick-create-symbol">
                          <Search size={19} aria-hidden="true" />
                        </span>
                        <div>
                          <strong>Tìm & kết nối</strong>
                          <small>Tìm bạn bè bằng tên hoặc @username</small>
                        </div>
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setNewChatMode("direct");
                          setQuickCreateOpen(false);
                        }}
                      >
                        <span className="quick-create-symbol">
                          <MessageCircle size={19} aria-hidden="true" />
                        </span>
                        <div>
                          <strong>Chat riêng</strong>
                          <small>Bắt đầu cuộc trò chuyện 1-1</small>
                        </div>
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setFriendQuery("");
                          setChatCreateError("");
                          setNewChatMode("group");
                          setQuickCreateOpen(false);
                        }}
                      >
                        <span className="quick-create-symbol">
                          <Users size={19} aria-hidden="true" />
                        </span>
                        <div>
                          <strong>Tạo nhóm</strong>
                          <small>Trò chuyện cùng nhiều người</small>
                        </div>
                      </button>
                    </div>
                  </>
                )}
              </div>
              {desktopSection === "groups" && <button type="button" className="social-feed-header-account" aria-label="Mở trang cá nhân" onClick={() => switchTab("profile")}>
                <UserAvatar username={name} name={userLabel(profileMedia?.displayName || session.user.displayName, name)} className="social-feed-header-avatar"/>
              </button>}
            </>
          )}

          {tab === "feed" && (
            <>
              <button
                className="appbar-icon-button social-feed-header-new"
                type="button"
                aria-label="Tạo bài viết"
                onClick={() => {
                  if (isProfileDesktop) {
                    setFeedCheckInOpen(false);
                    setFeedComposerOpen(true);
                  } else {
                    postComposerRef.current?.focus();
                    postComposerRef.current?.scrollIntoView({
                      behavior: "smooth",
                      block: "center",
                    });
                  }
                }}
              >
                <UiIcon name="compose" size={24} />
              </button>
              <button
                className="appbar-icon-button notification-appbar"
                type="button"
                aria-label="Mở thông báo"
                onClick={() => switchTab("notifications")}
              >
                <UiIcon name="bell" size={27} />
                {notificationItemCount > 0 && (
                  <span className="appbar-badge appbar-badge-count" aria-hidden="true">{notificationBadgeText}</span>
                )}
              </button>
              <button
                className="social-feed-header-account"
                type="button"
                aria-label="Mở trang cá nhân"
                onClick={() => switchTab("profile")}
              >
                <UserAvatar
                  username={name}
                  name={userLabel(
                    profileMedia?.displayName || session.user.displayName,
                    name,
                  )}
                  className="social-feed-header-avatar"
                />
              </button>
            </>
          )}

          {tab === "profile" && (
            <>
              <button
                className="appbar-icon-button notification-appbar"
                type="button"
                aria-label="Mở thông báo"
                onClick={() => switchTab("notifications")}
              >
                <Bell size={21} aria-hidden="true" />
                {notificationItemCount > 0 && (
                  <span className="appbar-badge appbar-badge-count" aria-hidden="true">{notificationBadgeText}</span>
                )}
              </button>
              <button
                className="appbar-icon-button profile-page-header-new"
                type="button"
                aria-label="Tạo bài viết"
                onClick={() => {
                  setDesktopProfileSettings(false);
                  setProfileComposerOpen(true);
                }}
              >
                <PencilLine size={21} aria-hidden="true" />
              </button>
              <button
                className="profile-page-header-account"
                type="button"
                aria-label="Mở cài đặt tài khoản"
                onClick={() => {
                  setDesktopProfileSettings(true);
                  setProfileTimelineOpen(false);
                }}
              >
                <UserAvatar
                  username={name}
                  name={userLabel(
                    profileMedia?.displayName || session.user.displayName,
                    name,
                  )}
                  className="profile-page-header-avatar"
                />
              </button>
            </>
          )}

          {tab === "notifications" && (
            <>
              <button
                className="appbar-icon-button notification-appbar"
                type="button"
                aria-label="Trang Thông báo"
                aria-current="page"
              >
                <Bell size={22} aria-hidden="true" />
                {notificationItemCount > 0 && (
                  <span className="appbar-badge appbar-badge-count" aria-hidden="true">{notificationBadgeText}</span>
                )}
              </button>
              <button
                className="appbar-icon-button"
                type="button"
                aria-label="Tạo bài viết mới"
                onClick={() => {
                  switchTab("feed");
                  setFeedComposerOpen(true);
                }}
              >
                <UiIcon name="plus" size={31} />
              </button>
              <button
                className="social-feed-header-account"
                type="button"
                aria-label="Mở trang cá nhân"
                onClick={() => switchTab("profile")}
              >
                <UserAvatar username={name}
                  name={userLabel(profileMedia?.displayName || session.user.displayName, name)}
                  className="social-feed-header-avatar" />
              </button>
            </>
          )}

          {tab === "contacts" && (
            <>
              <button
                className="appbar-icon-button notification-appbar"
                type="button"
                aria-label="Mở trang Thông báo"
                title="Thông báo"
                onClick={() => switchTab("notifications")}
              >
                <Bell size={22} aria-hidden="true" />
                {notificationItemCount > 0 && (
                  <span className="appbar-badge appbar-badge-count" aria-hidden="true">{notificationBadgeText}</span>
                )}
              </button>
              <button
                className="appbar-icon-button"
                type="button"
                aria-label="Thêm bạn"
                onClick={() => {
                  setTab("chat");
                  setNewChatMode("friends");
                }}
              >
                <UiIcon name="plus" size={31} />
              </button>
            </>
          )}
        </div>
      </header>

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
          <div className={`messenger-layout modern-messenger social-chat-layout ${activeConversation ? 'has-active' : ''}${conversationDetailsOpen ? ' details-open' : ''}${groupSettingsOpen && activeConversation?.type === 'group' ? ' group-sidebar-open' : ''}`}>
            <aside className="conversation-sidebar social-chat-list" aria-label="Danh sách cuộc trò chuyện">
              <div className="social-chat-list-header">
                <div className="social-chat-list-title">
                  <h2>Cuộc trò chuyện</h2>
                  <button type="button" className="social-chat-groups-link" aria-label="Nhóm và cộng đồng" title="Nhóm và cộng đồng" onClick={() => { switchTab("chat"); setDesktopSection("groups"); setGroupWorkspaceMode("list"); }}>
                    <Users size={20} aria-hidden="true" />
                  </button>
                  <button type="button" className="social-chat-new" aria-label="Tạo cuộc trò chuyện mới"
                    title="Tạo cuộc trò chuyện" onClick={() => { setChatCreateError(''); setNewChatMode('direct') }}>
                    <Plus size={20} aria-hidden="true" />
                  </button>
                </div>
                <label className="social-chat-list-search">
                  <Search size={19} aria-hidden="true" />
                  <input type="search" value={chatListQuery} onChange={(event) => setChatListQuery(event.target.value)}
                    maxLength={120} placeholder="Tìm cuộc trò chuyện hoặc tin nhắn..."
                    aria-label="Tìm kiếm toàn bộ cuộc trò chuyện" />
                </label>
                <div className="social-chat-list-filters" role="group" aria-label="Lọc cuộc trò chuyện">
                  {([{ key: 'all', label: 'Tất cả' }, { key: 'unread', label: 'Chưa đọc' }, { key: 'groups', label: 'Nhóm' }] as const).map((filter) => (
                    <button key={filter.key} type="button" aria-pressed={chatListFilter === filter.key}
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
                chatDragDepth.current += 1
                if (!chatDragActive) setChatDragActive(true)
              }}
              onDragOver={(event) => {
                if (!transferHasFiles(event.dataTransfer)) return
                event.preventDefault()
                event.dataTransfer.dropEffect = 'copy'
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
                void addChatFiles(Array.from(event.dataTransfer.files))
              }}
              className={`conversation-panel${activeConversation?.type === 'group'
                ? ' group-chat-panel'
                : ''}${chatDragActive ? ' chat-file-drag-active' : ''}`}>
              {chatDragActive && activeConversationId && (
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
                        online={activeConversation.type === 'direct' && activeConversation.online}
                      />
                      <div className={activeConversation.type === 'group' ? 'group-room-details' : ''}>
                        {activeConversation.type === 'group' ? (
                          <>
                            <div className="group-room-title">
                                <strong title={activeConversation.name}>{activeConversation.name}</strong>
                                {canEditActiveGroup && (
                                  <button type="button" className="group-room-edit"
                                    aria-label="Chỉnh sửa tên nhóm" title="Chỉnh sửa tên nhóm"
                                    onClick={() => {
                                      setGroupNameDraft(activeConversation.name)
                                      setGroupNameEditing(true)
                                    }}>
                                    <PencilLine size={16} aria-hidden="true" />
                                  </button>
                                )}
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
                              {activeConversation.online ? '● Đang hoạt động' : 'Chat riêng'}
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
                        <CallHeaderActions conversationId={activeConversation.id} />
                        <button type="button" className="group-more-trigger"
                          aria-label="Tìm tin nhắn trong cuộc trò chuyện"
                          onClick={() => setMessageSearchOpen(true)}>
                          <Search size={20} aria-hidden="true" />
                        </button>
                        <button type="button" className="group-more-trigger"
                          aria-label="Thông tin hội thoại" aria-controls="conversation-details-panel"
                          aria-expanded={conversationDetailsOpen}
                          onClick={() => { setGroupSettingsOpen(false); setConversationDetailsOpen((open) => !open) }}>
                          <MoreHorizontal size={23} aria-hidden="true" />
                        </button>
                      </div>
                    )}

                    <div className="translate-controls">
                      <CallHeaderActions conversationId={activeConversation.id} />
                      <button type="button" className="group-settings-toggle" onClick={() => setMessageSearchOpen(true)} title="Tìm trong cuộc trò chuyện" aria-label="Tìm tin nhắn trong cuộc trò chuyện"><Search size={19} /></button>
                      <button type="button" className={conversationDetailsOpen ? 'group-settings-toggle active' : 'group-settings-toggle'}
                        onClick={() => { setGroupSettingsOpen(false); setConversationDetailsOpen((open) => !open) }}
                        title="Thông tin hội thoại" aria-label="Thông tin hội thoại"
                        aria-controls="conversation-details-panel" aria-expanded={conversationDetailsOpen}>
                        <MoreHorizontal size={22} aria-hidden="true" />
                      </button>
                      <div className="translation-hub">
                        <button
                          type="button"
                          className={autoTranslate ? 'translation-hub-trigger active' : 'translation-hub-trigger'}
                          aria-expanded={translationMenuOpen}
                          aria-controls="chat-translation-dialog"
                          aria-label="Cài đặt dịch AI"
                          onClick={() => {
                            setTranslationMenuOpen((current) => {
                              const next = !current
                              if (next) setLanguageSearch('')
                              return next
                            })
                          }}
                        >
                          <span className="translation-hub-flag" aria-hidden="true">{selectedLanguage?.flag || '🌐'}</span>
                          <span className="translation-hub-spark" aria-hidden="true">✦</span>
                          <b>AI</b>
                          <span className="translation-hub-dot" aria-hidden="true">·</span>
                          <strong>{selectedLanguage?.code || targetLanguage.toUpperCase()}</strong>
                          <span className="translation-hub-chevron" aria-hidden="true">{translationMenuOpen ? '⌃' : '⌄'}</span>
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
                    </div>
                  </header>

                  {pinnedMessages.length > 0 && (
                    <div className="chat-pinned-panel" role="region" aria-label="Tin nhắn đã ghim">
                      <div className="chat-pinned-heading">
                        <Pin size={16} aria-hidden="true" />
                        <strong>Tin nhắn đã ghim ({pinnedMessages.length})</strong>
                        {pinnedMessages.length > 1 && (
                          <button type="button" onClick={() => setPinnedExpanded((value) => !value)}
                            aria-expanded={pinnedExpanded}>
                            {pinnedExpanded ? 'Thu gọn' : 'Xem tất cả'}
                          </button>
                        )}
                      </div>
                      <div className="chat-pinned-items">
                        {pinnedMessages.slice(0, pinnedExpanded ? 100 : 1).map(({ message }) => (
                          <div className="chat-pinned-item" key={message.id}>
                            <button type="button" className="chat-pinned-jump"
                              title="Đi đến tin nhắn đã ghim"
                              onClick={() => setChatSearchJump({
                                conversationId: activeConversation.id,
                                messageId: message.id,
                                revision: ++chatSearchJumpRevision.current,
                              })}>
                              <strong>{userLabel(message.senderDisplayName, message.sender)}</strong>
                              <span>{message.text || attachmentLabel(message.attachments) || 'Tin nhắn'}</span>
                            </button>
                            <button type="button" className="chat-pinned-remove" disabled={pinBusy}
                              aria-label="Bỏ ghim tin nhắn" title="Bỏ ghim tin nhắn"
                              onClick={() => void toggleMessagePin(message)}>
                              <X size={15} aria-hidden="true" />
                            </button>
                          </div>
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
                      request={apiFetch}
                      onClose={() => setSharedContentOpen(false)}
                    />
                  )}

                  {messageSearchOpen && (
                    <MessageSearchPanel conversationId={activeConversation.id} request={apiFetch}
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
                          className={mine ? 'message mine message-press-target' : 'message message-press-target'}
                          onPointerDown={(event) => beginMessageLongPress(message, event.clientX, event.clientY, event.button, event.target)}
                          onPointerMove={(event) => moveMessageLongPress(event.clientX, event.clientY)}
                          onPointerUp={cancelMessageLongPress}
                          onPointerCancel={cancelMessageLongPress}
                          onPointerLeave={cancelMessageLongPress}
                          onContextMenu={(event) => {
                            if (message.deleted) return
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
                              {!isTranslating && !effectiveAutoTranslate && translationView.mode === 'dual' && (
                                <button type="button" className="chat-translation-action"
                                  onClick={() => setManuallyTranslated((current) => ({ ...current, [message.id]: false }))}>
                                  <Languages size={15} aria-hidden="true" /> Ẩn dịch
                                </button>
                              )}
                              {!isTranslating && !effectiveAutoTranslate &&
                                (!manuallyTranslated[message.id] || !hasTranslation) && (
                                <button type="button" className="chat-translation-action"
                                  onClick={() => void translateMessage(message)}>
                                  <Languages size={15} aria-hidden="true" />
                                  {translationFailed ? 'Thử dịch lại' : 'Dịch'}
                                </button>
                              )}
                              {!isTranslating && effectiveAutoTranslate && translationFailed && !hasTranslation && (
                                <button type="button" className="chat-translation-action"
                                  onClick={() => void translateMessage(message)}>
                                  <Languages size={15} aria-hidden="true" /> Thử dịch lại
                                </button>
                              )}
                              {Boolean(message.attachments?.length) && (
                                <div className={photoOnly ? 'chat-message-media chat-message-photo' : 'chat-message-media'}>
                                  <MediaAttachmentsView items={message.attachments} />
                                  {photoOnly && <span className="chat-image-time">{formatTime(message.createdAt)}</span>}
                                </div>
                              )}
                              <div className="message-reactions">
                                {(message.reactions || []).map((reaction) => (
                                  <button
                                    key={reaction.emoji}
                                    type="button"
                                    disabled={reactionPreviews[message.id] !== undefined}
                                    aria-pressed={reaction.mine}
                                    className={reaction.mine ? 'reaction-chip active' : 'reaction-chip'}
                                    onClick={() => void toggleReaction(message, reaction.emoji)}
                                    aria-label={`${messageReactionLabel(reaction.emoji)}: ${reaction.count} lượt`}
                                  >
                                    {reaction.emoji} {reaction.count}
                                  </button>
                                ))}
                                <button type="button" className="reaction-add"
                                  aria-label="Chọn cảm xúc cho tin nhắn"
                                  title="Thả cảm xúc"
                                  onClick={() => openMessageActions(message)}>
                                  <SmilePlus size={16} aria-hidden="true" />
                                </button>
                              </div>
                            </div>
                          )}
                          <div className={photoOnly ? 'message-stamp chat-photo-stamp' : 'message-stamp'}>
                            {formatTime(message.createdAt)}
                            {message.editedAt && !message.deleted ? ' · đã sửa' : ''}
                            {mine && (message.readByUserIds?.length || 0) > 0
                              ? activeConversation.type === 'group'
                                ? ` · ${message.readByUserIds?.length} đã xem`
                                : ' · Đã xem'
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
                    {chatOutbox.filter((item) => item.conversationId === activeConversationId).map((item) => (
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
                          {(item.status === 'failed' || (item.status === 'unconfirmed' && chatOnline)) && (
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

                  <div className={`social-chat-ai-banner${effectiveAutoTranslate ? ' is-enabled' : ''}`} role="status">
                    <Languages size={18} aria-hidden="true" />
                    <span>{effectiveAutoTranslate
                      ? `Dịch tự động đang bật · ${selectedConversationLanguage?.localizedLanguage || effectiveTargetLanguage.toUpperCase()}`
                      : 'Dịch tự động đang tắt'}</span>
                    <button type="button" aria-label="Cài đặt dịch AI" aria-expanded={translationMenuOpen}
                      onClick={() => { setLanguageSearch(''); setTranslationMenuOpen((open) => !open) }}>
                      <span>Cài đặt</span><ChevronDown size={15} aria-hidden="true" />
                    </button>
                  </div>

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
                    <input
                      ref={messageInputRef}
                      aria-label="Tin nhắn"
                      placeholder={isProfileDesktop ? 'Nhập tin nhắn...' : activeConversation.type === 'group' ? `Nhắn vào ${activeConversation.name}...` : `Nhắn ${activeConversation.name}...`}
                      value={messageText}
                      onChange={(event) => setMessageText(event.target.value)}
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
                </>
              )}
            </section>
            {activeConversation && conversationDetailsOpen && (
              <ConversationDetailsPanel
                conversation={activeConversation}
                busy={historyActionBusy}
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
                onShared={() => { setConversationDetailsOpen(false); setSharedContentOpen(true) }}
                onTranslate={() => {
                  setConversationDetailsOpen(false);
                  setTranslationMenuOpen(false);
                  setTranslationSettingsConversationId(activeConversation.id);
                }}
                onNotifications={() => { setConversationDetailsOpen(false); switchTab('notifications') }}
              />
            )}
            {groupSettingsOpen && activeConversation?.type === 'group' && (
              <>
                <button type="button" className="group-sidebar-scrim"
                  aria-label="Đóng thanh quản lý nhóm"
                  onClick={() => setGroupSettingsOpen(false)} />
                <aside className="group-settings-sidebar" aria-label="Thanh bên quản lý nhóm">
                  <GroupSettingsPanel
                    activeGroupMember={activeGroupMember}
                    setGroupSettingsOpen={setGroupSettingsOpen}
                    canManageActiveGroup={canManageActiveGroup}
                    canInviteActiveGroup={canInviteActiveGroup}
                    canEditActiveGroup={canEditActiveGroup}
                    onRenameRequest={() => {
                      setGroupNameDraft(activeConversation.name)
                      setGroupNameEditing(true)
                    }}
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
          </div>
        )}


        {tab === 'chat' && translationSettingsConversationId !== null &&
          activeConversation?.id === translationSettingsConversationId && (
          <ChatTranslationSettingsPage
            key={`${session.user.id}:${translationSettingsConversationId}`}
            conversation={activeConversation}
            languages={languageOptions}
            initial={activeChatTranslationSettings ?? {
              enabled: autoTranslate,
              targetLanguage,
              sourceLanguage: targetLanguage === 'en' ? 'vi' : 'en',
              display: 'adaptive',
            }}
            onCancel={() => setTranslationSettingsConversationId(null)}
            onSave={settings => {
              if (saveConversationTranslationSettings(translationSettingsConversationId, settings)) {
                setTranslationSettingsConversationId(null);
                setNotice('Đã lưu cài đặt dịch cho cuộc trò chuyện.', 'success');
              }
            }}
          />
        )}


        {tab === "chat" && desktopSection === "groups" && (
          groupWorkspaceMode === "create" ? (
            <CommunityGroupWizard
              key={session.sessionId + ":group-wizard"}
              friends={friends}
              userId={session.user.id}
              myName={session.user.displayName || session.user.username}
              step={groupCreateStep}
              onStep={setGroupCreateStep}
              onCancel={() => setGroupWorkspaceMode("list")}
              onCreate={createGroup}
              error={chatCreateError}
            />
          ) : (
            <CommunityGroupsPage
              mode={groupWorkspaceMode}
              onMode={setGroupWorkspaceMode}
              groups={conversations}
              userId={session.user.id}
              myName={session.user.displayName || session.user.username}
              selectedGroup={activeConversation?.type === "group" ? activeConversation : null}
              onSelectGroup={(id, mode) => {
                setActiveConversationId(id);
                setGroupWorkspaceMode(mode);
              }}
              onOpenFullChat={() => setDesktopSection(null)}
              onCreate={() => {
                setChatCreateError("");
                setGroupCreateStep(1);
                setGroupWorkspaceMode("create");
              }}
              onJoinedGroup={async (id) => {
                await refreshConversations();
                setActiveConversationId(id);
                setGroupWorkspaceMode("channel");
              }}
              members={groupMembers}
              groupBusy={groupBusy}
              activeMember={activeGroupMember}
              canManage={Boolean(canManageActiveGroup)}
              canInvite={Boolean(canInviteActiveGroup)}
              canEdit={Boolean(canEditActiveGroup)}
              onRename={() => {
                if (activeConversation) setGroupNameDraft(activeConversation.name);
                setGroupNameEditing(true);
              }}
              onInvite={() => void inviteGroupMembers()}
              inviteCandidates={groupInviteCandidates}
              inviteSelection={groupInviteSelection}
              setInviteSelection={setGroupInviteSelection}
              inviteSearch={groupInviteSearch}
              setInviteSearch={setGroupInviteSearch}
              onChangeRole={changeGroupMemberRole}
              onRemoveMember={removeGroupMember}
              onOpenMember={openVisitor}
              onMembersChanged={() => refreshGroupMembers(activeConversationId || undefined)}
              request={apiFetch}
              notify={setNotice}
              messages={messages}
              pendingMessages={chatOutbox}
              chatOnline={chatOnline}
              onRetryPending={() => void retryQueuedChatMessages()}
              messageText={messageText}
              onMessageText={setMessageText}
              onSend={sendMessage}
              canSend={canSend}
              onCall={(id) => launchGroupCall(id, "video")}
              hasMore={hasMoreConversations}
              loadingMore={conversationLoadingMore}
              onLoadMore={() => void loadMoreConversations()}
            />
          )
        )}

        {tab === "chat" && desktopSection === "calls" && (
          <CallCenter
            embedded
            request={apiFetch}
            userId={session.user.id}
            token={session.token}
            conversations={displayConversations}
            targetLanguage={targetLanguage}
            onNavigate={(destination) => { switchTab(destination); setDesktopSection(null); }}
            onOpenChat={(id) => { setDesktopSection(null); setActiveConversationId(id); }}

          />
        )}

        {tab === "notifications" && (
          <NotificationsPage
            requests={friendRequests}
            conversations={conversations}
            search={globalSearch}
            busyFriendIds={friendBusyIds}
            onAccept={(friend) => void actOnFriend(friend)}
            onDecline={(friend) => void declineFriendRequest(friend)}
            onOpenConversation={(id) => {
              switchTab("chat");
              setActiveConversationId(id);
            }}
            onOpenInvitations={() => {
              switchTab("contacts");
              setContactsScreen("invitations");
            }}
            onOpenFriend={openVisitor}
            onSettings={() => {
              switchTab("profile");
              setDesktopProfileSettings(true);
              setProfileTimelineOpen(false);
            }}
          />
        )}

        {tab === "contacts" && (
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
          />
        )}

        {tab === "discover" && (
          <Suspense fallback={<p role="status">Đang mở Quanh đây...</p>}>
            <NearbyExplorer
              query={globalSearch}
              onQueryChange={setGlobalSearch}
              users={nearbyUsers as NearbyUser[]}
              peopleBusy={nearbyBusy}
              peopleScanning={nearbyScanning}
              peopleActive={nearbyUntil > 0}
              peopleRadiusKm={nearbyRadiusKm}
              resultRadiusKm={nearbyResultRadiusKm}
              onPeopleRadiusChange={setNearbyRadiusKm}
              onScanPeople={findNearby}
              onStopPeople={stopNearby}
              friendActionBusy={friendActionBusy}
              onFriendAction={actOnFriend}
              getFriendActionLabel={(friend) => {
                const relationship = friendRelationship(friend.id);
                return relationship === "accepted"
                  ? "Nhắn tin"
                  : relationship === "incoming"
                    ? "Chấp nhận"
                    : relationship === "outgoing"
                      ? "Hủy lời mời"
                      : "Kết bạn";
              }}
            />
          </Suspense>
        )}

        {tab === "market" && (
          <Suspense fallback={<p role="status">Đang mở SocCO Market...</p>}>
            <Marketplace
              key={session.sessionId}
              userId={session.user.id}
              request={apiFetch}
              onBack={() => switchTab("discover")}
            />
          </Suspense>
        )}

        {tab === "feed" && isProfileDesktop && activePost && (
          <PostCommentsPage
            key={activePost.id}
            post={activePost}
            username={name}
            ownDisplayName={profileMedia?.displayName || session.user.displayName || name}
            token={session.token}
            targetLanguage={translationPreferencesLoaded ? targetLanguage : ""}
            request={apiFetch}
            sortOrder={commentSortOrder}
            onSortChange={setCommentSortOrder}
            onDeleted={(id) => { removeFeedPost(id); closeFeedPostDetails(); }}
            onAuthorOpen={openVisitor}
            likeBusy={likePreviews[activePost.id] !== undefined}
            onLike={(post, emoji) => like(post, emoji)}
            onUpdated={syncFeedPost}
            onFeedback={(message, kind) => setNotice(message, kind)}
          >
            {postDiscussion}
          </PostCommentsPage>
        )}

        {tab === "feed" && (!isProfileDesktop || !activePost) && (
          <div
            className="feed-view zalo-feed-view social-feed"
            ref={feedViewRef}
            onScroll={(event) => {
              if (feedSearchActive && event.currentTarget.scrollTop > 0)
                setSearchHasScrolled(true);
            }}
          >
            <FeedModeration
              request={apiFetch}
              onRemoved={(type, id) => {
                if (type === "post") {
                  setPosts((current) =>
                    current.filter((post) => post.id !== id),
                  );
                  setSavedPosts((current) =>
                    current.filter((post) => post.id !== id),
                  );
                  postSearch.removePost(id);
                  if (activePostId === id) setActivePostId(null);
                } else if (type === "comment") {
                  void refreshPosts();
                } else {
                  setStories((current) =>
                    current.filter((story) => story.id !== id),
                  );
                  if (activeStoryId === id) setActiveStoryId(null);
                }
              }}
            />
            <input
              ref={storyFileInputRef}
              className="hidden-media-input"
              type="file"
              accept="image/*,video/*"
              aria-label="Chọn ảnh hoặc video cho Story"
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                event.currentTarget.value = "";
                void createStory(file);
              }}
            />
            <div className="social-feed-grid">
              <div className="social-feed-center">
                {isProfileDesktop ? (
                  <SocialFeedStories
                    username={name}
                    displayName={userLabel(
                      profileMedia?.displayName || session.user.displayName,
                      name,
                    )}
                    stories={stories}
                    busy={storyBusy || mediaUploading === "story"}
                    onCreate={() => storyFileInputRef.current?.click()}
                    onOpen={setActiveStoryId}
                  />
                ) : (
                  <>
                    <div className="soco-feed-section-label">
                      <strong>Khoảnh khắc</strong>
                      <small>Story trong 24 giờ</small>
                    </div>
                    <div className="stories-row">
                      <button
                        type="button"
                        className="story-card"
                        disabled={storyBusy || mediaUploading === "story"}
                        onClick={() => storyFileInputRef.current?.click()}
                        aria-label="Tạo Story mới"
                      >
                        <div className="story-visual self-story">
                          <span className="story-camera">
                            <UiIcon name="plus" size={22} />
                          </span>
                        </div>
                        <span>
                          Tạo mới
                        </span>
                      </button>
                      {stories.map((story) => (
                        <button
                          type="button"
                          className="story-card"
                          key={story.id}
                          onClick={() => setActiveStoryId(story.id)}
                          aria-label={`Xem Story của ${userLabel(story.authorDisplayName, story.author)}`}
                        >
                          <div className="story-visual">
                            {story.attachment.kind === "video" ? (
                              <video
                                src={story.attachment.url}
                                muted
                                playsInline
                                preload="metadata"
                              />
                            ) : (
                              <img
                                src={story.attachment.url}
                                alt=""
                                loading="lazy"
                              />
                            )}
                            <UserAvatar
                              className="story-avatar-mini"
                              username={story.author}
                              name={userLabel(
                                story.authorDisplayName,
                                story.author,
                              )}
                            />
                          </div>
                          <span>
                            {story.author === name
                              ? "Story của bạn"
                              : userLabel(
                                  story.authorDisplayName,
                                  story.author,
                                )}
                          </span>
                        </button>
                      ))}
                    </div>
                  </>
                )}

                {isProfileDesktop ? (
                  <SocialFeedComposer
                    username={name}
                    displayName={userLabel(
                      profileMedia?.displayName || session.user.displayName,
                      name,
                    )}
                    draft={postText}
                    pending={Boolean(pendingPost)}
                    storyBusy={storyBusy || mediaUploading === "story"}
                    onCreatePost={() => {
                      setFeedCheckInOpen(false);
                      setFeedComposerOpen(true);
                    }}
                    onCreateMediaPost={() => {
                      setFeedCheckInOpen(false);
                      setFeedComposerOpen(true);
                    }}
                    onCreateStory={() => storyFileInputRef.current?.click()}
                    onCheckIn={() => {
                      setFeedCheckInOpen(true);
                      setFeedComposerOpen(true);
                    }}
                  />
                ) : (
                  postComposer
                )}

                {isProfileDesktop ? (
                  <div
                    className="social-feed-filter-bar"
                    role="group"
                    aria-label="Lọc bảng tin"
                  >
                    <div className="social-feed-filter-options">
                      <button
                        type="button"
                        aria-pressed={feedFilter === "all"}
                        onClick={() => setFeedFilter("all")}
                      >
                        Dành cho bạn
                      </button>
                      <button
                        type="button"
                        aria-pressed={feedFilter === "following"}
                        onClick={() => setFeedFilter("following")}
                      >
                        Đang theo dõi
                      </button>
                      <button
                        type="button"
                        aria-pressed={feedFilter === "latest"}
                        onClick={() => setFeedFilter("latest")}
                      >
                        Mới nhất
                      </button>
                      {feedFilter === "saved" && (
                        <button type="button" aria-pressed={true}>
                          Đã lưu
                        </button>
                      )}
                    </div>
                    <button
                      className="social-feed-refresh"
                      type="button"
                      onClick={() => {
                        if (feedFilter === "following") followingFeed.refresh();
                        else if (feedFilter === "saved") void loadSavedPosts();
                        else void refreshPosts();
                      }}
                    >
                      <RefreshCw size={15} aria-hidden="true" />
                      {feedFilter === "saved" ? "Bài đã lưu" : "Bài viết mới"}
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="soco-feed-section-label soco-feed-posts-label">
                      <strong>
                        {feedFilter === "saved"
                          ? "Bài viết đã lưu"
                          : "Bài viết mới"}
                      </strong>
                      <div
                        className="feed-filter-tabs"
                        role="group"
                        aria-label="Lọc bảng tin"
                      >
                        <button
                          type="button"
                          aria-pressed={feedFilter === "all"}
                          onClick={() => setFeedFilter("all")}
                        >
                          Mới nhất
                        </button>
                        <button
                          type="button"
                          aria-pressed={feedFilter === "saved"}
                          onClick={() => {
                            setFeedFilter("saved");
                            void loadSavedPosts();
                          }}
                        >
                          Đã lưu
                        </button>
                      </div>
                    </div>
                  </>
                )}
                <div className="feed zalo-feed">
                  {pendingPost && (
                    <article
                      className="post zalo-post outgoing-preview"
                      aria-busy="true"
                    >
                      <UserAvatar
                        username={pendingPost.author}
                        name={userLabel(
                          pendingPost.authorDisplayName,
                          pendingPost.author,
                        )}
                        className="avatar"
                      />
                      <div className="post-body">
                        <div className="post-author">
                          <strong>
                            {userLabel(
                              pendingPost.authorDisplayName,
                              pendingPost.author,
                            )}
                          </strong>
                          <small>{pendingPost.visibility === "friends" ? "Bạn bè" : pendingPost.visibility === "private" ? "Chỉ mình tôi" : "Công khai"}</small>
                        </div>
                        <p className="pending-content">{pendingPost.content}</p>
                        <MediaAttachmentsView items={pendingPost.attachments} />
                      </div>
                    </article>
                  )}


                  {renderPosts(searchedPosts, isProfileDesktop)}

                  {feedPagingError && (
                    <div role="alert" className="soco-feed-load-more">
                      <span>
                        {feedSearchActive
                          ? postSearch.error
                          : feedFilter === "following"
                            ? followingFeed.error
                            : "Không thể tải bài viết."}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          if (feedSearchActive) postSearch.retry();
                          else if (feedFilter === "saved")
                            void loadSavedPosts(savedPosts.length > 0);
                          else if (feedFilter === "following")
                            followingFeed.refresh();
                          else if (posts.length === 0) void refreshPosts();
                          else void loadMorePosts();
                        }}
                      >
                        Thử lại
                      </button>
                    </div>
                  )}
                  <div
                    ref={feedInfiniteScrollRef}
                    aria-hidden="true"
                    style={{ height: 1 }}
                  />
                  {searchedPosts.length === 0 &&
                    !feedLoadingMore &&
                    !(feedSearchActive && postSearch.loading) &&
                    !(feedFilter === "following" && followingFeed.loading) &&
                    !feedPagingError && (
                      <div className="feed-empty">
                        <SocoEmptyState
                          title={
                            normalizedSearch
                              ? "Không tìm thấy bài viết"
                              : feedFilter === "following"
                                ? "Chưa có bài viết từ bạn bè"
                                : "Chưa có bài viết"
                          }
                          description={
                            normalizedSearch
                              ? "Thử một từ khóa khác nhé."
                              : feedFilter === "following"
                                ? "Kết bạn để xem các bài viết được chia sẻ với bạn."
                                : "Hãy chia sẻ khoảnh khắc đầu tiên của bạn."
                          }
                          action={
                            !normalizedSearch && (
                              <SocoTextAction
                                onClick={() =>
                                  feedFilter === "following"
                                    ? switchTab("contacts")
                                    : isProfileDesktop
                                      ? (setFeedCheckInOpen(false),
                                        setFeedComposerOpen(true))
                                      : postComposerRef.current?.focus()
                                }
                              >
                                {feedFilter === "following"
                                  ? "Tìm bạn bè"
                                  : "Tạo bài viết"}
                              </SocoTextAction>
                            )
                          }
                        />
                      </div>
                    )}
                </div>
              </div>
              {isProfileDesktop && (
                <SocialFeedSidebar
                  username={name}
                  sessionId={session.sessionId}
                  posts={posts}
                  friends={friends}
                  friendRequests={friendRequests}
                  friendBusyIds={friendBusyIds}
                  request={apiFetch}
                  onFriend={(friend) => {
                    void actOnFriend(friend);
                  }}
                  onViewUser={openVisitor}
                  onViewContacts={() => switchTab("contacts")}
                  onSearchTag={(tag) => {
                    setFeedFilter("all");
                    setGlobalSearch(tag);
                  }}
                  onOpenChat={() => switchTab("chat")}
                />
              )}
            </div>
          </div>
        )}

        {activeConversationAction && (
          <div className={conversationMenuPosition ? 'conversation-context-backdrop' : 'message-context-backdrop'}
            role="dialog" aria-modal="true"
            aria-label={`Tùy chọn cuộc trò chuyện ${activeConversationAction.name}`}
            onMouseDown={(event) => {
              if (event.currentTarget === event.target) setConversationActionId(null)
            }}
            onKeyDown={(event) => { if (event.key === 'Escape') setConversationActionId(null) }}>
            <section
              className={conversationMenuPosition ? 'conversation-context-menu' : 'message-context-sheet'}
              style={conversationMenuPosition ? {
                left: Math.max(8, Math.min(conversationMenuPosition.x, window.innerWidth - 252)),
                top: Math.max(8, Math.min(conversationMenuPosition.y, window.innerHeight - 72)),
              } : undefined}
            >
              {!conversationMenuPosition && (
                <div className="conversation-pin-dialog-title">
                  <strong>{activeConversationAction.name}</strong>
                  <span>Thiết lập riêng cho tài khoản của bạn</span>
                </div>
              )}
              <div className={conversationMenuPosition ? 'conversation-context-actions' : 'message-context-actions'}>
                <button type="button" autoFocus disabled={pinBusy}
                  onClick={() => {
                    setConversationActionId(null)
                    void toggleConversationPin(activeConversationAction)
                  }}>
                  <span aria-hidden="true"><Pin size={19} /></span>
                  <b>{activeConversationAction.pinnedAt ? 'Bỏ ghim cuộc trò chuyện' : 'Ghim cuộc trò chuyện'}</b>
                </button>
              </div>
              {!conversationMenuPosition && (
                <button type="button" className="message-context-cancel"
                  onClick={() => setConversationActionId(null)}>Đóng</button>
              )}
            </section>
          </div>
        )}

        {activeConversation?.type === 'group' && (groupActivityCreateKind !== null || groupActivityViewedId !== null) && (
          <GroupActivityDialog
            key={`${activeConversation.id}-${groupActivityCreateKind || 'view'}-${groupActivityViewedId ?? ''}`}
            kind={groupActivityCreateKind}
            activity={viewedGroupActivity}
            onClose={() => { setGroupActivityCreateKind(null); setGroupActivityViewedId(null) }}
            onCreate={groupActivities.create}
            onVote={groupActivities.vote}
          />
        )}
        {activeMessageAction && (
          <MessageActions
            activeMessageAction={activeMessageAction}
            userId={session.user.id}
            isPinned={pinnedMessages.some((pin) => pin.message.id === activeMessageAction.id)}
            toggleMessagePin={toggleMessagePin}
            setMessageActionId={setMessageActionId}
            toggleReaction={toggleReaction}
            setReplyingTo={setReplyingTo}
            copyTarget={messageCopyTarget}
            copyMessageContent={copyMessageContent}
            translateMessage={translateMessage}
            editOwnMessage={editOwnMessage}
            recallOwnMessage={recallOwnMessage}
          />
        )}

        {activePost && !(tab === "feed" && isProfileDesktop) && (
          <div
            className="post-detail-backdrop"
            role="dialog"
            aria-modal="true"
            aria-label={`Chi tiết bài viết của ${userLabel(activePost.authorDisplayName, activePost.author)}`}
            onMouseDown={(event) => {
              if (event.currentTarget === event.target) setActivePostId(null);
            }}
          >
            <section className="post-detail-modal">
              <header className="post-detail-header">
                <div>
                  <strong>Chi tiết bài viết</strong>
                  <small>@{activePost.author}</small>
                </div>
                <button
                  type="button"
                  aria-label="Đóng chi tiết bài viết"
                  onClick={() => setActivePostId(null)}
                >
                  ×
                </button>
              </header>
              <div className="post-detail-scroll">
                <article className="post zalo-post post-detail-post">
                  <UserAvatar
                    username={activePost.author}
                    name={userLabel(
                      activePost.authorDisplayName,
                      activePost.author,
                    )}
                    className="avatar"
                  />
                  <div className="post-body">
                    <div className="post-author">
                      <div>
                        <strong>
                          {userLabel(
                            activePost.authorDisplayName,
                            activePost.author,
                          )}
                        </strong>
                        <small>
                          {new Date(activePost.createdAt).toLocaleString(
                            "vi-VN",
                          )}
                        </small>
                      </div>
                    </div>
                    {activePost.content && (
                      <FeedText
                        api={API}
                        token={session.token}
                        target={
                          translationPreferencesLoaded ? targetLanguage : ""
                        }
                        text={activePost.content}
                      />
                    )}
                    <MediaAttachmentsView items={activePost.attachments} />
                    <div className="post-toolbar">
                      <FeedReactionControl
                        post={activePost}
                        busy={likePreviews[activePost.id] !== undefined}
                        react={like}
                        showCount
                      />
                      <span className="post-stat">
                        <UiIcon name="comment" size={21} />
                        {activePost.comments?.length || 0} bình luận
                      </span>
                    </div>
                    {postDiscussion}
                  </div>
                </article>
              </div>
            </section>
          </div>
        )}

        {activeStory && (
          <StoryViewer
            activeStory={activeStory}
            name={name}
            storyBusy={storyBusy}
            deleteStory={deleteStory}
            setActiveStoryId={setActiveStoryId}
            nextStory={nextStory}
            previousStory={previousStory}
            activeStoryIndex={activeStoryIndex}
          />
        )}

        {tab === "profile" && desktopProfileOverview && (
          <>
            <input
              ref={avatarFileInputRef}
              className="hidden-media-input"
              type="file"
              accept="image/*"
              aria-label="Chọn ảnh đại diện"
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                event.currentTarget.value = "";
                void updateProfileImage("avatar", file);
              }}
            />
            <input
              ref={coverFileInputRef}
              className="hidden-media-input"
              type="file"
              accept="image/*"
              aria-label="Chọn ảnh bìa"
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                event.currentTarget.value = "";
                void updateProfileImage("cover", file);
              }}
            />
            {profileEditorOpen ? (
              <ProfileEditorPage
                username={name}
                displayName={
                  profileMedia?.displayName || session.user.displayName || name
                }
                profile={profileMedia}
                coverUrl={
                  profileMedia?.coverSet
                    ? profileAssetUrl(name, "cover", profileMedia.updatedAt)
                    : undefined
                }
                displayNameDraft={profileDisplayNameDraft}
                setDisplayNameDraft={setProfileDisplayNameDraft}
                usernameDraft={profileUsernameDraft}
                setUsernameDraft={setProfileUsernameDraft}
                bioDraft={profileBioDraft}
                setBioDraft={setProfileBioDraft}
                cityDraft={profileCityDraft}
                setCityDraft={setProfileCityDraft}
                profileSaving={profileSaving}
                mediaBusy={profileBusy !== null || mediaUploading === "profile"}
                privacy={privacy}
                privacyBusy={privacyBusy}
                privacyLoading={privacyLoading}
                privacyError={privacyError}
                retryPrivacy={() => setPrivacyRetry((n) => n + 1)}
                changePrivacy={changePrivacy}
                onSave={saveProfileIdentity}
                onDiscard={discardDesktopProfileEdits}
                onChangeAvatar={() => avatarFileInputRef.current?.click()}
                onChangeCover={() => coverFileInputRef.current?.click()}
              />
            ) : (
              <ProfilePage
                username={name}
                displayName={
                  profileMedia?.displayName || session.user.displayName || name
                }
                email={session.user.email}
                bio={profileMedia?.bio}
                city={profileMedia?.city}
                coverUrl={
                  profileMedia?.coverSet
                    ? profileAssetUrl(name, "cover", profileMedia.updatedAt)
                    : undefined
                }
                coverSet={Boolean(profileMedia?.coverSet)}
                editBusy={profileBusy !== null || mediaUploading === "profile"}
                friends={friends}
                posts={profilePosts}
                pendingPost={pendingPost}
                postsBusy={profilePostsBusy}
                postsError={profilePostsError}
                hasMorePosts={profileHasMore}
                postCards={renderPosts(visibleProfilePosts)}
                profileNote={
                  <ProfileNote
                    key={session.sessionId + ":desktop-note"}
                    username={name}
                    owner
                    request={apiFetch}
                  />
                }
                onEditProfile={() => setProfileEditorOpen(true)}
                onChangeAvatar={() => avatarFileInputRef.current?.click()}
                onChangeCover={() => coverFileInputRef.current?.click()}
                onCreatePost={() => setProfileComposerOpen(true)}
                onReloadPosts={() => void loadProfilePosts(false, true)}
                onLoadMorePosts={() => void loadProfilePosts(true)}
                onViewFriend={openVisitor}
                onOpenContacts={() => switchTab("contacts")}
                onOpenPost={setActivePostId}
              />
            )}
          </>
        )}

        {tab === "profile" && !desktopProfileOverview && (
          <div
            className={`simple-view profile-view ${profileTimelineOpen ? "personal-timeline-view" : ""} ${isProfileDesktop && desktopProfileSettings ? "settings-workspace-open" : ""}`}
          >
            {isProfileDesktop && desktopProfileSettings && (
              <SettingsWorkspace
                privacy={privacy}
                privacyLoading={privacyLoading}
                privacyBusy={privacyBusy}
                privacyError={privacyError}
                onPrivacyRetry={() => setPrivacyRetry((value) => value + 1)}
                onSavePrivacy={savePrivacy}
                account={
                  <div className="settings-workspace-account">
                    <div className="settings-workspace-account-details">
                      <strong>{profileMedia?.displayName || session.user.displayName || name}</strong>
                      <span>@{session.user.username}</span>
                      <span>{session.user.email}</span>
                    </div>
                    <button type="button" className="settings-workspace-action" onClick={() => {
                      setDesktopProfileSettings(false);
                      setProfileEditorOpen(true);
                    }}>
                      <PencilLine size={16} aria-hidden="true" /> Chỉnh sửa hồ sơ
                    </button>
                    {!isStandalone && (
                      <button type="button" className="settings-workspace-action" onClick={() => void installApp()}>
                        <Download size={16} aria-hidden="true" /> {t("profile.install")}
                      </button>
                    )}
                    <button type="button" className="settings-workspace-action" onClick={() => logout()}>
                      <LogOut size={16} aria-hidden="true" /> {t("profile.logout")}
                    </button>
                  </div>
                }
                security={
                  <div className="settings-card">
                    <BlockedUsersPanel
                      blockedBusy={blockedBusy}
                      blockedOpen={blockedOpen}
                      setBlockedOpen={setBlockedOpen}
                      loadBlockedUsers={loadBlockedUsers}
                      blockedError={blockedError}
                      blockedUsers={blockedUsers}
                      unblockContact={unblockContact}
                    />
                  </div>
                }
                notifications={
                  <div className="settings-card">
                    <div className="settings-row">
                      <div>
                        <strong>{isDesktopBuild ? "Thông báo Desktop" : t("profile.notifications")}</strong>
                        <small>{isDesktopBuild
                          ? "Nhận thông báo khi SocCo còn đang chạy."
                          : t("profile.notificationsHint")}</small>
                      </div>
                      <button type="button" role="switch"
                        className={"switch-button" + ((isDesktopBuild ? nativeNotifications.enabled : pushEnabled) ? " on" : "")}
                        aria-checked={isDesktopBuild ? nativeNotifications.enabled : pushEnabled}
                        aria-label={isDesktopBuild ? "Thông báo Desktop" : t("profile.notifications")}
                        disabled={!isDesktopBuild && pushBusy}
                        onClick={() => isDesktopBuild ? nativeNotifications.toggle() : void togglePush()}
                      ><span /></button>
                    </div>
                    {isDesktopBuild && nativeNotifications.warning && (
                      <div className="settings-row" role="status"><small>{nativeNotifications.warning}</small></div>
                    )}
                    {!isDesktopBuild && (
                      <div className="settings-row">
                        <div><strong>{t("profile.testNotification")}</strong><small>{t("profile.testNotificationHint")}</small></div>
                        <button type="button" className="settings-action"
                          disabled={pushBusy || !pushEnabled} onClick={() => void sendTestPush()}>
                          {t("common.test")}
                        </button>
                      </div>
                    )}
                  </div>
                }
                language={
                  <div className="settings-card">
                    <button type="button" className="settings-row settings-row-button app-locale-row"
                      onClick={() => { setLocaleSearch(""); setLocalePickerOpen(true); }}>
                      <div><strong>{t("profile.appLanguage")}</strong><small>{t("profile.appLanguageHint")}</small></div>
                      <span className="settings-current-locale">
                        <span>{appLocale === "auto" ? t("common.auto") : selectedAppLanguage?.localizedLanguage}</span>
                        <ChevronDown size={16} aria-hidden="true" />
                      </span>
                    </button>
                    <div className="settings-row">
                      <div><strong>{t("profile.autoTranslate")}</strong></div>
                      <button type="button" role="switch" aria-checked={autoTranslate}
                        aria-label={t("profile.autoTranslate")}
                        className={"switch-button" + (autoTranslate ? " on" : "")}
                        onClick={() => changeAutoTranslate(!autoTranslate)}><span /></button>
                    </div>
                    <button type="button" className="settings-row settings-row-button translation-locale-row"
                      onClick={() => { setTranslationSettingsSearch(""); setTranslationPickerOpen(true); }}>
                      <div><strong>{t("profile.translationLanguage")}</strong><small>{t("profile.translationLanguageHint")}</small></div>
                      <span className="settings-current-locale">
                        <span>{selectedLanguage?.localizedLanguage || targetLanguage.toUpperCase()}</span>
                        <ChevronDown size={16} aria-hidden="true" />
                      </span>
                    </button>
                  </div>
                }
                messages={
                  <div className="settings-card">
                    <div className="settings-row message-sound-row">
                      <div><strong>{t("profile.messageSound")}</strong><small>{t("profile.messageSoundHint")}</small></div>
                      <button type="button" role="switch" aria-checked={messageSoundEnabled}
                        aria-label={t("profile.messageSound")}
                        className={"switch-button" + (messageSoundEnabled ? " on" : "")}
                        onClick={toggleMessageSound}><span /></button>
                    </div>
                    {messageSoundEnabled && (
                      <div className="settings-row message-sound-preview-row">
                        <div><strong>{t("profile.soundPreview")}</strong><small>{t("profile.soundPreviewHint")}</small></div>
                        <button type="button" className="settings-action message-sound-preview-button"
                          onClick={() => void previewMessageSound()}>
                          <Volume2 size={17} aria-hidden="true" /> {t("profile.soundPreview")}
                        </button>
                      </div>
                    )}
                  </div>
                }
                appearance={
                  <p className="settings-workspace-empty-note">
                    Giao diện SocCo hiện sử dụng bộ màu sáng thống nhất trên web và desktop.
                  </p>
                }
                storage={
                  <div className="settings-workspace-account">
                    <p className="settings-workspace-empty-note">
                      Bạn có thể quản lý ảnh, video và tệp đã chia sẻ trong từng cuộc trò chuyện.
                    </p>
                    <button type="button" className="settings-workspace-action" onClick={() => switchTab("chat")}>
                      Mở tin nhắn
                    </button>
                  </div>
                }
                devices={
                  <div className="settings-card">
                    <AccountSessionsPanel
                      sessionsBusy={sessionsBusy}
                      canManageSessions={isDesktopBuild || Boolean(session.refreshToken)}
                      sessionsOpen={sessionsOpen}
                      setSessionsOpen={setSessionsOpen}
                      fetchAccountSessions={fetchAccountSessions}
                      sessionsError={sessionsError}
                      managedSessions={managedSessions}
                      revokeAccountSessions={revokeAccountSessions}
                    />
                  </div>
                }
              />
            )}
            <input
              ref={avatarFileInputRef}
              className="hidden-media-input"
              type="file"
              accept="image/*"
              aria-label="Chọn ảnh đại diện"
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                event.currentTarget.value = "";
                void updateProfileImage("avatar", file);
              }}
            />
            <input
              ref={coverFileInputRef}
              className="hidden-media-input"
              type="file"
              accept="image/*"
              aria-label="Chọn ảnh bìa"
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                event.currentTarget.value = "";
                void updateProfileImage("cover", file);
              }}
            />

            {profileTimelineOpen && (
              <header className="personal-timeline-header">
                <button
                  type="button"
                  onClick={closeProfileTimeline}
                  aria-label="Quay lại hồ sơ"
                >
                  <ArrowLeft size={20} />
                </button>
                <h1 ref={profileHeadingRef} tabIndex={-1}>
                  Trang cá nhân
                </h1>
                <button
                  type="button"
                  onClick={() => setProfileEditorOpen(true)}
                >
                  <Settings size={18} />
                  <span>Chỉnh sửa</span>
                </button>
              </header>
            )}
            <section className="profile-hero">
              <div
                className={`profile-cover-art ${profileMedia?.coverSet ? "has-cover" : ""}`}
              >
                <div className="profile-cover-placeholder">
                  <strong>SocCO</strong>
                  <small>Understand. Connect. Together.</small>
                </div>
                {profileMedia?.coverSet && (
                  <img
                    src={profileAssetUrl(name, "cover", profileMedia.updatedAt)}
                    alt="Ảnh bìa"
                    draggable={false}
                    onError={(event) => {
                      event.currentTarget.hidden = true;
                      event.currentTarget.parentElement?.classList.remove(
                        "has-cover",
                      );
                    }}
                  />
                )}
                <button
                  type="button"
                  className="profile-cover-edit"
                  disabled={
                    profileBusy !== null || mediaUploading === "profile"
                  }
                  onClick={() => coverFileInputRef.current?.click()}
                >
                  <UiIcon name="photo" size={17} />
                  {profileBusy === "cover"
                    ? t("common.loading")
                    : profileMedia?.coverSet
                      ? t("profile.changeCover")
                      : t("profile.addCover")}
                </button>
              </div>

              <div
                className="profile-identity"
                onClick={(event) => {
                  if (
                    !profileTimelineOpen &&
                    !(event.target as HTMLElement).closest("button")
                  ) {
                    setProfileTimelineOpen(true);
                    setGlobalSearch("");
                  }
                }}
              >
                <div className="profile-avatar-editor">
                  <ProfileNote
                    key={session.sessionId + ":note"}
                    username={name}
                    owner
                    request={apiFetch}
                  />
                  <UserAvatar
                    username={name}
                    name={userLabel(
                      profileMedia?.displayName || session.user.displayName,
                      name,
                    )}
                    className="profile-avatar"
                    online
                  />
                  <button
                    type="button"
                    className="profile-avatar-edit"
                    aria-label="Đổi ảnh đại diện"
                    title="Đổi ảnh đại diện"
                    disabled={
                      profileBusy !== null || mediaUploading === "profile"
                    }
                    onClick={() => avatarFileInputRef.current?.click()}
                  >
                    <UiIcon name="photo" size={17} />
                  </button>
                </div>
                <button
                  type="button"
                  ref={profileIdentityRef}
                  className="profile-identity-copy profile-identity-link"
                  aria-label="Mở trang cá nhân"
                  disabled={profileTimelineOpen}
                  onClick={() => {
                    setProfileTimelineOpen(true);
                    setGlobalSearch("");
                  }}
                >
                  <strong>
                    {profileMedia?.displayName ||
                      session.user.displayName ||
                      name}
                  </strong>
                  <span>@{name}</span>
                  <small className="profile-email">{session.user.email}</small>
                  {!profileTimelineOpen && (
                    <small className="profile-media-hint">
                      Xem trang cá nhân · Dòng thời gian ›
                    </small>
                  )}
                </button>
              </div>
            </section>

            {profileTimelineOpen ? (
              <section
                className="personal-timeline-content"
                aria-label="Dòng thời gian cá nhân"
              >
                <div className="personal-timeline-intro">
                  <div>
                    <strong>Khoảnh khắc của bạn</strong>
                    <p>Lưu giữ và chia sẻ những câu chuyện mỗi ngày.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setProfileComposerOpen(true)}
                  >
                    <PencilLine size={18} />
                    Đăng bài
                  </button>
                </div>
                <div className="profile-post-launcher">
                  <UserAvatar
                    username={name}
                    name={userLabel(
                      profileMedia?.displayName || session.user.displayName,
                      name,
                    )}
                    className="avatar self-avatar"
                  />
                  <button
                    type="button"
                    onClick={() => setProfileComposerOpen(true)}
                  >
                    {postText.trim()
                      ? "Tiếp tục bản nháp của bạn..."
                      : "Bạn đang nghĩ gì?"}
                  </button>
                  <button
                    type="button"
                    className="profile-post-photo"
                    aria-label="Tạo bài viết có ảnh hoặc video"
                    onClick={() => setProfileComposerOpen(true)}
                  >
                    <Images size={23} />
                  </button>
                </div>
                <div className="personal-timeline-label">
                  <h2>Dòng thời gian</h2>
                  <button
                    type="button"
                    aria-label="Tải lại dòng thời gian"
                    disabled={profilePostsBusy || !!pendingPost}
                    onClick={() => void loadProfilePosts(false, true)}
                  >
                    <RefreshCw size={18} />
                  </button>
                </div>
                {profilePostsError && (
                  <div className="personal-timeline-error" role="alert">
                    <p>{profilePostsError}</p>
                    <button
                      type="button"
                      disabled={profilePostsBusy}
                      onClick={() =>
                        void loadProfilePosts(profilePosts.length > 0, true)
                      }
                    >
                      Thử lại
                    </button>
                  </div>
                )}

                <div className="feed zalo-feed">
                  {pendingPost && (
                    <article
                      className="post zalo-post outgoing-preview"
                      aria-busy="true"
                    >
                      <UserAvatar
                        username={name}
                        name={userLabel(
                          profileMedia?.displayName || session.user.displayName,
                          name,
                        )}
                        className="avatar"
                      />
                      <div className="post-body">
                        <strong>{userLabel(profileMedia?.displayName || session.user.displayName, name)}</strong>
                        <p>{pendingPost.content}</p>
                        <MediaAttachmentsView items={pendingPost.attachments} />
                      </div>
                    </article>
                  )}
                  {renderPosts(visibleProfilePosts)}
                </div>
                {!profilePostsBusy &&
                  !profilePostsError &&
                  profilePosts.length === 0 &&
                  !pendingPost && (
                    <SocoEmptyState
                      title="Chưa có bài viết nào"
                      description="Chia sẻ khoảnh khắc đầu tiên lên trang cá nhân của bạn."
                      action={
                        <SocoTextAction
                          onClick={() => setProfileComposerOpen(true)}
                        >
                          Đăng bài đầu tiên
                        </SocoTextAction>
                      }
                    />
                  )}
                {profileHasMore && (
                  <button
                    type="button"
                    className="soco-load-more soco-feed-load-more"
                    disabled={profilePostsBusy || !!pendingPost}
                    onClick={() => void loadProfilePosts(true)}
                  >
                    Xem bài viết cũ hơn
                  </button>
                )}
              </section>
            ) : (
              <>
                {isProfileDesktop && desktopProfileSettings ? (
                  <section className="profile-editor-settings-entry">
                    <div>
                      <strong>Thông tin hồ sơ</strong>
                      <p>
                        Thay đổi tên, tên người dùng, tiểu sử, thành phố và ảnh
                        hồ sơ trong trang chỉnh sửa.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setDesktopProfileSettings(false);
                        setProfileEditorOpen(true);
                      }}
                    >
                      Chỉnh sửa hồ sơ
                    </button>
                  </section>
                ) : (
                  profileIdentityForm
                )}

                <div className="soco-profile-section-label">
                  TÙY CHỌN & CÀI ĐẶT
                </div>
                <section className="settings-card">
                  {profilePrivacyControls}
                  <AccountSessionsPanel
                    sessionsBusy={sessionsBusy}
                    canManageSessions={
                      isDesktopBuild || Boolean(session.refreshToken)
                    }
                    sessionsOpen={sessionsOpen}
                    setSessionsOpen={setSessionsOpen}
                    fetchAccountSessions={fetchAccountSessions}
                    sessionsError={sessionsError}
                    managedSessions={managedSessions}
                    revokeAccountSessions={revokeAccountSessions}
                  />
                  <BlockedUsersPanel
                    blockedBusy={blockedBusy}
                    blockedOpen={blockedOpen}
                    setBlockedOpen={setBlockedOpen}
                    loadBlockedUsers={loadBlockedUsers}
                    blockedError={blockedError}
                    blockedUsers={blockedUsers}
                    unblockContact={unblockContact}
                  />
                  <button
                    type="button"
                    className="settings-row settings-row-button app-locale-row"
                    onClick={() => {
                      setLocaleSearch("");
                      setLocalePickerOpen(true);
                    }}
                  >
                    <div>
                      <strong>{t("profile.appLanguage")}</strong>
                      <small>{t("profile.appLanguageHint")}</small>
                    </div>
                    <span className="settings-current-locale">
                      <b aria-hidden="true">
                        {selectedAppLanguage?.flag || "🌐"}
                      </b>
                      <span>
                        {appLocale === "auto"
                          ? t("common.auto")
                          : selectedAppLanguage?.localizedLanguage}
                        {uiLocaleLoading ? " · …" : ""}
                      </span>
                      <i aria-hidden="true">›</i>
                    </span>
                  </button>

                  <div className="settings-row">
                    <div>
                      <strong>
                        {isDesktopBuild
                          ? "Thông báo Desktop"
                          : t("profile.notifications")}
                      </strong>
                      <small>
                        {isDesktopBuild
                          ? "Ẩn nội dung và tên người gửi. Nhận khi SocCO còn chạy; thoát hẳn sẽ dừng thông báo."
                          : t("profile.notificationsHint")}
                      </small>
                    </div>
                    <button
                      type="button"
                      className={`switch-button ${(isDesktopBuild ? nativeNotifications.enabled : pushEnabled) ? "on" : ""}`}
                      onClick={() =>
                        isDesktopBuild
                          ? nativeNotifications.toggle()
                          : void togglePush()
                      }
                      disabled={!isDesktopBuild && pushBusy}
                      aria-label={
                        (
                          isDesktopBuild
                            ? nativeNotifications.enabled
                            : pushEnabled
                        )
                          ? "Tắt thông báo"
                          : "Bật thông báo"
                      }
                      role="switch"
                      aria-checked={
                        isDesktopBuild
                          ? nativeNotifications.enabled
                          : pushEnabled
                      }
                    >
                      <span />
                    </button>
                  </div>
                  {isDesktopBuild && nativeNotifications.warning && (
                    <div className="settings-row" role="status">
                      <small>{nativeNotifications.warning}</small>
                    </div>
                  )}
                  <div className="settings-row message-sound-row">
                    <div>
                      <strong>{t("profile.messageSound")}</strong>
                      <small>{t("profile.messageSoundHint")}</small>
                    </div>
                    <button
                      type="button"
                      className={`switch-button ${messageSoundEnabled ? "on" : ""}`}
                      onClick={toggleMessageSound}
                      aria-label={
                        messageSoundEnabled
                          ? t("profile.soundOff")
                          : t("profile.soundOn")
                      }
                      role="switch"
                      aria-checked={messageSoundEnabled}
                    >
                      <span />
                    </button>
                  </div>
                  {messageSoundEnabled && (
                    <div className="settings-row message-sound-preview-row">
                      <div>
                        <strong>{t("profile.soundPreview")}</strong>
                        <small>{t("profile.soundPreviewHint")}</small>
                      </div>
                      <button
                        type="button"
                        className="settings-action message-sound-preview-button"
                        onClick={() => void previewMessageSound()}
                        aria-label={t("profile.soundPreview")}
                      >
                        <Volume2 size={17} aria-hidden="true" />
                        {t("profile.soundPreview")}
                      </button>
                    </div>
                  )}
                  {!isDesktopBuild && (
                    <div className="settings-row">
                      <div>
                        <strong>{t("profile.testNotification")}</strong>
                        <small>{t("profile.testNotificationHint")}</small>
                      </div>
                      <button
                        type="button"
                        className="settings-action"
                        onClick={() => void sendTestPush()}
                        disabled={pushBusy || !pushEnabled}
                      >
                        {t("common.test")}
                      </button>
                    </div>
                  )}
                  <div className="settings-row">
                    <div>
                      <strong>{t("profile.autoTranslate")}</strong>
                    </div>
                    <button
                      type="button"
                      className={`switch-button ${autoTranslate ? "on" : ""}`}
                      onClick={() => changeAutoTranslate(!autoTranslate)}
                      aria-label={t("profile.autoTranslate")}
                      role="switch"
                      aria-checked={autoTranslate}
                    >
                      <span />
                    </button>
                  </div>
                  <button
                    type="button"
                    className="settings-row settings-row-button translation-locale-row"
                    onClick={() => {
                      setTranslationSettingsSearch("");
                      setTranslationPickerOpen(true);
                    }}
                  >
                    <div>
                      <strong>{t("profile.translationLanguage")}</strong>
                      <small>{t("profile.translationLanguageHint")}</small>
                    </div>
                    <span className="settings-current-locale">
                      <b aria-hidden="true">{selectedLanguage?.flag || "🌐"}</b>
                      <span>
                        {selectedLanguage?.localizedLanguage ||
                          targetLanguage.toUpperCase()}
                      </span>
                      <i aria-hidden="true">›</i>
                    </span>
                  </button>
                  {!isStandalone && (
                    <button
                      type="button"
                      className="settings-row settings-row-button settings-install-row"
                      onClick={() => void installApp()}
                    >
                      <span className="settings-account-label">
                        <Download size={19} aria-hidden="true" />
                        {t("profile.install")}
                      </span>
                      <span
                        className="settings-account-chevron"
                        aria-hidden="true"
                      >
                        ›
                      </span>
                    </button>
                  )}
                  <button
                    type="button"
                    className="settings-row settings-row-button settings-logout-row"
                    onClick={() => logout()}
                  >
                    <span className="settings-account-label">
                      <LogOut size={19} aria-hidden="true" />
                      {t("profile.logout")}
                    </span>
                    <span
                      className="settings-account-chevron"
                      aria-hidden="true"
                    >
                      ›
                    </span>
                  </button>
                </section>
              </>
            )}

            {translationPickerOpen && (
              <div
                className="locale-picker-overlay"
                role="dialog"
                aria-modal="true"
                aria-label={t("profile.translationLanguage")}
              >
                <button
                  type="button"
                  className="locale-picker-backdrop"
                  aria-label={t("common.close")}
                  onClick={() => setTranslationPickerOpen(false)}
                />
                <section className="locale-picker-sheet">
                  <header>
                    <div>
                      <strong>{t("profile.translationLanguage")}</strong>
                      <small>{t("translation.subtitle")}</small>
                    </div>
                    <button
                      type="button"
                      aria-label={t("common.close")}
                      onClick={() => setTranslationPickerOpen(false)}
                    >
                      ×
                    </button>
                  </header>

                  <label className="locale-picker-search">
                    <span aria-hidden="true">⌕</span>
                    <input
                      type="search"
                      value={translationSettingsSearch}
                      onChange={(event) =>
                        setTranslationSettingsSearch(event.target.value)
                      }
                      placeholder={t("translation.searchPlaceholder")}
                      autoComplete="off"
                      autoCapitalize="none"
                      spellCheck={false}
                    />
                    {translationSettingsSearch && (
                      <button
                        type="button"
                        aria-label="Xóa tìm kiếm"
                        onClick={() => setTranslationSettingsSearch("")}
                      >
                        ×
                      </button>
                    )}
                  </label>

                  <div className="locale-picker-list">
                    {visibleTranslationSettingsOptions.map((language) => (
                      <button
                        key={language.value}
                        type="button"
                        className={`locale-option ${targetLanguage === language.value ? "active" : ""}`}
                        onClick={() => changeTargetLanguage(language.value)}
                      >
                        <span className="locale-option-flag" aria-hidden="true">
                          {language.flag}
                        </span>
                        <span className="locale-option-copy">
                          <strong>{language.localizedLanguage}</strong>
                          <small>{language.nativeLanguage}</small>
                          <em>
                            {language.localizedRegion} · {language.nativeRegion}
                          </em>
                        </span>
                        <b>{language.code}</b>
                        {targetLanguage === language.value && (
                          <i aria-hidden="true">✓</i>
                        )}
                      </button>
                    ))}
                    {visibleTranslationSettingsOptions.length === 0 && (
                      <div className="locale-picker-empty">
                        {t("translation.noResults")}
                      </div>
                    )}
                  </div>

                  <footer>{t("translation.languageHint")}</footer>
                </section>
              </div>
            )}

            {localePickerOpen && (
              <div
                className="locale-picker-overlay"
                role="dialog"
                aria-modal="true"
                aria-label={t("locale.title")}
              >
                <button
                  type="button"
                  className="locale-picker-backdrop"
                  aria-label={t("common.close")}
                  onClick={() => setLocalePickerOpen(false)}
                />
                <section className="locale-picker-sheet">
                  <header>
                    <div>
                      <strong>{t("locale.title")}</strong>
                      <small>{t("locale.subtitle")}</small>
                    </div>
                    <button
                      type="button"
                      aria-label={t("common.close")}
                      onClick={() => setLocalePickerOpen(false)}
                    >
                      ×
                    </button>
                  </header>

                  <label className="locale-picker-search">
                    <span aria-hidden="true">⌕</span>
                    <input
                      type="search"
                      value={localeSearch}
                      onChange={(event) => setLocaleSearch(event.target.value)}
                      placeholder={t("locale.searchPlaceholder")}
                      autoComplete="off"
                      autoCapitalize="none"
                      spellCheck={false}
                    />
                    {localeSearch && (
                      <button
                        type="button"
                        aria-label="Xóa tìm kiếm"
                        onClick={() => setLocaleSearch("")}
                      >
                        ×
                      </button>
                    )}
                  </label>

                  {!localeSearch && (
                    <button
                      type="button"
                      className={`locale-option locale-auto-option ${appLocale === "auto" ? "active" : ""}`}
                      onClick={() => void changeAppLocale("auto")}
                    >
                      <span className="locale-option-flag" aria-hidden="true">
                        ⚙️
                      </span>
                      <span className="locale-option-copy">
                        <strong>{t("locale.device")}</strong>
                        <small>{t("locale.deviceHint")}</small>
                        <em>
                          {selectedAppLanguage?.flag}{" "}
                          {selectedAppLanguage?.localizedLanguage}
                        </em>
                      </span>
                      {appLocale === "auto" && <i aria-hidden="true">✓</i>}
                    </button>
                  )}

                  <div className="locale-picker-list">
                    {visibleLocaleOptions.map((language) => (
                      <button
                        key={language.value}
                        type="button"
                        className={`locale-option ${appLocale === language.value ? "active" : ""}`}
                        onClick={() => void changeAppLocale(language.value)}
                      >
                        <span className="locale-option-flag" aria-hidden="true">
                          {language.flag}
                        </span>
                        <span className="locale-option-copy">
                          <strong>{language.localizedLanguage}</strong>
                          <small>{language.nativeLanguage}</small>
                          <em>
                            {language.localizedRegion} · {language.nativeRegion}
                          </em>
                        </span>
                        <b>{language.code}</b>
                        {appLocale === language.value && (
                          <i aria-hidden="true">✓</i>
                        )}
                      </button>
                    ))}
                    {visibleLocaleOptions.length === 0 && (
                      <div className="locale-picker-empty">
                        {t("locale.noResults")}
                      </div>
                    )}
                  </div>

                  <footer>{t("locale.dynamicHint")}</footer>
                </section>
              </div>
            )}
          </div>
        )}
      </section>

      {feedComposerOpen && tab === "feed" && isProfileDesktop && (
        <ProfileOverlay
          title="Tạo bài viết"
          busy={!!pendingPost || mediaUploading === "feed"}
          onClose={() => {
            setFeedComposerOpen(false);
            setFeedCheckInOpen(false);
          }}
        >
          {postComposer}
        </ProfileOverlay>
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
        conversations={displayConversations.map(({ id, name, type, otherUsername }) => ({
          id,
          name,
          type,
          otherUsername,
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
    </main>
  );
}