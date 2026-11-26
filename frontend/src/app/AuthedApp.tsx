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
import { createAppLogout } from "./lifecycle/createAppLogout";
import { createAppTabSwitch } from "./navigation/createAppTabSwitch";
import { useFeedRouteLifecycle } from "./navigation/useFeedRouteLifecycle";
import { applyPostLikePreviews } from "./applyPostLikePreviews";
import { useAppChatSearchState } from "./hooks/useAppChatSearchState";
import { useFeedRefreshInterval } from "./hooks/useFeedRefreshInterval";
import { useAppInstallState } from "./hooks/useAppInstallState";
import { useLatest } from "../shared/hooks/useLatest";
import { useSessionKeepalive } from "./hooks/useSessionKeepalive";
import { useChatOutboxReconnect } from "./hooks/useChatOutboxReconnect";
import { useUnreadDocumentTitle } from "./hooks/useUnreadDocumentTitle";
import { useDesktopShortcuts } from "./hooks/useDesktopShortcuts";
import { useDesktopNotifications } from "../features/chat/hooks/useDesktopNotifications";
import { useConversationData } from "../features/chat/hooks/useConversationData";
import { revokeConversationMembership, restoreConversationFromNotification } from "../features/chat/lib/conversationMembershipLifecycle";
import { useConversationListSearch } from "../features/chat/hooks/useConversationListSearch";
import {
  useChatQuickSearch,
} from "../features/chat/hooks/useChatQuickSearch";
import { useContactData } from "../features/contacts/hooks/useContactData";
import { selectFriendRelationship } from "../features/contacts/utils/friendRelationship";
import { useFeedData } from "../features/feed/hooks/useFeedData";
import { useFeedPagingOrchestration } from "../features/feed/hooks/useFeedPagingOrchestration";
import { useFollowingPosts } from "../features/feed/hooks/useFollowingPosts";

import { useGroupManagement } from "../features/chat/hooks/useGroupManagement";
import { API } from "../shared/lib/config";
import type {
  UserPrivacy,
} from "../features/profile/types";
import {
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
import { FEED_PAGE_SIZE, type PendingStoryView, type Post, type Story } from "../features/feed/types";
import type { Tab } from "../shared/types/navigation";
import { useLocation, useNavigate } from "react-router-dom";
import { ROUTE, TAB_PATH, chatConversationIdFromPath, feedPostIdFromPath, feedPostPath } from "./router/routes";
import { useAppRouteNavigation } from "./router/useAppRouteNavigation";
import { useGlobalSearchShortcut } from "./navigation/useGlobalSearchShortcut";
import { resolveDesktopSection } from "./navigation/resolveDesktopSection";
import { createVisitorNavigation } from "./navigation/createVisitorNavigation";
import { useMessageSoundPreference } from "./hooks/useMessageSoundPreference";
import { useChatConversationRoute } from "./router/useChatConversationRoute";
import { useChatRouteConversation } from "../features/chat/hooks/useChatRouteConversation";
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
  profileAssetUrl,
} from "../shared/ui/UserAvatar";
import useSlidingPill from "../shared/ui/useSlidingPill";
import MediaAttachmentsView from "../shared/ui/MediaAttachmentsView";
import UiIcon from "../shared/ui/UiIcon";
import NearbyRadar from "../features/discover/components/NearbyRadar";
import CommunitySuggestions from "../features/discover/components/CommunitySuggestions";
import { createPostComposerPresenter } from "../features/feed/components/createPostComposerPresenter";
import ReactionParticipantsDialog from "../shared/ui/ReactionParticipantsDialog";
import SharedPostLinkPicker from "../features/chat/components/SharedPostLinkPicker";
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
import { useDesktopScreenshot } from "./navigation/useDesktopScreenshot";
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
import CommunicationHub from "../features/chat/components/CommunicationHub";
import CallCenter from "../features/calls/components/CallCenter";
import type { GroupWorkspaceMode } from "../features/chat/components/CommunityGroupsPage";
import FeedCommunitiesList from "../features/feed/components/FeedCommunitiesList";
import "../features/chat/styles/community-groups.css";
import CommunityGroupWizard, { type CommunityCreationExtras } from "../features/chat/components/CommunityGroupWizard";
import GroupSettingsPanel from "../features/chat/components/GroupSettingsPanel";
import GroupChannelPicker from "../features/chat/components/GroupChannelPicker";
import { validGroupChannels } from "../features/chat/utils/groupChannels";
import GroupInviteJoinDialog from "../features/chat/components/GroupInviteJoinDialog";
import ContactsView from "../features/contacts/components/ContactsView";
import PrivacyControls from "../features/profile/components/PrivacyControls";
import AccountSessionsPanel from "../features/auth/components/AccountSessionsPanel";
import BlockedUsersPanel from "../features/contacts/components/BlockedUsersPanel";
import {
  Fragment,
  lazy,
  Suspense,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
  useEffect,
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import {
  FeedText,
  type FeedComment,
  type DiscussionDraft,
} from "../features/feed/components/FeedDiscussion";
import { createFeedDiscussionPresenter } from "../features/feed/components/createFeedDiscussionPresenter";
import { createFeedPostListPresenter } from "../features/feed/components/createFeedPostListPresenter";
import FeedModeration from "../features/feed/components/FeedModeration";
import GroupCreator from "../features/chat/components/GroupCreator";
import {
  Ban,
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
  createSessionClient,
  type Session,
} from "../features/auth/lib/session";
import {
  clearPendingSend,
  loadPendingSend,
} from "../features/chat/lib/chatPersistence";
import {
  confirmChatMessage,
  enqueueChatMessage,
  retryableChatMessages,
  type QueuedChatMessage,
} from "../features/chat/lib/chatOutbox";
import { uploadPresignedFile } from "../features/chat/lib/mediaUpload";
import { chatFilesFromClipboard } from "../features/chat/utils/chatFileTransfer";
import { canMarkConversationRead } from "../features/chat/utils/conversationRead";
import { mergeById, toggleMessageReactionCount } from "../shared/utils/optimistic";
import { CallHeaderActions } from "../features/calls/components/CallManager";
import SharedContent from "../features/chat/components/SharedContent";
import VoiceRecorder from "../features/chat/components/VoiceRecorder";
import { SocoEmptyState, SocoTextAction } from "../shared/ui/SocoUI";
import {
  getCurrentPositionSmart,
  geolocationErrorMessage,
} from "../features/discover/lib/geolocation";

const ProfileQr = lazy(() => import("../features/profile/components/ProfileQr"));
import {
  defaultBundle,
  loadCachedBundle,
  resolveEffectiveLocale,
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
  isPushDisabled,
  setupOneSignal,
  type PushState,
} from "../features/notifications/lib/onesignal";

import { isDesktopBuild } from "../platform/desktop";
import AppHeader, { AppHeaderActions } from "./header/AppHeader";
import AppLayout from "./layouts/AppLayout";
import { withContactNicknames, mergeContactSearchResults, selectChatListConversations, sortChatListConversations } from "./selectors/appListSelectors";
import { selectDisplayedFeedPosts } from "./selectors/feedListSelector";
import { createSecondaryPageSlots } from "./router/createSecondaryPageSlots";
import AppShellNotices from "./layouts/AppShellNotices";
import AppShellUploadProgress from "./layouts/AppShellUploadProgress";
import AppShellCallManager from "./layouts/AppShellCallManager";

import { notificationRouteTarget } from "./navigation/notificationDeepLink";
import { inviteRouteTarget } from "./navigation/inviteDeepLink";
import AppQuickSearch from "./header/AppQuickSearch";
import HeaderActions from "./header/HeaderActions";
import HeaderAccount from "./header/HeaderAccount";
import HeaderTitle from "./header/HeaderTitle";
import HeaderFeedTabs from "./header/HeaderFeedTabs";
import CallsSection from "../features/calls/components/CallsSection";
import ChatTranslationSection from "../features/chat/components/ChatTranslationSection";
import FeedPostDetail from "../features/feed/components/FeedPostDetail";
import FeedSection from "../features/feed/components/FeedSection";
import ConversationActionDialog from "../features/chat/components/ConversationActionDialog";
import MessageActionDialog from "../features/chat/components/MessageActionDialog";
import StoryOverlay from "../features/feed/components/StoryOverlay";
import ProfileOverviewSection from "../features/profile/components/ProfileOverviewSection";
import ProfileSection from "../features/profile/components/ProfileSection";
import ChatSection from "../features/chat/components/ChatSection";
import StoryDraftOverlay from "../features/feed/components/StoryDraftOverlay";
import AppComposerOverlays from "./layouts/AppComposerOverlays";
import { useNearbyDiscovery } from "../features/discover/hooks/useNearbyDiscovery";
import { useAccountSessions } from "../features/auth/hooks/useAccountSessions";
import { usePushSettings } from "../features/notifications/hooks/usePushSettings";
import { requestPushConfig } from "../features/notifications/api/push";
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
import { useGroupChannelLiveSync } from "../features/chat/hooks/useGroupChannelLiveSync";
import { useChatMessageJumpFocus } from "../features/chat/hooks/useChatMessageJumpFocus";
import { useGroupSettingsEscape } from "../features/chat/hooks/useGroupSettingsEscape";
import { useDirectConversations } from "../features/chat/hooks/useDirectConversations";
import { useGroupCreation } from "../features/chat/hooks/useGroupCreation";
import { usePostSync } from "../features/feed/hooks/usePostSync";
import { usePostMentions } from "../features/feed/hooks/usePostMentions";
import { createOpenMentionPost } from "../features/feed/utils/createOpenMentionPost";
import { usePostRouteLoad } from "../features/feed/hooks/usePostRouteLoad";
import { useProfilePosts } from "../features/feed/hooks/useProfilePosts";
import { usePostComposer } from "../features/feed/hooks/usePostComposer";
import { usePostReactions } from "../features/feed/hooks/usePostReactions";
import { usePostComments } from "../features/feed/hooks/usePostComments";
import { usePostDetailNavigation } from "../features/feed/hooks/usePostDetailNavigation";
import { useInviteSharing } from "../features/profile/hooks/useInviteSharing";
import { useStoryActions } from "../features/feed/hooks/useStoryActions";
import { usePrivacySettings } from "../features/settings/hooks/usePrivacySettings";
import { savePrivacySettings } from "../features/settings/api/privacy";
import { useNearbyState } from "../features/discover/hooks/useNearbyState";
import { useBlockedUsers } from "../features/contacts/hooks/useBlockedUsers";
import { useFriendSearch } from "../features/contacts/hooks/useFriendSearch";
import { useFriendSearchRequests } from "../features/contacts/hooks/useFriendSearchRequests";
import { useAppLocaleState } from "../features/i18n/hooks/useAppLocaleState";
import { useLanguagePreferencesLifecycle } from "../features/i18n/hooks/useLanguagePreferencesLifecycle";
import { useTranslationState } from "../features/chat/hooks/useTranslationState";
import { useProfileState } from "../features/profile/hooks/useProfileState";
import { profileEditDraft } from "../features/profile/utils/profileEditDraft";
import { useProfileIdentityActions } from "../features/profile/hooks/useProfileIdentityActions";
import { useFeedUiState } from "../features/feed/hooks/useFeedUiState";
import { useChatPanelState } from "../features/chat/hooks/useChatPanelState";
import { useScopedState } from "../shared/hooks/useScopedState";
import { useGroupWorkspaceState } from "../features/chat/hooks/useGroupWorkspaceState";
import { useChatDraftState } from "../features/chat/hooks/useChatDraftState";
import { useChatScrollCoordinator } from "../features/chat/hooks/useChatScrollCoordinator";
import { useConversationViewReset } from "../features/chat/hooks/useConversationViewReset";
import { useIncomingMessageAutoTranslation } from "../features/chat/hooks/useIncomingMessageAutoTranslation";
import { useChatOutboxState } from "../features/chat/hooks/useChatOutboxState";
import { useChatOutboxReceiptReconciliation } from "../features/chat/hooks/useChatOutboxReceiptReconciliation";
import { useChatQuickSelectionActions } from "../features/chat/hooks/useChatQuickSelectionActions";
import { useChatComposerSurface } from "../features/chat/hooks/useChatComposerSurface";
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
  const screenshot = useDesktopScreenshot(setNotice);
  const { chatCreateError, directUsername, groupCreateStep, groupWorkspaceMode, newChatMode, quickCreateOpen, setChatCreateError, setDirectUsername, setGroupCreateStep, setGroupWorkspaceMode, setNewChatMode, setQuickCreateOpen } = useGroupWorkspaceState({  });

  const { isProfileDesktop, postSubmitError, profileBioDraft, profileBusy, profileCityDraft, profilePublicDetailsDraft, profileComposerOpen, profileDisplayNameDraft, profileEditorOpen, profileHasMore, profileHeadingRef, profileIdentityRef, profileLoadSequence, profileMedia, profilePagingBusy, profilePosts, profilePostsBusy, profilePostsError, profileSaving, profileTimelineOpen, profileUsernameDraft, setPostSubmitError, setProfileBioDraft, setProfileBusy, setProfileCityDraft, setProfilePublicDetailsDraft, setProfileComposerOpen, setProfileDisplayNameDraft, setProfileEditorOpen, setProfileHasMore, setProfileMedia, setProfilePosts, setProfilePostsBusy, setProfilePostsError, setProfileSaving, setProfileTimelineOpen, setProfileUsernameDraft } = useProfileState({ sessionId: session?.sessionId ?? null });

  const { appLocale, languageSearch, localePickerOpen, localeSearch, setAppLocale, setLanguageSearch, setLocalePickerOpen, setLocaleSearch, setTranslationPickerOpen, setUiBundle, setUiLocaleLoading, translationPickerOpen, uiBundle, uiLocaleLoading } = useAppLocaleState({  });

  const { friendActionBusy, friendActionRef, friendBusyIds, friendMenuId, friendQuery, friendResults, friendSearchError, friendSearchRetry, friendSearching, setFriendActionBusy, setFriendBusyIds, setFriendMenuId, setFriendQuery, setFriendResults, setFriendSearchError, setFriendSearchRetry, setFriendSearching } = useFriendSearch({  });

  const { blockedBusy, blockedError, blockedOpen, blockedUsers, setBlockedBusy, setBlockedError, setBlockedOpen, setBlockedUsers } = useBlockedUsers({  });

  const { nearbyBusy, nearbyRadiusKm, nearbyRequest, nearbyResultRadiusKm, nearbyScanning, nearbyUntil, nearbyUsers, setNearbyBusy, setNearbyRadiusKm, setNearbyResultRadiusKm, setNearbyScanning, setNearbyUntil, setNearbyUsers } = useNearbyState({  });

  const { managedSessions, sessionsBusy, sessionsError, sessionsOpen, setManagedSessions, setSessionsBusy, setSessionsError, setSessionsOpen } = useSessionsPanel({ session });

  const { autoTranslate, conversationTranslationOverrides, manuallyTranslated, setAutoTranslate, setConversationTranslationOverrides, setManuallyTranslated, setTargetLanguage, setTranslationFailures, setTranslationMenuOpen, setTranslationOriginals, setTranslationPending, setTranslations, targetLanguage, translationAttempted, translationFailures, translationLanguageRef, translationMenuOpen, translationOriginals, translationPending, translations } = useTranslationState({ session });


  const routeLocation = useLocation();
  const isSearchResultsRoute = routeLocation.pathname === "/search";
  const navigate = useNavigate();
  useGlobalSearchShortcut();
  const {
    tab, setTab, contactsScreen, setContactsScreen,
    desktopProfileSettings, setDesktopProfileSettings,
    visitorUsername, openVisitorProfile, closeVisitor,
  } = useAppRouteNavigation();
  const { activePostId, activeStoryId, commentEditors, commentSortOrder, feedCheckInLocation, feedCheckInOpen, feedCommunitiesOpen, feedComposerOpen, feedFilter, feedViewRef, searchHasScrolled, setActivePostId, setActiveStoryId, setCommentEditors, setCommentSortOrder, setFeedCheckInLocation, setFeedCheckInOpen, setFeedCommunitiesOpen, setFeedComposerOpen, setFeedFilter, setSearchHasScrolled, setStoryBusy, setStoryDraft, storyBusy, storyDraft } = useFeedUiState({ tab });

  const [inlineCommentsId, setInlineCommentsId] = useScopedState<number | null>(tab, null);
  const tabRef = useLatest(tab);
  const {
    globalSearch, setGlobalSearch, chatListQuery, setChatListQuery,
    chatListFilter, setChatListFilter,
    quickSearchOpen, setQuickSearchOpen, phoneSearchLayout, quickSearchAnchorRef,
    chatSearchJump, setChatSearchJump, chatSearchJumpRevision,
    nextChatSearchJumpRevision, lastScrolledSearchJump,
  } = useAppChatSearchState();
  const [activeConversationId, setActiveConversationId] = useState<
    number | null
  >(null);
  const selectRoutedConversation = useChatConversationRoute(activeConversationId, setActiveConversationId);
  const { channelSelection, conversationActionId, conversationDetailsOpen, conversationMenuPosition, groupActivityCreateKind, groupActivityViewedId, groupChannelBusy, groupChannelState, groupMemberViewOpen, historyActionBusy, messageActionId, messageActionMode, messageSearchOpen, replyingTo, setChannelSelection, setConversationActionId, setConversationDetailsOpen, setConversationMenuPosition, setGroupActivityCreateKind, setGroupActivityViewedId, setGroupChannelBusy, setGroupChannelState, setGroupMemberViewOpen, setHistoryActionBusy, setMessageActionId, setMessageActionMode, setMessageSearchOpen, setReplyingTo, setSharedContentOpen, sharedContentOpen } = useChatPanelState({ activeConversationId, sessionId: session?.sessionId ?? null });

  const activeConversationIdRef = useRef<number | null>(null);
  const selectedChannelId = channelSelection.conversationId === activeConversationId ? channelSelection.channelId : 0;
  const activeChannelIdRef = useLatest(selectedChannelId);
  const activeConversationTypeRef = useRef<'group' | 'direct' | null>(null);
  const groupChannels = groupChannelState.conversationId === activeConversationId
    ? groupChannelState.channels
    : validGroupChannels([], activeConversationId ?? 0);
  const messagesScrollRef = useRef<HTMLDivElement>(null);
  const messageScrollAtBottom = useRef(true);
  const setMessageScrollAtBottom = useCallback((next: boolean) => { messageScrollAtBottom.current = next; }, []);
  const ownSendScrollConversation = useRef<number | null>(null);
  const [messageCopyTarget, setMessageCopyTarget] =
    useState<MessageCopyTarget | null>(null);

  const {
    messageDrafts, setMessageDrafts, channelDrafts, setChannelDrafts,
    channelDraftKey, draft, messageText, messageAttachments, setMessageText,
  } = useChatDraftState({
    userId: session?.user.id ?? 0,
    sessionRef,
    activeConversationId,
    selectedChannelId,
  });
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
  const [postLinkToSend, setPostLinkToSend] = useScopedState<string | null>(session?.sessionId ?? null, null);
  const [forwardSource, setForwardSource] = useScopedState<Message | null>(session?.sessionId ?? null, null);
  const [reactionTarget, setReactionTarget] = useScopedState<{
    kind: "message" | "post"; id: number; initialEmoji?: string;
    portalContainer?: HTMLElement;
    reactions?: { emoji: string; count: number }[];
  } | null>(session?.sessionId ?? null, null);
  const messageChanges = useRef(new Set<number>());
  const resetMessageChanges = useCallback((next: Set<number>) => { messageChanges.current = next; }, []);
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
  const {
    chatOutbox, setChatOutbox, chatOutboxRef, chatOutboxSession, sendingClientIDs,
    retryOutboxBusy, chatOnline, setChatOnline, updateChatOutbox,
  } = useChatOutboxState({ session, sessionRef, actionLocksRef: actionLocks, setNotice });
  const preferenceRevision = useRef(0);
  const advancePreferenceRevision = useCallback(() => ++preferenceRevision.current, []);
  const { openVisitor, setFriendPreview } = createVisitorNavigation({
    getOwnUsername: () => sessionRef.current?.user.username,
    openOwnProfile: () => {
      setTab("profile");
      setProfileTimelineOpen(true);
    },
    openVisitorProfile,
    closeVisitor,
    visitorUsername,
  });
  const [qrOpen, setQrOpen] = useState<"mine" | "scan" | null>(null);
  const [desktopSectionState, setDesktopSection] = useState<
    "groups" | "calls" | null
  >(null);
  const desktopSection = resolveDesktopSection(routeLocation.pathname, desktopSectionState);
  const [translationSettingsConversationId, setTranslationSettingsConversationId] = useState<number | null>(null);
  const [translationSettingsActiveConversationId, setTranslationSettingsActiveConversationId] = useState(activeConversationId);
  // Reset dialog state during render when the selected conversation changes,
  // so a stale dialog never appears for a previous conversation.
  if (translationSettingsActiveConversationId !== activeConversationId) {
    setTranslationSettingsActiveConversationId(activeConversationId);
    setTranslationSettingsConversationId(null);
  }
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
  const { mentions: postMentions, readPostMention, isCurrentVisit: isCurrentMentionVisit } = usePostMentions({
    sessionId: session?.sessionId ?? null,
    notificationsTab: tab === "notifications",
    apiFetch,
    onReadError: message => setNotice(message, "error"),
  });
  useFeedRouteLifecycle({
    tab,
    searchKey: globalSearch.trim().toLocaleLowerCase('vi-VN'),
    feedViewRef,
    setSearchHasScrolled,
    pathname: routeLocation.pathname,
    search: routeLocation.search,
    getPostIdFromPath: feedPostIdFromPath,
    setActivePostId,
  });
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
  useLayoutEffect(() => {
    translationLanguageRef.current = effectiveTargetLanguage;
  }, [effectiveTargetLanguage, translationLanguageRef]);
  const [translationPreferencesLoaded, setTranslationPreferencesLoaded] =
    useState(false);
  const [status, setStatus] = useState("Đang kết nối...");
  const isStandalone = useAppInstallState(() => {
    setInstallPrompt(null);
    setNotice("SocCO đã được cài vào thiết bị");
  });
  const [pushConfigured, setPushConfigured] = useState(false);
  const [pushAppId, setPushAppId] = useState("");
  const [pushEnabled, setPushEnabled] = useState(false);
  const { messageSoundEnabled, setMessageSoundEnabled, messageSoundEnabledRef, messageSound } = useMessageSoundPreference();
  const [pushBusy, setPushBusy] = useState(false);
  const [pushInitFailed, setPushInitFailed] = useState(false);
  const [pushPrompt, setPushPrompt] = useState(false);
  const [pushPromptDismissed, setPushPromptDismissed] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const postComposerRef = useRef<HTMLTextAreaElement>(null);
  const { messageInputRef } = useChatComposerSurface({ tab, activeConversationId, desktopSection, messageText });

  useDesktopShortcuts({
    sessionRef,
    onOpenChat: () => setTab("chat"),
    messageInputRef,
  });
  const feedAlbumInputRef = useRef<HTMLInputElement>(null);
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
    conversationListError,
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
    savedPostsBusy,
    savedPostsLoaded,
    resetSavedPosts,
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

  const routedPost = usePostRouteLoad({
    sessionId: session?.sessionId ?? null,
    sessionToken: session?.token ?? null,
    sessionRef,
    tab,
    routeSearch: routeLocation.search,
    routePostId: feedPostIdFromPath(routeLocation.pathname),
    request: apiFetch,
    setTab,
    setPosts,
    onError: message => setNotice(message, "error"),
  });

  const followingFeed = useFollowingPosts({
    sessionId: session?.sessionId,
    enabled: tab === "feed" && feedFilter === "following",
    request: apiFetch,
  });
  const { feedSearchActive, postSearch, feedInitialLoading, feedLoadingMore, feedPagingError, feedInfiniteScrollRef } =
    useFeedPagingOrchestration({
      tab,
      sessionId: session?.sessionId,
      globalSearch,
      feedFilter,
      request: apiFetch,
      followingFeed,
      savedPostsLoaded,
      savedPagingError,
      savedPostsBusy,
      postsLoadingMore,
      postsPagingError,
      searchHasScrolled,
      hasMoreSavedPosts,
      hasMorePosts,
      loadSavedPosts,
      loadMorePosts,
    });

  const {
    messages,
    setMessages,
    hasMoreMessages,
    setHasMoreMessages,
    messagesLoadingMore,
    messageHistoryLoading,
    messageHistoryError,
    retryMessageHistory,
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
    resetMessageChanges,
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
  }, [groupSettingsOpen, setGroupMemberViewOpen]);

  useGroupSettingsEscape(groupSettingsOpen, setGroupSettingsOpen);

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
  useChatMessageJumpFocus({
    jump: chatSearchJump,
    activeConversationId,
    messages,
    lastScrolledRevision: lastScrolledSearchJump,
  });
  const name = session?.user.username || "";
  const displayConversations = useMemo(
    () => withContactNicknames(conversations, contactMetadata),
    [conversations, contactMetadata],
  );
  const activeConversation =
    displayConversations.find((item) => item.id === activeConversationId) ||
    null;
  const routeConversationId = chatConversationIdFromPath(routeLocation.pathname);
  const onRouteConversationUnavailable = useCallback(() => {
    setNotice("Hội thoại không tồn tại hoặc bạn không có quyền truy cập.", "warning");
    navigate(TAB_PATH.chat, { replace: true });
  }, [navigate, setNotice]);
  const onRouteConversationError = useCallback(() => {
    setNotice("Chưa tải được hội thoại từ liên kết. Kiểm tra kết nối và thử tải lại.", "warning");
  }, [setNotice]);
  useChatRouteConversation({
    conversationId: routeConversationId,
    known: activeConversation?.id === routeConversationId,
    sessionId: session?.sessionId ?? null,
    sessionRef,
    request: apiFetch,
    setConversations,
    revokedIds: revokedConversationIds,
    membershipIds: membershipSnapshot,
    onUnavailable: onRouteConversationUnavailable,
    onError: onRouteConversationError,
  });
  useLayoutEffect(() => {
    activeConversationTypeRef.current = activeConversation?.type ?? null;
  }, [activeConversation?.type]);

  const { groupChannelUnreadAvailable } = useGroupChannelLiveSync({
    groupConversationId: activeConversation?.type === "group" ? activeConversation.id : null,
    sessionToken: session?.token ?? null,
    request: apiFetch,
    setGroupChannelState,
    setChannelSelection,
    setConversations,
    setNotice,
  });
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
  // Message updates should not rebuild the feed previews, and unrelated shell
  // state changes should not remap every visible message in a long conversation.
  const visiblePosts = useMemo(
    () => applyPostLikePreviews(posts, likePreviews),
    [posts, likePreviews],
  );
  const visibleMessages = useMemo(
    () => messages.filter(message => (message.channelId || 0) === selectedChannelId).map((message) =>
      reactionPreviews[message.id]
        ? {
            ...message,
            reactions: message.deleted ? [] : reactionPreviews[message.id],
          }
        : message,
    ),
    [messages, selectedChannelId, reactionPreviews],
  );
  const visibleProfilePosts = useMemo(
    () => applyPostLikePreviews(profilePosts, likePreviews),
    [profilePosts, likePreviews],
  );
  // Shared links are routed, while opening a card in the feed is local UI state.
  const feedRoutePostId = feedPostIdFromPath(routeLocation.pathname)
    ?? Number(new URLSearchParams(routeLocation.search).get("post"));
  const visibleActivePostId = tab === "feed" && Number.isSafeInteger(feedRoutePostId) && feedRoutePostId > 0
    ? feedRoutePostId
    : activePostId;
  const activePost = visibleActivePostId
    ? [
        ...visibleProfilePosts,
        ...visiblePosts,
        ...savedPosts,
        ...postSearch.posts,
        ...followingFeed.posts,
        ...(routedPost ? [routedPost] : []),
      ].find((item) => item.id === visibleActivePostId) || null
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
  const { addComment, manageFeedComment, reportFeedComment, setCommentLike } = usePostComments({ actionLocks, feedRevisionRef: feedRevision, followingFeed, name, postSearch, setPendingComments, setPosts, setProfilePosts, setSavedPosts, syncFeedPost });
  const { closeFeedPostDetails, openFeedPostDetails } = usePostDetailNavigation({ setActivePostId });

  const { clearActiveConversationHistory } = useConversationHistory({ activeConversationId, activeConversationIdRef, conversations, historyActionBusy, refreshConversations, responseCache, setActiveConversationId, setConversationDetailsOpen, setHasMoreMessages, setHistoryActionBusy, setMessageSearchOpen, setMessages, setReplyingTo, setSharedContentOpen, setTranslations });
  const { createGroupChannel, selectGroupChannel, refreshGroupChannels } = useGroupChannels({ activeChannelIdRef, activeConversation, activeGroupMember, groupChannelBusy, groupChannels, messageScrollAtBottomRef: messageScrollAtBottom, setChannelSelection, setChatSearchJump, setConversationDetailsOpen, setGroupChannelBusy, setGroupChannelState, setHasMoreMessages, setMessageActionId, setMessageSearchOpen, setReplyingTo });
  const { createDirect, openDirectByUsername } = useDirectConversations({ actionLocks, directUsername, membershipEventSequenceRef: membershipEventSequence, membershipSnapshot, refreshConversations, revokedConversationIds, setActiveConversationId: selectRoutedConversation, setChatCreateError, setConversations, setDesktopSection, setDirectUsername, setFriendQuery, setFriendResults, setGlobalSearch, setNewChatMode, setTab, setTranslations });
  const { createGroup } = useGroupCreation({ actionLocks, membershipEventSequenceRef: membershipEventSequence, membershipSnapshot, refreshConversations, revokedConversationIds, setActiveConversationId: selectRoutedConversation, setChatCreateError, setConversations, setFriendQuery, setNewChatMode, setTab });

  const { changeAppLocale, changeAutoTranslate, changeTargetLanguage, saveConversationTranslationSettings, translateMessage } = useTranslationActions({ activeChatTranslationSettings, activeConversationId, activeConversationIdRef, apiFetch, appLocale, autoTranslate, conversationTranslationOverrides, effectiveTargetLanguage, preferenceRevision, advancePreferenceRevision, session, sessionRef, setAppLocale, setAutoTranslate, setConversationTranslationOverrides, setLanguageSearch, setLocalePickerOpen, setLocaleSearch, setManuallyTranslated, setNotice, setTargetLanguage, setTranslationFailures, setTranslationMenuOpen, setTranslationOriginals, setTranslationPending, setTranslationPickerOpen, setTranslations, setTranslationSettingsSearch, targetLanguage, translationAttempted, translationFailures, translationLanguageRef, translations });

  const { addChatFiles, addFeedFiles, setMessageAttachments, uploadMediaFiles } = useMediaUploads({ activeConversationId, apiFetch, channelDraftKey, mediaUploadAbort, mediaUploading, messageAttachments, messageSending, pendingPost, postAttachments, selectedChannelId, session, sessionRef, setChannelDrafts, setMediaUploading, setMediaUploadProgress, setMessageDrafts, setNotice, setPostAttachments });

  const { copyMessageContent } = useMessageClipboard({ setMessageActionId, setNotice });

  const { installApp, previewMessageSound, sendTestPush, syncPushState, toggleMessageSound, togglePush } = usePushSettings({ apiFetch, installPrompt, isStandalone, messageSound, messageSoundEnabledRef, pushAppId, pushBusy, pushConfigured, pushEnabled, pushInitFailed, session, setInstallPrompt, setMessageSoundEnabled, setNotice, setPushBusy, setPushEnabled, setPushInitFailed, setPushPrompt });

  const { findNearby, stopNearby } = useNearbyDiscovery({ apiFetch, nearbyBusy, nearbyRadiusKm, nearbyRequest, session, sessionRef, setNearbyBusy, setNearbyResultRadiusKm, setNearbyScanning, setNearbyUntil, setNearbyUsers, setNotice });

  useEffect(() => {
    if (!session?.token) return;
    const target = inviteRouteTarget(routeLocation);
    if (!target) return;
    const returnTo = target.to.pathname + target.to.search + target.to.hash;
    navigate(target.to, { replace: true, state: routeLocation.state });
    if (target.username.toLocaleLowerCase("vi-VN") !==
        session.user.username.toLocaleLowerCase("vi-VN")) {
      openVisitor(target.username, returnTo);
    }
  }, [session?.token, routeLocation.pathname, routeLocation.search, routeLocation.hash, navigate]);

  useConversationViewReset(activeConversationId, {
    activeConversationIdRef,
    messageScrollAtBottom,
    messagesPagingBusy,
    setHasMoreMessages,
    setMessagesLoadingMore,
    setGroupMembers,
  });


  const { loadProfileMedia, saveProfileIdentity, updateProfileImage } = useProfileIdentityActions({
    session, sessionRef, apiFetch, saveSession, setNotice, uploadMediaFiles,
    isProfileDesktop,
    profileSaving,
    profileBusy,
    profileDisplayNameDraft,
    profileUsernameDraft,
    profileBioDraft,
    profileCityDraft,
    profilePublicDetailsDraft,
    setProfileMedia,
    setProfileDisplayNameDraft,
    setProfileUsernameDraft,
    setProfileBioDraft,
    setProfileCityDraft,
    setProfilePublicDetailsDraft,
    setProfileSaving,
    setProfileBusy,
    setProfileEditorOpen,
  });

  useEffect(() => {
    if (!session?.token) {
      setProfileMedia(null);
      return;
    }
    void loadProfileMedia().catch(() => setStatus("Đang kết nối lại..."));
  }, [session?.sessionId]);

  useLanguagePreferencesLifecycle({
    session,
    apiFetch,
    preferenceRevision,
    setTranslationPreferencesLoaded,
    setAutoTranslate,
    setTargetLanguage,
    setAppLocale,
  });

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
      const target = notificationRouteTarget(routeLocation);
      if (!target) return;

      if (target.conversationId !== null) {
        setDesktopSection(null);
        setChatSearchJump(
          target.messageId !== null
            ? {
                conversationId: target.conversationId,
                messageId: target.messageId,
                revision: ++chatSearchJumpRevision.current,
              }
            : null,
        );
        setActiveConversationId(target.conversationId);
      }
      // Replace only the consumed query keys; keep the router's location and history in sync.
      navigate(target.to, { replace: true, state: routeLocation.state });
    };
    openNotificationTarget();
  }, [session?.token, routeLocation.pathname, routeLocation.search, routeLocation.hash, navigate]);

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
        const response = await requestPushConfig(apiFetch);
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
      const response = await savePrivacySettings(apiFetch, next);
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

  const contactSearchResults = mergeContactSearchResults(friendQuery, friends, friendRequests, friendResults);

  function friendRelationship(userId: number) {
    return selectFriendRelationship(userId, friends, friendRequests);
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

  useFriendSearchRequests({
    sessionToken: session?.token,
    sessionId: session?.sessionId,
    tab,
    desktopSection,
    newChatMode,
    friendQuery,
    friendSearchRetry,
    apiFetch,
    setFriendResults,
    setFriendSearching,
    setFriendSearchError,
  });

  function purgeConversation(id: number) {
    revokeConversationMembership(id, {
      responseCache,
      revokedConversationIds,
      membershipSnapshot,
      membershipEventSequence,
      activeConversationIdRef,
      setConversations,
      setMessageDrafts,
      setActiveConversationId,
      setHasMoreMessages,
      setGroupMembers,
      setGroupSettingsOpen,
      setSharedContentOpen,
      setTranslations,
      setReplyingTo,
      setMessageActionId,
      setNotice,
    });
  }

  function closeProfileTimeline() {
    setProfileTimelineOpen(false);
    requestAnimationFrame(() => profileIdentityRef.current?.focus());
  }

  const logout = createAppLogout({
    setNearbyUsers,
    setNearbyUntil,
    setNearbyBusy,
    setNearbyScanning,
    setChatOutbox,
    setConversations,
    setHasMoreConversations,
    setConversationLoadingMore,
    setActiveConversationId,
    setMessages,
    setHasMoreMessages,
    setMessagesLoadingMore,
    setOutgoingMessage,
    setPendingPost,
    setPendingComments,
    setLikePreviews,
    setReactionPreviews,
    setMessageSending,
    setGroupBusy,
    setProfileBusy,
    setProfileSaving,
    setStoryBusy,
    setMediaUploading,
    setMediaUploadProgress,
    setFriendBusyIds,
    setFriendActionBusy,
    setMessageDrafts,
    setFriends,
    setFriendRequests,
    setFriendMenuId,
    setFriendPreview,
    setPostText,
    setPostTaggedFriends,
    setPostFeelingId,
    setEditingPost,
    setPostEditBusy,
    setPosts,
    setProfileTimelineOpen,
    setProfileComposerOpen,
    setFeedComposerOpen,
    setProfileEditorOpen,
    setPostSubmitError,
    setProfilePosts,
    setProfileHasMore,
    setProfilePostsBusy,
    setProfilePostsError,
    setHasMorePosts,
    setPostsLoadingMore,
    setStories,
    setActiveStoryId,
    setCommentEditors,
    setPostAttachments,
    setTranslations,
    nearbyRequest,
    chatOutboxRef,
    chatOutboxSession,
    sendingClientIDs,
    pendingSend,
    conversationOffset,
    conversationPagingBusy,
    messagesPagingBusy,
    actionLocks,
    pendingRequests,
    mutationRequests,
    messageReceipts,
    messageSound,
    preferenceRevision,
    sendingRef,
    mediaUploadAbort,
    friendActionRef,
    feedRevision,
    draftBeforeEdit,
    profileLoadSequence,
    profilePagingBusy,
    postsPagingBusy,
    visitorUsername,
    navigate,
    sessionRef,
    endSession,
    setNotice,
    resetSavedPosts,
    revokedConversationIds,
    membershipSnapshot,
    membershipSyncSequence,
    membershipEventSequence,
  });
  const { fetchAccountSessions, revokeAccountSessions } = useAccountSessions({ logout, managedSessions, sessionRef, sessionsBusy, setManagedSessions, setNotice, setSessionsBusy, setSessionsError, setSessionsOpen });



  useSessionKeepalive(session?.sessionId ?? null, sessionRef, sessionClient, setStatus);

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
      restoreConversationFromNotification(conversation, {
        revokedConversationIds,
        membershipSnapshot,
        setConversations,
        switchTab,
        selectConversation: selectRoutedConversation,
      });
    },
  });

  useUnreadDocumentTitle(nativeNotifications.unreadCount);

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

  useFeedRefreshInterval({
    enabled: tab === "feed" && Boolean(session?.token),
    sessionId: session?.sessionId ?? null,
    sessionToken: session?.token ?? null,
    refreshPosts,
    refreshStories,
  });

  useChatScrollCoordinator({
    activeConversationId,
    selectedChannelId,
    messages,
    outgoingMessage,
    chatOutbox,
    messagesScrollRef,
    messageScrollAtBottom,
    ownSendScrollConversation,
    pendingMessageScrollRestore,
  });

  useIncomingMessageAutoTranslation({
    enabled: effectiveAutoTranslate,
    preferencesLoaded: translationPreferencesLoaded,
    messages,
    targetLanguage: effectiveTargetLanguage,
    userId: session?.user.id ?? null,
    sessionId: session?.sessionId ?? null,
    activeConversationId,
    translations,
    attempted: translationAttempted,
    translateMessage,
  });

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
  const { cancelStory, createStory, deleteStory, pendingStory, replyToStory, reportStory, retryStory, shareStory } = useStoryActions({ mediaUploading, name, openDirectByUsername, ownSendScrollConversation, retryQueuedChatMessages, setActiveStoryId, setChatOnline, setStories, setStoryBusy, setStoryDraft, storyBusy, updateChatOutbox, uploadMediaFiles });
  const pendingStoryView: PendingStoryView | null = pendingStory
    ? {
        status: pendingStory.status,
        percent: mediaUploading === "story" && mediaUploadProgress?.total ? Math.min(99, Math.round((mediaUploadProgress.loaded / mediaUploadProgress.total) * 100)) : null,
        kind: "text" in pendingStory.input ? "Chữ" : pendingStory.input.file.type.startsWith("video/") ? "Video" : "Ảnh",
      }
    : null;

  const { actOnFriend, blockContact, changePersonalContact, declineFriendRequest, loadBlockedUsers, openBlockedFriendConversation, removeAcceptedFriend, reportContact, unblockContact } = useContactActions({ apiFetch, blockedBusy, contactMetadata, conversations, friendActionRef, friendBusyIds, friendRelationship, friends, friendSyncRequest, openDirectByUsername, refreshConversations, refreshFriendConnections, session, sessionRef, setActiveConversationId: selectRoutedConversation, setBlockedBusy, setBlockedError, setBlockedOpen, setBlockedUsers, setContactMetadata, setConversations, setDesktopSection, setFriendActionBusy, setFriendBusyIds, setFriendMenuId, setFriendPreview, setFriendRequests, setFriendResults, setFriends, setNotice, setTab });

  useChatOutboxReconnect({
    sessionId: session?.sessionId ?? null,
    retryQueuedMessages: retryQueuedChatMessages,
    setChatOnline,
  });

  useChatOutboxReceiptReconciliation({
    messages,
    sessionId: session?.sessionId ?? null,
    userId: session?.user.id ?? null,
    chatOutboxRef,
    updateChatOutbox,
  });

  const unreadTotal = nativeNotifications.unreadCount ?? 0;
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
  const chatListConversations = selectChatListConversations({
    visibleConversations,
    searchActive: conversationListSearch.active,
    searchItems: conversationListSearch.items,
    searchQuery: chatListQuery,
    filter: chatListFilter,
    revokedIds: revokedConversationIds.current,
    contactMetadata,
  });

  const searchedPosts = selectDisplayedFeedPosts({
    searchActive: feedSearchActive,
    searchPosts: postSearch.posts,
    savedPosts,
    followingPosts: followingFeed.posts,
    visiblePosts,
    filter: feedFilter,
    likePreviews,
  });
  const sortedChatListConversations = sortChatListConversations(chatListConversations);
  const { openChatQuickContact, openChatQuickHit } = useChatQuickSelectionActions({
    setQuickSearchOpen,
    setGlobalSearch,
    setChatSearchJump,
    setConversations,
    selectConversation: selectRoutedConversation,
    openDirectByUsername,
    nextRevision: nextChatSearchJumpRevision,
    setTranslations,
    setTranslationOriginals,
  });
  const openMentionPost = createOpenMentionPost({
    isCurrentMentionVisit,
    apiFetch,
    setPosts,
    setFeedCommunitiesOpen,
    setTab,
    navigate,
    readPostMention,
    setNotice,
    feedPostPath,
  });

  const switchTab = createAppTabSwitch({
    setDesktopSection,
    setFeedCommunitiesOpen,
    setTranslationSettingsConversationId,
    setProfileEditorOpen,
    activePostId,
    setActivePostId,
    routeLocation,
    navigate,
    setQuickSearchOpen,
    setTab,
    setQuickCreateOpen,
    setGlobalSearch,
    setActiveConversationId,
    setFriendQuery,
  });

  const discardDesktopProfileEdits = () => {
    const draft = profileEditDraft(profileMedia, name, session.user.displayName);
    setProfileDisplayNameDraft(draft.displayName);
    setProfileUsernameDraft(draft.username);
    setProfileBioDraft(draft.bio);
    setProfileCityDraft(draft.city);
    setProfilePublicDetailsDraft(draft.publicDetails);
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
      cityDraft={profileCityDraft}
      setCityDraft={setProfileCityDraft}
      publicDetailsDraft={profilePublicDetailsDraft}
      setPublicDetailsDraft={setProfilePublicDetailsDraft}
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
  const postComposer = createPostComposerPresenter({
    props: {
      name,
      createPost,
      editingPost,
      editBusy: postEditBusy,
      postComposerRef,
      postBackground,
      pendingPost,
      postText,
      setPostText,
      taggedFriends: postTaggedFriends,
      setTaggedFriends: setPostTaggedFriends,
      feelingId: postFeelingId,
      setFeelingId: setPostFeelingId,
      feedAlbumInputRef,
      addFeedFiles,
      postAttachments,
      setPostAttachments,
      mediaUploading,
      showPostBackgrounds,
      setShowPostBackgrounds,
      postVisibility,
      setPostVisibility,
      setPostBackground,
      submitError: postSubmitError,
      checkInOpen: feedCheckInOpen,
      checkInLocation: feedCheckInLocation,
      setCheckInLocation: setFeedCheckInLocation,
      setCheckInOpen: setFeedCheckInOpen,
      uploadProgress: mediaUploadProgress,
    },
    friends,
    profileDisplayName: profileMedia?.displayName,
    sessionDisplayName: session.user.displayName,
    profileComposerOpen,
    feedComposerOpen,
    cancelUpload: () => mediaUploadAbort.current?.abort(),
  });

  function openPostDetailProfile(username: string) {
    const returnTo = closeFeedPostDetails();
    openVisitor(username, returnTo);
  }

  const renderPostDiscussion = createFeedDiscussionPresenter({
    sessionId: session.sessionId,
    getCurrentSessionId: () => sessionRef.current?.sessionId,
    sortOrder: commentSortOrder,
    pendingComments,
    commentEditors,
    setCommentEditors,
    api: API,
    token: session.token,
    targetLanguage,
    translationPreferencesLoaded,
    currentUser: name,
    addComment,
    manageFeedComment,
    reportFeedComment,
    setCommentLike,
  });

  function refreshAfterRepost() {
    void refreshPosts();
    if (feedFilter === 'following') followingFeed.refresh();
    if (feedSearchActive) postSearch.retry();
    if (tab === 'profile') void loadProfilePosts(false, true);
  }

  const renderPosts = createFeedPostListPresenter({
    card: {
      name,
      onAuthorOpen: openVisitor,
      ownDisplayName: profileMedia?.displayName || session.user.displayName || name,
      apiFetch,
      syncFeedPost,
      removeFeedPost,
      setNotice,
      token: session.token,
      translationPreferencesLoaded,
      targetLanguage,
      likePreviews,
      like,
      onEditPost: openEditPost,
      onRepostChanged: refreshAfterRepost,
      onShareToChat: setPostLinkToSend,
      taggedNames: friendTaggedNames,
    },
    onOpenPost: openFeedPostDetails,
    toggleInlineComments: id => setInlineCommentsId(current => current === id ? null : id),
    inlineCommentsId,
    renderDiscussion: post => renderPostDiscussion(post, openVisitor),
    onReactionUsers: post => setReactionTarget({ kind: 'post', id: post.id, reactions: post.reactions }),
  });

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
      suggestions={friendResults}
      suggestionsLoading={friendSearching && friendResults.length === 0}
      suggestionsError={friendSearchError}
      onRetrySuggestions={() => setFriendSearchRetry(value => value + 1)}
      onSettings={() => navigate("/settings/privacy")}
      declineFriendRequest={declineFriendRequest}
      friends={friends}
      friendsLoading={friendSyncBusy && friendSyncSessionId !== session.sessionId}
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
      onOpenCallChat={(id) => { setDesktopSection(null); selectRoutedConversation(id); }}
    />
  );

  const searchInConversationList = phoneSearchLayout && tab === "chat" &&
    desktopSection === null && translationSettingsConversationId === null;
  const showHeaderAccount =
    tab === "profile" ||
    tab === "feed" ||
    tab === "notifications" ||
    (tab === "chat" && desktopSection === "groups");
  const quickSearchControl = (
    <AppQuickSearch
      tab={tab}
      anchorRef={quickSearchAnchorRef}
      friendQuery={friendQuery}
      globalSearch={globalSearch}
      conversationSearching={conversationSearching}
      quickSearchOpen={quickSearchOpen}
      setQuickSearchOpen={setQuickSearchOpen}
      setFriendQuery={setFriendQuery}
      setGlobalSearch={setGlobalSearch}
      setTab={setTab}
      navigate={navigate}
      results={chatQuickSearch.results}
      loading={chatQuickSearch.loading}
      error={chatQuickSearch.error}
      retry={chatQuickSearch.retry}
      onContact={openChatQuickContact}
      onHit={openChatQuickHit}
    />
  );

  return (
    <AppLayout
      activeTab={tab}
      className={`app-shell modern-shell app-layout ${tab === "contacts" || tab === "notifications" ? "friends-layout-active" : ""} ${tab === "chat" && activeConversation && !desktopSection ? "conversation-open" : ""} ${tab === "chat" && !desktopSection && translationSettingsConversationId === null ? "chat-rail-screen" : ""}`}
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
        notificationCount={notificationItemCount}
        feedSaved={feedFilter === "saved"}
        settingsActive={desktopProfileSettings}
        searchActive={isSearchResultsRoute}
        onSearch={() => navigate(ROUTE.search)}
        onNavigate={switchTab}
        onScreenshot={screenshot.captureWithoutWindow}
        screenshotBusy={screenshot.busy}
        onSaved={() => {
          switchTab("feed");
          setFeedFilter("saved");
        }}
        onSettings={() => {
          switchTab("profile");
          navigate(ROUTE.settings);
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
          <AppShellUploadProgress
            progress={mediaUploading ? mediaUploadProgress : null}
            onCancel={() => mediaUploadAbort.current?.abort()}
          />
          {visitorUsername && (
        <VisitorProfile
          key={session.sessionId + ":" + visitorUsername}
          username={visitorUsername}
          friendOnline={friends.some((friend) => friend.username === visitorUsername.toLowerCase()
            && friend.status === "accepted" && !friend.blockedByMe && !friend.blockedByOther && friend.online)}
          request={apiFetch}
          currentUser={name}
          token={session.token}
          targetLanguage={translationPreferencesLoaded ? targetLanguage : ""}
          relationship={friendRelationship}
          friendBusy={friendActionBusy}
          onFriend={actOnFriend}
          onRemoveFriend={(friend) => removeAcceptedFriend(friend, { keepProfileOpen: true })}
          onMessage={async (username) => {
            await openDirectByUsername(username);
          }}
          onClose={closeVisitor}
          onReactionUsers={(post) => setReactionTarget({kind: "post", id: post.id, reactions: post.reactions})}
          onOpenOriginal={openFeedPostDetails}
          onRepostChanged={refreshAfterRepost}
          onShareToChat={setPostLinkToSend}
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
      // The search page owns its search field and title, so the shared header is omitted there.
      header={isSearchResultsRoute || tab === "market" || (tab === "profile" && desktopProfileOverview && !profileEditorOpen) ? null : (
        <AppHeader
          mobileSearchActions={tab === "feed"}
          className={`chatnet-appbar ${tab === "chat" && desktopSection === null && translationSettingsConversationId === null ? "mobile-chat-appbar" : ""} ${searchInConversationList ? "mobile-search-in-list" : ""} ${tab === "profile" || tab === "discover" ? "mobile-section-header" : ""}`}
          start={
            <HeaderTitle
              tab={tab}
              searchResults={isSearchResultsRoute}
              desktopSection={desktopSection}
              translationSettingsOpen={translationSettingsConversationId !== null}
              groupWorkspaceMode={groupWorkspaceMode}
              groupCreateStep={groupCreateStep}
              activeConversationName={activeConversation?.name}
              contactsDirectory={contactsScreen !== "invitations"}
              contactsOverview={contactsScreen === "overview"}
              profileSettings={desktopProfileSettings}
              profileDesktop={isProfileDesktop}
              profileEditing={Boolean(desktopProfileOverview && profileEditorOpen)}
            />
          }
          center={tab === "feed" ? (
            <>
              <div className="appbar-feed-desktop"><HeaderFeedTabs
                filter={feedFilter}
                onChange={(next) => { setFeedCommunitiesOpen(false); setFeedFilter(next); }}
              /></div>
              <div className="appbar-feed-mobile">{quickSearchControl}</div>
            </>
          ) : searchInConversationList ? null : quickSearchControl}
          end={
          <AppHeaderActions
            account={
              <HeaderAccount
                variant={tab === "profile" ? "settings" : "profile"}
                desktopOnly={!showHeaderAccount}
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
          }
        />
      )}
      beforePage={<AppShellNotices
        showPushPrompt={pushPrompt && !pushPromptDismissed && !pushEnabled}
        pushBusy={pushBusy}
        notice={notice}
        onDismissPushPrompt={() => setPushPromptDismissed(true)}
        onEnablePush={() => void togglePush()}
        onDismissNotice={dismissNotice}
      />}
      outletContext={{
        frameClassName: tab === "chat" && activeConversation ? "mobile-conversation-open" : "",
        ...createSecondaryPageSlots({
          notifications: {
            actOnFriend,
            conversations,
            declineFriendRequest,
            friendBusyIds,
            friendRequests,
            globalSearch,
            openMentionPost,
            openVisitor,
            postMentions,
            readPostMention,
            setActiveConversationId: selectRoutedConversation,
            setContactsScreen,
            setDesktopProfileSettings,
            setProfileTimelineOpen,
            switchTab,
          },
          contacts: {
            contactsContent,
            conversations: displayConversations,
            friends,
            incomingRequests: friendRequests.filter(friend => friend.direction === "incoming").length,
            request: apiFetch,
            userId: session.user.id,
            token: session.token,
            targetLanguage,
            friendQuery,
            setFriendQuery,
            onOpenChat: (id) => { switchTab("chat"); selectRoutedConversation(id); },
            onNavigate: switchTab,
          },
          search: {
            request: apiFetch,
            sessionId: session.sessionId,
            onOpenProfile: username => openVisitorProfile(username),
            onOpenPost: postId => navigate(feedPostPath(postId)),
            renderPosts: (items, onOpen) => renderPosts(items, false, onOpen),
          },
          discover: {
            request: apiFetch,
            sessionId: session.sessionId,
            actOnFriend,
            findNearby,
            friendActionBusy,
            friendRelationship,
            globalSearch,
            nearbyBusy,
            nearbyRadiusKm,
            nearbyResultRadiusKm,
            nearbyScanning,
            nearbyUntil,
            nearbyUsers,
            setGlobalSearch,
            setNearbyRadiusKm,
            stopNearby,
          },
          market: {
            searchQuery: globalSearch,
            apiFetch,
            session,
            switchTab,
          },
        }),
        profile: <>
        {desktopProfileOverview && (
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
          onCreateStory={() => setStoryDraft({ kind: "choose" })}
          pendingPost={pendingPost}
          postDraft={postText}
          onCreateMediaPost={(files) => { setProfileComposerOpen(true); void addFeedFiles(files); }}
          onCheckIn={() => { setFeedCheckInOpen(true); setProfileComposerOpen(true); }}
          storyBusy={storyBusy || mediaUploading === 'story'}
          privacy={privacy}
          privacyBusy={privacyBusy}
          privacyError={privacyError}
          privacyLoading={privacyLoading}
          profileBioDraft={profileBioDraft}
          profileBusy={profileBusy}
          profileCityDraft={profileCityDraft}
          publicDetailsDraft={profilePublicDetailsDraft}
          setPublicDetailsDraft={setProfilePublicDetailsDraft}
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

        {!desktopProfileOverview && (
          <ProfileSection
          apiFetch={apiFetch}
          onCreateStory={() => setStoryDraft({ kind: "choose" })}
          onOpenPost={setActivePostId}
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
          friendCount={friends.filter(friend => friend.status === "accepted").length}
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
        </>,
        chat: <>
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
          blockContact={blockContact}
          blockedBusy={blockedBusy}
          bottomRef={bottomRef}
          canEditGroup={canEditGroup}
          canInviteActiveGroup={canInviteActiveGroup}
          canManageActiveGroup={canManageActiveGroup}
          canSend={canSend}
          changeAutoTranslate={changeAutoTranslate}
          changeGroupMemberRole={changeGroupMemberRole}
          changeTargetLanguage={changeTargetLanguage}
          chatCreateError={chatCreateError}
          chatFriend={chatFriend}
          chatFriendRelationship={chatFriendRelationship}
          allChatConversations={displayConversations}
          chatListConversations={chatListConversations}
          chatListFilter={chatListFilter}
          chatListQuery={chatListQuery}
          chatOnline={chatOnline}
          chatOutbox={chatOutbox}
          nextChatSearchJumpRevision={nextChatSearchJumpRevision}
          clearActiveConversationHistory={clearActiveConversationHistory}
          conversationBlocked={conversationBlocked}
          conversationCategories={conversationCategories}
          conversationDetailsOpen={conversationDetailsOpen}
          conversationListSearch={conversationListSearch}
          conversationLoadingMore={conversationLoadingMore}
          conversationListError={conversationListError}
          refreshConversations={refreshConversations}
          copyInviteLink={copyInviteLink}
          createDirect={createDirect}
          createGroupChannel={createGroupChannel}
          refreshGroupChannels={refreshGroupChannels}
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
          groupSettingsOpen={groupSettingsOpen}
          groupMemberViewOpen={groupMemberViewOpen}
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
          setMessageScrollAtBottom={setMessageScrollAtBottom}
          messageSearchOpen={messageSearchOpen}
          messageSending={messageSending}
          messagesLoadingMore={messagesLoadingMore}
          messageHistoryLoading={messageHistoryLoading}
          messageHistoryError={messageHistoryError}
          retryMessageHistory={retryMessageHistory}
          messagesScrollRef={messagesScrollRef}
          messageText={messageText}
          newChatMode={newChatMode}
          openConnectSurface={openConnectSurface}
          openGroupSettings={openGroupSettings}
          onReactionUsers={(message, emoji) => setReactionTarget({kind: "message", id: message.id, initialEmoji: emoji, reactions: message.reactions})}
          onForwardMessage={setForwardSource}
          openVisitor={openVisitor}
          pinBusy={pinBusy}
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
          setActiveConversationId={selectRoutedConversation}
          setChatCreateError={setChatCreateError}
          setChatListFilter={setChatListFilter}
          setChatListQuery={setChatListQuery}
          setChatSearchJump={setChatSearchJump}
          setConversationActionId={setConversationActionId}
          setMessageActionId={setMessageActionId}
          setMessageActionMode={setMessageActionMode}
          setMessageCopyTarget={setMessageCopyTarget}
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
          setGroupSettingsOpen={setGroupSettingsOpen}
          setGroupMemberViewOpen={setGroupMemberViewOpen}
          setLanguageSearch={setLanguageSearch}
          setManuallyTranslated={setManuallyTranslated}
          setMessageAttachments={setMessageAttachments}
          setMessageSearchOpen={setMessageSearchOpen}
          setMessageText={setMessageText}
          setNewChatMode={setNewChatMode}
          setNotice={setNotice}
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
          setActiveConversationId={selectRoutedConversation}
          setContactsScreen={setContactsScreen}
          setDesktopSection={setDesktopSection}
          setFriendQuery={setFriendQuery}
          switchTab={switchTab}
          targetLanguage={targetLanguage}
        />
        )}











        </>,
        beforeFeed: <>
        {activePost && (
          <FeedPostDetail
          activePost={activePost}
          onRepostChanged={refreshAfterRepost}
          onShareToChat={setPostLinkToSend}
          onOpenOriginal={openFeedPostDetails}
          apiFetch={apiFetch}
          closeFeedPostDetails={closeFeedPostDetails}
          commentSortOrder={commentSortOrder}
          friendTaggedNames={friendTaggedNames}
          like={like}
          likePreviews={likePreviews}
          onReactionUsers={(post, portalContainer) => setReactionTarget({kind: "post", id: post.id, reactions: post.reactions, portalContainer})}
          name={name}
          openEditPost={openEditPost}
          openVisitor={openPostDetailProfile}
          postDiscussion={renderPostDiscussion(activePost, openPostDetailProfile)}
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

        </>,
        feed: (<FeedSection
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
          feedInitialLoading={feedInitialLoading}
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
          searchQuery={globalSearch}
          onSearchChange={setGlobalSearch}
          communityCard={<CommunitySuggestions
            title="Cộng đồng của bạn"
            joinedItems={conversations.filter(group => group.type === "group").slice(0, 3).map(group => ({
              id: group.id, name: group.name, memberCount: group.memberCount,
              avatarUrl: group.avatarUrl,
            }))}
            onViewAll={() => switchTab("discover")}
            onOpenJoined={(id) => {
              switchTab("chat");
              setChatListFilter("all");
              selectRoutedConversation(id);
            }}
          />}
          openVisitor={openVisitor}
          pendingPost={pendingPost}
          postComposerRef={postComposerRef}
          posts={posts}
          postSearch={postSearch}
          postText={postText}
          profileMedia={profileMedia}
          refreshPosts={refreshPosts}
          renderPosts={renderPosts}
          searchedPosts={searchedPosts}
          session={session}
          setActiveConversationId={selectRoutedConversation}
          setActivePostId={setActivePostId}
          setActiveStoryId={setActiveStoryId}
          setChatListFilter={setChatListFilter}
          setFeedCheckInOpen={setFeedCheckInOpen}
          setFeedCommunitiesOpen={setFeedCommunitiesOpen}
          setFeedComposerOpen={setFeedComposerOpen}
          setFeedFilter={setFeedFilter}
          setPosts={setPosts}
          setSavedPosts={setSavedPosts}
          setSearchHasScrolled={setSearchHasScrolled}
          setStories={setStories}
          setStoryDraft={setStoryDraft}
          stories={stories}
          storyBusy={storyBusy}
          pendingStory={pendingStoryView}
          retryStory={retryStory}
          cancelStory={cancelStory}
          switchTab={switchTab}
        />),
        afterFeed: <>


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

        {activeStory && (
          <StoryOverlay
          key={session.sessionId}
          request={apiFetch}
          activeStory={activeStory}
          deleteStory={deleteStory}
          name={name}
          openVisitor={openVisitor}
          openMessages={() => switchTab("chat")}
          replyToStory={replyToStory}
          reportStory={reportStory}
          setActiveStoryId={setActiveStoryId}
          shareStory={shareStory}
          stories={stories}
          storyBusy={storyBusy}
        />
        )}

        </>,
      }}
    >

      {storyDraft && (tab === "feed" || tab === "profile") && (
          <StoryDraftOverlay
          createStory={createStory}
          mediaUploading={mediaUploading}
          setStoryDraft={setStoryDraft}
          storyBusy={storyBusy}
          storyDraft={storyDraft}
        />
        )}
      <AppComposerOverlays
        tab={tab}
        feedComposerOpen={feedComposerOpen}
        profileComposerOpen={profileComposerOpen}
        profileTimelineOpen={profileTimelineOpen}
        desktopProfileOverview={desktopProfileOverview}
        editingPost={editingPost}
        mediaUploading={mediaUploading}
        pendingPost={pendingPost}
        postComposer={postComposer}
        postEditBusy={postEditBusy}
        restoreDraftAfterEdit={restoreDraftAfterEdit}
        setFeedCheckInOpen={setFeedCheckInOpen}
        setFeedComposerOpen={setFeedComposerOpen}
        setProfileComposerOpen={setProfileComposerOpen}
      />
      {postLinkToSend && (
        <SharedPostLinkPicker
          key={session.sessionId + ":" + postLinkToSend}
          url={postLinkToSend}
          conversations={conversations}
          hasMore={hasMoreConversations}
          loadingMore={conversationLoadingMore}
          onLoadMore={() => void loadMoreConversations()}
          request={apiFetch}
          onClose={() => setPostLinkToSend(null)}
          onOpenChat={(id) => { setPostLinkToSend(null); switchTab("chat"); selectRoutedConversation(id); }}
          onSent={(destinationName) => setNotice(`Đã gửi bài viết đến ${destinationName}.`, "success")}
        />
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
          portalContainer={reactionTarget.portalContainer}
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
          setTab("chat");
          selectRoutedConversation(id);
        }}
      />

      <AppShellCallManager
        request={apiFetch}
        apiBase={API}
        token={session.token}
        sessionId={session.sessionId}
        userId={session.user.id}
        sourceLanguage={effectiveAppLocale}
        targetLanguage={targetLanguage}
        conversations={displayConversations}
      />

      <BottomNavigation
        tab={tab}
        t={t}
        switchTab={switchTab}
        unreadTotal={unreadTotal}
        pushEnabled={pushEnabled}
      />
    </AppLayout>
  );
}