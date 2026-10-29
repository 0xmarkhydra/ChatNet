import ProfileNote from '../features/profile/ProfileNote'
import ConversationCategories, { CategoryAssignment, CategoryBadge } from '../features/chat/ConversationCategories'
import { useConversationCategories } from '../features/chat/useConversationCategories'
import { SessionResponseCache } from '../shared/lib/sessionCache'
import VisitorProfile from '../features/profile/VisitorProfile'
import { userLabel } from '../shared/lib/userLabel'
import { useMessageData } from '../features/chat/useMessageData'
import { useApiRequest } from './useApiRequest'
import { useAppRealtime } from './useAppRealtime'
import { useConversationData } from '../features/chat/useConversationData'
import { useContactData } from '../features/contacts/useContactData'
import { useFeedData } from '../features/feed/useFeedData'

import { useGroupManagement } from '../features/chat/useGroupManagement'
import { API } from '../shared/lib/config'
import type { ProfileMediaState, ProfileUpdateResponse, UserPrivacy } from '../features/profile/types'
import { attachmentRequestBody, type MediaAttachment, type PresignedUpload } from '../shared/lib/media'
import { emptyDraft, CHAT_LIST_PAGE_SIZE, MESSAGE_PAGE_SIZE, type Message, type MessageReaction, type MessageDraft, type Conversation, type RealtimeEvent, type GroupMember, type NewChatMode } from '../features/chat/types'
import { FEED_PAGE_SIZE, type Post, type Story } from '../features/feed/types'
import type { Tab } from './types'
import type { FriendSearchResult, FriendConnection } from '../features/contacts/types'
import type { ManagedAccountSession } from '../features/auth/types'
import type { InstallPromptEvent } from '../features/pwa/types'
import { inferToastKind, type ToastKind, type ToastNotice } from '../features/notifications/toast'
import { formatTime, attachmentLabel } from '../shared/lib/format'
import UserAvatar, { avatarRefreshVersions, profileAssetUrl } from '../shared/ui/UserAvatar'
import MediaAttachmentsView from '../shared/ui/MediaAttachmentsView'
import UiIcon from '../shared/ui/UiIcon'
import NearbyRadar from '../features/discover/NearbyRadar'
import AuthScreen from '../features/auth/AuthScreen'
import { useAuthFlow } from '../features/auth/useAuthFlow'
import PostComposer from '../features/feed/PostComposer'
import FeedPostCard from '../features/feed/FeedPostCard'
import StoryViewer from '../features/feed/StoryViewer'
import MessageActions from '../features/chat/MessageActions'
import ProfileIdentityForm from '../features/profile/ProfileIdentityForm'
import BottomNavigation from './BottomNavigation'
import GroupSettingsPanel from '../features/chat/GroupSettingsPanel'
import ContactsView from '../features/contacts/ContactsView'
import PrivacyControls from '../features/profile/PrivacyControls'
import AccountSessionsPanel from '../features/auth/AccountSessionsPanel'
import BlockedUsersPanel from '../features/contacts/BlockedUsersPanel'
import { FormEvent, lazy, Suspense, type SetStateAction, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { FeedDiscussion, FeedText, type FeedComment, type DiscussionDraft } from '../features/feed/FeedDiscussion'
import FeedModeration from '../features/feed/FeedModeration'
import ProfileOverlay from '../features/profile/ProfileOverlay'
import type { NearbyUser } from '../features/discover/NearbyExplorer'
import GroupCreator from '../features/chat/GroupCreator'
import { Bell, Check, Images, LogOut, MessageCircle, MoreHorizontal, ArrowLeft, Settings, PencilLine, RefreshCw, Search, UserCheck, UserPlus, Users, Volume2, X, Download } from 'lucide-react'
import { IncomingMessageSound, MESSAGE_SOUND_SETTING_KEY, persistMessageSoundEnabled, readMessageSoundEnabled } from '../features/notifications/incomingSound'
import { createSessionClient, loadSession, type Session } from '../features/auth/session'
import { clearChatPersistence, clearPendingSend, loadChatDrafts, loadPendingSend, saveChatDrafts, savePendingSend } from '../features/chat/chatPersistence'
import { uploadPresignedFile } from '../features/chat/mediaUpload'
import { canMarkConversationRead } from '../features/chat/conversationRead'
import { mergeById, toggleCount } from '../shared/lib/optimistic'
import CallManager, { CallHeaderActions } from '../features/calls/CallManager'
import GroupActionsSheet from '../features/chat/GroupActionsSheet'
import SharedContent from '../features/chat/SharedContent'
import VoiceRecorder from '../features/chat/VoiceRecorder'
import { SocoEmptyState, SocoTextAction } from '../shared/ui/SocoUI'
import { getCurrentPositionSmart, geolocationErrorMessage } from '../features/discover/geolocation'

const NearbyExplorer = lazy(() => import('../features/discover/NearbyExplorer'))
const ProfileQr = lazy(() => import('../features/profile/ProfileQr'))
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
} from '../features/i18n/i18n'
import { buildLanguageOptions, filterLanguageOptions, isSupportedLanguageCode } from '../features/i18n/languages'
import {
  disableOneSignalPush,
  enableOneSignalPush,
  getOneSignalPushState,
  isPushDisabled,
  setupOneSignal,
  type PushState,
} from '../features/notifications/onesignal'

export default function App() {
  const [session, setSession] = useState<Session | null>(loadSession)
  const sessionRef = useRef(session)
  const responseCache = useRef(new SessionResponseCache())
  const [sessionClient] = useState(() => createSessionClient(API, {
    get: () => sessionRef.current,
    save: saveSession,
    expire: () => logout(false),
  }))
  const auth = useAuthFlow(saveSession)

  const [tab, setTab] = useState<Tab>('chat')
  const tabRef = useRef(tab)
  tabRef.current = tab
  const [globalSearch, setGlobalSearch] = useState('')
  const [quickCreateOpen, setQuickCreateOpen] = useState(false)
  useEffect(() => {
    if (!quickCreateOpen) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setQuickCreateOpen(false)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [quickCreateOpen])
  const [activeConversationId, setActiveConversationId] = useState<number | null>(null)
  const activeConversationIdRef = useRef<number | null>(null)
  const messagesScrollRef = useRef<HTMLDivElement>(null)
  const messageScrollAtBottom = useRef(true)
  const [replyingTo, setReplyingTo] = useState<Message | null>(null)
  const [messageActionId, setMessageActionId] = useState<number | null>(null)
  const messageLongPressTimer = useRef<number | null>(null)
  const messageLongPressStart = useRef<{ x: number; y: number; messageId: number } | null>(null)

  const [sharedContentOpen, setSharedContentOpen] = useState(false)

  // Only text is kept in this tab's session storage. Media URLs/tokens are never persisted.
  const [messageDrafts, setMessageDrafts] = useState<Record<number, MessageDraft>>(() => {
    const saved = loadChatDrafts(session?.user.id ?? 0)
    return Object.fromEntries(Object.entries(saved).map(([id, item]) => [Number(id), { text: item.text, attachments: [] }]))
  })
  useEffect(() => {
    if (session?.user.id && sessionRef.current?.user.id === session.user.id) {
      saveChatDrafts(session.user.id, messageDrafts)
    }
  }, [session?.user.id, messageDrafts])
  const draft = messageDrafts[activeConversationId ?? 0] ?? emptyDraft
  const messageText = draft.text
  const messageAttachments = draft.attachments
  const [messageSending, setMessageSending] = useState(false)
  const sendingRef = useRef(false)
  const [outgoingMessage, setOutgoingMessage] = useState<Message | null>(null)
  const [pendingPost, setPendingPost] = useState<Post | null>(null)
  const [pendingComments, setPendingComments] = useState<Record<number, FeedComment>>({})
  const [likePreviews, setLikePreviews] = useState<Record<number, boolean>>({})
  const [reactionPreviews, setReactionPreviews] = useState<Record<number, MessageReaction[]>>({})
  const messageChanges = useRef(new Set<number>())
  const actionLocks = useRef(new Set<string>())
  const messageReceipts = useRef(new Map<string, Message | null>())
  // Preserve the request ID for an ambiguous send so a retry cannot create another row.
  const pendingSend = useRef<{ sessionId: string; conversationId: number; signature: string; clientId: string; draft: MessageDraft } | null>(null)
  const preferenceQueue = useRef(Promise.resolve())
  const preferenceRevision = useRef(0)
  const [newChatMode, setNewChatMode] = useState<NewChatMode>('none')
  const [friendQuery, setFriendQuery] = useState('')
  const [friendResults, setFriendResults] = useState<FriendSearchResult[]>([])
  const [friendSearching, setFriendSearching] = useState(false)
  const [friendSearchError, setFriendSearchError] = useState(false)
  const [friendSearchRetry, setFriendSearchRetry] = useState(0)
  const [friendActionBusy, setFriendActionBusy] = useState<number | null>(null)
  const friendActionRef = useRef(new Set<number>())
  const [friendBusyIds, setFriendBusyIds] = useState<Set<number>>(() => new Set())
  const [friendMenuId, setFriendMenuId] = useState<number | null>(null)
  const [visitorUsername,setVisitorUsername]=useState<string|null>(null)
  function openVisitor(username:string) {
    if(username===sessionRef.current?.user.username){setTab('profile');setProfileTimelineOpen(true);return}
    setVisitorUsername(username)
  }
  function setFriendPreview(friend:FriendSearchResult|null){if(friend)openVisitor(friend.username);else setVisitorUsername(null)}
  const [blockedUsers, setBlockedUsers] = useState<Array<{ id: number; username: string; displayName: string }>>([])
  const [blockedOpen, setBlockedOpen] = useState(false)
  const [blockedBusy, setBlockedBusy] = useState(false)
  const [blockedError, setBlockedError] = useState('')
  const [directUsername, setDirectUsername] = useState('')
  const [qrOpen, setQrOpen] = useState<'mine' | 'scan' | null>(null)
  const [chatCreateError, setChatCreateError] = useState('')
  const [nearbyUsers, setNearbyUsers] = useState<FriendSearchResult[]>([])
  const [nearbyBusy, setNearbyBusy] = useState(false)
  const [nearbyScanning, setNearbyScanning] = useState(false)
  const [nearbyUntil, setNearbyUntil] = useState(0)
  const [nearbyResultRadiusKm, setNearbyResultRadiusKm] = useState(5)
  const [nearbyRadiusKm, setNearbyRadiusKm] = useState(5)
  const nearbyRequest = useRef(0)

  const [profileTimelineOpen, setProfileTimelineOpen] = useState(false)
  const [profileComposerOpen, setProfileComposerOpen] = useState(false)
  const [profileEditorOpen, setProfileEditorOpen] = useState(false)
  const [postSubmitError, setPostSubmitError] = useState('')
  useEffect(() => {
    if (tab !== 'profile' || !profileTimelineOpen) {
      setProfileComposerOpen(false)
      setProfileEditorOpen(false)
    }
  }, [tab, profileTimelineOpen])
  const [profilePosts, setProfilePosts] = useState<Post[]>([])
  const [profilePostsBusy, setProfilePostsBusy] = useState(false)
  const [profilePostsError, setProfilePostsError] = useState('')
  const [profileHasMore, setProfileHasMore] = useState(false)
  const profileLoadSequence = useRef(0)
  const profilePagingBusy = useRef(false)
  const profileIdentityRef = useRef<HTMLButtonElement>(null)
  const profileHeadingRef = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    if (!profileTimelineOpen || tab !== 'profile' || !session?.sessionId) return
    void loadProfilePosts()
    profileHeadingRef.current?.focus()
    return () => { ++profileLoadSequence.current; profilePagingBusy.current = false }
  }, [profileTimelineOpen, tab, session?.sessionId, session?.user.username])

  const [feedFilter, setFeedFilter] = useState<'all' | 'saved'>('all')
  const [activePostId, setActivePostId] = useState<number | null>(null)
  useEffect(() => {
    if (!session?.token) return
    const params = new URLSearchParams(window.location.search)
    if (params.get('tab') !== 'feed') return
    setTab('feed')
    const id = Number(params.get('post'))
    if (!Number.isSafeInteger(id) || id <= 0) return
    let cancelled = false
    void apiFetch('/api/posts/' + id).then(async response => {
      if (!response.ok) throw new Error(response.status === 404 ? 'Bài viết không tồn tại hoặc bạn không có quyền xem.' : 'Không thể mở bài viết.')
      return response.json() as Promise<Post>
    }).then(post => {
      if (cancelled) return
      setPosts(current => [post, ...current.filter(item => item.id !== post.id)])
      setActivePostId(post.id)
    }).catch(error => {
      if (!cancelled) setNotice(error instanceof Error ? error.message : 'Không thể mở bài viết.', 'error')
    })
    return () => { cancelled = true }
  }, [session?.token])
  const [activeStoryId, setActiveStoryId] = useState<number | null>(null)
  const [storyBusy, setStoryBusy] = useState(false)
  const [commentEditors, setCommentEditors] = useState<Record<number, DiscussionDraft>>({})
  const [postText, setPostText] = useState('')
  const [postVisibility, setPostVisibility] = useState<'public' | 'friends' | 'private'>('public')
  const [postBackground, setPostBackground] = useState('')
  const [showPostBackgrounds, setShowPostBackgrounds] = useState(false)
  const [postAttachments, setPostAttachments] = useState<MediaAttachment[]>([])
  const [mediaUploading, setMediaUploading] = useState<'chat' | 'feed' | 'story' | 'profile' | null>(null)
  const [mediaUploadProgress, setMediaUploadProgress] = useState<{ loaded: number; total: number } | null>(null)
  const mediaUploadAbort = useRef<AbortController | null>(null)
  const [profileMedia, setProfileMedia] = useState<ProfileMediaState | null>(null)
  const [profileBusy, setProfileBusy] = useState<'avatar' | 'cover' | null>(null)
  const [profileDisplayNameDraft, setProfileDisplayNameDraft] = useState('')
  const [profileUsernameDraft, setProfileUsernameDraft] = useState('')
  const [profileSaving, setProfileSaving] = useState(false)
  const [privacy, setPrivacy] = useState<UserPrivacy | null>(null)
  const [privacyBusy, setPrivacyBusy] = useState(false)
  const [privacyLoading, setPrivacyLoading] = useState(false)
  const [privacyError, setPrivacyError] = useState('')
  const [privacyRetry, setPrivacyRetry] = useState(0)
  const [sessionsOpen, setSessionsOpen] = useState(false)
  const [managedSessions, setManagedSessions] = useState<ManagedAccountSession[]>([])
  const [sessionsBusy, setSessionsBusy] = useState(false)
  const [sessionsError, setSessionsError] = useState('')
  const [translations, setTranslations] = useState<Record<number, string>>({})
  const [translationOriginals, setTranslationOriginals] = useState<Record<number, boolean>>({})
  const [translationMenuOpen, setTranslationMenuOpen] = useState(false)
  const [languageSearch, setLanguageSearch] = useState('')
  const [appLocale, setAppLocale] = useState(loadAppLocalePreference)
  const [uiBundle, setUiBundle] = useState<UIBundle>(defaultBundle)
  const [uiLocaleLoading, setUiLocaleLoading] = useState(false)
  const [localePickerOpen, setLocalePickerOpen] = useState(false)
  const [localeSearch, setLocaleSearch] = useState('')
  const [translationPickerOpen, setTranslationPickerOpen] = useState(false)
  const [translationSettingsSearch, setTranslationSettingsSearch] = useState('')
  const [targetLanguage, setTargetLanguage] = useState('en')
  const [autoTranslate, setAutoTranslate] = useState(true)
  const [translationPreferencesLoaded, setTranslationPreferencesLoaded] = useState(false)
  const [status, setStatus] = useState('Đang kết nối...')
  const [notice, setNoticeState] = useState<ToastNotice | null>(null)
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null)
  const [isStandalone, setIsStandalone] = useState(false)
  const [pushConfigured, setPushConfigured] = useState(false)
  const [pushAppId, setPushAppId] = useState('')
  const [pushEnabled, setPushEnabled] = useState(false)
  const [messageSoundEnabled, setMessageSoundEnabled] = useState(readMessageSoundEnabled)
  const messageSoundEnabledRef = useRef(messageSoundEnabled)
  messageSoundEnabledRef.current = messageSoundEnabled
  const messageSound = useRef<IncomingMessageSound | null>(null)
  if (!messageSound.current) messageSound.current = new IncomingMessageSound()
  useEffect(() => {
    // Browsers permit sound only after an interaction. Warm up Web Audio on a
    // real user gesture, without playing a notification just for opening SOCO.
    const unlockAudio = () => {
      if (messageSoundEnabledRef.current) messageSound.current?.unlock()
    }
    const syncPreference = (event: StorageEvent) => {
      if (event.key !== MESSAGE_SOUND_SETTING_KEY && event.key !== null) return
      const enabled = readMessageSoundEnabled()
      messageSoundEnabledRef.current = enabled
      setMessageSoundEnabled(enabled)
    }
    window.addEventListener('pointerdown', unlockAudio, { passive: true })
    window.addEventListener('keydown', unlockAudio)
    window.addEventListener('storage', syncPreference)
    return () => {
      window.removeEventListener('pointerdown', unlockAudio)
      window.removeEventListener('keydown', unlockAudio)
      window.removeEventListener('storage', syncPreference)
    }
  }, [])
  const [pushBusy, setPushBusy] = useState(false)
  const [pushInitFailed, setPushInitFailed] = useState(false)
  const [pushPrompt, setPushPrompt] = useState(false)
  const [pushPromptDismissed, setPushPromptDismissed] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const postComposerRef = useRef<HTMLTextAreaElement>(null)
  const messageInputRef = useRef<HTMLInputElement>(null)
  const chatFileInputRef = useRef<HTMLInputElement>(null)
  const feedImageInputRef = useRef<HTMLInputElement>(null)
  const feedVideoInputRef = useRef<HTMLInputElement>(null)
  const feedAlbumInputRef = useRef<HTMLInputElement>(null)
  const storyFileInputRef = useRef<HTMLInputElement>(null)
  const avatarFileInputRef = useRef<HTMLInputElement>(null)
  const coverFileInputRef = useRef<HTMLInputElement>(null)

  const {
    apiFetch,
    pendingActions,
    setPendingActions,
    pendingRequests,
    mutationRequests,
  } = useApiRequest({ session, sessionRef, sessionClient, responseCache })

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
  })

  const conversationCategories = useConversationCategories({
    session, sessionRef, apiFetch, setStatus, setNotice,
    mergeConversations: items => setConversations(current => {
      const fresh = new Map(items.filter(c => !revokedConversationIds.current.has(c.id)).map(c => [c.id,c]))
      return [...current.map(c => fresh.get(c.id) || c), ...[...fresh.values()].filter(c => !current.some(p => p.id === c.id))]
    }),
    setCategory: (id, categoryId) => setConversations(current => current.map(c =>
      c.id === id ? { ...c, categoryId: categoryId || undefined } : c)),
    clearCategory: id => setConversations(current => current.map(c => c.categoryId === id ? { ...c, categoryId: undefined } : c)),
  })

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
  })

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
  })

  const {
    messages,
    setMessages,
    hasMoreMessages,
    setHasMoreMessages,
    messagesLoadingMore,
    setMessagesLoadingMore,
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
    targetLanguage,
    setTranslations,
    messageChanges,
    pendingSend,
    setMessageDrafts,
    setConversations,
    tabRef,
    messagesScrollRef,
    purgeConversation,
  })

  const {
    groupSettingsOpen,
    setGroupSettingsOpen,
    groupActionsOpen,
    setGroupActionsOpen,
    groupMembers,
    setGroupMembers,
    groupNameDraft,
    setGroupNameDraft,
    groupInviteDraft,
    setGroupInviteDraft,
    groupInviteSearch,
    setGroupInviteSearch,
    groupInviteSelection,
    setGroupInviteSelection,
    groupBusy,
    setGroupBusy,
    activeGroupMember,
    canManageActiveGroup,
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
    activeConversationIdRef,
    friends,
    apiFetch,
    refreshFriendConnections,
    refreshConversations,
    setActiveConversationId,
    setNotice,
    actionLocks,
  })

  const name = session?.user.username || ''
  const displayConversations = useMemo(() => conversations.map(conversation => ({
    ...conversation,
    name: conversation.type === 'direct' && conversation.otherUserId
      ? contactMetadata[conversation.otherUserId]?.nickname || conversation.name
      : conversation.name,
  })), [conversations, contactMetadata])
  const activeConversation = displayConversations.find((item) => item.id === activeConversationId) || null
  const chatFriend = activeConversation?.type === 'direct' && activeConversation.otherUserId
    && activeConversation.otherUserId !== session?.user.id
    ? { id: activeConversation.otherUserId, username: activeConversation.otherUsername || '', displayName: activeConversation.name, online: activeConversation.online }
    : null
  const chatFriendRelationship = chatFriend ? friendRelationship(chatFriend.id) : 'none'

  const visiblePosts = posts.map((post) => likePreviews[post.id] === undefined ? post : {
    ...post, liked: likePreviews[post.id],
    likes: Math.max(0, post.likes + (likePreviews[post.id] === post.liked ? 0 : likePreviews[post.id] ? 1 : -1)),
  })
  const visibleMessages = messages.map((message) => reactionPreviews[message.id] ? {
    ...message, reactions: message.deleted ? [] : reactionPreviews[message.id],
  } : message)
  const visibleProfilePosts = profilePosts.map(post => likePreviews[post.id] === undefined ? post : {
    ...post, liked: likePreviews[post.id],
    likes: Math.max(0, post.likes + (likePreviews[post.id] === post.liked ? 0 : likePreviews[post.id] ? 1 : -1)),
  })
  const activePost = activePostId ? [...visibleProfilePosts, ...visiblePosts, ...savedPosts].find((item) => item.id === activePostId) || null : null
  const activeMessageAction = messageActionId
    ? messages.find((item) => item.id === messageActionId) || null
    : null
  const activeStoryIndex = stories.findIndex((item) => item.id === activeStoryId)
  const activeStory = activeStoryIndex < 0 ? null : stories[activeStoryIndex]
  const effectiveAppLocale = resolveEffectiveLocale(appLocale, isSupportedLanguageCode)
  const interfaceLocale = effectiveAppLocale || 'vi'
  const languageOptions = useMemo(() => buildLanguageOptions(interfaceLocale), [interfaceLocale])
  const selectedLanguage = languageOptions.find((language) => language.value === targetLanguage) || languageOptions[0]
  const visibleLanguageOptions = useMemo(
    () => filterLanguageOptions(languageOptions, languageSearch),
    [languageOptions, languageSearch],
  )
  const visibleLocaleOptions = useMemo(
    () => filterLanguageOptions(languageOptions, localeSearch),
    [languageOptions, localeSearch],
  )
  const visibleTranslationSettingsOptions = useMemo(
    () => filterLanguageOptions(languageOptions, translationSettingsSearch),
    [languageOptions, translationSettingsSearch],
  )
  const selectedAppLanguage = languageOptions.find((language) => language.value === effectiveAppLocale) || languageOptions[0]
  const t = (key: keyof typeof UI_MESSAGES) => translateUI(uiBundle, key)

  function setNotice(message: string, kind?: ToastKind) {
    const clean = message.trim()
    if (!clean) {
      setNoticeState(null)
      return
    }
    setNoticeState({
      id: Date.now(),
      message: clean,
      kind: kind || inferToastKind(clean),
    })
  }

  function connectUrl(username = session?.user.username || '') {
    const url = new URL(window.location.href)
    url.hash = ''
    url.search = ''
    if (username) url.searchParams.set('connect', username)
    return url.toString()
  }

  function openConnectSurface(query = '') {
    setTab('chat')
    setActiveConversationId(null)
    setQuickCreateOpen(false)
    setNewChatMode('friends')
    if (query) setFriendQuery(query.replace(/^@/, '').trim())
  }

  async function shareMyProfile() {
    if (!session?.user.username) return
    const url = connectUrl(session.user.username)
    const shareData = {
      title: `Kết nối với @${session.user.username} trên SOCO`,
      text: `Kết nối với ${session.user.displayName || '@' + session.user.username} trên SOCO`,
      url,
    }
    try {
      if (typeof navigator.share === 'function') {
        await navigator.share(shareData)
        return
      }
      await navigator.clipboard.writeText(url)
      setNotice('Đã sao chép link hồ sơ SOCO.', 'success')
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      setNotice('Không thể chia sẻ hồ sơ trên thiết bị này.', 'error')
    }
  }

  async function copyInviteLink() {
    if (!session?.user.username) return
    try {
      await navigator.clipboard.writeText(connectUrl(session.user.username))
      setNotice('Đã sao chép link kết nối SOCO.', 'success')
    } catch {
      setNotice('Không sao chép được link trên trình duyệt này.', 'error')
    }
  }

  function cancelMessageLongPress() {
    if (messageLongPressTimer.current !== null) {
      window.clearTimeout(messageLongPressTimer.current)
      messageLongPressTimer.current = null
    }
    messageLongPressStart.current = null
  }

  function openMessageActions(message: Message) {
    if (message.deleted) return
    cancelMessageLongPress()
    setMessageActionId(message.id)
    navigator.vibrate?.(24)
  }

  function beginMessageLongPress(message: Message, x: number, y: number, button: number, target: EventTarget | null) {
    if (message.deleted || button !== 0) return
    if (target instanceof Element && target.closest('button,a,input,textarea,select,video,audio')) return
    cancelMessageLongPress()
    messageLongPressStart.current = { x, y, messageId: message.id }
    messageLongPressTimer.current = window.setTimeout(() => {
      if (messageLongPressStart.current?.messageId === message.id) openMessageActions(message)
    }, 500)
  }

  function moveMessageLongPress(x: number, y: number) {
    const start = messageLongPressStart.current
    if (!start) return
    if (Math.hypot(x - start.x, y - start.y) > 12) cancelMessageLongPress()
  }

  async function copyMessage(message: Message) {
    const content = message.text.trim()
    setMessageActionId(null)
    if (!content) return
    try {
      await navigator.clipboard.writeText(content)
      setNotice('Đã sao chép tin nhắn.', 'success')
    } catch {
      setNotice('Không sao chép được tin nhắn trên trình duyệt này.', 'error')
    }
  }

  useEffect(() => {
    if (!notice) return
    const timeout =
      notice.kind === 'error' ? 8000 :
      notice.kind === 'warning' ? 6000 :
      4500
    const timer = window.setTimeout(() => {
      setNoticeState((current) => current?.id === notice.id ? null : current)
    }, timeout)
    return () => window.clearTimeout(timer)
  }, [notice])

  useEffect(() => {
    if (!session?.token) return
    const params = new URLSearchParams(window.location.search)
    const requestedUser = (params.get('connect') || params.get('invite') || '').replace(/^@/, '').trim()
    if (!requestedUser) return

    if (requestedUser.toLocaleLowerCase('vi-VN') !== session.user.username.toLocaleLowerCase('vi-VN')) {
      openVisitor(requestedUser)
    }

    params.delete('connect')
    params.delete('invite')
    const nextSearch = params.toString()
    window.history.replaceState({}, '', `${window.location.pathname}${nextSearch ? '?' + nextSearch : ''}${window.location.hash}`)
  }, [session?.token])

  useEffect(() => {
    activeConversationIdRef.current = activeConversationId
    messageScrollAtBottom.current = true
    cancelMessageLongPress()
    setMessageActionId(null)
    setMessages([])
    setHasMoreMessages(false)
    setMessagesLoadingMore(false)
    messagesPagingBusy.current = false
    setReplyingTo(null)
    setGroupSettingsOpen(false)
    setSharedContentOpen(false)
    setGroupMembers([])
    setGroupInviteDraft('')
    setGroupInviteSearch('')
    setGroupInviteSelection([])
  }, [activeConversationId])

  function setMessageText(text: string) {
    if (!activeConversationId) return
    setMessageDrafts((current) => ({
      ...current,
      [activeConversationId]: { ...(current[activeConversationId] ?? emptyDraft), text },
    }))
  }

  function setMessageAttachments(update: SetStateAction<MediaAttachment[]>) {
    if (!activeConversationId) return
    setMessageDrafts((current) => {
      const previous = current[activeConversationId] ?? emptyDraft
      return {
        ...current,
        [activeConversationId]: {
          ...previous,
          attachments: typeof update === 'function' ? update(previous.attachments) : update,
        },
      }
    })
  }

  useEffect(() => {
    const navigatorWithStandalone = navigator as Navigator & { standalone?: boolean }
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      navigatorWithStandalone.standalone === true
    setIsStandalone(standalone)

    const handleBeforeInstall = (event: Event) => {
      event.preventDefault()
      setInstallPrompt(event as InstallPromptEvent)
    }
    const handleInstalled = () => {
      setInstallPrompt(null)
      setIsStandalone(true)
      setNotice('SOCO đã được cài vào thiết bị')
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstall)
    window.addEventListener('appinstalled', handleInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall)
      window.removeEventListener('appinstalled', handleInstalled)
    }
  }, [])

  async function installApp() {
    if (isStandalone) return

    if (installPrompt) {
      await installPrompt.prompt()
      const choice = await installPrompt.userChoice
      if (choice.outcome === 'accepted') {
        setInstallPrompt(null)
      }
      return
    }

    const isiOS = /iphone|ipad|ipod/i.test(navigator.userAgent)
    setNotice(
      isiOS
        ? 'Trên iPhone: bấm Chia sẻ trong Safari → Thêm vào Màn hình chính'
        : 'Mở menu trình duyệt → Cài đặt ứng dụng / Add to Home screen',
    )
  }

  function saveSession(next: Session) {
    localStorage.setItem('chatnet-session', JSON.stringify(next))
    sessionRef.current = next
    setSession(next)
  }


  async function loadProfileMedia() {
    if (!session?.token) return
    const sessionId = session.sessionId
    const response = await apiFetch('/api/profile')
    if (!response.ok) return
    const profile = await response.json() as ProfileMediaState
    if (sessionRef.current?.sessionId !== sessionId) return
    avatarRefreshVersions.set(profile.username, profile.updatedAt)
    setProfileMedia(profile)
    setProfileDisplayNameDraft(profile.displayName)
    setProfileUsernameDraft(profile.username)
  }

  async function saveProfileIdentity(event: FormEvent) {
    event.preventDefault()
    if (!session || profileSaving) return

    const displayName = profileDisplayNameDraft.trim()
    const username = profileUsernameDraft.trim().toLowerCase()
    if (!displayName || !username) {
      setNotice('Tên hiển thị và username không được để trống.', 'error')
      return
    }

    setProfileSaving(true)
    try {
      const response = await apiFetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName, username }),
      })
      const result = await response.json().catch(() => null) as (ProfileUpdateResponse & { error?: string }) | null
      if (sessionRef.current?.sessionId !== session.sessionId) return
      if (!response.ok || !result?.token) {
        throw new Error(result?.error || 'Không cập nhật được thông tin cá nhân.')
      }

      const previousUsername = session.user.username
      avatarRefreshVersions.delete(previousUsername)
      avatarRefreshVersions.set(result.username, result.updatedAt)
      setProfileMedia({
        username: result.username,
        displayName: result.displayName,
        avatarSet: result.avatarSet,
        coverSet: result.coverSet,
        updatedAt: result.updatedAt,
      })
      setProfileDisplayNameDraft(result.displayName)
      setProfileUsernameDraft(result.username)

      const nextSession: Session = {
        ...sessionRef.current,
        token: result.token,
        user: {
          ...session.user,
          username: result.username,
          displayName: result.displayName,
        },
      }
      saveSession(nextSession)
      setNotice('Đã cập nhật tên và username.', 'success')
    } catch (error) {
      if (sessionRef.current?.sessionId === session.sessionId) setNotice(error instanceof Error ? error.message : 'Không cập nhật được thông tin cá nhân.', 'error')
    } finally {
      if (sessionRef.current?.sessionId === session.sessionId) setProfileSaving(false)
    }
  }

  async function updateProfileImage(kind: 'avatar' | 'cover', file?: File) {
    if (!session || profileBusy) return
    if (!file || !file.type.toLowerCase().startsWith('image/')) {
      setNotice('Chỉ hỗ trợ file ảnh cho ảnh đại diện và ảnh bìa.', 'error')
      return
    }
    setProfileBusy(kind)
    try {
      const [attachment] = await uploadMediaFiles([file], 'profile')
      if (sessionRef.current?.sessionId !== session.sessionId) return
      if (!attachment) throw new Error('Không upload được ảnh.')

      const response = await apiFetch('/api/profile/media', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
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
      })
      const result = await response.json().catch(() => null) as (ProfileMediaState & { error?: string }) | null
      if (sessionRef.current?.sessionId !== session.sessionId) return
      if (!response.ok || !result) {
        throw new Error(result?.error || 'Không cập nhật được ảnh hồ sơ.')
      }
      avatarRefreshVersions.set(result.username, result.updatedAt)
      setProfileMedia(result)
      setNotice(kind === 'avatar' ? 'Đã cập nhật ảnh đại diện.' : 'Đã cập nhật ảnh bìa.', 'success')
    } catch (error) {
      if (sessionRef.current?.sessionId === session.sessionId) setNotice(error instanceof Error ? error.message : 'Không cập nhật được ảnh hồ sơ.', 'error')
    } finally {
      if (sessionRef.current?.sessionId === session.sessionId) setProfileBusy(null)
    }
  }

  useEffect(() => {
    if (!session?.token) {
      setProfileMedia(null)
      return
    }
    void loadProfileMedia().catch(() => setStatus('Đang kết nối lại...'))
  }, [session?.sessionId])

  async function findNearby() {
    if (!session || nearbyBusy) return
    const request = ++nearbyRequest.current
    const sessionId = session.sessionId
    setNearbyBusy(true)
    setNearbyScanning(true)
    try {
      const position = await getCurrentPositionSmart()
      if (request !== nearbyRequest.current || sessionRef.current?.sessionId !== sessionId) return
      const { latitude, longitude } = position.coords
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)
        || Math.abs(latitude) > 85.05112878 || Math.abs(longitude) > 180) {
        throw new Error('Tọa độ trình duyệt không hợp lệ. Kiểm tra Latitude (vĩ độ) và Longitude (kinh độ) trong cài đặt vị trí giả lập nếu đang dùng.')
      }
      const response = await apiFetch('/api/users/nearby', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          latitude,
          longitude,
          radiusKm: nearbyRadiusKm,
        }),
      })
      if (request !== nearbyRequest.current || sessionRef.current?.sessionId !== sessionId) return
      if (!response.ok) throw new Error(response.status === 429 ? 'Chờ 10 giây trước khi tìm lại.' : 'Không tìm được bạn quanh đây. Thử lại sau.')
      const result = await response.json() as {
        users: FriendSearchResult[]
        expiresAt: string
        cacheExpiresAt?: string
        radiusKm?: number
      }
      if (request !== nearbyRequest.current || sessionRef.current?.sessionId !== sessionId) return
      setNearbyUsers(result.users)
      setNearbyResultRadiusKm(nearbyRadiusKm)
      setNearbyUntil(Date.parse(result.expiresAt))
      setNotice(
        result.users.length
          ? `Quét thành công: tìm thấy ${result.users.length} người trong bán kính ${nearbyRadiusKm} km.`
          : `Quét thành công nhưng chưa tìm thấy người dùng trong bán kính ${nearbyRadiusKm} km.`,
        result.users.length ? 'success' : 'info',
      )
    } catch (error) {
      if (request !== nearbyRequest.current) return
      setNotice(await geolocationErrorMessage(error), 'error')
    } finally {
      if (request === nearbyRequest.current) {
        setNearbyBusy(false)
        setNearbyScanning(false)
      }
    }
  }

  async function stopNearby() {
    if (!session || nearbyBusy) return
    const request = ++nearbyRequest.current
    setNearbyBusy(true)
    try {
      const response = await apiFetch('/api/users/nearby', { method: 'DELETE' })
      if (request !== nearbyRequest.current) return
      if (!response.ok) throw new Error('Chưa tắt được Quanh đây. Thử lại sau.')
      setNearbyUntil(0)
      setNearbyUsers([])
      setNotice('Đã tắt Quanh đây và xóa cache vị trí gần nhất.', 'success')
    } catch (error) {
      if (request !== nearbyRequest.current) return
      setNotice(
        error instanceof Error ? error.message : 'Mất kết nối. Chưa xác nhận đã tắt Quanh đây.',
        'error',
      )
    } finally {
      if (request === nearbyRequest.current) setNearbyBusy(false)
    }
  }

  useEffect(() => {
    if (!nearbyUntil) return
    const timer = window.setTimeout(() => {
      // Keep the last scan results visible from the longer server-side cache.
      // Only the short "active nearby" lease expires here.
      setNearbyUntil(0)
    }, Math.max(0, nearbyUntil - Date.now()))
    return () => window.clearTimeout(timer)
  }, [nearbyUntil])

  useEffect(() => {
    if (!activeStory) {
      if (activeStoryId !== null) setActiveStoryId(null)
      return
    }
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setActiveStoryId(null)
      if (event.key === 'ArrowLeft') previousStory()
      if (event.key === 'ArrowRight') nextStory()
    }
    window.addEventListener('keydown', handleKey)
    const timer = activeStory.attachment.kind === 'image'
      ? window.setTimeout(nextStory, 7000)
      : undefined
    return () => {
      window.removeEventListener('keydown', handleKey)
      if (timer) window.clearTimeout(timer)
    }
  }, [activeStory?.id, activeStoryId, stories.length])

  async function uploadMediaFiles(files: File[], scope: 'chat' | 'feed' | 'story' | 'profile') {
    if (!files.length) return [] as MediaAttachment[]
    if (mediaUploadAbort.current) throw new Error('Đang tải tệp khác. Hãy hoàn tất hoặc hủy trước khi tải tiếp.')
    const sessionId = session?.sessionId
    const controller = new AbortController()
    mediaUploadAbort.current = controller
    setMediaUploading(scope)
    const totalBytes = files.reduce((sum, file) => sum + file.size, 0)
    const loadedBytes = files.map(() => 0)
    setMediaUploadProgress({ loaded: 0, total: Math.max(1, totalBytes) })
    let lastReport = 0

    function trackProgress(index: number, loaded: number) {
      if (mediaUploadAbort.current !== controller) return
      loadedBytes[index] = Math.min(files[index].size, Math.max(0, loaded))
      const now = performance.now()
      if (loadedBytes[index] < files[index].size && now - lastReport < 120) return
      lastReport = now
      setMediaUploadProgress({
        loaded: loadedBytes.reduce((sum, value) => sum + value, 0),
        total: Math.max(1, totalBytes),
      })
    }

    try {
      const result = new Array<MediaAttachment>(files.length)
      let nextIndex = 0
      const workerCount = Math.min(4, files.length)

      async function worker() {
        try {
          while (true) {
            if (controller.signal.aborted) throw new DOMException('Đã hủy tải tệp.', 'AbortError')
            const index = nextIndex++
            if (index >= files.length) return

            const file = files[index]
            const contentType = file.type || 'application/octet-stream'
            const presignResponse = await apiFetch('/api/media/presign', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                scope,
                name: file.name,
                sizeBytes: file.size,
                contentType,
              }),
              signal: controller.signal,
            })
            if (controller.signal.aborted) throw new DOMException('Đã hủy tải tệp.', 'AbortError')
            const ticket = (await presignResponse.json().catch(() => null)) as
              | (PresignedUpload & { error?: string })
              | null
            if (!presignResponse.ok || !ticket?.uploadUrl) {
              throw new Error(ticket?.error || 'Không cấp được quyền upload file. Hãy kiểm tra cấu hình S3.')
            }

            await uploadPresignedFile(ticket.uploadUrl, file, contentType, controller.signal, (loaded) => trackProgress(index, loaded))
            if (controller.signal.aborted) throw new DOMException('Đã hủy tải tệp.', 'AbortError')
            result[index] = {
              storageRef: ticket.storageRef,
              name: file.name,
              sizeBytes: file.size,
              contentType,
              kind: ticket.kind,
              url: ticket.downloadUrl,
            }
          }
        } catch (error) {
          controller.abort()
          throw error
        }
      }

      const outcomes = await Promise.allSettled(Array.from({ length: workerCount }, () => worker()))
      const errors = outcomes.filter((outcome): outcome is PromiseRejectedResult => outcome.status === 'rejected')
      const firstError = errors.find((item) => !(item.reason instanceof DOMException && item.reason.name === 'AbortError')) ?? errors[0]
      if (firstError) throw firstError.reason
      return result
    } finally {
      if (mediaUploadAbort.current === controller) {
        mediaUploadAbort.current = null
        setMediaUploadProgress(null)
        if (sessionRef.current?.sessionId === sessionId) setMediaUploading(null)
      }
    }
  }

  async function addChatFiles(files: File[]) {
    if (!files.length || mediaUploading || messageSending || !activeConversationId) return
    const conversationId = activeConversationId
    const sessionId = session?.sessionId
    const remaining = Math.max(0, 10 - messageAttachments.length)
    if (remaining === 0) {
      setNotice('Mỗi tin nhắn tối đa 10 file đính kèm.')
      return
    }
    const selected = files.slice(0, remaining)
    if (selected.length < files.length) setNotice('Mỗi tin nhắn tối đa 10 file đính kèm.')
    try {
      const uploaded = await uploadMediaFiles(selected, 'chat')
      if (sessionRef.current?.sessionId !== sessionId) return
      setMessageDrafts((current) => {
        const previous = current[conversationId] ?? emptyDraft
        return {
          ...current,
          [conversationId]: { ...previous, attachments: [...previous.attachments, ...uploaded].slice(0, 10) },
        }
      })
    } catch (error) {
      if (sessionRef.current?.sessionId === sessionId) setNotice(error instanceof Error ? error.message : 'Không upload được file')
    }
  }

  async function addFeedFiles(files: File[]) {
    if (!files.length || pendingPost || mediaUploading) return
    const sessionId = session?.sessionId
    const remaining = Math.max(0, 12 - postAttachments.length)
    if (remaining === 0) {
      setNotice('Mỗi bài viết tối đa 12 ảnh/video.')
      return
    }
    const selected = files.slice(0, remaining)
    if (selected.length < files.length) setNotice('Mỗi bài viết tối đa 12 ảnh/video.')
    try {
      const uploaded = await uploadMediaFiles(selected, 'feed')
      if (sessionRef.current?.sessionId !== sessionId) return
      setPostAttachments((current) => [...current, ...uploaded].slice(0, 12))
    } catch (error) {
      if (sessionRef.current?.sessionId === sessionId) setNotice(error instanceof Error ? error.message : 'Không upload được media')
    }
  }

  async function createStory(file?: File) {
    if (!file || storyBusy || mediaUploading) return
    const sessionId = session?.sessionId
    setStoryBusy(true)
    try {
      const [attachment] = await uploadMediaFiles([file], 'story')
      if (sessionRef.current?.sessionId !== sessionId) return
      const response = await apiFetch('/api/stories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attachment: attachmentRequestBody(attachment) }),
      })
      const result = await response.json().catch(() => null) as (Story & { error?: string }) | null
      if (sessionRef.current?.sessionId !== sessionId) return
      if (!response.ok || !result?.id || !result.attachment) throw new Error(result?.error || 'Không đăng được Story')
      setStories((current) => [result, ...current.filter((item) => item.id !== result.id)])
      setActiveStoryId(result.id)
    } catch (error) {
      if (sessionRef.current?.sessionId === sessionId) setNotice(error instanceof Error ? error.message : 'Không đăng được Story')
    } finally {
      if (sessionRef.current?.sessionId === sessionId) setStoryBusy(false)
    }
  }

  function nextStory() {
    const next = stories[activeStoryIndex + 1]
    setActiveStoryId(next?.id ?? null)
  }

  function previousStory() {
    const previous = stories[activeStoryIndex - 1]
    if (previous) setActiveStoryId(previous.id)
  }

  async function deleteStory(story: Story) {
    if (story.author !== name || storyBusy || !window.confirm('Xóa Story này?')) return
    const sessionId = session?.sessionId
    setStoryBusy(true)
    try {
      const response = await apiFetch(`/api/stories/${story.id}`, { method: 'DELETE' })
      if (sessionRef.current?.sessionId !== sessionId) return
      if (!response.ok) throw new Error('Không xóa được Story')
      setStories((current) => current.filter((item) => item.id !== story.id))
      setActiveStoryId((current) => current === story.id ? null : current)
    } catch (error) {
      if (sessionRef.current?.sessionId === sessionId) setNotice(error instanceof Error ? error.message : 'Không xóa được Story')
    } finally {
      if (sessionRef.current?.sessionId === sessionId) setStoryBusy(false)
    }
  }

  async function syncPushState(state: PushState) {
    if (!session?.token || !state.subscriptionId) return

    const response = await apiFetch('/api/push/subscription', {
      method: state.optedIn ? 'POST' : 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscriptionId: state.subscriptionId }),
    })
    if (!response.ok) throw new Error('Không lưu được đăng ký thông báo.')
  }

  useEffect(() => {
    if (!session?.token) {
      setTranslationPreferencesLoaded(false)
      setAutoTranslate(true)
      setTargetLanguage('en')
      setAppLocale(loadAppLocalePreference())
      return
    }

    let cancelled = false
    const revision = preferenceRevision.current
    const preferenceKey = `chatnet-preferences:${session.user.id}`
    try {
      const cached = JSON.parse(localStorage.getItem(preferenceKey) || 'null') as
        | { targetLanguage?: string; autoTranslate?: boolean; appLocale?: string }
        | null
      if (cached?.targetLanguage && isSupportedLanguageCode(cached.targetLanguage)) {
        setTargetLanguage(cached.targetLanguage)
      }
      if (typeof cached?.autoTranslate === 'boolean') setAutoTranslate(cached.autoTranslate)
      if (cached?.appLocale === 'auto' || (cached?.appLocale && isSupportedLanguageCode(cached.appLocale))) {
        setAppLocale(cached.appLocale)
        saveAppLocalePreference(cached.appLocale)
      }
    } catch {
      // Ignore malformed local fallback; server preferences remain authoritative.
    }

    apiFetch('/api/preferences')
      .then(async (response) => {
        if (!response.ok) return null
        return response.json() as Promise<{
          targetLanguage: string
          autoTranslate: boolean
          appLocale: string
        }>
      })
      .then((preferences) => {
        if (cancelled || revision !== preferenceRevision.current) return
        if (preferences) {
          const nextTarget = isSupportedLanguageCode(preferences.targetLanguage)
            ? preferences.targetLanguage
            : 'en'
          const nextAuto = preferences.autoTranslate !== false
          const nextLocale = preferences.appLocale === 'auto' || isSupportedLanguageCode(preferences.appLocale)
            ? preferences.appLocale
            : 'auto'

          setTargetLanguage(nextTarget)
          setAutoTranslate(nextAuto)
          setAppLocale(nextLocale)
          saveAppLocalePreference(nextLocale)
          localStorage.setItem(
            preferenceKey,
            JSON.stringify({
              targetLanguage: nextTarget,
              autoTranslate: nextAuto,
              appLocale: nextLocale,
            }),
          )
        }
      })
      .catch(() => {
        // Keep local/device preferences when the network is unavailable.
      })
      .finally(() => {
        if (!cancelled) setTranslationPreferencesLoaded(true)
      })

    return () => {
      cancelled = true
    }
  }, [session?.sessionId])

  async function savePreferences(
    nextTarget: string,
    nextAuto: boolean,
    nextAppLocale: string,
  ) {
    if (!session?.token) return
    const sessionId = session.sessionId
    const revision = ++preferenceRevision.current
    const preferenceKey = `chatnet-preferences:${session.user.id}`
    localStorage.setItem(
      preferenceKey,
      JSON.stringify({
        targetLanguage: nextTarget,
        autoTranslate: nextAuto,
        appLocale: nextAppLocale,
      }),
    )
    const save = async () => {
      if (sessionRef.current?.sessionId !== sessionId || revision !== preferenceRevision.current) return
      const response = await apiFetch('/api/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetLanguage: nextTarget,
          autoTranslate: nextAuto,
          appLocale: nextAppLocale,
        }),
      })
      if (!response.ok && sessionRef.current?.sessionId === sessionId && revision === preferenceRevision.current) {
        setNotice('Cài đặt đã áp dụng trên máy này nhưng chưa đồng bộ được. Chọn lại cài đặt để thử lại.', 'warning')
      }
    }
    preferenceQueue.current = preferenceQueue.current.catch(() => undefined).then(save)
    await preferenceQueue.current
  }

  async function saveTranslationPreferences(nextTarget: string, nextAuto: boolean) {
    await savePreferences(nextTarget, nextAuto, appLocale)
  }

  async function changeAppLocale(nextLocale: string) {
    const normalized = nextLocale === 'auto' ? 'auto' : nextLocale.toLowerCase().split('-')[0]
    if (normalized !== 'auto' && !isSupportedLanguageCode(normalized)) return
    setAppLocale(normalized)
    saveAppLocalePreference(normalized)
    setLocalePickerOpen(false)
    setLocaleSearch('')
    if (session?.token) {
      await savePreferences(targetLanguage, autoTranslate, normalized)
    }
  }

  useEffect(() => {
    document.documentElement.lang = effectiveAppLocale

    const cached = loadCachedBundle(effectiveAppLocale)
    if (cached) {
      setUiBundle(cached)
    } else {
      setUiBundle(defaultBundle())
    }

    if (effectiveAppLocale === 'vi' || !session?.token) {
      setUiLocaleLoading(false)
      return
    }

    const sessionId = session.sessionId
    let cancelled = false
    setUiLocaleLoading(true)

    apiFetch('/api/i18n/bundle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        locale: effectiveAppLocale,
        version: UI_BUNDLE_VERSION,
        messages: UI_MESSAGES,
      }),
    })
      .then(async (response) => {
        if (!response.ok) throw new Error('cannot load UI locale')
        return response.json() as Promise<{ locale: string; messages: UIBundle }>
      })
      .then((result) => {
        if (cancelled || sessionRef.current?.sessionId !== sessionId || result.locale !== effectiveAppLocale) return
        const bundle = { ...defaultBundle(), ...result.messages }
        setUiBundle(bundle)
        saveCachedBundle(effectiveAppLocale, bundle)
      })
      .catch(() => {
        // Cached bundle or Vietnamese source remains available as a safe fallback.
      })
      .finally(() => {
        if (!cancelled) setUiLocaleLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [effectiveAppLocale, session?.token])

  useEffect(() => {
    if (!session?.token) return

    const params = new URLSearchParams(window.location.search)
    if (params.get('tab') === 'feed') {
      setTab('feed')
    } else if (params.get('tab') === 'contacts') {
      setTab('contacts')
    }
    const conversationID = Number(params.get('conversation'))
    if (Number.isInteger(conversationID) && conversationID > 0) {
      setTab('chat')
      setActiveConversationId(conversationID)
    }
    if (params.has('tab') || params.has('conversation')) {
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [session?.token])

  useEffect(() => {
    setPushPrompt(false)
    setPushPromptDismissed(false)
    if (!session?.token) {
      setPushConfigured(false)
      setPushAppId('')
      setPushEnabled(false)
      setPushInitFailed(false)
      return
    }

    let cancelled = false

    void (async () => {
      try {
        const response = await apiFetch('/api/push/config')
        if (!response.ok) {
          if (!cancelled) setPushConfigured(false)
          return
        }

        const config = (await response.json()) as { configured: boolean; appId: string }
        if (cancelled) return

        setPushConfigured(config.configured)
        setPushAppId(config.appId || '')
        setPushInitFailed(false)

        if (!config.configured || !config.appId) return

        try {
          const state = await setupOneSignal(config.appId, async (nextState) => {
            if (cancelled) return
            setPushEnabled(nextState.optedIn)
            setPushPrompt(nextState.supported && nextState.permission === 'default' && !isPushDisabled())
            await syncPushState(nextState)
          })

          if (!cancelled) {
            setPushEnabled(state.optedIn)
            setPushPrompt(state.supported && state.permission === 'default' && !isPushDisabled())
            await syncPushState(state)
          }
        } catch (error) {
          if (!cancelled) {
            setPushEnabled(false)
            setPushInitFailed(true)
            const detail = error instanceof Error ? error.message : String(error)
            console.warn('OneSignal init failed:', detail)
          }
        }
      } catch {
        if (!cancelled) setPushConfigured(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [session?.sessionId])

  async function sendTestPush(silent = false, force = false) {
    if (!pushConfigured || (!pushEnabled && !force) || (pushBusy && !force)) return false

    const response = await apiFetch('/api/push/test', { method: 'POST' })
    const result = await response.json().catch(() => ({}))

    if (!response.ok) {
      if (!silent) {
        setNotice(
          result.error === 'no push subscription registered'
            ? 'Thiết bị chưa có Push Subscription hợp lệ.'
            : result.error || 'Không gửi được thông báo test.',
        )
      }
      return false
    }

    if (!silent) {
      setNotice(`Đã gửi thông báo test tới ${result.recipients || 1} thiết bị.`)
    }
    return true
  }

  async function previewMessageSound() {
    const played = await messageSound.current?.preview()
    if (!played) setNotice('Trình duyệt chưa cho phép phát âm thanh. Hãy thử lại sau khi chạm vào SOCO.', 'warning')
  }

  function toggleMessageSound() {
    const enabled = !messageSoundEnabledRef.current
    messageSoundEnabledRef.current = enabled
    setMessageSoundEnabled(enabled)
    persistMessageSoundEnabled(enabled)
    if (enabled) void previewMessageSound()
  }

  async function togglePush() {
    if (pushBusy) return

    if (!pushConfigured || !pushAppId) {
      setNotice('Hệ thống thông báo chưa sẵn sàng. Vui lòng thử lại sau vài giây.')
      return
    }

    if (pushInitFailed) {
      try {
        const state = await setupOneSignal(pushAppId, async (nextState) => {
          setPushEnabled(nextState.optedIn)
          await syncPushState(nextState)
        })
        setPushInitFailed(false)
        setPushEnabled(state.optedIn)
        await syncPushState(state)
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error)
        setNotice(`Không khởi tạo được Push Notification: ${detail}`)
        return
      }
    }

    const isiOS = /iphone|ipad|ipod/i.test(navigator.userAgent)
    if (isiOS && !isStandalone && !pushEnabled) {
      setNotice('Trên iPhone: thêm SOCO vào Màn hình chính trước, rồi mở app và bật thông báo.')
      return
    }

    setPushBusy(true)
    try {
      const state = pushEnabled
        ? await disableOneSignalPush()
        : await enableOneSignalPush()

      setPushEnabled(state.optedIn)
      setPushPrompt(state.supported && state.permission === 'default' && !isPushDisabled())
      await syncPushState(state)

      if (state.permission === 'denied') {
        setNotice(
          'Thông báo đang bị chặn. Hãy mở cài đặt của trình duyệt/PWA → Notifications → Allow rồi quay lại SOCO.',
        )
      } else if (state.permission === 'unsupported') {
        setNotice('Thiết bị hoặc trình duyệt này chưa hỗ trợ Web Push.')
      } else if (!pushEnabled && !state.optedIn) {
        setNotice(
          'Chưa bật được thông báo. Vui lòng thử lại và chọn Cho phép.',
        )
      } else if (state.optedIn) {
        setNotice('Đã bật thông báo SOCO.')
      } else {
        setNotice('Đã tắt thông báo SOCO')
      }
    } catch {
      setNotice('Không thể bật thông báo. Kiểm tra quyền Notification của trình duyệt/PWA rồi thử lại.')
    } finally {
      setPushBusy(false)
    }
  }

  useEffect(() => {
    if (!session?.token) {
      setPrivacy(null)
      setPrivacyError('')
      setPrivacyLoading(false)
      return
    }
    const controller = new AbortController()
    setPrivacy(null)
    setPrivacyBusy(false)
    setPrivacyLoading(true)
    setPrivacyError('')
    apiFetch('/api/privacy', { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('Không thể tải quyền riêng tư.')
        return response.json() as Promise<UserPrivacy>
      })
      .then((value) => {
        if (!controller.signal.aborted) setPrivacy(value)
      })
      .catch(() => {
        if (!controller.signal.aborted) setPrivacyError('Không thể tải cài đặt riêng tư.')
      })
      .finally(() => {
        if (!controller.signal.aborted) setPrivacyLoading(false)
      })
    return () => controller.abort()
  }, [session?.sessionId, privacyRetry])

  async function changePrivacy(key: keyof UserPrivacy) {
    if (!privacy || privacyBusy || !session?.sessionId) return
    const sessionId = session.sessionId
    const next = { ...privacy, [key]: !privacy[key] }
    setPrivacyBusy(true)
    try {
      const response = await apiFetch('/api/privacy', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next),
      })
      const result = await response.json().catch(() => null) as UserPrivacy | null
      if (sessionRef.current?.sessionId !== sessionId) return
      if (!response.ok || !result) throw new Error('Không lưu được quyền riêng tư.')
      setPrivacy(result)
      setPrivacyError('')
      setNotice('Đã lưu cài đặt riêng tư')
    } catch {
      if (sessionRef.current?.sessionId === sessionId) {
        setPrivacyError('Lưu thất bại. Cài đặt trước đó vẫn được giữ.')
        setNotice('Không thể lưu quyền riêng tư. Vui lòng thử lại.', 'error')
      }
    } finally {
      if (sessionRef.current?.sessionId === sessionId) setPrivacyBusy(false)
    }
  }

  useEffect(() => {
    setManagedSessions([])
    setSessionsOpen(false)
    setSessionsBusy(false)
    setSessionsError('')
  }, [session?.sessionId])

  async function fetchAccountSessions() {
    const current = sessionRef.current
    if (!current?.refreshToken || sessionsBusy) return
    const identity = current.sessionId
    setSessionsBusy(true)
    setSessionsError('')
    try {
      const response = await fetch(`${API}/api/auth/sessions/list`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({ refreshToken: current.refreshToken }),
      })
      if (!response.ok) throw new Error('Không tải được phiên đăng nhập.')
      const data = await response.json() as ManagedAccountSession[]
      if (sessionRef.current?.sessionId === identity) {
        setManagedSessions(data)
        setSessionsOpen(true)
      }
    } catch {
      if (sessionRef.current?.sessionId === identity) {
        setSessionsError('Không thể tải các thiết bị. Vui lòng thử lại.')
      }
    } finally {
      if (sessionRef.current?.sessionId === identity) setSessionsBusy(false)
    }
  }

  async function revokeAccountSessions(sessionID?: string) {
    const current = sessionRef.current
    if (!current?.refreshToken || sessionsBusy) return
    const identity = current.sessionId
    const selected = managedSessions.find((item) => item.id === sessionID)
    if (sessionID && !selected) return
    const message = sessionID
      ? selected?.current
        ? 'Bạn muốn đăng xuất khỏi thiết bị này?'
        : 'Bạn muốn thu hồi phiên đăng nhập trên thiết bị đã chọn?'
      : 'Bạn muốn đăng xuất tất cả thiết bị khác?'
    if (!window.confirm(message)) return
    setSessionsBusy(true)
    setSessionsError('')
    try {
      const response = await fetch(`${API}/api/auth/sessions/${sessionID ? 'revoke' : 'revoke-others'}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({ refreshToken: current.refreshToken, ...(sessionID ? { sessionId: sessionID } : {}) }),
      })
      if (!response.ok) throw new Error('Không thu hồi được phiên đăng nhập.')
      if (sessionRef.current?.sessionId !== identity) return
      if (selected?.current) {
        logout(false)
      } else {
        setManagedSessions((items) => sessionID
          ? items.filter((item) => item.id !== sessionID)
          : items.filter((item) => item.current))
        setNotice('Đã thu hồi phiên đăng nhập được chọn.')
      }
    } catch {
      if (sessionRef.current?.sessionId === identity) {
        setSessionsError('Không thu hồi được phiên. Vui lòng thử lại.')
      }
    } finally {
      if (sessionRef.current?.sessionId === identity) setSessionsBusy(false)
    }
  }


  const contactQuery = friendQuery.trim().replace(/^@/, '').toLocaleLowerCase('vi-VN')
  const localContactMatches = [...friends, ...friendRequests].filter((friend) =>
    `${friend.displayName} ${friend.username}`.toLocaleLowerCase('vi-VN').includes(contactQuery),
  )
  const localContactIds = new Set(localContactMatches.map((friend) => friend.id))
  const contactSearchResults = [
    ...localContactMatches,
    ...friendResults.filter((friend) => !localContactIds.has(friend.id)),
  ]

  function friendRelationship(userId: number) {
    if (friends.some((item) => item.id === userId)) return 'accepted' as const
    const request = friendRequests.find((item) => item.id === userId)
    if (request?.direction === 'incoming') return 'incoming' as const
    if (request?.direction === 'outgoing') return 'outgoing' as const
    return 'none' as const
  }

  async function actOnFriend(friend: FriendSearchResult | FriendConnection, decline = false) {
    const sessionId = session?.sessionId
    if (!sessionId || friendActionRef.current.has(friend.id) || friend.id === session.user.id) return
    const relationship = friendRelationship(friend.id)
    if (decline && relationship !== 'incoming') return
    if (relationship === 'accepted') {
      if (friend.username) await openDirectByUsername(friend.username)
      return
    }

    friendActionRef.current.add(friend.id)
    setFriendBusyIds((current) => new Set(current).add(friend.id))
    ++friendSyncRequest.current
    setFriendActionBusy(friend.id)
    try {
      const removing = decline || relationship === 'outgoing'
      const method = removing ? 'DELETE' : 'POST'
      const path = removing
        ? `/api/friends/${friend.id}?direction=${relationship}`
        : relationship === 'incoming'
        ? `/api/friends/${friend.id}/accept`
        : `/api/friends/${friend.id}`
      const response = await apiFetch(path, { method })
      const result = await response.json().catch(() => null) as (FriendConnection & { error?: string }) | null
      if (sessionRef.current?.sessionId !== sessionId) return
      ++friendSyncRequest.current
      if (!response.ok) {
        setNotice(result?.error || 'Không cập nhật được lời mời kết bạn')
        await refreshFriendConnections()
        return
      }
      const label = friend.displayName || `@${friend.username}`
      if (removing) {
        setFriendRequests((current) => current.filter((item) => item.id !== friend.id))
        setNotice(decline ? 'Đã từ chối lời mời kết bạn' : 'Đã hủy lời mời kết bạn')
      } else if (result?.id === friend.id && result.status === 'accepted') {
        setFriends((current) => [...current.filter((item) => item.id !== friend.id), result])
        setFriendRequests((current) => current.filter((item) => item.id !== friend.id))
        setNotice(`Đã kết bạn với ${label}`)
      } else if (result?.id === friend.id && result.status === 'pending') {
        setFriendRequests((current) => [...current.filter((item) => item.id !== friend.id), result])
        setNotice(result.direction === 'incoming'
          ? `${label} cũng đã gửi lời mời. Bạn có thể chấp nhận ngay.`
          : `Đã gửi lời mời kết bạn tới ${label}`)
      } else {
        setNotice('Đang kiểm tra trạng thái kết bạn')
        await refreshFriendConnections()
      }
    } catch {
      if (sessionRef.current?.sessionId === sessionId) {
        setNotice('Không cập nhật được lời mời kết bạn. Kiểm tra kết nối rồi thử lại.')
        await refreshFriendConnections()
      }
    } finally {
      if (sessionRef.current?.sessionId === sessionId) {
        friendActionRef.current.delete(friend.id)
        setFriendBusyIds((current) => {
          const next = new Set(current)
          next.delete(friend.id)
          return next
        })
        setFriendActionBusy(friendActionRef.current.values().next().value ?? null)
      }
    }
  }

  async function changePersonalContact(friend: FriendConnection, field: 'nickname' | 'note' | 'favorite') {
    const sid = session?.sessionId
    if (!sid || friendBusyIds.has(friend.id)) return
    const previous = contactMetadata[friend.id] || { nickname: '', note: '', favorite: false }
    const next = { ...previous }
    if (field === 'favorite') {
      next.favorite = !next.favorite
    } else {
      const label = field === 'nickname' ? 'Biệt danh riêng (tối đa 60 ký tự)' : 'Ghi chú riêng (tối đa 1500 ký tự)'
      const answer = window.prompt(label, previous[field])
      if (answer === null) return
      next[field] = answer.trim()
      if (next[field].length > (field === 'nickname' ? 60 : 1500)) {
        setNotice('Nội dung vượt quá độ dài cho phép.', 'warning')
        return
      }
    }
    setFriendMenuId(null)
    setFriendBusyIds((ids) => new Set(ids).add(friend.id))
    try {
      const response = await apiFetch(`/api/contacts/${friend.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next),
      })
      const result = await response.json().catch(() => null) as { error?: string; id?: number; nickname?: string; note?: string; favorite?: boolean } | null
      if (sessionRef.current?.sessionId !== sid) return
      if (!response.ok || !result || result.id !== friend.id) {
        setNotice(result?.error || 'Không lưu được liên hệ.', 'error')
        return
      }
      setContactMetadata((old) => ({ ...old, [friend.id]: next }))
      setNotice('Đã lưu thông tin liên hệ riêng.')
    } catch {
      if (sessionRef.current?.sessionId === sid) setNotice('Không thể lưu liên hệ. Hãy thử lại.', 'error')
    } finally {
      setFriendBusyIds((ids) => {
        const nextIDs = new Set(ids)
        nextIDs.delete(friend.id)
        return nextIDs
      })
    }
  }

  async function blockContact(friend: FriendSearchResult | FriendConnection) {
    const sid = session?.sessionId
    if (!sid || friendBusyIds.has(friend.id)) return
    if (!window.confirm(`Chặn @${friend.username}? Người này sẽ không thể nhắn tin trực tiếp hoặc kết bạn với bạn.`)) return
    setFriendBusyIds((old) => new Set(old).add(friend.id))
    setFriendMenuId(null)
    try {
      const response = await apiFetch(`/api/users/${friend.id}/block`, { method: 'POST' })
      const result = await response.json().catch(() => null) as { error?: string } | null
      if (sessionRef.current?.sessionId !== sid) return
      if (!response.ok) {
        setNotice(result?.error || 'Không thể chặn người dùng.', 'error')
        return
      }
      setFriends((old) => old.filter((item) => item.id !== friend.id))
      setFriendRequests((old) => old.filter((item) => item.id !== friend.id))
      setFriendResults((old) => old.filter((item) => item.id !== friend.id))
      setBlockedUsers((old) => [...old.filter((item) => item.id !== friend.id), {
        id: friend.id, username: friend.username, displayName: friend.displayName,
      }])
      setFriendPreview(null)
      setConversations((old) => old.filter((item) => item.otherUserId !== friend.id))
      const currentConversation = conversations.find((item) => item.id === activeConversationId)
      if (currentConversation?.otherUserId === friend.id) setActiveConversationId(null)
      setNotice(`Đã chặn @${friend.username}.`)
      await refreshFriendConnections()
      void refreshConversations()
    } catch {
      if (sessionRef.current?.sessionId === sid) setNotice('Không thể chặn người dùng. Hãy thử lại.', 'error')
    } finally {
      setFriendBusyIds((old) => {
        const next = new Set(old)
        next.delete(friend.id)
        return next
      })
    }
  }

  async function reportContact(friend: FriendSearchResult | FriendConnection) {
    const sid = session?.sessionId
    if (!sid) return
    const answer = window.prompt('Lý do báo cáo: 1 - Spam, 2 - Quấy rối, 3 - Giả mạo, 4 - Khác')
    if (answer === null) return
    const reason = ({ '1': 'spam', '2': 'harassment', '3': 'impersonation', '4': 'other' } as Record<string, string>)[answer.trim()]
    if (!reason) {
      setNotice('Vui lòng chọn lý do từ 1 đến 4.', 'warning')
      return
    }
    const details = window.prompt('Mô tả sự việc (không quá 1000 ký tự, có thể để trống):')
    if (details === null) return
    if (details.length > 1000) {
      setNotice('Mô tả không được quá 1000 ký tự.', 'warning')
      return
    }
    setFriendMenuId(null)
    try {
      const response = await apiFetch(`/api/users/${friend.id}/report`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason, details: details.trim() }),
      })
      const result = await response.json().catch(() => null) as { error?: string } | null
      if (sessionRef.current?.sessionId !== sid) return
      setNotice(response.ok ? 'Đã gửi báo cáo. Cảm ơn bạn.' : result?.error || 'Không thể gửi báo cáo.', response.ok ? 'success' : 'error')
    } catch {
      if (sessionRef.current?.sessionId === sid) setNotice('Không thể gửi báo cáo. Hãy thử lại.', 'error')
    }
  }

  async function loadBlockedUsers() {
    const sid = session?.sessionId
    if (!sid || blockedBusy) return
    setBlockedBusy(true)
    setBlockedError('')
    try {
      const response = await apiFetch('/api/users/blocked')
      if (!response.ok) throw new Error()
      const data = await response.json() as Array<{id: number; username: string; displayName: string}>
      if (sessionRef.current?.sessionId === sid) {
        setBlockedUsers(data)
        setBlockedOpen(true)
      }
    } catch {
      if (sessionRef.current?.sessionId === sid) setBlockedError('Không tải được danh sách chặn.')
    } finally {
      if (sessionRef.current?.sessionId === sid) setBlockedBusy(false)
    }
  }

  async function unblockContact(userId: number) {
    const sid = session?.sessionId
    if (!sid || blockedBusy || !window.confirm('Bỏ chặn người dùng này?')) return
    setBlockedBusy(true)
    setBlockedError('')
    try {
      const response = await apiFetch(`/api/users/${userId}/block`, { method: 'DELETE' })
      if (!response.ok) throw new Error()
      if (sessionRef.current?.sessionId === sid) {
        setBlockedUsers((old) => old.filter((item) => item.id !== userId))
        setNotice('Đã bỏ chặn người dùng.')
      }
    } catch {
      if (sessionRef.current?.sessionId === sid) setBlockedError('Không thể bỏ chặn. Hãy thử lại.')
    } finally {
      if (sessionRef.current?.sessionId === sid) setBlockedBusy(false)
    }
  }

  async function declineFriendRequest(friend: FriendConnection) {
    await actOnFriend(friend, true)
  }

  async function removeAcceptedFriend(friend: FriendConnection) {
    const sessionId = session?.sessionId
    if (!sessionId || friendRelationship(friend.id) !== 'accepted' || friendActionRef.current.has(friend.id)) return
    if (!window.confirm(`Hủy kết bạn với ${friend.displayName || '@' + friend.username}?`)) return
    friendActionRef.current.add(friend.id)
    setFriendBusyIds((current) => new Set(current).add(friend.id))
    setFriendActionBusy(friend.id)
    setFriendMenuId(null)
    try {
      const response = await apiFetch(`/api/friends/${friend.id}?direction=accepted`, { method: 'DELETE' })
      const result = await response.json().catch(() => null) as { error?: string } | null
      if (sessionRef.current?.sessionId !== sessionId) return
      if (!response.ok) {
        setNotice(result?.error || 'Không thể hủy kết bạn. Vui lòng thử lại.')
      } else {
        setFriends((current) => current.filter((item) => item.id !== friend.id))
        setFriendPreview(null)
        setNotice('Đã hủy kết bạn')
      }
      await refreshFriendConnections()
    } catch {
      if (sessionRef.current?.sessionId === sessionId) {
        setNotice('Mạng gián đoạn. Đang đồng bộ lại danh sách bạn bè.')
        await refreshFriendConnections()
      }
    } finally {
      friendActionRef.current.delete(friend.id)
      if (sessionRef.current?.sessionId === sessionId) {
        setFriendBusyIds((current) => {
          const next = new Set(current)
          next.delete(friend.id)
          return next
        })
        setFriendActionBusy(friendActionRef.current.values().next().value ?? null)
      }
    }
  }

  useEffect(() => {
    if (!session?.token) {
      setFriends([])
      setFriendRequests([])
      setContactMetadata({})
      setFriendSyncSessionId('')
      setFriendSyncError('')
      setBlockedUsers([])
      setBlockedOpen(false)
      setBlockedError('')
      ++friendSyncRequest.current
      return
    }
    if (tab === 'contacts' || newChatMode === 'friends' || newChatMode === 'group' || chatFriend) {
      void refreshFriendConnections()
    }
  }, [session?.token, tab, newChatMode, chatFriend?.id])

  useEffect(() => {
    const friendSurfaceOpen = newChatMode === 'friends' || newChatMode === 'group' || tab === 'contacts'
    if (!session?.token || !friendSurfaceOpen) {
      setFriendResults([])
      setFriendSearching(false)
      setFriendSearchError(false)
      return
    }

    const controller = new AbortController()
    const query = friendQuery.trim()
    setFriendResults([])
    setFriendSearching(true)
    setFriendSearchError(false)

    if (!query) {
      apiFetch('/api/users/suggestions', { signal: controller.signal })
        .then(async (response) => {
          if (!response.ok) throw new Error('Cannot load suggestions')
          return response.json() as Promise<FriendSearchResult[]>
        })
        .then((items) => {
          if (!controller.signal.aborted) setFriendResults(items)
        })
        .catch(() => {
          if (!controller.signal.aborted) {
            setFriendResults([])
            setFriendSearchError(true)
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) setFriendSearching(false)
        })

      return () => controller.abort()
    }

    const timer = window.setTimeout(async () => {
      setFriendSearching(true)
      try {
        const response = await apiFetch(
          `/api/users/search?q=${encodeURIComponent(query)}`,
          { signal: controller.signal },
        )
        if (!response.ok) throw new Error('Cannot search users')
        const items = (await response.json()) as FriendSearchResult[]
        if (!controller.signal.aborted) setFriendResults(items)
      } catch {
        if (!controller.signal.aborted) {
          setFriendResults([])
          setFriendSearchError(true)
        }
      } finally {
        if (!controller.signal.aborted) setFriendSearching(false)
      }
    }, 250)

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [friendQuery, friendSearchRetry, newChatMode, session?.token, tab])

  function purgeConversation(id: number) {
    responseCache.current.invalidate(['conversations','messages'])
    revokedConversationIds.current.add(id)
    membershipSnapshot.current?.delete(id)
    membershipEventSequence.current += 1
    setConversations((current) => current.filter((item) => item.id !== id))
    setMessageDrafts((current) => {
      const next = { ...current }
      delete next[id]
      return next
    })
    if (activeConversationIdRef.current === id) {
      activeConversationIdRef.current = null
      setActiveConversationId(null)
      setMessages([])
      setHasMoreMessages(false)
      setGroupMembers([])
      setGroupSettingsOpen(false)
      setGroupActionsOpen(false)
      setSharedContentOpen(false)
      setTranslations({})
      setReplyingTo(null)
      setMessageActionId(null)
      setNotice('Bạn không còn là thành viên của nhóm này.')
    }
  }

  function syncFeedPost(updated: Post) {
    ++feedRevision.current
    setProfilePosts(current => current.map(p => p.id === updated.id ? updated : p))
    syncFeedDataPost(updated)
  }

  function removeFeedPost(id: number) {
    ++feedRevision.current
    setProfilePosts(current => current.filter(p => p.id !== id))
    removeFeedDataPost(id)
  }

  async function loadProfilePosts(more = false, force = false) {
    if (!session || profilePagingBusy.current) return
    const sessionId = session.sessionId
    const sequence = ++profileLoadSequence.current
    const revision = feedRevision.current
    const before = more && profilePosts.length ? Math.min(...profilePosts.map(post => post.id)) : 0
    profilePagingBusy.current = true
    setProfilePostsBusy(true)
    setProfilePostsError('')
    try {
      const response = await apiFetch(`/api/posts?scope=mine&limit=${FEED_PAGE_SIZE}${before ? '&before=' + before : ''}`, force ? { cache: 'reload' } : {})
      if (!response.ok) throw new Error('Không tải được dòng thời gian. Hãy thử lại.')
      const data = await response.json() as Post[]
      if (sessionRef.current?.sessionId !== sessionId || sequence !== profileLoadSequence.current) return
      if (revision !== feedRevision.current) throw new Error('Dòng thời gian vừa thay đổi. Hãy tải lại để cập nhật.')
      if (!Array.isArray(data) || data.some(post => !Number.isSafeInteger(post.id) || post.id <= 0 || post.author !== sessionRef.current?.user.username)) {
        throw new Error('Dữ liệu dòng thời gian không hợp lệ. Hãy tải lại.')
      }
      setProfilePosts(current => more ? data.reduce((items, post) => mergeById(items, post), current) : data)
      setProfileHasMore(data.length === FEED_PAGE_SIZE)
    } catch (error) {
      if (sessionRef.current?.sessionId === sessionId && sequence === profileLoadSequence.current) {
        setProfilePostsError(error instanceof Error ? error.message : 'Không tải được dòng thời gian. Hãy thử lại.')
      }
    } finally {
      if (sequence === profileLoadSequence.current) {
        profilePagingBusy.current = false
        if (sessionRef.current?.sessionId === sessionId) setProfilePostsBusy(false)
      }
    }
  }

  function closeProfileTimeline() {
    setProfileTimelineOpen(false)
    requestAnimationFrame(() => profileIdentityRef.current?.focus())
  }


  function logout(revoke = true, clearStorage = true) {
    responseCache.current.clear()
    setVisitorUsername(null)
    const current = sessionRef.current
    const currentToken = current?.token
    if (revoke && current?.refreshToken) {
      void fetch(`${API}/api/auth/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: current.refreshToken }),
        keepalive: true,
      }).then((response) => {
        if (!response.ok) throw new Error('revocation failed')
      }).catch(() => setNotice('Đã đăng xuất trên máy này. Không kết nối được server để thu hồi phiên.', 'warning'))
    }
    ++nearbyRequest.current
    setNearbyUsers([])
    setNearbyUntil(0)
    setNearbyBusy(false)
    setNearbyScanning(false)
    if (currentToken) {
      void fetch(`${API}/api/users/nearby`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${currentToken}` }, keepalive: true,
      }).catch(() => undefined)
    }
    void getOneSignalPushState()
      .then(async (state) => {
        if (!currentToken || !state.subscriptionId) return
        await fetch(`${API}/api/push/subscription`, {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${currentToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ subscriptionId: state.subscriptionId }),
        })
      })
      .catch(() => undefined)

    if (current?.user.id) clearChatPersistence(current.user.id)
    pendingSend.current = null
    if (clearStorage) localStorage.removeItem('chatnet-session')
    sessionRef.current = null
    auth.resetRegistration()
    auth.setAuthMode('login')
    setSession(null)
    setConversations([])
    revokedConversationIds.current.clear()
    membershipSnapshot.current = null
    membershipSyncSequence.current += 1
    membershipEventSequence.current += 1
    setHasMoreConversations(false)
    setConversationLoadingMore(false)
    conversationOffset.current = 0
    conversationPagingBusy.current = false
    setActiveConversationId(null)
    setMessages([])
    setHasMoreMessages(false)
    setMessagesLoadingMore(false)
    messagesPagingBusy.current = false
    setOutgoingMessage(null)
    setPendingPost(null)
    setPendingComments({})
    setLikePreviews({})
    setReactionPreviews({})
    actionLocks.current.clear()
    pendingRequests.current.clear()
    mutationRequests.current.clear()
    messageReceipts.current.clear()
    messageSound.current?.clearSeen()
    ++preferenceRevision.current
    setPendingActions(0)
    sendingRef.current = false
    setMessageSending(false)
    setGroupBusy(false)
    setProfileBusy(null)
    setProfileSaving(false)
    setStoryBusy(false)
    mediaUploadAbort.current?.abort()
    mediaUploadAbort.current = null
    setMediaUploading(null)
    setMediaUploadProgress(null)
    friendActionRef.current.clear()
    setFriendBusyIds(new Set())
    setFriendActionBusy(null)
    ++feedRevision.current
    setMessageDrafts({})
    setFriends([])
    setFriendRequests([])
    setFriendMenuId(null)
    setFriendPreview(null)
    setPostText('')
    setPosts([])
    ++profileLoadSequence.current
    profilePagingBusy.current = false
    setProfileTimelineOpen(false)
    setProfileComposerOpen(false)
    setProfileEditorOpen(false)
    setPostSubmitError('')
    setProfilePosts([])
    setProfileHasMore(false)
    setProfilePostsBusy(false)
    setProfilePostsError('')
    setHasMorePosts(false)
    setPostsLoadingMore(false)
    postsPagingBusy.current = false
    setStories([])
    setActiveStoryId(null)
    setCommentEditors({})
    setPostAttachments([])
    setTranslations({})
  }

  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key !== 'chatnet-session' && event.key !== null) return
      const next = loadSession()
      if (sessionRef.current?.sessionId !== next?.sessionId) logout(false, false)
      sessionRef.current = next
      setSession(next)
    }
    window.addEventListener('storage', sync)
    return () => window.removeEventListener('storage', sync)
  }, [])

  useEffect(() => {
    if (!session) return
    const refresh = () => {
      if (document.visibilityState === 'hidden') return
      void sessionClient.refresh().catch(() => setStatus('Đang kết nối lại...'))
    }
    refresh()
    const timer = window.setInterval(refresh, 60_000)
    window.addEventListener('focus', refresh)
    window.addEventListener('online', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', refresh)
      window.removeEventListener('online', refresh)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [session?.sessionId, sessionClient])

  useAppRealtime({
    onCategoryAssignmentChanged: conversationCategories.applyAssignment,
    onCategoriesChanged: () => { void conversationCategories.refreshCategories(); conversationCategories.refreshFiltered() },
    refreshCategoryConversations: conversationCategories.refreshFiltered,
    responseCache,
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
  })


  useEffect(() => {
    if (!session?.token || tab !== 'feed') return
    void refreshPosts()
    void refreshStories()
    const timer = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return
      void refreshPosts()
      void refreshStories()
    }, 12000)
    return () => window.clearInterval(timer)
  }, [tab, session?.token])

  useLayoutEffect(() => {
    const restore = pendingMessageScrollRestore.current
    const container = messagesScrollRef.current
    if (restore && container) {
      container.scrollTop = restore.top + container.scrollHeight - restore.height
      pendingMessageScrollRestore.current = null
      return
    }
    // Preserve scroll position when reading history; only follow new messages
    // when the reader was already near the bottom of the conversation.
    if (container && messageScrollAtBottom.current) container.scrollTop = container.scrollHeight
  }, [messages, outgoingMessage])

  useEffect(() => {
    if (
      !translationPreferencesLoaded ||
      !autoTranslate ||
      !session ||
      !activeConversationId
    ) return
    const missing = messages.filter(
      (message) =>
        message.senderId !== session.user.id &&
        Boolean(message.text.trim()) &&
        !translations[message.id],
    )
    missing.forEach((message) => void translateMessage(message))
  }, [autoTranslate, messages, targetLanguage, session?.user.id, activeConversationId])

  function changeAutoTranslate(next: boolean) {
    setAutoTranslate(next)
    void saveTranslationPreferences(targetLanguage, next)
  }

  function changeTargetLanguage(next: string) {
    setTargetLanguage(next)
    setTranslations({})
    setTranslationOriginals({})
    setTranslationMenuOpen(false)
    setTranslationPickerOpen(false)
    setLanguageSearch('')
    setTranslationSettingsSearch('')
    void saveTranslationPreferences(next, autoTranslate)
  }

  const canSend = useMemo(
    () =>
      Boolean(
        activeConversationId &&
        !mediaUploading &&
        !messageSending &&
        (messageText.trim() || messageAttachments.length > 0),
      ),
    [activeConversationId, messageText, messageAttachments.length, mediaUploading, messageSending],
  )

  async function openDirectByUsername(username: string) {
    setChatCreateError('')
    const normalized = username.trim().toLowerCase()
    if (!normalized || actionLocks.current.has('chat:create')) return
    const sessionId = session?.sessionId
    actionLocks.current.add('chat:create')
    try {
      const response = await apiFetch('/api/conversations/direct', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: normalized }),
      })
      const result = await response.json()
      if (sessionRef.current?.sessionId !== sessionId) return
      if (!response.ok || !Number.isSafeInteger(result?.id) || result.id <= 0) {
        setNotice(result?.error || 'Không thể mở cuộc trò chuyện')
        return
      }

      if (sessionRef.current?.sessionId !== session?.sessionId) return
      const created = result as Conversation
      membershipSnapshot.current?.add(created.id)
      revokedConversationIds.current.delete(created.id)
      membershipEventSequence.current += 1
      setConversations((current) => [created, ...current.filter((item) => item.id !== created.id)])
      setActiveConversationId(created.id)
      setTab('chat')
      setGlobalSearch('')
      setDirectUsername('')
      setFriendQuery('')
      setFriendResults([])
      setNewChatMode('none')
      setTranslations({})
      void refreshConversations()
    } catch {
      if (sessionRef.current?.sessionId === sessionId) setNotice('Không mở được cuộc trò chuyện. Kiểm tra kết nối rồi thử lại.')
    } finally {
      if (sessionRef.current?.sessionId === sessionId) actionLocks.current.delete('chat:create')
    }
  }

  async function createDirect(event: FormEvent) {
    event.preventDefault()
    await openDirectByUsername(directUsername)
  }

  async function createGroup(name: string, usernames: string[]) {
    if (actionLocks.current.has('chat:create')) return
    actionLocks.current.add('chat:create')
    setChatCreateError('')
    const sessionId = session?.sessionId
    try {
      const response = await apiFetch('/api/conversations/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, usernames }),
      })
      const result = await response.json()
      if (sessionRef.current?.sessionId !== sessionId) return
      if (!response.ok || !Number.isSafeInteger(result?.id) || result.id <= 0) {
        setChatCreateError(result?.error || 'Không thể tạo nhóm')
        return
      }
      const created = result as Conversation
      membershipSnapshot.current?.add(created.id)
      revokedConversationIds.current.delete(created.id)
      membershipEventSequence.current += 1
      setConversations((current) => [created, ...current.filter((item) => item.id !== created.id)])
      setActiveConversationId(created.id)
      setTab('chat')
      setFriendQuery('')
      setNewChatMode('none')
      void refreshConversations()
    } catch {
      if (sessionRef.current?.sessionId === sessionId) setChatCreateError('Không thể tạo nhóm. Kiểm tra kết nối rồi thử lại.')
    } finally {
      if (sessionRef.current?.sessionId === sessionId) actionLocks.current.delete('chat:create')
    }
  }

  async function sendMessage(event: FormEvent) {
    event.preventDefault()
    if (!canSend || !activeConversationId || sendingRef.current) return

    const conversationId = activeConversationId
    const submittedDraft = draft
    const text = messageText.trim()
    const attachments = messageAttachments
    if (!session) return
    const sessionId = session.sessionId
    const reply = replyingTo
    const signature = JSON.stringify({ text, attachments: attachments.map((file) => file.storageRef), replyToMessageId: reply?.id ?? null })
    const previous = pendingSend.current ?? loadPendingSend(session.user.id, sessionId)
    // A refresh cannot restore unsigned media URLs. Never silently resend a
    // text-only copy of an ambiguous attachment message as a new message.
    if (previous?.conversationId === conversationId && messageAttachments.length === 0) {
      try {
        const earlier = JSON.parse(previous.signature) as { text?: string; attachments?: string[] }
        if (earlier.text === text && Array.isArray(earlier.attachments) && earlier.attachments.length > 0) {
          setNotice('Tin kèm tệp trước đó chưa được xác nhận. Hãy kiểm tra lịch sử hoặc thay đổi nội dung trước khi gửi lại.', 'warning')
          return
        }
      } catch { /* Invalid old receipt is ignored. */ }
    }
    const clientId = previous && previous.sessionId === sessionId && previous.conversationId === conversationId && previous.signature === signature
      ? previous.clientId : crypto.randomUUID()
    pendingSend.current = { sessionId, conversationId, signature, clientId, draft: submittedDraft }
    savePendingSend(session.user.id, { sessionId, conversationId, signature, clientId })
    // A matching realtime receipt can confirm delivery even if the HTTP response is lost.
    messageReceipts.current.set(clientId, null)
    sendingRef.current = true
    setMessageSending(true)
    setOutgoingMessage({
      id: -1, clientId, conversationId, senderId: session.user.id, sender: session.user.username, senderDisplayName: session.user.displayName,
      text, attachments, createdAt: new Date().toISOString(),
      replyToMessageId: reply?.id, replyToSender: reply?.sender, replyToDisplayName: reply?.senderDisplayName, replyToText: reply?.text,
    })
    try {
      const response = await apiFetch(`/api/conversations/${conversationId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          attachments: attachments.map(attachmentRequestBody),
          clientId,
          ...(reply ? { replyToMessageId: reply.id } : {}),
        }),
      })
      if (sessionRef.current?.sessionId !== sessionId) return
      const receipt = messageReceipts.current.get(clientId)
      if (!response.ok && !receipt?.id) {
        if (response.status >= 400 && response.status < 500 && pendingSend.current?.clientId === clientId) {
          pendingSend.current = null
          clearPendingSend(session.user.id, clientId)
        }
        const result = await response.json().catch(() => null) as { error?: string } | null
        setNotice(result?.error || 'Gửi tin nhắn thất bại')
        return
      }
      const sent = receipt?.id ? receipt : await response.json() as Message
      if (!Number.isSafeInteger(sent.id) || sent.id <= 0 || sent.conversationId !== conversationId) {
        throw new Error('Invalid message response')
      }
      if (pendingSend.current?.clientId === clientId) pendingSend.current = null
      clearPendingSend(session.user.id, clientId)
      if (activeConversationIdRef.current === conversationId) {
        messageChanges.current.add(sent.id)
        setMessages((current) => mergeById(current, sent).sort((a, b) => a.id - b.id))
      }
      void refreshConversations()
      setMessageDrafts((current) => {
        if (current[conversationId] !== submittedDraft) return current
        const next = { ...current }
        delete next[conversationId]
        return next
      })
      if (activeConversationIdRef.current === conversationId) setReplyingTo((current) => current === reply ? null : current)
    } catch {
      if (sessionRef.current?.sessionId === sessionId) {
        setNotice('Chưa xác nhận được tin đã gửi. Bản nháp được giữ lại; kiểm tra hội thoại trước khi gửi lại.')
      }
    } finally {
      messageReceipts.current.delete(clientId)
      if (sessionRef.current?.sessionId === sessionId) {
        setOutgoingMessage(null)
        sendingRef.current = false
        setMessageSending(false)
        if (activeConversationIdRef.current === conversationId) {
          window.requestAnimationFrame(() => messageInputRef.current?.focus({ preventScroll: true }))
        }
      }
    }
  }

  async function editOwnMessage(message: Message) {
    const key = `message:${message.id}`
    if (message.deleted || message.senderId !== session?.user.id || actionLocks.current.has(key)) return
    const next = window.prompt('Sửa tin nhắn', message.text)
    if (next === null || next.trim() === message.text.trim()) return
    if (!next.trim()) {
      setNotice('Tin nhắn sau khi sửa không được để trống.')
      return
    }

    const sessionId = session?.sessionId
    actionLocks.current.add(key)
    try {
      const response = await apiFetch(`/api/messages/${message.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: next.trim() }),
      })
      const result = await response.json().catch(() => null) as Message | { error?: string } | null
      if (sessionRef.current?.sessionId !== sessionId) return
      if (!response.ok || !result || !('id' in result) || result.id !== message.id || typeof result.text !== 'string') {
        setNotice((result as { error?: string } | null)?.error || 'Không sửa được tin nhắn')
        return
      }
      const updated = result as Message
      if (activeConversationIdRef.current !== message.conversationId) return
      messageChanges.current.add(updated.id)
      setMessages((current) => current.map((item) => item.id === updated.id ? {
        ...item, text: updated.text, editedAt: updated.editedAt,
      } : item))
      setTranslations((current) => {
        const nextTranslations = { ...current }
        delete nextTranslations[message.id]
        return nextTranslations
      })
    } finally {
      if (sessionRef.current?.sessionId === sessionId) actionLocks.current.delete(key)
    }
  }

  async function recallOwnMessage(message: Message) {
    const key = `message:${message.id}`
    if (message.deleted || message.senderId !== session?.user.id || actionLocks.current.has(key)) return
    if (!window.confirm('Thu hồi tin nhắn này?')) return
    const sessionId = session?.sessionId
    actionLocks.current.add(key)
    try {
      const response = await apiFetch(`/api/messages/${message.id}`, { method: 'DELETE' })
      const result = await response.json().catch(() => null) as Message | { error?: string } | null
      if (sessionRef.current?.sessionId !== sessionId) return
      if (!response.ok || !result || !('id' in result) || result.id !== message.id || !result.deleted) {
        setNotice((result as { error?: string } | null)?.error || 'Không thu hồi được tin nhắn')
        return
      }
      const updated = result as Message
      if (activeConversationIdRef.current !== message.conversationId) return
      messageChanges.current.add(updated.id)
      setMessages((current) => current.map((item) => (item.id === updated.id ? updated : item)))
      setTranslations((current) => {
        const next = { ...current }
        delete next[message.id]
        return next
      })
      setReplyingTo((current) => current?.id === message.id ? null : current)
    } finally {
      if (sessionRef.current?.sessionId === sessionId) actionLocks.current.delete(key)
    }
  }

  async function toggleReaction(message: Message, emoji: string) {
    const key = `message:${message.id}`
    if (message.deleted || actionLocks.current.has(key)) return
    const sessionId = session?.sessionId
    actionLocks.current.add(key)
    setReactionPreviews((current) => ({ ...current, [message.id]: toggleCount(message.reactions || [], emoji) }))
    try {
      const response = await apiFetch(`/api/messages/${message.id}/reactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emoji }),
      })
      const result = await response.json() as Message & { error?: string }
      if (sessionRef.current?.sessionId !== sessionId) return
      if (!response.ok || result.id !== message.id) throw new Error(result.error || 'Không thả cảm xúc được')
      if (activeConversationIdRef.current === message.conversationId) {
        messageChanges.current.add(result.id)
        setMessages((current) => current.map((item) => item.id === result.id ? { ...item, reactions: result.reactions } : item))
      }
    } catch (error) {
      if (sessionRef.current?.sessionId === sessionId) setNotice(error instanceof Error ? error.message : 'Không thả cảm xúc được', 'error')
    } finally {
      if (sessionRef.current?.sessionId === sessionId) {
        actionLocks.current.delete(key)
        setReactionPreviews((current) => { const next = { ...current }; delete next[message.id]; return next })
      }
    }
  }

  async function requestTranslation(text: string, messageId?: number) {
    const response = await apiFetch('/api/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        target: targetLanguage,
        ...(messageId ? { messageId } : {}),
      }),
    })
    const result = await response.json().catch(() => null)
    if (sessionRef.current?.sessionId !== session?.sessionId) return null
    if (!response.ok || typeof result?.translatedText !== 'string') {
      setNotice(result?.error || 'AI dịch thất bại')
      return null
    }
    return result as { translatedText: string }
  }

  async function translateMessage(message: Message) {
    if (!message.text.trim()) return
    const result = await requestTranslation(message.text, message.id)
    if (!result) return
    setTranslations((current) => ({ ...current, [message.id]: result.translatedText }))
  }

  async function createPost(event: FormEvent) {
    event.preventDefault()
    if (!session || actionLocks.current.has('feed:create') || mediaUploading || (!postText.trim() && postAttachments.length === 0)) return

    setPostSubmitError('')
    const content = postText.trim()
    const attachments = postAttachments
    const visibility = postVisibility
    const background = postBackground
    const sessionId = session.sessionId
    actionLocks.current.add('feed:create')
    ++feedRevision.current
    setPendingPost({ id: -1, author: name, authorDisplayName: session?.user.displayName, content, visibility, background, attachments, likes: 0, liked: false, comments: [], createdAt: new Date().toISOString() })
    try {
      const response = await apiFetch('/api/posts', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, attachments: attachments.map(attachmentRequestBody), visibility, background }),
      })
      const post = await response.json() as Post & { error?: string }
      if (sessionRef.current?.sessionId !== sessionId) return
      if (!response.ok || !Number.isSafeInteger(post.id) || post.id <= 0) throw new Error(post.error || 'Không đăng được bài viết')
      setPosts((current) => [post, ...current.filter((item) => item.id !== post.id)])
      setProfilePosts(current => [post, ...current.filter(item => item.id !== post.id)])
      setPostText('')
      setPostAttachments([])
      setPostBackground('')
      setShowPostBackgrounds(false)
      setProfileComposerOpen(false)
      setNotice('Đã đăng bài viết.', 'success')
    } catch (error) {
      if (sessionRef.current?.sessionId === sessionId) {
        const message = error instanceof Error ? error.message : 'Không đăng được bài viết. Bản nháp được giữ lại.'
        setPostSubmitError(message)
        setNotice(message, 'error')
      }
    } finally {
      if (sessionRef.current?.sessionId === sessionId) {
        ++feedRevision.current
        actionLocks.current.delete('feed:create')
        setPendingPost(null)
      }
    }
  }

  async function like(post: Post) {
    const key = `feed:like:${post.id}`
    if (actionLocks.current.has(key)) return
    const sessionId = session?.sessionId
    actionLocks.current.add(key)
    ++feedRevision.current
    setLikePreviews((current) => ({ ...current, [post.id]: !post.liked }))
    try {
      const response = await apiFetch(`/api/posts/${post.id}/like`, { method: 'POST' })
      const updated = await response.json() as Post & { error?: string }
      if (sessionRef.current?.sessionId !== sessionId) return
      if (!response.ok || updated.id !== post.id || typeof updated.liked !== 'boolean' || !Number.isFinite(updated.likes)) {
        throw new Error(updated.error || 'Không cập nhật được lượt thích.')
      }
      setPosts((current) => current.map((item) => item.id === updated.id ? { ...item, liked: updated.liked, likes: updated.likes } : item))
      setSavedPosts((current) => current.map((item) => item.id === updated.id ? { ...item, liked: updated.liked, likes: updated.likes } : item))
      setProfilePosts(current => current.map(item => item.id === updated.id ? { ...item, liked: updated.liked, likes: updated.likes } : item))
    } catch (error) {
      if (sessionRef.current?.sessionId === sessionId) void refreshPosts()
      if (sessionRef.current?.sessionId === sessionId) setNotice(error instanceof Error ? error.message : 'Không cập nhật được lượt thích.', 'error')
    } finally {
      if (sessionRef.current?.sessionId === sessionId) {
        ++feedRevision.current
        actionLocks.current.delete(key)
        setLikePreviews((current) => { const next = { ...current }; delete next[post.id]; return next })
      }
    }
  }

  async function manageFeedComment(post: Post, commentId: number, method: 'PATCH' | 'DELETE', content?: string) {
    const response = await apiFetch('/api/posts/' + post.id + '/comments/' + commentId, {
      method,
      ...(method === 'PATCH' ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content }) } : {}),
    })
    if (!response.ok) {
      const data = await response.json().catch(() => ({})) as { error?: string }
      throw new Error(data.error || 'Không cập nhật được bình luận')
    }
    const updated = await response.json() as Post
    syncFeedPost(updated)
    setNotice(method === 'PATCH' ? 'Đã sửa bình luận.' : 'Đã xóa bình luận.', 'success')
  }
  async function reportFeedComment(commentId: number, reason: string) {
    const response = await apiFetch('/api/feed/reports', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetType: 'comment', targetId: commentId, reason }),
    })
    if (!response.ok) throw new Error('Không thể gửi báo cáo bình luận.')
    setNotice('Đã gửi báo cáo bình luận.', 'success')
  }

  async function addComment(post: Post, content: string, parentId?: number) {
    const sessionId = session?.sessionId
    const key = `feed:comment:${post.id}`
    if (actionLocks.current.has(key)) throw new Error('Bình luận đang được gửi.')
    actionLocks.current.add(key)
    ++feedRevision.current
    setPendingComments((current) => ({ ...current, [post.id]: {
      id: -1, parentId, author: name, authorDisplayName: session?.user.displayName, content, createdAt: new Date().toISOString(),
    } }))
    try {
      const response = await apiFetch(`/api/posts/${post.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, parentId }),
      })
      if (!response.ok) throw new Error('Chưa xác nhận được bình luận. Bản nháp được giữ lại; kiểm tra bài viết trước khi gửi lại.')
      const updated = await response.json() as Post
      if (sessionRef.current?.sessionId !== sessionId) return
      if (updated.id !== post.id || !Array.isArray(updated.comments)) throw new Error('Phản hồi không hợp lệ. Bản nháp được giữ lại.')
      setPosts((current) => current.map((item) => item.id === updated.id ? { ...item, comments: updated.comments } : item))
      setSavedPosts((current) => current.map((item) => item.id === updated.id ? { ...item, comments: updated.comments } : item))
      setProfilePosts(current => current.map(item => item.id === updated.id ? { ...item, comments: updated.comments } : item))
    } finally {
      if (sessionRef.current?.sessionId === sessionId) {
        ++feedRevision.current
        actionLocks.current.delete(key)
        setPendingComments((current) => { const next = { ...current }; delete next[post.id]; return next })
      }
    }
  }

  if (!session) return <AuthScreen {...auth} />

  const unreadTotal = conversations.reduce((sum, conversation) => sum + conversation.unreadCount, 0)
  const normalizedSearch = globalSearch.trim().toLocaleLowerCase('vi-VN')
  const searchedConversations = displayConversations.filter((conversation) => {
    if (!normalizedSearch) return true
    return (
      conversation.name.toLocaleLowerCase('vi-VN').includes(normalizedSearch) ||
      (conversation.otherUsername || '').toLocaleLowerCase('vi-VN').includes(normalizedSearch) ||
      conversation.lastMessage.toLocaleLowerCase('vi-VN').includes(normalizedSearch)
    )
  })
  const visibleConversations = conversationCategories.selected === null ? searchedConversations :
    conversationCategories.items.map(item => displayConversations.find(c => c.id === item.id) || item)
      .filter(item => !revokedConversationIds.current.has(item.id) &&
        (!membershipSnapshot.current || membershipSnapshot.current.has(item.id)) &&
        (!normalizedSearch || (item.name + ' ' + (item.otherUsername || '') + ' ' + item.lastMessage).toLocaleLowerCase('vi-VN').includes(normalizedSearch)))
  const searchedPosts = (feedFilter === 'saved' ? savedPosts : visiblePosts).filter((post) => {
    if (!normalizedSearch || tab !== 'feed') return true
    return (
      post.author.toLocaleLowerCase('vi-VN').includes(normalizedSearch) ||
      userLabel(post.authorDisplayName, post.author).toLocaleLowerCase('vi-VN').includes(normalizedSearch) ||
      post.content.toLocaleLowerCase('vi-VN').includes(normalizedSearch)
    )
  })
  const switchTab = (nextTab: Tab) => {
    setTab(nextTab)
    setQuickCreateOpen(false)
    setGlobalSearch('')
    if (nextTab !== 'chat') setActiveConversationId(null)
    if (nextTab !== 'contacts') setFriendQuery('')
  }

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
  )
  const profilePrivacyControls = (
    <PrivacyControls
      privacyLoading={privacyLoading}
      privacyError={privacyError}
      setPrivacyRetry={setPrivacyRetry}
      privacy={privacy}
      privacyBusy={privacyBusy}
      changePrivacy={changePrivacy}
    />
  )
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
      popup={profileComposerOpen}
      displayName={profileMedia?.displayName || session.user.displayName || name}
      submitError={postSubmitError}
    />
  )
  const renderPosts = (items: Post[]) => items.map(post => (
    <FeedPostCard
      key={post.id}
      post={post}
      name={name}
      onAuthorOpen={openVisitor}
      ownDisplayName={profileMedia?.displayName || session.user.displayName || name}
      apiFetch={apiFetch}
      syncFeedPost={syncFeedPost}
      removeFeedPost={removeFeedPost}
      setNotice={setNotice}
      token={session.token}
      translationPreferencesLoaded={translationPreferencesLoaded}
      targetLanguage={targetLanguage}
      setActivePostId={setActivePostId}
      likePreviews={likePreviews}
      like={like}
    />
  ))

  return (
    <main className={`app-shell modern-shell ${tab === 'chat' && activeConversation ? 'conversation-open' : ''}`}>
      {qrOpen && <Suspense fallback={<div role="status">Đang mở QR...</div>}>
        <ProfileQr username={session.user.username} displayName={session.user.displayName || session.user.username}
          url={connectUrl()} initialMode={qrOpen} onClose={() => setQrOpen(null)}
          onConnect={(username) => { setQrOpen(null); openVisitor(username) }} />
      </Suspense>}
      {mediaUploading && mediaUploadProgress && (
        <div className="media-upload-progress" role="status" aria-live="polite">
          <span>Đang tải tệp: {Math.round(mediaUploadProgress.loaded / Math.max(1, mediaUploadProgress.total) * 100)}%</span>
          <progress value={mediaUploadProgress.loaded} max={mediaUploadProgress.total} aria-label="Tiến độ tải tệp" />
          <button type="button" onClick={() => mediaUploadAbort.current?.abort()}>Hủy tải</button>
        </div>
      )}
      {visitorUsername && <VisitorProfile key={session.sessionId+':'+visitorUsername}
        username={visitorUsername} request={apiFetch} currentUser={name} token={session.token}
        targetLanguage={translationPreferencesLoaded?targetLanguage:''} relationship={friendRelationship}
        friendBusy={friendActionBusy} onFriend={actOnFriend} onMessage={async username=>{await openDirectByUsername(username);setVisitorUsername(null)}}
        onClose={()=>setVisitorUsername(null)} onPostOpen={post=>{setPosts(current=>[post,...current.filter(item=>item.id!==post.id)]);setActivePostId(post.id)}}
        onUpdated={syncFeedPost} updates={posts} onDeleted={removeFeedPost} feedback={setNotice} />}
      {newChatMode === 'group' && <GroupCreator ownerId={session.user.id}
        friends={friends.filter((friend) => friend.status === 'accepted')} results={friendResults}
        searching={friendSearching} query={friendQuery} onQuery={setFriendQuery} onCreate={createGroup}
        error={chatCreateError} onClose={() => { setNewChatMode('none'); setFriendQuery(''); setChatCreateError('') }} />}
      {tab !== 'profile' && tab !== 'discover' && (
      <header className="chatnet-appbar">
        <div className="appbar-brand"><img src="/soco-mark.svg" width="32" height="32" alt="" /><strong>SOCO</strong></div>
          <label className="appbar-search">
            <UiIcon name="search" size={27} />
            <input
              value={tab === 'contacts' ? friendQuery : globalSearch}
              onChange={(event) => {
                if (tab === 'contacts') setFriendQuery(event.target.value)
                else setGlobalSearch(event.target.value)
              }}
              placeholder={
                tab === 'contacts' ? 'Tên, @username hoặc email'
                  : tab === 'feed' ? 'Tìm tác giả hoặc nội dung bài viết'
                    : 'Tìm cuộc trò chuyện'
              }
              aria-label={
                tab === 'contacts' ? 'Tìm bạn bằng tên, username hoặc email'
                  : tab === 'feed' ? 'Tìm bài viết'
                    : 'Tìm cuộc trò chuyện'
              }
            />
          </label>
        <div className="appbar-actions">
          {tab === 'chat' && (
            <>
              <button
                className="appbar-icon-button"
                type="button"
                aria-label="Quét QR"
                onClick={() => setQrOpen('scan')}
              >
                <UiIcon name="qr" size={28} />
              </button>
              <div className="appbar-create-anchor">
                <button
                  className={quickCreateOpen ? 'appbar-icon-button appbar-create-trigger active' : 'appbar-icon-button appbar-create-trigger'}
                  type="button"
                  aria-label="Tạo mới"
                  aria-expanded={quickCreateOpen}
                  aria-haspopup="menu"
                  onClick={() => setQuickCreateOpen((current) => !current)}
                >
                  <UiIcon name="plus" size={29} />
                </button>
                {quickCreateOpen && (
                  <>
                    <button
                      type="button"
                      className="quick-create-dismiss"
                      aria-label="Đóng menu tạo mới"
                      onClick={() => setQuickCreateOpen(false)}
                    />
                    <div className="quick-create-menu" role="menu" aria-label="Tạo cuộc trò chuyện mới">
                      <div className="quick-create-caption">TẠO MỚI</div>
                      <button type="button" role="menuitem" onClick={() => openConnectSurface()}>
                        <span className="quick-create-symbol"><Search size={19} aria-hidden="true" /></span>
                        <div><strong>Tìm & kết nối</strong><small>Tìm bạn bè bằng tên hoặc @username</small></div>
                      </button>
                      <button type="button" role="menuitem" onClick={() => { setNewChatMode('direct'); setQuickCreateOpen(false) }}>
                        <span className="quick-create-symbol"><MessageCircle size={19} aria-hidden="true" /></span>
                        <div><strong>Chat riêng</strong><small>Bắt đầu cuộc trò chuyện 1-1</small></div>
                      </button>
                      <button type="button" role="menuitem" onClick={() => { setFriendQuery(''); setChatCreateError(''); setNewChatMode('group'); setQuickCreateOpen(false) }}>
                        <span className="quick-create-symbol"><Users size={19} aria-hidden="true" /></span>
                        <div><strong>Tạo nhóm</strong><small>Trò chuyện cùng nhiều người</small></div>
                      </button>
                    </div>
                  </>
                )}
              </div>
            </>
          )}

          {tab === 'feed' && (
            <>
              <button
                className="appbar-icon-button"
                type="button"
                aria-label="Tạo bài viết"
                onClick={() => {
                  postComposerRef.current?.focus()
                  postComposerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                }}
              >
                <UiIcon name="compose" size={27} />
              </button>
              <button
                className="appbar-icon-button notification-appbar"
                type="button"
                aria-label={pushEnabled ? 'Tắt thông báo' : 'Bật thông báo'}
                onClick={() => void togglePush()}
                disabled={pushBusy}
              >
                <UiIcon name="bell" size={27} />
                {!pushEnabled && <span className="appbar-badge">!</span>}
              </button>
            </>
          )}

          {tab === 'contacts' && (
            <button
              className="appbar-icon-button"
              type="button"
              aria-label="Thêm bạn"
              onClick={() => {
                setTab('chat')
                setNewChatMode('friends')
              }}
            >
              <UiIcon name="plus" size={31} />
            </button>
          )}


        </div>
      </header>
      )}

      {pushPrompt && !pushPromptDismissed && !pushEnabled && (
        <section className="push-onboarding" aria-label="Thông báo tin nhắn" aria-live="polite">
          <Bell size={22} aria-hidden="true" />
          <strong>Nhận thông báo tin nhắn mới?</strong>
          <div className="push-onboarding-actions">
            <button type="button" onClick={() => setPushPromptDismissed(true)} disabled={pushBusy}>
              Để sau
            </button>
            <button className="push-onboarding-enable" type="button" onClick={() => void togglePush()} disabled={pushBusy}>
              {pushBusy ? 'Đang bật...' : 'Bật thông báo'}
            </button>
          </div>
        </section>
      )}

      {notice && (
        <div
          className={`notice toast toast-${notice.kind}`}
          role={notice.kind === 'error' ? 'alert' : 'status'}
          aria-live={notice.kind === 'error' ? 'assertive' : 'polite'}
        >
          <span className="toast-icon" aria-hidden="true">
            {notice.kind === 'success' ? '✓' : notice.kind === 'error' ? '!' : notice.kind === 'warning' ? '!' : 'i'}
          </span>
          <div className="toast-copy">
            <strong>
              {notice.kind === 'success' ? 'Thành công' : notice.kind === 'error' ? 'Có lỗi' : notice.kind === 'warning' ? 'Lưu ý' : 'Thông báo'}
            </strong>
            <span>{notice.message}</span>
          </div>
          <button type="button" aria-label="Đóng thông báo" onClick={() => setNoticeState(null)}>×</button>
        </div>
      )}
      {pendingActions > 0 && (
        <div className="request-progress" role="status" aria-live="polite">
          <RefreshCw size={16} aria-hidden="true" />
          <span>Đang xử lý{pendingActions > 1 ? ` (${pendingActions})` : ''}...</span>
        </div>
      )}

      <section className={`phone-frame modern-frame ${tab === 'chat' && activeConversation ? 'mobile-conversation-open' : ''}`}>
        {tab === 'chat' && (
          <div className={`messenger-layout modern-messenger ${activeConversation ? 'has-active' : ''}`}>
            <aside className="conversation-sidebar">
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
                        <small>Tìm bạn bè trên SOCO</small>
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
                      {friendSearching && (
                        <div className="connect-loading" aria-label="Đang tìm">
                          <span /><span /><span />
                        </div>
                      )}
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
              <div className="conversation-list zalo-conversation-list">
                {conversationCategories.selected !== null && conversationCategories.loading && <p role="status">Đang tải phân loại…</p>}
                {conversationCategories.selected !== null && conversationCategories.listError && <div role="alert" className="category-error">
                  {conversationCategories.listError}<button type="button" onClick={() => void conversationCategories.load(false,true)}>Thử lại</button>
                </div>}
                {visibleConversations.length === 0 && !conversationCategories.loading && !conversationCategories.listError && (
                  <div className="conversation-list-empty">
                    <SocoEmptyState
                      kind={normalizedSearch ? 'search' : 'chat'}
                      title={normalizedSearch ? 'Không tìm thấy cuộc trò chuyện' : 'Chưa có cuộc trò chuyện'}
                      description={normalizedSearch ? 'Thử tìm bằng tên hoặc nội dung khác.' : 'Tìm bạn bè để bắt đầu kết nối và trò chuyện.'}
                      action={!normalizedSearch && <SocoTextAction onClick={() => openConnectSurface()}>Tìm bạn bè</SocoTextAction>}
                    />
                  </div>
                )}

                {visibleConversations.map((conversation) => (
                  <button
                    key={conversation.id}
                    className={`conversation-item ${activeConversationId === conversation.id ? 'active' : ''}`}
                    onClick={() => {
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
                        <span className="conversation-title"><strong>{conversation.name}</strong>
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
                ))}
                {(conversationCategories.selected === null ? hasMoreConversations : conversationCategories.hasMore) && (
                  <button type="button" className="soco-load-more soco-conversation-load-more"
                    onClick={() => void (conversationCategories.selected === null ? loadMoreConversations() : conversationCategories.load(true))}
                    disabled={conversationLoadingMore || conversationCategories.loading}
                    aria-busy={conversationLoadingMore || conversationCategories.loading}>
                    <RefreshCw size={15} aria-hidden="true" />
                    {conversationLoadingMore || conversationCategories.loading ? 'Đang tải...' : 'Tải thêm hội thoại'}
                  </button>
                )}
              </div>
            </aside>

            <section className={activeConversation?.type === 'group'
              ? `conversation-panel group-chat-panel${groupSettingsOpen ? ' group-settings-visible' : ''}`
              : 'conversation-panel'}>
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
                      <div>
                        <strong>{activeConversation.type === 'direct' && activeConversation.otherUsername
                          ? <button type="button" className="visitor-name-link" onClick={() => openVisitor(activeConversation.otherUsername!)} aria-label="Xem trang cá nhân">{activeConversation.name}</button>
                          : activeConversation.name}</strong>
                        <small className="room-subtitle">
                          {activeConversation.type === 'group'
                            ? `${activeConversation.memberCount} thành viên`
                            : activeConversation.online ? '● Đang online' : 'Chat riêng'}
                          <CategoryAssignment model={conversationCategories} conversationId={activeConversation.id} categoryId={activeConversation.categoryId} />
                        </small>
                      </div>
                    </div>

                    {activeConversation.type === 'group' && (
                      <div className="group-mobile-actions">
                        <CallHeaderActions conversationId={activeConversation.id} />
                        <button type="button" className="group-more-trigger"
                          aria-label="Tùy chọn nhóm" aria-haspopup="dialog"
                          aria-expanded={groupActionsOpen}
                          onClick={() => setGroupActionsOpen((open) => !open)}>
                          <MoreHorizontal size={23} aria-hidden="true" />
                        </button>
                      </div>
                    )}

                    <div className="translate-controls">
                      <CallHeaderActions conversationId={activeConversation.id} />
                      <button
                        type="button"
                        className="group-settings-toggle shared-content-trigger"
                        onClick={() => setSharedContentOpen(true)}
                        aria-label="Xem ảnh, tệp và liên kết đã chia sẻ"
                        title="Nội dung đã chia sẻ"
                      >
                        <Images size={19} strokeWidth={2.1} aria-hidden="true" />
                        <span className="shared-content-label">Nội dung</span>
                      </button>
                      {activeConversation.type === 'group' && (
                        <button
                          type="button"
                          className={groupSettingsOpen ? 'group-settings-toggle active' : 'group-settings-toggle'}
                          onClick={() => {
                            if (groupSettingsOpen) setGroupSettingsOpen(false)
                            else openGroupSettings(activeConversation)
                          }}
                        >
                          👥 Nhóm
                        </button>
                      )}
                      <div className="translation-hub">
                        <button
                          type="button"
                          className={autoTranslate ? 'translation-hub-trigger active' : 'translation-hub-trigger'}
                          aria-expanded={translationMenuOpen}
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

                        {translationMenuOpen && (
                          <>
                            <button
                              type="button"
                              className="translation-hub-scrim"
                              aria-label="Đóng cài đặt dịch"
                              onClick={() => setTranslationMenuOpen(false)}
                            />
                            <div className="translation-hub-popover" role="dialog" aria-label="Cài đặt dịch AI">
                              <div className="translation-hub-heading">
                                <div>
                                  <strong>{t('translation.title')}</strong>
                                  <small>{t('translation.subtitle')}</small>
                                </div>
                                <button
                                  type="button"
                                  className={autoTranslate ? 'translation-hub-switch active' : 'translation-hub-switch'}
                                  role="switch"
                                  aria-checked={autoTranslate}
                                  onClick={() => changeAutoTranslate(!autoTranslate)}
                                >
                                  <span />
                                </button>
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
                                    className={targetLanguage === language.value ? 'active' : ''}
                                    onClick={() => changeTargetLanguage(language.value)}
                                  >
                                    <span className="translation-language-flag" aria-hidden="true">{language.flag}</span>
                                    <span className="translation-language-copy">
                                      <strong>{language.localizedLanguage}</strong>
                                      <small>{language.nativeLanguage}</small>
                                      <em>{language.localizedRegion} · {language.nativeRegion}</em>
                                    </span>
                                    <b>{language.code}</b>
                                    {targetLanguage === language.value && <i aria-hidden="true">✓</i>}
                                  </button>
                                ))}
                                {visibleLanguageOptions.length === 0 && (
                                  <div className="translation-language-empty">
                                    {t('translation.noResults')}
                                  </div>
                                )}
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </header>


                  {groupActionsOpen && activeConversation.type === 'group' && !groupSettingsOpen && (
                    <GroupActionsSheet
                      groupName={activeConversation.name}
                      memberCount={activeConversation.memberCount}
                      autoTranslate={autoTranslate}
                      targetLanguage={targetLanguage}
                      languages={languageOptions}
                      onClose={() => setGroupActionsOpen(false)}
                      onCall={(mediaType) => launchGroupCall(activeConversation.id, mediaType)}
                      onSharedContent={() => setSharedContentOpen(true)}
                      onManageGroup={() => openGroupSettings(activeConversation)}
                      onToggleAutoTranslate={() => changeAutoTranslate(!autoTranslate)}
                      onChangeLanguage={(language) => changeTargetLanguage(language)}
                    />
                  )}

                  {chatFriend && (
                    <div className={`chat-friend-bar relationship-${chatFriendRelationship}`} aria-label="Kết bạn trong cuộc trò chuyện">
                      <span role="status">
                        {chatFriendRelationship === 'accepted' ? <UserCheck size={18} aria-hidden="true" /> : <UserPlus size={18} aria-hidden="true" />}
                        {friendSyncError || (friendSyncSessionId !== session?.sessionId ? 'Đang tải trạng thái kết bạn...' :
                          chatFriendRelationship === 'accepted' ? 'Hai bạn đã là bạn bè' :
                          chatFriendRelationship === 'incoming' ? 'Bạn nhận được lời mời kết bạn' :
                          chatFriendRelationship === 'outgoing' ? 'Đã gửi lời mời kết bạn' : 'Hai bạn chưa kết bạn')}
                      </span>
                      {friendSyncError ? (
                        <button type="button" disabled={friendSyncBusy} onClick={() => void refreshFriendConnections()}>
                          <RefreshCw size={16} aria-hidden="true" /> Thử lại
                        </button>
                      ) : friendSyncSessionId === session?.sessionId && chatFriendRelationship !== 'accepted' && (
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

                  {groupSettingsOpen && activeConversation.type === 'group' && (
            <GroupSettingsPanel
              activeGroupMember={activeGroupMember}
              setGroupSettingsOpen={setGroupSettingsOpen}
              canManageActiveGroup={canManageActiveGroup}
              groupNameDraft={groupNameDraft}
              setGroupNameDraft={setGroupNameDraft}
              renameActiveGroup={renameActiveGroup}
              groupBusy={groupBusy}
              activeConversation={activeConversation}
              groupInviteSelection={groupInviteSelection}
              groupInviteSearch={groupInviteSearch}
              setGroupInviteSearch={setGroupInviteSearch}
              groupInviteCandidates={groupInviteCandidates}
              friends={friends}
              setGroupInviteSelection={setGroupInviteSelection}
              groupInviteDraft={groupInviteDraft}
              setGroupInviteDraft={setGroupInviteDraft}
              inviteGroupMembers={inviteGroupMembers}
              groupMembers={groupMembers}
              userId={session.user.id}
              changeGroupMemberRole={changeGroupMemberRole}
              removeGroupMember={removeGroupMember}
            />
                  )}

                  {sharedContentOpen && (
                    <SharedContent
                      conversationId={activeConversation.id}
                      request={apiFetch}
                      onClose={() => setSharedContentOpen(false)}
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
                        {messagesLoadingMore ? 'Đang tải...' : 'Tải thêm tin nhắn cũ'}
                      </button>
                    )}
                    <div className="day-divider"><span>Cuộc trò chuyện</span></div>
                    {visibleMessages.map((message) => {
                      const mine = message.senderId === session.user.id
                      const translatedText = !message.deleted ? translations[message.id] : ''
                      const originalVisible = Boolean(translationOriginals[message.id])
                      const translatedLanguage = selectedLanguage?.localizedLanguage || targetLanguage.toUpperCase()
                      return (
                        <article
                          key={message.id}
                          className={mine ? 'message mine message-press-target' : 'message message-press-target'}
                          onPointerDown={(event) => beginMessageLongPress(message, event.clientX, event.clientY, event.button, event.target)}
                          onPointerMove={(event) => moveMessageLongPress(event.clientX, event.clientY)}
                          onPointerUp={cancelMessageLongPress}
                          onPointerCancel={cancelMessageLongPress}
                          onPointerLeave={cancelMessageLongPress}
                          onContextMenu={(event) => {
                            if (message.deleted) return
                            event.preventDefault()
                            openMessageActions(message)
                          }}
                        >
                          {!mine && <div className="message-meta">{userLabel(message.senderDisplayName, message.sender)}</div>}
                          {message.replyToMessageId && (
                            <div className="message-reply-quote">
                              <strong>{userLabel(message.replyToDisplayName, message.replyToSender)}</strong>
                              <span>{message.replyToText || 'Tin nhắn đã thu hồi'}</span>
                            </div>
                          )}
                          {message.deleted ? (
                            <div className="bubble recalled-message">Tin nhắn đã được thu hồi</div>
                          ) : (
                            <>
                              {message.text && (
                                <div className={translatedText ? 'bubble translated-bubble translation-flip-bubble' : 'bubble'}>
                                  <span
                                    key={translatedText ? `${message.id}-${originalVisible ? 'original' : 'translated'}` : `${message.id}-plain`}
                                    className="translation-flip-content"
                                  >
                                    {translatedText
                                      ? originalVisible ? message.text : translatedText
                                      : message.text}
                                  </span>
                                </div>
                              )}
                              {translatedText && message.text && (
                                <button
                                  type="button"
                                  className={originalVisible ? 'translation-flip-pill original' : 'translation-flip-pill translated'}
                                  aria-label={originalVisible ? `Hiện bản dịch ${translatedLanguage}` : 'Hiện bản gốc'}
                                  onClick={() => setTranslationOriginals((current) => ({
                                    ...current,
                                    [message.id]: !current[message.id],
                                  }))}
                                >
                                  <span className="translation-flip-icon" aria-hidden="true">{originalVisible ? '↔' : '✦'}</span>
                                  <b>{originalVisible ? t('translation.original') : targetLanguage.split('-')[0].toUpperCase()}</b>
                                  <small>{originalVisible ? t('translation.originalText') : 'AI'}</small>
                                  <span className="translation-flip-swap" aria-hidden="true">↔</span>
                                </button>
                              )}
                              <MediaAttachmentsView items={message.attachments} />
                            </>
                          )}
                          <div className="message-stamp">
                            {formatTime(message.createdAt)}
                            {message.editedAt && !message.deleted ? ' · đã sửa' : ''}
                            {mine && (message.readByUserIds?.length || 0) > 0
                              ? activeConversation.type === 'group'
                                ? ` · ${message.readByUserIds?.length} đã xem`
                                : ' · Đã xem'
                              : ''}
                          </div>
                          {!message.deleted && (
                            <>
                              <div className="message-reactions">
                                {(message.reactions || []).map((reaction) => (
                                  <button
                                    key={reaction.emoji}
                                    type="button"
                                    disabled={reactionPreviews[message.id] !== undefined}
                                    aria-pressed={reaction.mine}
                                    className={reaction.mine ? 'reaction-chip active' : 'reaction-chip'}
                                    onClick={() => void toggleReaction(message, reaction.emoji)}
                                    aria-label={`Thả cảm xúc ${reaction.emoji}`}
                                  >
                                    {reaction.emoji} {reaction.count}
                                  </button>
                                ))}
                              </div>
                            </>
                          )}
                        </article>
                      )
                    })}
                    {outgoingMessage?.conversationId === activeConversationId && (
                      <article className="message mine outgoing-preview" aria-busy="true">
                        {outgoingMessage.replyToMessageId && (
                          <div className="message-reply-quote">
                            <strong>{userLabel(outgoingMessage.replyToDisplayName, outgoingMessage.replyToSender)}</strong><span>{outgoingMessage.replyToText}</span>
                          </div>
                        )}
                        {outgoingMessage.text && <div className="bubble">{outgoingMessage.text}</div>}
                        <MediaAttachmentsView items={outgoingMessage.attachments} />
                        <div className="message-stamp" role="status">Đang gửi...</div>
                      </article>
                    )}
                    <div ref={bottomRef} />
                  </div>

                  <form className="composer media-composer" onSubmit={sendMessage}>
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
                    </button>
                    <VoiceRecorder
                      key={`${session.sessionId}:${activeConversationId}`}
                      disabled={Boolean(mediaUploading) || messageSending}
                      onRecorded={(file) => { void addChatFiles([file]) }}
                      onError={(message) => setNotice(message, 'error')}
                    />
                    <input
                      ref={messageInputRef}
                      aria-label="Tin nhắn"
                      placeholder={mediaUploading === 'chat' ? 'Đang tải file lên...' : activeConversation.type === 'group' ? `Nhắn vào ${activeConversation.name}...` : `Nhắn ${activeConversation.name}...`}
                      value={messageText}
                      onChange={(event) => setMessageText(event.target.value)}
                      maxLength={4000}
                    />
                    <button className="send-button polished-send" disabled={!canSend} aria-label="Gửi tin nhắn">
                      {messageSending || mediaUploading === 'chat' ? <RefreshCw size={19} aria-label="Đang gửi" /> : <><span className="send-label">Gửi</span><UiIcon name="send" size={19} /></>}
                    </button>
                  </form>
                </>
              )}
            </section>
          </div>
        )}

        {tab === 'contacts' && (
            <ContactsView
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
              setTab={setTab}
              setNewChatMode={setNewChatMode}
              setChatCreateError={setChatCreateError}
              friendRequests={friendRequests}
              declineFriendRequest={declineFriendRequest}
              friends={friends}
              contactMetadata={contactMetadata}
              openDirectByUsername={openDirectByUsername}
              setFriendPreview={setFriendPreview}
              changePersonalContact={changePersonalContact}
              removeAcceptedFriend={removeAcceptedFriend}
              friendResults={friendResults}
            />
        )}

        {tab === 'discover' && (
          <Suspense
            fallback={(
              <p role="status">Đang mở Quanh đây...</p>
            )}
          >
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
                const relationship = friendRelationship(friend.id)
                return relationship === 'accepted'
                  ? 'Nhắn tin'
                  : relationship === 'incoming'
                    ? 'Chấp nhận'
                    : relationship === 'outgoing'
                      ? 'Hủy lời mời'
                      : 'Kết bạn'
              }}
            />
          </Suspense>
        )}

        {tab === 'feed' && (
          <div className="feed-view zalo-feed-view">
            <FeedModeration request={apiFetch} onRemoved={(type, id) => {
              if (type === 'post') {
                setPosts((current) => current.filter((post) => post.id !== id))
                setSavedPosts((current) => current.filter((post) => post.id !== id))
                if (activePostId === id) setActivePostId(null)
              } else if (type === 'comment') {
                void refreshPosts()
              } else {
                setStories((current) => current.filter((story) => story.id !== id))
                if (activeStoryId === id) setActiveStoryId(null)
              }
            }} />
            <input
              ref={storyFileInputRef}
              className="hidden-media-input"
              type="file"
              accept="image/*,video/*"
              aria-label="Chọn ảnh hoặc video cho Story"
              onChange={(event) => {
                const file = event.currentTarget.files?.[0]
                event.currentTarget.value = ''
                void createStory(file)
              }}
            />
            <div className="soco-feed-section-label"><strong>Khoảnh khắc</strong><small>Story trong 24 giờ</small></div>
            <div className="stories-row">
              <button
                type="button"
                className="story-card"
                disabled={storyBusy || mediaUploading === 'story'}
                onClick={() => storyFileInputRef.current?.click()}
                aria-label="Tạo Story mới"
              >
                <div className="story-visual self-story">
                  <span className="story-camera"><UiIcon name="plus" size={22} /></span>
                </div>
                <span>{storyBusy || mediaUploading === 'story' ? 'Đang tải...' : 'Tạo mới'}</span>
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
                    {story.attachment.kind === 'video' ? (
                      <video src={story.attachment.url} muted playsInline preload="metadata" />
                    ) : (
                      <img src={story.attachment.url} alt="" loading="lazy" />
                    )}
                    <UserAvatar className="story-avatar-mini" username={story.author} name={userLabel(story.authorDisplayName, story.author)} />
                  </div>
                  <span>{story.author === name ? 'Story của bạn' : userLabel(story.authorDisplayName, story.author)}</span>
                </button>
              ))}
            </div>

            {postComposer}

            <div className="soco-feed-section-label soco-feed-posts-label">
              <strong>{feedFilter === 'saved' ? 'Bài viết đã lưu' : 'Bài viết mới'}</strong>
              <div className="feed-filter-tabs" role="group" aria-label="Lọc bảng tin">
                <button type="button" aria-pressed={feedFilter === 'all'} onClick={() => setFeedFilter('all')}>Mới nhất</button>
                <button type="button" aria-pressed={feedFilter === 'saved'} onClick={() => { setFeedFilter('saved'); void loadSavedPosts() }}>Đã lưu</button>
              </div>
            </div>
            <div className="feed zalo-feed">
              {pendingPost && (
                <article className="post zalo-post outgoing-preview" aria-busy="true">
                  <UserAvatar username={pendingPost.author} name={userLabel(pendingPost.authorDisplayName, pendingPost.author)} className="avatar" />
                  <div className="post-body">
                    <div className="post-author"><strong>{userLabel(pendingPost.authorDisplayName, pendingPost.author)}</strong><small role="status">Đang đăng...</small></div>
                    <p className="pending-content">{pendingPost.content}</p>
                    <MediaAttachmentsView items={pendingPost.attachments} />
                  </div>
                </article>
              )}
              {renderPosts(searchedPosts)}
              {(feedFilter === 'saved' ? hasMoreSavedPosts : hasMorePosts) && (
                <button type="button" className="soco-load-more soco-feed-load-more"
                  onClick={() => void (feedFilter === 'saved' ? loadSavedPosts(true) : loadMorePosts())}
                  disabled={feedFilter === 'saved' ? savedPostsBusy : postsLoadingMore}>
                  <RefreshCw size={17} aria-hidden="true" />
                  {(feedFilter === 'saved' ? savedPostsBusy : postsLoadingMore) ? 'Đang tải...' : 'Tải thêm bài viết'}
                </button>
              )}
              {searchedPosts.length === 0 && (
                <div className="feed-empty">
                  <SocoEmptyState title={normalizedSearch ? 'Không tìm thấy bài viết' : 'Chưa có bài viết'}
                    description={normalizedSearch ? 'Thử một từ khóa khác nhé.' : 'Hãy chia sẻ khoảnh khắc đầu tiên của bạn.'}
                    action={!normalizedSearch && <SocoTextAction onClick={() => postComposerRef.current?.focus()}>Tạo bài viết</SocoTextAction>}
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {activeMessageAction && <MessageActions activeMessageAction={activeMessageAction} userId={session.user.id} setMessageActionId={setMessageActionId} toggleReaction={toggleReaction} setReplyingTo={setReplyingTo} copyMessage={copyMessage} translateMessage={translateMessage} editOwnMessage={editOwnMessage} recallOwnMessage={recallOwnMessage} />}

        {activePost && (
          <div
            className="post-detail-backdrop"
            role="dialog"
            aria-modal="true"
            aria-label={`Chi tiết bài viết của ${userLabel(activePost.authorDisplayName, activePost.author)}`}
            onMouseDown={(event) => {
              if (event.currentTarget === event.target) setActivePostId(null)
            }}
          >
            <section className="post-detail-modal">
              <header className="post-detail-header">
                <div>
                  <strong>Chi tiết bài viết</strong>
                  <small>@{activePost.author}</small>
                </div>
                <button type="button" aria-label="Đóng chi tiết bài viết" onClick={() => setActivePostId(null)}>×</button>
              </header>
              <div className="post-detail-scroll">
                <article className="post zalo-post post-detail-post">
                  <UserAvatar username={activePost.author} name={userLabel(activePost.authorDisplayName, activePost.author)} className="avatar" />
                  <div className="post-body">
                    <div className="post-author">
                      <div>
                        <strong>{userLabel(activePost.authorDisplayName, activePost.author)}</strong>
                        <small>{new Date(activePost.createdAt).toLocaleString('vi-VN')}</small>
                      </div>
                    </div>
                    {activePost.content && (
                      <FeedText
                        api={API}
                        token={session.token}
                        target={translationPreferencesLoaded ? targetLanguage : ''}
                        text={activePost.content}
                      />
                    )}
                    <MediaAttachmentsView items={activePost.attachments} />
                    <div className="post-toolbar">
                      <button type="button" className={activePost.liked ? 'liked' : ''} disabled={likePreviews[activePost.id] !== undefined}
                        aria-pressed={activePost.liked} aria-busy={likePreviews[activePost.id] !== undefined} onClick={() => void like(activePost)}>
                        <UiIcon name="heart" size={21} /><span>Thích</span>{activePost.likes > 0 && <b>{activePost.likes}</b>}
                      </button>
                      <span className="post-stat"><UiIcon name="comment" size={21} />{activePost.comments?.length || 0} bình luận</span>
                    </div>
                    <FeedDiscussion
                      key={activePost.id}
                      pending={pendingComments[activePost.id]}
                      comments={activePost.comments || []}
                      editor={commentEditors[activePost.id] || { replyTo: null, drafts: {} }}
                      updateEditor={(editor) => {
                        if (sessionRef.current?.sessionId === session.sessionId) {
                          setCommentEditors((current) => ({ ...current, [activePost.id]: editor }))
                        }
                      }}
                      api={API}
                      token={session.token}
                      target={translationPreferencesLoaded ? targetLanguage : ''}
                      submit={(content, parentId) => addComment(activePost, content, parentId)}
                      currentUser={name}
                      onEdit={(commentId, content) => manageFeedComment(activePost, commentId, 'PATCH', content)}
                      onDelete={(commentId) => manageFeedComment(activePost, commentId, 'DELETE')}
                      onReport={reportFeedComment}
                    />
                  </div>
                </article>
              </div>
            </section>
          </div>
        )}

        {activeStory && <StoryViewer activeStory={activeStory} name={name} storyBusy={storyBusy} deleteStory={deleteStory} setActiveStoryId={setActiveStoryId} nextStory={nextStory} previousStory={previousStory} activeStoryIndex={activeStoryIndex} />}

        {tab === 'profile' && (
          <div className={`simple-view profile-view ${profileTimelineOpen ? 'personal-timeline-view' : ''}`}>
            <input
              ref={avatarFileInputRef}
              className="hidden-media-input"
              type="file"
              accept="image/*"
              aria-label="Chọn ảnh đại diện"
              onChange={(event) => {
                const file = event.currentTarget.files?.[0]
                event.currentTarget.value = ''
                void updateProfileImage('avatar', file)
              }}
            />
            <input
              ref={coverFileInputRef}
              className="hidden-media-input"
              type="file"
              accept="image/*"
              aria-label="Chọn ảnh bìa"
              onChange={(event) => {
                const file = event.currentTarget.files?.[0]
                event.currentTarget.value = ''
                void updateProfileImage('cover', file)
              }}
            />

            {profileTimelineOpen && (
              <header className="personal-timeline-header">
                <button type="button" onClick={closeProfileTimeline} aria-label="Quay lại hồ sơ"><ArrowLeft size={20} /></button>
                <h1 ref={profileHeadingRef} tabIndex={-1}>Trang cá nhân</h1>
                <button type="button" onClick={() => setProfileEditorOpen(true)}><Settings size={18} /><span>Chỉnh sửa</span></button>
              </header>
            )}
            <section className="profile-hero">
              <div className={`profile-cover-art ${profileMedia?.coverSet ? 'has-cover' : ''}`}>
                <div className="profile-cover-placeholder">
                  <strong>SOCO</strong>
                  <small>Understand. Connect. Together.</small>
                </div>
                {profileMedia?.coverSet && (
                  <img
                    src={profileAssetUrl(name, 'cover', profileMedia.updatedAt)}
                    alt="Ảnh bìa"
                    draggable={false}
                    onError={(event) => {
                      event.currentTarget.hidden = true
                      event.currentTarget.parentElement?.classList.remove('has-cover')
                    }}
                  />
                )}
                <button
                  type="button"
                  className="profile-cover-edit"
                  disabled={profileBusy !== null || mediaUploading === 'profile'}
                  onClick={() => coverFileInputRef.current?.click()}
                >
                  <UiIcon name="photo" size={17} />
                  {profileBusy === 'cover' ? t('common.loading') : profileMedia?.coverSet ? t('profile.changeCover') : t('profile.addCover')}
                </button>
              </div>

              <div className="profile-identity" onClick={(event) => {
                if (!profileTimelineOpen && !(event.target as HTMLElement).closest('button')) {
                  setProfileTimelineOpen(true)
                  setGlobalSearch('')
                }
              }}>
                <div className="profile-avatar-editor">
                  <ProfileNote key={session.sessionId+':note'} username={name} owner request={apiFetch} />
                  <UserAvatar username={name} name={userLabel(profileMedia?.displayName || session.user.displayName, name)} className="profile-avatar" online />
                  <button
                    type="button"
                    className="profile-avatar-edit"
                    aria-label="Đổi ảnh đại diện"
                    title="Đổi ảnh đại diện"
                    disabled={profileBusy !== null || mediaUploading === 'profile'}
                    onClick={() => avatarFileInputRef.current?.click()}
                  >
                    <UiIcon name="photo" size={17} />
                  </button>
                </div>
                <button type="button" ref={profileIdentityRef} className="profile-identity-copy profile-identity-link"
                  aria-label="Mở trang cá nhân" disabled={profileTimelineOpen}
                  onClick={() => { setProfileTimelineOpen(true); setGlobalSearch('') }}>
                  <strong>{profileMedia?.displayName || session.user.displayName || name}</strong>
                  <span>@{name}</span>
                  <small className="profile-email">{session.user.email}</small>
                  {!profileTimelineOpen && <small className="profile-media-hint">Xem trang cá nhân · Dòng thời gian ›</small>}
                </button>
              </div>
            </section>

            {profileTimelineOpen ? (
              <section className="personal-timeline-content" aria-label="Dòng thời gian cá nhân">
                <div className="personal-timeline-intro">
                  <div><strong>Khoảnh khắc của bạn</strong><p>Lưu giữ và chia sẻ những câu chuyện mỗi ngày.</p></div>
                  <button type="button" onClick={() => setProfileComposerOpen(true)}><PencilLine size={18} />Đăng bài</button>
                </div>
                <div className="profile-post-launcher">
                  <UserAvatar username={name} name={userLabel(profileMedia?.displayName || session.user.displayName, name)} className="avatar self-avatar" />
                  <button type="button" onClick={() => setProfileComposerOpen(true)}>
                    {postText.trim() ? 'Tiếp tục bản nháp của bạn...' : 'Bạn đang nghĩ gì?'}
                  </button>
                  <button type="button" className="profile-post-photo" aria-label="Tạo bài viết có ảnh hoặc video"
                    onClick={() => setProfileComposerOpen(true)}><Images size={23} /></button>
                </div>
                <div className="personal-timeline-label">
                  <h2>Dòng thời gian</h2>
                  <button type="button" aria-label="Tải lại dòng thời gian" disabled={profilePostsBusy || !!pendingPost}
                    onClick={() => void loadProfilePosts(false, true)}><RefreshCw size={18} /></button>
                </div>
                {profilePostsError && <div className="personal-timeline-error" role="alert">
                  <p>{profilePostsError}</p>
                  <button type="button" disabled={profilePostsBusy} onClick={() => void loadProfilePosts(profilePosts.length > 0, true)}>Thử lại</button>
                </div>}
                {profilePostsBusy && <p role="status">Đang tải dòng thời gian...</p>}
                <div className="feed zalo-feed">
                  {pendingPost && <article className="post zalo-post outgoing-preview" aria-busy="true">
                    <UserAvatar username={name} name={userLabel(profileMedia?.displayName || session.user.displayName, name)} className="avatar" />
                    <div className="post-body"><strong>Đang đăng...</strong><p>{pendingPost.content}</p>
                      <MediaAttachmentsView items={pendingPost.attachments} /></div>
                  </article>}
                  {renderPosts(visibleProfilePosts)}
                </div>
                {!profilePostsBusy && !profilePostsError && profilePosts.length === 0 && !pendingPost && (
                  <SocoEmptyState title="Chưa có bài viết nào" description="Chia sẻ khoảnh khắc đầu tiên lên trang cá nhân của bạn."
                    action={<SocoTextAction onClick={() => setProfileComposerOpen(true)}>Đăng bài đầu tiên</SocoTextAction>} />
                )}
                {profileHasMore && <button type="button" className="soco-load-more soco-feed-load-more"
                  disabled={profilePostsBusy || !!pendingPost} onClick={() => void loadProfilePosts(true)}>
                  {profilePostsBusy ? 'Đang tải...' : 'Xem bài viết cũ hơn'}
                </button>}
              </section>
            ) : (<>
            {profileIdentityForm}

            <div className="soco-profile-section-label">TÙY CHỌN & CÀI ĐẶT</div>
            <section className="settings-card">
              {profilePrivacyControls}
            <AccountSessionsPanel
              sessionsBusy={sessionsBusy}
              refreshToken={session.refreshToken}
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
                  setLocaleSearch('')
                  setLocalePickerOpen(true)
                }}
              >
                <div>
                  <strong>{t('profile.appLanguage')}</strong>
                  <small>{t('profile.appLanguageHint')}</small>
                </div>
                <span className="settings-current-locale">
                  <b aria-hidden="true">{selectedAppLanguage?.flag || '🌐'}</b>
                  <span>
                    {appLocale === 'auto' ? t('common.auto') : selectedAppLanguage?.localizedLanguage}
                    {uiLocaleLoading ? ' · …' : ''}
                  </span>
                  <i aria-hidden="true">›</i>
                </span>
              </button>

              <div className="settings-row">
                <div><strong>{t('profile.notifications')}</strong><small>{t('profile.notificationsHint')}</small></div>
                <button
                  type="button"
                  className={`switch-button ${pushEnabled ? 'on' : ''}`}
                  onClick={() => void togglePush()}
                  disabled={pushBusy}
                  aria-label={pushEnabled ? 'Tắt thông báo' : 'Bật thông báo'}
                  role="switch"
                  aria-checked={pushEnabled}
                ><span /></button>
              </div>
              <div className="settings-row message-sound-row">
                <div><strong>{t('profile.messageSound')}</strong><small>{t('profile.messageSoundHint')}</small></div>
                <button
                  type="button"
                  className={`switch-button ${messageSoundEnabled ? 'on' : ''}`}
                  onClick={toggleMessageSound}
                  aria-label={messageSoundEnabled ? t('profile.soundOff') : t('profile.soundOn')}
                  role="switch"
                  aria-checked={messageSoundEnabled}
                ><span /></button>
              </div>
              {messageSoundEnabled && (
                <div className="settings-row message-sound-preview-row">
                  <div><strong>{t('profile.soundPreview')}</strong><small>{t('profile.soundPreviewHint')}</small></div>
                  <button type="button" className="settings-action message-sound-preview-button"
                    onClick={() => void previewMessageSound()} aria-label={t('profile.soundPreview')}>
                    <Volume2 size={17} aria-hidden="true" />
                    {t('profile.soundPreview')}
                  </button>
                </div>
              )}
              <div className="settings-row">
                <div><strong>{t('profile.testNotification')}</strong><small>{t('profile.testNotificationHint')}</small></div>
                <button type="button" className="settings-action" onClick={() => void sendTestPush()} disabled={pushBusy || !pushEnabled}>{t('common.test')}</button>
              </div>
              <div className="settings-row">
                <div><strong>{t('profile.autoTranslate')}</strong></div>
                <button
                  type="button"
                  className={`switch-button ${autoTranslate ? 'on' : ''}`}
                  onClick={() => changeAutoTranslate(!autoTranslate)}
                  aria-label={t('profile.autoTranslate')}
                  role="switch"
                  aria-checked={autoTranslate}
                ><span /></button>
              </div>
              <button
                type="button"
                className="settings-row settings-row-button translation-locale-row"
                onClick={() => {
                  setTranslationSettingsSearch('')
                  setTranslationPickerOpen(true)
                }}
              >
                <div>
                  <strong>{t('profile.translationLanguage')}</strong>
                  <small>{t('profile.translationLanguageHint')}</small>
                </div>
                <span className="settings-current-locale">
                  <b aria-hidden="true">{selectedLanguage?.flag || '🌐'}</b>
                  <span>{selectedLanguage?.localizedLanguage || targetLanguage.toUpperCase()}</span>
                  <i aria-hidden="true">›</i>
                </span>
              </button>
              {!isStandalone && (
                <button type="button" className="settings-row settings-row-button settings-install-row" onClick={() => void installApp()}>
                  <span className="settings-account-label"><Download size={19} aria-hidden="true" />{t('profile.install')}</span>
                  <span className="settings-account-chevron" aria-hidden="true">›</span>
                </button>
              )}
              <button type="button" className="settings-row settings-row-button settings-logout-row" onClick={() => logout()}>
                <span className="settings-account-label"><LogOut size={19} aria-hidden="true" />{t('profile.logout')}</span>
                <span className="settings-account-chevron" aria-hidden="true">›</span>
              </button>
            </section>

            </>)}

            {translationPickerOpen && (
              <div className="locale-picker-overlay" role="dialog" aria-modal="true" aria-label={t('profile.translationLanguage')}>
                <button
                  type="button"
                  className="locale-picker-backdrop"
                  aria-label={t('common.close')}
                  onClick={() => setTranslationPickerOpen(false)}
                />
                <section className="locale-picker-sheet">
                  <header>
                    <div>
                      <strong>{t('profile.translationLanguage')}</strong>
                      <small>{t('translation.subtitle')}</small>
                    </div>
                    <button type="button" aria-label={t('common.close')} onClick={() => setTranslationPickerOpen(false)}>×</button>
                  </header>

                  <label className="locale-picker-search">
                    <span aria-hidden="true">⌕</span>
                    <input
                      type="search"
                      value={translationSettingsSearch}
                      onChange={(event) => setTranslationSettingsSearch(event.target.value)}
                      placeholder={t('translation.searchPlaceholder')}
                      autoComplete="off"
                      autoCapitalize="none"
                      spellCheck={false}
                    />
                    {translationSettingsSearch && (
                      <button
                        type="button"
                        aria-label="Xóa tìm kiếm"
                        onClick={() => setTranslationSettingsSearch('')}
                      >×</button>
                    )}
                  </label>

                  <div className="locale-picker-list">
                    {visibleTranslationSettingsOptions.map((language) => (
                      <button
                        key={language.value}
                        type="button"
                        className={`locale-option ${targetLanguage === language.value ? 'active' : ''}`}
                        onClick={() => changeTargetLanguage(language.value)}
                      >
                        <span className="locale-option-flag" aria-hidden="true">{language.flag}</span>
                        <span className="locale-option-copy">
                          <strong>{language.localizedLanguage}</strong>
                          <small>{language.nativeLanguage}</small>
                          <em>{language.localizedRegion} · {language.nativeRegion}</em>
                        </span>
                        <b>{language.code}</b>
                        {targetLanguage === language.value && <i aria-hidden="true">✓</i>}
                      </button>
                    ))}
                    {visibleTranslationSettingsOptions.length === 0 && (
                      <div className="locale-picker-empty">{t('translation.noResults')}</div>
                    )}
                  </div>

                  <footer>{t('translation.languageHint')}</footer>
                </section>
              </div>
            )}

            {localePickerOpen && (
              <div className="locale-picker-overlay" role="dialog" aria-modal="true" aria-label={t('locale.title')}>
                <button
                  type="button"
                  className="locale-picker-backdrop"
                  aria-label={t('common.close')}
                  onClick={() => setLocalePickerOpen(false)}
                />
                <section className="locale-picker-sheet">
                  <header>
                    <div>
                      <strong>{t('locale.title')}</strong>
                      <small>{t('locale.subtitle')}</small>
                    </div>
                    <button type="button" aria-label={t('common.close')} onClick={() => setLocalePickerOpen(false)}>×</button>
                  </header>

                  <label className="locale-picker-search">
                    <span aria-hidden="true">⌕</span>
                    <input
                      type="search"
                      value={localeSearch}
                      onChange={(event) => setLocaleSearch(event.target.value)}
                      placeholder={t('locale.searchPlaceholder')}
                      autoComplete="off"
                      autoCapitalize="none"
                      spellCheck={false}
                    />
                    {localeSearch && (
                      <button type="button" aria-label="Xóa tìm kiếm" onClick={() => setLocaleSearch('')}>×</button>
                    )}
                  </label>

                  {!localeSearch && (
                    <button
                      type="button"
                      className={`locale-option locale-auto-option ${appLocale === 'auto' ? 'active' : ''}`}
                      onClick={() => void changeAppLocale('auto')}
                    >
                      <span className="locale-option-flag" aria-hidden="true">⚙️</span>
                      <span className="locale-option-copy">
                        <strong>{t('locale.device')}</strong>
                        <small>{t('locale.deviceHint')}</small>
                        <em>{selectedAppLanguage?.flag} {selectedAppLanguage?.localizedLanguage}</em>
                      </span>
                      {appLocale === 'auto' && <i aria-hidden="true">✓</i>}
                    </button>
                  )}

                  <div className="locale-picker-list">
                    {visibleLocaleOptions.map((language) => (
                      <button
                        key={language.value}
                        type="button"
                        className={`locale-option ${appLocale === language.value ? 'active' : ''}`}
                        onClick={() => void changeAppLocale(language.value)}
                      >
                        <span className="locale-option-flag" aria-hidden="true">{language.flag}</span>
                        <span className="locale-option-copy">
                          <strong>{language.localizedLanguage}</strong>
                          <small>{language.nativeLanguage}</small>
                          <em>{language.localizedRegion} · {language.nativeRegion}</em>
                        </span>
                        <b>{language.code}</b>
                        {appLocale === language.value && <i aria-hidden="true">✓</i>}
                      </button>
                    ))}
                    {visibleLocaleOptions.length === 0 && (
                      <div className="locale-picker-empty">{t('locale.noResults')}</div>
                    )}
                  </div>

                  <footer>{t('locale.dynamicHint')}</footer>
                </section>
              </div>
            )}

          </div>
        )}
      </section>

      {profileComposerOpen && tab === 'profile' && profileTimelineOpen && (
        <ProfileOverlay title="Tạo bài viết" busy={!!pendingPost || mediaUploading === 'feed'} onClose={() => setProfileComposerOpen(false)}>
          {postComposer}
        </ProfileOverlay>
      )}
      {profileEditorOpen && tab === 'profile' && profileTimelineOpen && (
        <ProfileOverlay title="Chỉnh sửa hồ sơ" drawer busy={profileSaving || privacyBusy} onClose={() => setProfileEditorOpen(false)}>
          {profileIdentityForm}
          <section className="settings-card profile-field-permissions" aria-label="Quyền trường thông tin">
            <h3>Quyền trường thông tin</h3>
            {profilePrivacyControls}
          </section>
        </ProfileOverlay>
      )}

      <CallManager
        request={apiFetch}
        apiBase={API}
        token={session.token}
        userId={session.user.id}
        sourceLanguage={effectiveAppLocale}
        targetLanguage={targetLanguage}
        conversations={displayConversations.map(({ id, name, type }) => ({ id, name, type }))}
      />

      <BottomNavigation
        tab={tab}
        t={t}
        switchTab={switchTab}
        unreadTotal={unreadTotal}
        pushEnabled={pushEnabled}
      />
    </main>
  )
}