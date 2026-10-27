import { FormEvent, lazy, Suspense, type SetStateAction, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { FeedDiscussion, FeedText, type FeedComment, type DiscussionDraft } from './FeedDiscussion'
import FeedPostActions, { FeedShareAction } from './FeedPostActions'
import FeedModeration from './FeedModeration'
import type { NearbyUser } from './NearbyExplorer'
import GroupCreator from './GroupCreator'
import { Bell, Check, Images, LogOut, MessageCircle, MoreHorizontal, RefreshCw, Search, UserCheck, UserPlus, Users, Volume2, X, Download } from 'lucide-react'
import { IncomingMessageSound, MESSAGE_SOUND_SETTING_KEY, persistMessageSoundEnabled, readMessageSoundEnabled } from './incomingSound'
import { createSessionClient, loadSession, parseSession, type Session } from './session'
import { clearChatPersistence, clearPendingSend, loadChatDrafts, loadPendingSend, saveChatDrafts, savePendingSend } from './chatPersistence'
import { uploadPresignedFile } from './mediaUpload'
import { canMarkConversationRead } from './conversationRead'
import { mergeById, toggleCount } from './optimistic'
import CallManager, { CallHeaderActions } from './CallManager'
import GroupActionsSheet from './GroupActionsSheet'
import SharedContent from './SharedContent'
import VoiceRecorder from './VoiceRecorder'
import { SocoEmptyState, SocoTextAction } from './SocoUI'
import { getCurrentPositionSmart, geolocationErrorMessage } from './geolocation'

const NearbyExplorer = lazy(() => import('./NearbyExplorer'))
const ProfileQr = lazy(() => import('./ProfileQr'))
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
} from './i18n'
import { buildLanguageOptions, filterLanguageOptions, isSupportedLanguageCode } from './languages'
import {
  disableOneSignalPush,
  enableOneSignalPush,
  getOneSignalPushState,
  isPushDisabled,
  setupOneSignal,
  type PushState,
} from './onesignal'

const API =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV ? 'http://localhost:8080' : 'https://api-chat.codelocal.cloud')

type User = {
  id: number
  email: string
  username: string
  displayName: string
}

type ProfileMediaState = {
  username: string
  displayName: string
  avatarSet: boolean
  coverSet: boolean
  updatedAt: string
}

type ProfileUpdateResponse = ProfileMediaState & {
  token: string
}

type MediaAttachment = {
  id?: number
  storageRef: string
  name: string
  sizeBytes: number
  contentType: string
  kind: 'image' | 'video' | 'audio' | 'file'
  url?: string
}

/** Only trusted upload input fields are accepted by strict Go JSON decoders.
 * Public signed URLs and response IDs must never be sent back in API requests. */
const attachmentRequestBody = ({ storageRef, name, sizeBytes, contentType, kind }: MediaAttachment) =>
  ({ storageRef, name, sizeBytes, contentType, kind })

type PresignedUpload = {
  uploadUrl: string
  storageRef: string
  key: string
  expiresAt: string
  kind: MediaAttachment['kind']
  downloadUrl: string
}

type MessageReaction = {
  emoji: string
  count: number
  mine: boolean
}

type Message = {
  id: number
  clientId?: string
  conversationId: number
  senderId: number
  sender: string
  text: string
  replyToMessageId?: number
  replyToSender?: string
  replyToText?: string
  editedAt?: string
  deleted?: boolean
  reactions?: MessageReaction[]
  readByUserIds?: number[]
  translatedText?: string
  translationLanguage?: string
  attachments?: MediaAttachment[]
  createdAt: string
}

type MessageDraft = { text: string; attachments: MediaAttachment[] }
const emptyDraft: MessageDraft = { text: '', attachments: [] }
const FEED_PAGE_SIZE = 15
const CHAT_LIST_PAGE_SIZE = 25
const MESSAGE_PAGE_SIZE = 40

type Conversation = {
  id: number
  type: 'direct' | 'group'
  name: string
  otherUserId?: number
  memberCount: number
  unreadCount: number
  lastMessage: string
  lastMessageAt?: string
  online: boolean
  createdAt: string
}

type RealtimeEvent = {
  type: 'message' | 'message.updated' | 'conversation.created' | 'conversation.updated' | 'conversation.removed' | 'conversation.read' | 'friend.updated'
  conversationId: number
  message?: Message
  conversation?: Conversation
  readerId?: number
  lastReadMessageId?: number
}

type Post = {
  id: number
  author: string
  content: string
  likes: number
  liked: boolean
  comments: FeedComment[]
  attachments?: MediaAttachment[]
  visibility?: 'public' | 'friends' | 'private'
  background?: string
  updatedAt?: string
  saved?: boolean
  createdAt: string
}

type Story = {
  id: number
  author: string
  attachment: MediaAttachment
  createdAt: string
  expiresAt: string
}

type Tab = 'chat' | 'contacts' | 'discover' | 'feed' | 'profile'
type AuthMode = 'login' | 'register'
type RegisterStep = 'details' | 'otp'
type NewChatMode = 'none' | 'friends' | 'direct' | 'group'

type FriendSearchResult = {
  id: number
  username: string
  displayName: string
  online: boolean
  distanceKm?: number
  nearbyActive?: boolean
  locationUpdatedAt?: string
  mutualGroups?: number
  reason?: string
}

type ManagedAccountSession = {
  id: string
  userAgent: string
  createdAt: string
  lastSeenAt: string
  expiresAt: string
  current: boolean
}

type UserPrivacy = {
  searchableByUsername: boolean
  searchableByName: boolean
  searchableByEmail: boolean
  allowFriendRequests: boolean
  showOnlineStatus: boolean
}

type FriendConnection = FriendSearchResult & {
  status: 'accepted' | 'pending'
  direction?: 'incoming' | 'outgoing'
  updatedAt: string
}

type GroupMember = {
  id: number
  username: string
  displayName: string
  role: 'owner' | 'admin' | 'member'
  online: boolean
}

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

type ToastKind = 'success' | 'error' | 'warning' | 'info'
type ToastNotice = { id: number; message: string; kind: ToastKind }


function inferToastKind(message: string): ToastKind {
  const normalized = message.trim().toLocaleLowerCase('vi-VN')
  if (
    normalized.startsWith('đã ') ||
    normalized.startsWith('bạn đã ') ||
    normalized.startsWith('chatnet đã ')
  ) return 'success'
  if (
    normalized.includes('không ') ||
    normalized.includes('thất bại') ||
    normalized.includes('bị chặn') ||
    normalized.startsWith('chưa xác nhận') ||
    normalized.startsWith('mất kết nối')
  ) return 'error'
  if (
    normalized.startsWith('mỗi ') ||
    normalized.startsWith('hãy ') ||
    normalized.startsWith('trên iphone') ||
    normalized.includes('chưa hỗ trợ')
  ) return 'warning'
  return 'info'
}

function formatTime(value?: string) {
  if (!value) return ''
  return new Date(value).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
}

function formatBytes(value: number) {
  if (!Number.isFinite(value) || value <= 0) return ''
  if (value < 1024 * 1024) return `${Math.max(1, Math.round(value / 1024))} KB`
  return `${(value / 1024 / 1024).toFixed(value >= 10 * 1024 * 1024 ? 0 : 1)} MB`
}

function attachmentLabel(items?: MediaAttachment[]) {
  const first = items?.[0]
  if (!first) return ''
  if (first.kind === 'image') return '[Ảnh]'
  if (first.kind === 'video') return '[Video]'
  if (first.kind === 'audio') return '[Âm thanh]'
  return '[Tệp]'
}

function avatarInitials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '?'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase()
}

function avatarTone(name: string) {
  let hash = 0
  for (let index = 0; index < name.length; index += 1) {
    hash = (hash * 31 + name.charCodeAt(index)) >>> 0
  }
  return hash % 8
}

const avatarRefreshVersions = new Map<string, string>()

function profileAssetUrl(name: string, kind: 'avatar' | 'cover', version?: string) {
  const base = `${API}/api/users/${encodeURIComponent(name)}/${kind}`
  return version ? `${base}?v=${encodeURIComponent(version)}` : base
}

function UserAvatar({
  name,
  className = 'avatar',
  online = false,
  group = false,
}: {
  name: string
  className?: string
  online?: boolean
  group?: boolean
}) {
  const version = avatarRefreshVersions.get(name)
  const imageUrl = group ? '' : profileAssetUrl(name, 'avatar', version)
  const [imageFailed, setImageFailed] = useState(false)

  useEffect(() => {
    setImageFailed(false)
  }, [imageUrl])

  return (
    <div
      className={`${className} smart-avatar avatar-tone-${avatarTone(name)} ${group ? 'group' : ''}`}
      aria-label={name}
      title={name}
    >
      <span className="avatar-initials">{group ? '👥' : avatarInitials(name)}</span>
      {!group && !imageFailed && (
        <img
          className="avatar-photo"
          src={imageUrl}
          alt=""
          draggable={false}
          onError={() => setImageFailed(true)}
        />
      )}
      <span className="avatar-shine" aria-hidden="true" />
      {online && <span className="presence-dot" />}
    </div>
  )
}

function MediaAttachmentsView({
  items,
  pending = false,
  onRemove,
}: {
  items?: MediaAttachment[]
  pending?: boolean
  onRemove?: (index: number) => void
}) {
  if (!items?.length) return null

  return (
    <div className={`media-attachments ${pending ? 'pending-media' : ''} ${items.length > 1 ? 'media-grid' : ''} media-count-${Math.min(items.length, 4)}`}>
      {items.map((item, index) => (
        <div className={`media-item media-${item.kind}`} key={`${item.storageRef}:${index}`}>
          {item.kind === 'image' && item.url ? (
            <a href={item.url} target="_blank" rel="noreferrer">
              <img
                src={item.url}
                alt={item.name}
                loading="lazy"
                onLoad={(event) => {
                  const image = event.currentTarget
                  image.classList.toggle(
                    'media-extra-tall',
                    image.naturalWidth > 0 && image.naturalHeight / image.naturalWidth >= 1.8,
                  )
                }}
              />
            </a>
          ) : item.kind === 'video' && item.url ? (
            <video src={item.url} controls playsInline preload="metadata" />
          ) : item.kind === 'audio' && item.url ? (
            <div className="media-file-card">
              <span>🎙️</span>
              <div><strong>{item.name}</strong><small>{formatBytes(item.sizeBytes)}</small></div>
              <audio src={item.url} controls preload="none" />
            </div>
          ) : (
            <a className="media-file-card" href={item.url || '#'} target="_blank" rel="noreferrer">
              <span>📎</span>
              <div><strong>{item.name}</strong><small>{formatBytes(item.sizeBytes)}</small></div>
            </a>
          )}
          {pending && onRemove && (
            <button type="button" className="media-remove" onClick={() => onRemove(index)} aria-label={`Bỏ ${item.name}`}>×</button>
          )}
        </div>
      ))}
    </div>
  )
}

function UiIcon({ name, size = 24 }: { name: string; size?: number }) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.9,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  }

  switch (name) {
    case 'search':
      return <svg {...common}><circle cx="11" cy="11" r="7" /><path d="m20 20-4.2-4.2" /></svg>
    case 'qr':
      return <svg {...common}><path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" /><path d="M8 8h3v3H8zM14 8h2M14 11h3M8 14h2M12 14h4v4M8 17h1M18 12h2" /></svg>
    case 'plus':
      return <svg {...common}><path d="M12 5v14M5 12h14" /></svg>
    case 'compose':
      return <svg {...common}><path d="M4 20h4l11-11a2.8 2.8 0 0 0-4-4L4 16v4Z" /><path d="m13.5 6.5 4 4" /></svg>
    case 'bell':
      return <svg {...common}><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></svg>
    case 'chat':
      return <svg {...common}><path d="M4 5h16v11H9l-5 4V5Z" /><path d="M8 9h8M8 12h5" /></svg>
    case 'contacts':
      return <svg {...common}><rect x="4" y="3" width="16" height="18" rx="2" /><circle cx="12" cy="9" r="2.5" /><path d="M8 17c.7-2.4 2-3.5 4-3.5s3.3 1.1 4 3.5" /></svg>
    case 'discover':
      return <svg {...common}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><path d="m12 12 7-7" /><circle cx="12" cy="12" r="1" /></svg>
    case 'wall':
      return <svg {...common}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M7 9h6M7 13h10M17 9h.01" /></svg>
    case 'profile':
      return <svg {...common}><circle cx="12" cy="8" r="4" /><path d="M4.5 21c.8-4.5 3.3-6.5 7.5-6.5s6.7 2 7.5 6.5" /></svg>
    case 'attach':
      return <svg {...common}><path d="m9.5 12.5 5.8-5.8a3.2 3.2 0 0 1 4.5 4.5l-8.4 8.4a5 5 0 0 1-7.1-7.1l8-8" /></svg>
    case 'send':
      return <svg {...common}><path d="m4 4 17 8-17 8 3-8-3-8Z" /><path d="M7 12h14" /></svg>
    case 'photo':
      return <svg {...common}><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="9" r="2" /><path d="m5 18 5-5 3 3 2-2 4 4" /></svg>
    case 'video':
      return <svg {...common}><rect x="3" y="6" width="13" height="12" rx="2" /><path d="m16 10 5-3v10l-5-3" /></svg>
    case 'album':
      return <svg {...common}><rect x="5" y="4" width="14" height="16" rx="2" /><path d="M9 4V2h8a2 2 0 0 1 2 2M8 15l3-3 4 4 2-2" /></svg>
    case 'text':
      return <svg {...common}><path d="M5 6h14M12 6v12M8 18h8" /></svg>
    case 'heart':
      return <svg {...common}><path d="M20.8 8.8c0 5-8.8 10-8.8 10s-8.8-5-8.8-10A4.8 4.8 0 0 1 12 6a4.8 4.8 0 0 1 8.8 2.8Z" /></svg>
    case 'comment':
      return <svg {...common}><path d="M4 5h16v11H9l-5 4V5Z" /><path d="M8 9h8M8 12h5" /></svg>
    case 'trash':
      return <svg {...common}><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5" /></svg>
    default:
      return <span aria-hidden="true">•</span>
  }
}

function formatEstimatedDistance(distanceKm?: number) {
  if (typeof distanceKm !== 'number' || !Number.isFinite(distanceKm)) return 'Trong phạm vi 5 km'
  return `Khoảng ${distanceKm.toLocaleString('vi-VN', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} km`
}

function NearbyRadar({ scanning = false, large = false }: { scanning?: boolean; large?: boolean }) {
  return (
    <div className={`nearby-radar ${scanning ? 'is-scanning' : ''} ${large ? 'is-large' : ''}`} aria-hidden="true">
      <span className="nearby-radar-ring ring-one" />
      <span className="nearby-radar-ring ring-two" />
      <span className="nearby-radar-axis axis-x" />
      <span className="nearby-radar-axis axis-y" />
      <span className="nearby-radar-sweep" />
      <span className="nearby-radar-blip blip-one" />
      <span className="nearby-radar-blip blip-two" />
      <span className="nearby-radar-blip blip-three" />
      <span className="nearby-radar-center" />
    </div>
  )
}

export default function App() {
  const [session, setSession] = useState<Session | null>(loadSession)
  const sessionRef = useRef(session)
  const [sessionClient] = useState(() => createSessionClient(API, {
    get: () => sessionRef.current,
    save: saveSession,
    expire: () => logout(false),
  }))
  const [authMode, setAuthMode] = useState<AuthMode>('register')
  const [registerStep, setRegisterStep] = useState<RegisterStep>('details')
  const [authEmail, setAuthEmail] = useState('')
  const [verificationToken, setVerificationToken] = useState('')
  const [verificationEmail, setVerificationEmail] = useState('')
  const [otpCode, setOtpCode] = useState('')
  const [otpExpiresAt, setOtpExpiresAt] = useState(0)
  const [otpSecondsLeft, setOtpSecondsLeft] = useState(0)
  const [authError, setAuthError] = useState('')
  const [authLoading, setAuthLoading] = useState(false)

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
  const [conversations, setConversations] = useState<Conversation[]>([])
  const revokedConversationIds = useRef(new Set<number>())
  const membershipSnapshot = useRef<Set<number> | null>(null)
  const membershipSyncSequence = useRef(0)
  const membershipEventSequence = useRef(0)
  const [hasMoreConversations, setHasMoreConversations] = useState(false)
  const [conversationLoadingMore, setConversationLoadingMore] = useState(false)
  const conversationPagingBusy = useRef(false)
  const conversationOffset = useRef(0)
  const [activeConversationId, setActiveConversationId] = useState<number | null>(null)
  const activeConversationIdRef = useRef<number | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [hasMoreMessages, setHasMoreMessages] = useState(false)
  const [messagesLoadingMore, setMessagesLoadingMore] = useState(false)
  const messagesPagingBusy = useRef(false)
  const pendingMessageScrollRestore = useRef<{ height: number; top: number } | null>(null)
  const messagesScrollRef = useRef<HTMLDivElement>(null)
  const messageScrollAtBottom = useRef(true)
  const [replyingTo, setReplyingTo] = useState<Message | null>(null)
  const [messageActionId, setMessageActionId] = useState<number | null>(null)
  const messageLongPressTimer = useRef<number | null>(null)
  const messageLongPressStart = useRef<{ x: number; y: number; messageId: number } | null>(null)
  const [groupSettingsOpen, setGroupSettingsOpen] = useState(false)
  const [groupActionsOpen, setGroupActionsOpen] = useState(false)
  useEffect(() => setGroupActionsOpen(false), [activeConversationId, tab])
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([])
  const [groupNameDraft, setGroupNameDraft] = useState('')
  const [groupInviteDraft, setGroupInviteDraft] = useState('')
  const [groupInviteSearch, setGroupInviteSearch] = useState('')
  const [groupInviteSelection, setGroupInviteSelection] = useState<number[]>([])
  const [sharedContentOpen, setSharedContentOpen] = useState(false)
  const [groupBusy, setGroupBusy] = useState(false)
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
  const feedRevision = useRef(0)
  const feedLoads = useRef(0)
  const [pendingActions, setPendingActions] = useState(0)
  const pendingRequests = useRef(new Set<symbol>())
  const mutationRequests = useRef(new Map<string, Promise<Response>>())
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
  const [friends, setFriends] = useState<FriendConnection[]>([])
  const [friendRequests, setFriendRequests] = useState<FriendConnection[]>([])
  const [friendActionBusy, setFriendActionBusy] = useState<number | null>(null)
  const friendActionRef = useRef(new Set<number>())
  const [friendBusyIds, setFriendBusyIds] = useState<Set<number>>(() => new Set())
  const [friendMenuId, setFriendMenuId] = useState<number | null>(null)
  const [friendPreview, setFriendPreview] = useState<FriendSearchResult | null>(null)
  const [blockedUsers, setBlockedUsers] = useState<Array<{ id: number; username: string; displayName: string }>>([])
  const [blockedOpen, setBlockedOpen] = useState(false)
  const [blockedBusy, setBlockedBusy] = useState(false)
  const [blockedError, setBlockedError] = useState('')
  const [contactMetadata, setContactMetadata] = useState<Record<number, { nickname: string; note: string; favorite: boolean }>>({})
  const friendSyncRequest = useRef(0)
  const [friendSyncSessionId, setFriendSyncSessionId] = useState('')
  const [friendSyncError, setFriendSyncError] = useState('')
  const [friendSyncBusy, setFriendSyncBusy] = useState(false)
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

  const [posts, setPosts] = useState<Post[]>([])
  const [savedPosts, setSavedPosts] = useState<Post[]>([])
  const [feedFilter, setFeedFilter] = useState<'all' | 'saved'>('all')
  const [hasMoreSavedPosts, setHasMoreSavedPosts] = useState(false)
  const [savedPostsBusy, setSavedPostsBusy] = useState(false)
  const savedPagingBusy = useRef(false)
  const [hasMorePosts, setHasMorePosts] = useState(false)
  const [postsLoadingMore, setPostsLoadingMore] = useState(false)
  const postsPagingBusy = useRef(false)
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
  const [stories, setStories] = useState<Story[]>([])
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

  const name = session?.user.username || ''
  const activeConversation = conversations.find((item) => item.id === activeConversationId) || null
  const chatFriend = activeConversation?.type === 'direct' && activeConversation.otherUserId
    && activeConversation.otherUserId !== session?.user.id
    ? { id: activeConversation.otherUserId, username: '', displayName: activeConversation.name, online: activeConversation.online }
    : null
  const chatFriendRelationship = chatFriend ? friendRelationship(chatFriend.id) : 'none'
  const activeGroupMember = groupMembers.find((item) => item.id === session?.user.id) || null
  const canManageActiveGroup = activeGroupMember?.role === 'owner' || activeGroupMember?.role === 'admin'
  const groupInviteCandidates = useMemo(() => {
    const memberIds = new Set(groupMembers.map((member) => member.id))
    const normalized = groupInviteSearch.trim().replace(/^@/, '').toLocaleLowerCase('vi-VN')
    return friends
      .filter((friend) => friend.status === 'accepted' && !memberIds.has(friend.id))
      .filter((friend) => !normalized || `${friend.displayName} ${friend.username}`.toLocaleLowerCase('vi-VN').includes(normalized))
      .sort((a, b) => (a.displayName || a.username).localeCompare(b.displayName || b.username, 'vi'))
  }, [friends, groupMembers, groupInviteSearch])
  const visiblePosts = posts.map((post) => likePreviews[post.id] === undefined ? post : {
    ...post, liked: likePreviews[post.id],
    likes: Math.max(0, post.likes + (likePreviews[post.id] === post.liked ? 0 : likePreviews[post.id] ? 1 : -1)),
  })
  const visibleMessages = messages.map((message) => reactionPreviews[message.id] ? {
    ...message, reactions: message.deleted ? [] : reactionPreviews[message.id],
  } : message)
  const activePost = activePostId ? [...visiblePosts, ...savedPosts].find((item) => item.id === activePostId) || null : null
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
    if (target instanceof Element && target.closest('button,a,input,textarea,select,video,audio,.message-selectable-text')) return
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
      openConnectSurface(requestedUser)
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

  async function apiFetch(path: string, init: RequestInit = {}) {
    const sessionId = session?.sessionId
    const write = !!init.method && !['GET', 'HEAD'].includes(init.method)
    const key = JSON.stringify([sessionId, path, init.method, init.body])
    const existing = write && mutationRequests.current.get(key)
    if (existing) return (await existing).clone()
    const operation = performRequest()
    if (write) mutationRequests.current.set(key, operation)
    try { return (await operation).clone() }
    finally { if (mutationRequests.current.get(key) === operation) mutationRequests.current.delete(key) }

    async function performRequest() {
      const mutation = write && !/\/(read|translate|presign|subscription|bundle)$/.test(path)
      const request = Symbol(path)
      if (mutation) {
        pendingRequests.current.add(request)
        setPendingActions(pendingRequests.current.size)
      }
      try {
        const response = await sessionClient.request(path, {
          ...init, signal: init.signal || AbortSignal.timeout(30_000),
        }, sessionId)
        // Consume the body before releasing pending state or accepting a stale session.
        await response.clone().text()
        if (sessionRef.current?.sessionId !== sessionId) throw new Error('Phiên đăng nhập đã thay đổi.')
        return response
      } catch (error) {
        if (!write) throw error
        const message = error instanceof Error && error.message === 'Phiên đăng nhập đã thay đổi.'
          ? error.message
          : 'Chưa xác nhận được kết quả. Kiểm tra dữ liệu trước khi thử lại.'
        return Response.json({ error: message }, { status: 503 })
      } finally {
        pendingRequests.current.delete(request)
        if (sessionRef.current?.sessionId === sessionId) setPendingActions(pendingRequests.current.size)
      }
    }
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

  async function refreshFriendConnections() {
    const sessionId = session?.sessionId
    if (!sessionId) return
    const request = ++friendSyncRequest.current
    setFriendSyncBusy(true)
    try {
      const [friendsResponse, requestsResponse, metadataResponse] = await Promise.all([
        apiFetch('/api/friends'),
        apiFetch('/api/friends/requests'),
        apiFetch('/api/contacts'),
      ])
      if (!friendsResponse.ok || !requestsResponse.ok) throw new Error('Friend sync failed')
      const [nextFriends, nextRequests] = await Promise.all([
        friendsResponse.json() as Promise<FriendConnection[]>,
        requestsResponse.json() as Promise<FriendConnection[]>,
      ])
      if (sessionRef.current?.sessionId !== sessionId || request !== friendSyncRequest.current) return
      setFriends(nextFriends)
      setFriendRequests(nextRequests)
      if (metadataResponse.ok) {
        const records = await metadataResponse.json() as Array<{ id: number; nickname: string; note: string; favorite: boolean }>
        if (sessionRef.current?.sessionId !== sessionId || request !== friendSyncRequest.current) return
        setContactMetadata(Object.fromEntries(records.map((item) => [item.id, {
          nickname: item.nickname, note: item.note, favorite: item.favorite,
        }])))
      }
      setFriendSyncSessionId(sessionId)
      setFriendSyncError('')
    } catch {
      if (sessionRef.current?.sessionId === sessionId && request === friendSyncRequest.current) {
        setFriendSyncError('Chưa tải được trạng thái kết bạn.')
      }
    } finally {
      if (sessionRef.current?.sessionId === sessionId && request === friendSyncRequest.current) setFriendSyncBusy(false)
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
      }
      await refreshFriendConnections()
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

  async function reconcileConversationMemberships() {
    const sessionId = session?.sessionId
    if (!sessionId) return
    const sequence = ++membershipSyncSequence.current
    const membershipEventAtStart = membershipEventSequence.current
    const authorized = new Set<number>()
    let after = 0
    try {
      // Fetch only IDs, not full message metadata. Never prune on partial
      // snapshots: a failed page is not proof of lost group membership.
      for (let page = 0; page < 200; page += 1) {
        const response = await apiFetch(`/api/conversations/memberships?limit=500&after=${after}`)
        if (!response.ok) return
        const data = (await response.json()) as { ids: number[]; nextAfter: number | null }
        if (!Array.isArray(data.ids) || data.ids.length > 500 ||
          data.ids.some((id) => !Number.isSafeInteger(id) || id <= after)) return
        for (const id of data.ids) authorized.add(id)
        if (data.nextAfter === null) {
          if (sessionRef.current?.sessionId !== sessionId ||
              sequence !== membershipSyncSequence.current ||
              membershipEventAtStart !== membershipEventSequence.current) return
          membershipSnapshot.current = authorized
          for (const id of authorized) revokedConversationIds.current.delete(id)
          setConversations((current) => current.filter((item) => authorized.has(item.id)))
          setMessageDrafts((current) => Object.fromEntries(
            Object.entries(current).filter(([id]) => authorized.has(Number(id))),
          ))
          if (activeConversationIdRef.current && !authorized.has(activeConversationIdRef.current)) {
            purgeConversation(activeConversationIdRef.current)
          }
          void refreshConversations()
          return
        }
        if (!Number.isSafeInteger(data.nextAfter) || data.nextAfter <= after ||
            data.nextAfter !== data.ids[data.ids.length - 1]) return
        after = data.nextAfter
      }
    } catch {
      // Connectivity failures must never be interpreted as revoked rights.
    }
  }

  async function refreshConversations() {
    const sessionId = session?.sessionId
    try {
      const response = await apiFetch(`/api/conversations?limit=${CHAT_LIST_PAGE_SIZE}`)
      if (!response.ok) return
      const data = ((await response.json()) as Conversation[])
        .filter((item) => !revokedConversationIds.current.has(item.id) &&
          (!membershipSnapshot.current || membershipSnapshot.current.has(item.id)))
      if (sessionRef.current?.sessionId !== sessionId) return
      setConversations((current) => {
        const freshIds = new Set(data.map((item) => item.id))
        return [...data, ...current.filter((item) => !freshIds.has(item.id))]
      })
      conversationOffset.current = Math.max(conversationOffset.current, data.length)
      if (conversationOffset.current === data.length) setHasMoreConversations(data.length === CHAT_LIST_PAGE_SIZE)
    } catch {
      setStatus('Đang kết nối lại...')
    }
  }

  async function loadMoreConversations() {
    if (!session || conversationPagingBusy.current || !hasMoreConversations) return
    const sessionId = session.sessionId
    conversationPagingBusy.current = true
    setConversationLoadingMore(true)
    try {
      const response = await apiFetch(`/api/conversations?limit=${CHAT_LIST_PAGE_SIZE}&offset=${conversationOffset.current}`)
      if (!response.ok) throw new Error('Không tải thêm được hội thoại')
      const data = (await response.json()) as Conversation[]
      if (sessionRef.current?.sessionId !== sessionId) return
      conversationOffset.current += data.length
      setHasMoreConversations(data.length === CHAT_LIST_PAGE_SIZE)
      setConversations((current) => {
        const ids = new Set(current.map((item) => item.id))
        return [...current, ...data.filter((item) => !ids.has(item.id) && !revokedConversationIds.current.has(item.id) &&
          (!membershipSnapshot.current || membershipSnapshot.current.has(item.id)))]
      })
    } catch {
      if (sessionRef.current?.sessionId === sessionId) setNotice('Không tải thêm được hội thoại. Hãy thử lại.', 'error')
    } finally {
      conversationPagingBusy.current = false
      if (sessionRef.current?.sessionId === sessionId) setConversationLoadingMore(false)
    }
  }

  async function refreshPosts() {
    const revision = feedRevision.current
    const request = ++feedLoads.current
    const sessionId = session?.sessionId
    try {
      const response = await apiFetch(`/api/posts?limit=${FEED_PAGE_SIZE}`)
      if (!response.ok) return
      const data = (await response.json()) as Post[]
      if (sessionRef.current?.sessionId !== sessionId ||
        revision !== feedRevision.current || request !== feedLoads.current ||
        [...actionLocks.current].some((key) => key.startsWith('feed:'))) return
      setPosts((current) => {
        const ids = new Set(data.map((item) => item.id))
        return [...data, ...current.filter((item) => !ids.has(item.id))]
      })
      if (data.length < FEED_PAGE_SIZE) setHasMorePosts(false)
      else if (posts.length === 0) setHasMorePosts(true)
    } catch {
      setStatus('Đang kết nối lại...')
    }
  }

  async function loadMorePosts() {
    if (!session || postsPagingBusy.current || !hasMorePosts || posts.length === 0) return
    const sessionId = session.sessionId
    const before = Math.min(...posts.map((item) => item.id))
    postsPagingBusy.current = true
    setPostsLoadingMore(true)
    try {
      const response = await apiFetch(`/api/posts?limit=${FEED_PAGE_SIZE}&before=${before}`)
      if (!response.ok) throw new Error('Không tải thêm được bài viết')
      const data = (await response.json()) as Post[]
      if (sessionRef.current?.sessionId !== sessionId) return
      setHasMorePosts(data.length === FEED_PAGE_SIZE)
      setPosts((current) => {
        const ids = new Set(current.map((item) => item.id))
        return [...current, ...data.filter((item) => !ids.has(item.id))]
      })
    } catch {
      if (sessionRef.current?.sessionId === sessionId) setNotice('Không tải thêm được bài viết. Hãy thử lại.', 'error')
    } finally {
      postsPagingBusy.current = false
      if (sessionRef.current?.sessionId === sessionId) setPostsLoadingMore(false)
    }
  }

  async function loadSavedPosts(more = false) {
    if (!session || savedPagingBusy.current) return
    const sessionId = session.sessionId
    savedPagingBusy.current = true
    setSavedPostsBusy(true)
    try {
      const before = more && savedPosts.length ? '&before=' + Math.min(...savedPosts.map(p => p.id)) : ''
      const response = await apiFetch('/api/posts?scope=saved&limit=' + FEED_PAGE_SIZE + before)
      if (!response.ok) throw new Error('Không tải được các bài đã lưu.')
      const data = await response.json() as Post[]
      if (sessionRef.current?.sessionId !== sessionId) return
      setSavedPosts(current => {
        if (!more) return data
        const ids = new Set(current.map(p => p.id))
        return [...current, ...data.filter(p => !ids.has(p.id))]
      })
      setHasMoreSavedPosts(data.length === FEED_PAGE_SIZE)
    } catch (error) {
      if (sessionRef.current?.sessionId === sessionId) setNotice(error instanceof Error ? error.message : 'Không tải được bài đã lưu.', 'error')
    } finally {
      savedPagingBusy.current = false
      if (sessionRef.current?.sessionId === sessionId) setSavedPostsBusy(false)
    }
  }

  function syncFeedPost(updated: Post) {
    setPosts(current => current.map(p => p.id === updated.id ? updated : p))
    setSavedPosts(current => {
      if (!updated.saved) return current.filter(p => p.id !== updated.id)
      const exists = current.some(p => p.id === updated.id)
      return exists ? current.map(p => p.id === updated.id ? updated : p) : [updated, ...current]
    })
  }

  function removeFeedPost(id: number) {
    setPosts(current => current.filter(p => p.id !== id))
    setSavedPosts(current => current.filter(p => p.id !== id))
    setActivePostId(current => current === id ? null : current)
  }

  async function refreshStories() {
    try {
      const response = await apiFetch('/api/stories')
      if (!response.ok) return
      const data = (await response.json()) as Story[]
      if (sessionRef.current?.sessionId === session?.sessionId) {
        setStories(data.filter((item) => Date.parse(item.expiresAt) > Date.now()))
      }
    } catch {
      setStatus('Đang kết nối lại...')
    }
  }

  async function submitAuth(event: FormEvent) {
    event.preventDefault()
    setAuthLoading(true)
    setAuthError('')

    try {
      const response = await fetch(`${API}/api/auth/email/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: authEmail.trim(),
        }),
      })
      const result = await response.json()
      if (!response.ok) {
        setAuthError(result.error || 'Không thể gửi mã xác minh')
        return
      }

      const payload = result as {
        verificationToken: string
        emailMasked: string
        expiresInSeconds: number
      }
      setVerificationToken(payload.verificationToken)
      setVerificationEmail(payload.emailMasked)
      setOtpCode('')
      const expiresAt = Date.now() + payload.expiresInSeconds * 1000
      setOtpExpiresAt(expiresAt)
      setOtpSecondsLeft(payload.expiresInSeconds)
      setRegisterStep('otp')
    } catch {
      setAuthError('Không kết nối được server')
    } finally {
      setAuthLoading(false)
    }
  }

  async function verifyOTP(event: FormEvent) {
    event.preventDefault()
    if (!verificationToken || otpCode.length !== 6) return

    setAuthLoading(true)
    setAuthError('')
    try {
      const response = await fetch(`${API}/api/auth/email/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: verificationToken,
          code: otpCode,
        }),
      })
      const result = await response.json()
      if (!response.ok) {
        setAuthError(result.error || 'Mã xác minh không đúng')
        return
      }

      const next = parseSession(result)
      if (!next) throw new Error('invalid session response')
      saveSession({ ...next, sessionId: crypto.randomUUID() })
    } catch {
      setAuthError('Không kết nối được server')
    } finally {
      setAuthLoading(false)
    }
  }

  async function resendOTP() {
    if (!verificationToken) return

    setAuthLoading(true)
    setAuthError('')
    try {
      const response = await fetch(`${API}/api/auth/email/resend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: verificationToken }),
      })
      const result = await response.json()
      if (!response.ok) {
        setAuthError(result.error || 'Không thể gửi lại mã')
        return
      }
      const payload = result as {
        verificationToken: string
        emailMasked: string
        expiresInSeconds: number
      }
      setVerificationEmail(payload.emailMasked)
      setOtpCode('')
      const expiresAt = Date.now() + payload.expiresInSeconds * 1000
      setOtpExpiresAt(expiresAt)
      setOtpSecondsLeft(payload.expiresInSeconds)
    } catch {
      setAuthError('Không kết nối được server')
    } finally {
      setAuthLoading(false)
    }
  }

  function resetRegistration() {
    setRegisterStep('details')
    setVerificationToken('')
    setVerificationEmail('')
    setOtpCode('')
    setOtpExpiresAt(0)
    setOtpSecondsLeft(0)
    setAuthError('')
  }

  useEffect(() => {
    if (registerStep !== 'otp' || otpExpiresAt <= 0) return
    const update = () => {
      const left = Math.max(0, Math.ceil((otpExpiresAt - Date.now()) / 1000))
      setOtpSecondsLeft(left)
    }
    update()
    const timer = window.setInterval(update, 1000)
    return () => window.clearInterval(timer)
  }, [registerStep, otpExpiresAt])

  function logout(revoke = true, clearStorage = true) {
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
    resetRegistration()
    setAuthMode('login')
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

  useEffect(() => {
    if (!session?.token) return

    void refreshConversations()
    void refreshPosts()
    void refreshStories()

    const events = new EventSource(
      `${API}/api/events?token=${encodeURIComponent(session.token)}`,
    )
    events.onopen = () => {
      setStatus('Đang online')
      void refreshFriendConnections()
      void reconcileConversationMemberships()
    }
    events.onerror = () => setStatus('Đang kết nối lại...')
    events.addEventListener('update', (event) => {
      if (sessionRef.current?.sessionId !== session.sessionId) return
      const update = JSON.parse((event as MessageEvent).data) as RealtimeEvent
      if (update.type === 'friend.updated') {
        void refreshFriendConnections()
        return
      }

      if (update.type === 'conversation.removed') {
        purgeConversation(update.conversationId)
        return
      }

      if (update.type === 'conversation.created' || update.type === 'conversation.updated') {
        revokedConversationIds.current.delete(update.conversationId)
        membershipSnapshot.current?.add(update.conversationId)
        membershipEventSequence.current += 1
        void refreshConversations()
        if (groupSettingsOpen && activeConversationIdRef.current === update.conversationId) {
          void refreshGroupMembers(update.conversationId)
        }
        return
      }

      if (
        update.type === 'conversation.read' &&
        update.readerId &&
        update.lastReadMessageId &&
        update.readerId !== session.user.id
      ) {
        if (activeConversationIdRef.current === update.conversationId) {
          setMessages((current) =>
            current.map((message) => {
              if (
                message.senderId !== session.user.id ||
                message.id > (update.lastReadMessageId || 0)
              ) return message
              const readers = message.readByUserIds || []
              if (readers.includes(update.readerId as number)) return message
              messageChanges.current.add(message.id)
              return { ...message, readByUserIds: [...readers, update.readerId as number] }
            }),
          )
        }
        return
      }

      if (update.type === 'message.updated' && update.message) {
        const changed = update.message
        messageChanges.current.add(changed.id)
        if (activeConversationIdRef.current === update.conversationId) {
          setMessages((current) => {
            const item = current.find((message) => message.id === changed.id)
            const mineByEmoji = new Map(
              (item?.reactions || []).map((reaction) => [reaction.emoji, reaction.mine]),
            )
            return mergeById(current, {
              ...changed,
              readByUserIds: [...new Set([...(item?.readByUserIds || []), ...(changed.readByUserIds || [])])],
              reactions: (changed.reactions || []).map((reaction) => ({
                ...reaction,
                mine: mineByEmoji.get(reaction.emoji) ?? false,
              })),
            }).sort((a, b) => a.id - b.id)
          })
          setTranslations((current) => {
            const next = { ...current }
            delete next[changed.id]
            return next
          })
        }
        void refreshConversations()
        return
      }

      if (update.type === 'message' && update.message) {
        const incoming = update.message
        // Only genuine, recent messages from other users make a sound. Loading
        // history, updating reactions and our own sends never trigger one.
        messageSound.current?.onIncoming(incoming, session.user.id, messageSoundEnabledRef.current)
        messageChanges.current.add(incoming.id)
        if (incoming.senderId === session.user.id && incoming.clientId) {
          const recovered = loadPendingSend(session.user.id, session.sessionId)
          if (recovered?.clientId === incoming.clientId && recovered.conversationId === incoming.conversationId) {
            clearPendingSend(session.user.id, incoming.clientId)
            setMessageDrafts((current) => {
              const existing = current[incoming.conversationId]
              if (!existing || existing.text.trim() !== incoming.text || existing.attachments.length > 0) return current
              const next = { ...current }
              delete next[incoming.conversationId]
              return next
            })
          }
          if (pendingSend.current?.clientId === incoming.clientId) {
            const confirmed = pendingSend.current
            pendingSend.current = null
            // A late SSE receipt also resolves an ambiguous HTTP send. Keep any newer draft.
            setMessageDrafts((current) => {
              if (current[confirmed.conversationId] !== confirmed.draft) return current
              const next = { ...current }
              delete next[confirmed.conversationId]
              return next
            })
          }
          if (messageReceipts.current.has(incoming.clientId)) messageReceipts.current.set(incoming.clientId, incoming)
          setOutgoingMessage((current) => current?.clientId === incoming.clientId ? null : current)
        }
        const currentId = activeConversationIdRef.current

        setConversations((current) => {
          const existing = current.find((item) => item.id === update.conversationId)
          if (!existing) return current
          const next = current.map((item) =>
            item.id === update.conversationId
              ? {
                  ...item,
                  lastMessage: incoming.text || attachmentLabel(incoming.attachments),
                  lastMessageAt: incoming.createdAt,
                  unreadCount:
                    incoming.senderId !== session.user.id &&
                      !canMarkConversationRead(currentId, item.id, tabRef.current, document.visibilityState)
                      ? item.unreadCount + 1
                      : item.unreadCount,
                }
              : item,
          )
          return next.sort((a, b) =>
            (b.lastMessageAt || b.createdAt).localeCompare(a.lastMessageAt || a.createdAt),
          )
        })

        void refreshConversations()

        if (currentId === update.conversationId) {
          setMessages((current) =>
            current.some((item) => item.id === incoming.id)
              ? current
              : [...current, incoming],
          )
          if (incoming.senderId !== session.user.id &&
              canMarkConversationRead(currentId, update.conversationId, tabRef.current, document.visibilityState)) {
            void apiFetch(`/api/conversations/${update.conversationId}/read`, { method: 'POST' })
              .catch(() => setStatus('Đang kết nối lại...'))
          }
        }
      }
    })

    const refreshTimer = window.setInterval(() => {
      void refreshConversations()
      void refreshFriendConnections()
    }, 20000)
    const membershipTimer = window.setInterval(() => {
      void reconcileConversationMemberships()
    }, 90000)
    const checkMembership = () => { void reconcileConversationMemberships() }
    const checkVisibleMembership = () => {
      if (document.visibilityState === 'visible') checkMembership()
    }
    window.addEventListener('online', checkMembership)
    document.addEventListener('visibilitychange', checkVisibleMembership)
    return () => {
      events.close()
      window.clearInterval(refreshTimer)
      window.clearInterval(membershipTimer)
      window.removeEventListener('online', checkMembership)
      document.removeEventListener('visibilitychange', checkVisibleMembership)
      membershipSyncSequence.current += 1
    }
  }, [session?.token, groupSettingsOpen])

  useEffect(() => {
    if (!session?.token || tab !== 'feed') return
    void refreshPosts()
    void refreshStories()
    const timer = window.setInterval(() => {
      void refreshPosts()
      void refreshStories()
    }, 12000)
    return () => window.clearInterval(timer)
  }, [tab, session?.token])

  useEffect(() => {
    if (!session?.token || !activeConversationId || !translationPreferencesLoaded) {
      if (!activeConversationId) setMessages([])
      return
    }

    let cancelled = false
    const changes = new Set<number>()
    messageChanges.current = changes
    setTranslations({})
    apiFetch(
      `/api/conversations/${activeConversationId}/messages?target=${encodeURIComponent(targetLanguage)}&limit=${MESSAGE_PAGE_SIZE}`,
    )
      .then(async (response) => {
        if (response.status === 403) {
          if (!cancelled) purgeConversation(activeConversationId)
          return
        }
        if (!response.ok) throw new Error('Không tải được tin nhắn')
        const data = (await response.json()) as Message[]
        if (cancelled) return

        // Reconcile a POST whose ACK vanished before refresh. A persisted
        // clientId in history is proof of delivery; no second POST is needed.
        const recovered = loadPendingSend(session.user.id, session.sessionId)
        const confirmed = recovered && data.find((item) => item.clientId === recovered.clientId && item.conversationId === recovered.conversationId)
        if (confirmed && recovered) {
          clearPendingSend(session.user.id, recovered.clientId)
          if (pendingSend.current?.clientId === recovered.clientId) pendingSend.current = null
          setMessageDrafts((current) => {
            const existing = current[confirmed.conversationId]
            if (!existing || existing.text.trim() !== confirmed.text || existing.attachments.length > 0) return current
            const next = { ...current }
            delete next[confirmed.conversationId]
            return next
          })
        }

        setHasMoreMessages(data.length === MESSAGE_PAGE_SIZE)
        setMessages((current) => {
          const live = current.filter((item) => item.conversationId === activeConversationId && changes.has(item.id))
          const liveIds = new Set(live.map((item) => item.id))
          return [...data.filter((item) => !liveIds.has(item.id)), ...live].sort((a, b) => a.id - b.id)
        })
        const restored: Record<number, string> = {}
        for (const message of data) {
          if (
            message.translatedText &&
            !changes.has(message.id) &&
            message.translationLanguage === targetLanguage
          ) {
            restored[message.id] = message.translatedText
          }
        }
        setTranslations(restored)
        if (!canMarkConversationRead(activeConversationIdRef.current, activeConversationId, tabRef.current, document.visibilityState)) return
        const read = await apiFetch(`/api/conversations/${activeConversationId}/read`, { method: 'POST' })
        if (!read.ok) return
        if (!cancelled) {
          setConversations((current) =>
            current.map((item) =>
              item.id === activeConversationId ? { ...item, unreadCount: 0 } : item,
            ),
          )
        }
      })
      .catch(() => {
        if (!cancelled) setNotice('Không tải được tin nhắn. Kiểm tra kết nối rồi mở lại cuộc trò chuyện.')
      })

    return () => {
      cancelled = true
    }
  }, [
    activeConversationId,
    session?.token,
    targetLanguage,
    translationPreferencesLoaded,
  ])

  useEffect(() => {
    if (!session?.token || !activeConversationId) return
    const id = activeConversationId
    const sessionId = session.sessionId
    const markWhenVisible = () => {
      if (!canMarkConversationRead(activeConversationIdRef.current, id, tabRef.current, document.visibilityState)) return
      void apiFetch(`/api/conversations/${id}/read`, { method: 'POST' })
        .then((response) => {
          if (!response.ok || activeConversationIdRef.current !== id || sessionRef.current?.sessionId !== sessionId) return
          setConversations((current) =>
            current.map((item) => item.id === id ? { ...item, unreadCount: 0 } : item),
          )
        })
        .catch(() => undefined)
    }
    window.addEventListener('focus', markWhenVisible)
    document.addEventListener('visibilitychange', markWhenVisible)
    return () => {
      window.removeEventListener('focus', markWhenVisible)
      document.removeEventListener('visibilitychange', markWhenVisible)
    }
  }, [session?.sessionId, activeConversationId])

  async function loadOlderMessages() {
    if (!session || !activeConversationId || messagesPagingBusy.current ||
        !hasMoreMessages || messages.length === 0) return
    const conversationId = activeConversationId
    const sessionId = session.sessionId
    const before = Math.min(...messages.map((message) => message.id))
    messagesPagingBusy.current = true
    setMessagesLoadingMore(true)
    try {
      const response = await apiFetch(
        `/api/conversations/${conversationId}/messages?target=${encodeURIComponent(targetLanguage)}&limit=${MESSAGE_PAGE_SIZE}&before=${before}`,
      )
      if (!response.ok) throw new Error('Không tải thêm được lịch sử tin nhắn')
      const data = (await response.json()) as Message[]
      if (sessionRef.current?.sessionId !== sessionId || activeConversationIdRef.current !== conversationId) return
      setHasMoreMessages(data.length === MESSAGE_PAGE_SIZE)
      if (data.length > 0) {
        const container = messagesScrollRef.current
        if (container) pendingMessageScrollRestore.current = { height: container.scrollHeight, top: container.scrollTop }
        setMessages((current) => {
          const ids = new Set(current.map((message) => message.id))
          return [...data.filter((message) => !ids.has(message.id)), ...current].sort((a, b) => a.id - b.id)
        })
        setTranslations((current) => {
          const restored = { ...current }
          for (const message of data) {
            if (message.translatedText && message.translationLanguage === targetLanguage) {
              restored[message.id] = message.translatedText
            }
          }
          return restored
        })
      }
    } catch {
      if (sessionRef.current?.sessionId === sessionId && activeConversationIdRef.current === conversationId)
        setNotice('Không tải được tin nhắn cũ. Hãy thử lại.', 'error')
    } finally {
      messagesPagingBusy.current = false
      if (sessionRef.current?.sessionId === sessionId && activeConversationIdRef.current === conversationId)
        setMessagesLoadingMore(false)
    }
  }

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
      id: -1, clientId, conversationId, senderId: session.user.id, sender: session.user.username,
      text, attachments, createdAt: new Date().toISOString(),
      replyToMessageId: reply?.id, replyToSender: reply?.sender, replyToText: reply?.text,
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

  function openGroupSettings(conversation: Conversation) {
    setGroupActionsOpen(false)
    setGroupSettingsOpen(true)
    setGroupNameDraft(conversation.name)
    setGroupInviteSearch('')
    setGroupInviteSelection([])
    void Promise.all([
      refreshGroupMembers(conversation.id),
      refreshFriendConnections(),
    ])
  }

  function launchGroupCall(conversationId: number, mediaType: 'audio' | 'video') {
    window.dispatchEvent(new CustomEvent('chatnet:start-call', {
      detail: { conversationId, mediaType },
    }))
  }

  async function refreshGroupMembers(conversationId = activeConversationId || undefined) {
    if (!conversationId) return
    try {
      const response = await apiFetch(`/api/conversations/${conversationId}/members`)
      if (!response.ok) return
      const items = (await response.json()) as GroupMember[]
      if (activeConversationIdRef.current === conversationId) {
        setGroupMembers(items)
      }
    } catch {
      setNotice('Không tải được danh sách thành viên nhóm.')
    }
  }

  async function renameActiveGroup() {
    if (!activeConversationId || !groupNameDraft.trim() || actionLocks.current.has('group:write')) return
    const sessionId = session?.sessionId
    actionLocks.current.add('group:write')
    setGroupBusy(true)
    try {
      const response = await apiFetch(`/api/conversations/${activeConversationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: groupNameDraft.trim() }),
      })
      const result = await response.json().catch(() => null) as { error?: string } | null
      if (sessionRef.current?.sessionId !== sessionId) return
      if (!response.ok) {
        setNotice(result?.error || 'Không đổi được tên nhóm')
        return
      }
      setNotice('Đã cập nhật tên nhóm.')
      await refreshConversations()
    } finally {
      if (sessionRef.current?.sessionId === sessionId) {
        actionLocks.current.delete('group:write')
        setGroupBusy(false)
      }
    }
  }

  async function inviteGroupMembers() {
    if (!activeConversationId || actionLocks.current.has('group:write')) return
    const sessionId = session?.sessionId
    const selectedUsernames = friends
      .filter((friend) => friend.status === 'accepted' && groupInviteSelection.includes(friend.id))
      .map((friend) => friend.username)
    const usernames = Array.from(new Set([
      ...selectedUsernames,
      ...groupInviteDraft.split(/[\s,;]+/),
    ].map((item) => item.trim().replace(/^@/, '').toLowerCase()).filter(Boolean)))
    if (usernames.length === 0) return
    if (usernames.length > 50) {
      setNotice('Mỗi lần có thể mời tối đa 50 người. Hãy chia thành nhiều lượt.', 'warning')
      return
    }
    actionLocks.current.add('group:write')
    setGroupBusy(true)
    try {
      const response = await apiFetch(`/api/conversations/${activeConversationId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usernames }),
      })
      const result = await response.json().catch(() => null) as { error?: string } | null
      if (sessionRef.current?.sessionId !== sessionId) return
      if (!response.ok) {
        setNotice(result?.error || 'Không thêm được thành viên')
        return
      }
      if (activeConversationIdRef.current === activeConversationId) {
        setGroupInviteDraft((current) => current === groupInviteDraft ? '' : current)
        setGroupInviteSelection([])
        setGroupInviteSearch('')
      }
      setNotice('Đã thêm thành viên vào nhóm.')
      await Promise.all([refreshGroupMembers(activeConversationId), refreshConversations()])
    } finally {
      if (sessionRef.current?.sessionId === sessionId) {
        actionLocks.current.delete('group:write')
        setGroupBusy(false)
      }
    }
  }

  async function changeGroupMemberRole(member: GroupMember, role: GroupMember['role']) {
    if (!activeConversationId || actionLocks.current.has('group:write')) return
    const sessionId = session?.sessionId
    const message = role === 'owner'
      ? `Chuyển quyền chủ nhóm cho @${member.username}?`
      : role === 'admin'
        ? `Đặt @${member.username} làm quản trị viên?`
        : `Gỡ quyền quản trị của @${member.username}?`
    if (!window.confirm(message)) return
    actionLocks.current.add('group:write')
    setGroupBusy(true)
    try {
      const response = await apiFetch(`/api/conversations/${activeConversationId}/members/${member.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      })
      const result = await response.json().catch(() => null) as { error?: string } | null
      if (sessionRef.current?.sessionId !== sessionId) return
      if (!response.ok) {
        setNotice(result?.error || 'Không cập nhật được quyền thành viên')
        return
      }
      setNotice(role === 'owner' ? 'Đã chuyển quyền chủ nhóm.' : 'Đã cập nhật quyền thành viên.')
      await refreshGroupMembers(activeConversationId)
    } finally {
      if (sessionRef.current?.sessionId === sessionId) {
        actionLocks.current.delete('group:write')
        setGroupBusy(false)
      }
    }
  }

  async function removeGroupMember(member: GroupMember) {
    if (!activeConversationId || actionLocks.current.has('group:write')) return
    const sessionId = session?.sessionId
    const self = member.id === session?.user.id
    if (!window.confirm(self ? 'Rời khỏi nhóm này?' : `Xóa @${member.username} khỏi nhóm?`)) return
    actionLocks.current.add('group:write')
    setGroupBusy(true)
    try {
      const response = await apiFetch(`/api/conversations/${activeConversationId}/members/${member.id}`, {
        method: 'DELETE',
      })
      const result = await response.json().catch(() => null) as { error?: string } | null
      if (sessionRef.current?.sessionId !== sessionId) return
      if (!response.ok) {
        setNotice(result?.error || (self ? 'Không rời được nhóm' : 'Không xóa được thành viên'))
        return
      }
      if (self) {
        if (activeConversationIdRef.current === activeConversationId) {
          setGroupSettingsOpen(false)
          setActiveConversationId(null)
        }
        setNotice('Bạn đã rời nhóm.')
        await refreshConversations()
        return
      }
      setNotice(`Đã xóa @${member.username} khỏi nhóm.`)
      await Promise.all([refreshGroupMembers(activeConversationId), refreshConversations()])
    } finally {
      if (sessionRef.current?.sessionId === sessionId) {
        actionLocks.current.delete('group:write')
        setGroupBusy(false)
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

    const content = postText.trim()
    const attachments = postAttachments
    const visibility = postVisibility
    const background = postBackground
    const sessionId = session.sessionId
    actionLocks.current.add('feed:create')
    ++feedRevision.current
    setPendingPost({ id: -1, author: name, content, visibility, background, attachments, likes: 0, liked: false, comments: [], createdAt: new Date().toISOString() })
    try {
      const response = await apiFetch('/api/posts', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, attachments: attachments.map(attachmentRequestBody), visibility, background }),
      })
      const post = await response.json() as Post & { error?: string }
      if (sessionRef.current?.sessionId !== sessionId) return
      if (!response.ok || !Number.isSafeInteger(post.id) || post.id <= 0) throw new Error(post.error || 'Không đăng được bài viết')
      setPosts((current) => [post, ...current.filter((item) => item.id !== post.id)])
      setPostText('')
      setPostAttachments([])
      setPostBackground('')
      setShowPostBackgrounds(false)
      setNotice('Đã đăng bài viết.', 'success')
    } catch (error) {
      if (sessionRef.current?.sessionId === sessionId) setNotice(error instanceof Error ? error.message : 'Không đăng được bài viết. Bản nháp được giữ lại.', 'error')
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
    } catch (error) {
      if (sessionRef.current?.sessionId === sessionId) setNotice(error instanceof Error ? error.message : 'Không cập nhật được lượt thích.', 'error')
    } finally {
      if (sessionRef.current?.sessionId === sessionId) {
        ++feedRevision.current
        actionLocks.current.delete(key)
        setLikePreviews((current) => { const next = { ...current }; delete next[post.id]; return next })
        void refreshPosts()
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
      id: -1, parentId, author: name, content, createdAt: new Date().toISOString(),
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
    } finally {
      if (sessionRef.current?.sessionId === sessionId) {
        ++feedRevision.current
        actionLocks.current.delete(key)
        setPendingComments((current) => { const next = { ...current }; delete next[post.id]; return next })
      }
    }
  }

  if (!session) {
    return (
      <main className="auth-screen">
        <section className="auth-copy">
          <img src="/soco-mark.svg" width="52" height="52" alt="SOCO" />
          <h1>SOCO</h1>
          <p>Understand. Connect. Together.</p>
        </section>

        {registerStep === 'otp' ? (
          <form className="auth-card otp-card" onSubmit={verifyOTP}>
            <div className="otp-icon">✉️</div>
            <h2>Kiểm tra email của bạn</h2>
            <p className="auth-hint">
              SOCO đã gửi mã xác minh 6 số tới <strong>{verificationEmail || 'email của bạn'}</strong>.
              Mã có hiệu lực trong 10 phút.
            </p>

            <label>
              Mã xác minh
              <input
                className="otp-input"
                value={otpCode}
                onChange={(event) => setOtpCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                minLength={6}
                maxLength={6}
                autoFocus
                required
              />
            </label>

            <div className="otp-meta">
              <span>
                {otpSecondsLeft > 0
                  ? `Hết hạn sau ${Math.floor(otpSecondsLeft / 60)}:${String(otpSecondsLeft % 60).padStart(2, '0')}`
                  : 'Mã đã hết hạn'}
              </span>
              <button type="button" onClick={() => void resendOTP()} disabled={authLoading}>
                Gửi lại mã
              </button>
            </div>

            {authError && <div className="auth-error">{authError}</div>}
            <button className="auth-submit" disabled={authLoading || otpCode.length !== 6 || otpSecondsLeft <= 0}>
              {authLoading ? 'Đang xác minh...' : 'Xác minh & vào SOCO'}
            </button>
            <button type="button" className="auth-secondary" onClick={resetRegistration} disabled={authLoading}>
              Dùng email khác
            </button>
          </form>
        ) : (
          <form className="auth-card" onSubmit={submitAuth}>
            <div className="auth-tabs">
              <button
                type="button"
                className={authMode === 'register' ? 'active' : ''}
                disabled={authLoading}
                onClick={() => {
                  setAuthMode('register')
                  resetRegistration()
                }}
              >
                Đăng ký
              </button>
              <button
                type="button"
                className={authMode === 'login' ? 'active' : ''}
                disabled={authLoading}
                onClick={() => {
                  setAuthMode('login')
                  resetRegistration()
                }}
              >
                Đăng nhập
              </button>
            </div>

            <h2>{authMode === 'register' ? 'Tạo tài khoản' : 'Chào mừng quay lại'}</h2>
            <label>
              Email
              <input type="email" value={authEmail} onChange={(event) => setAuthEmail(event.target.value)} placeholder="you@example.com" autoComplete="email" maxLength={254} required />
            </label>

            {authMode === 'register' && (
              <div className="email-verify-note">
                🔐 Tài khoản chỉ được tạo sau khi bạn nhập đúng OTP gửi qua email.
              </div>
            )}

            {authError && <div className="auth-error">{authError}</div>}
            <button className="auth-submit" disabled={authLoading}>
              {authLoading
                ? 'Đang xử lý...'
                : authMode === 'register'
                  ? 'Gửi mã OTP'
                  : 'Đăng nhập'}
            </button>
          </form>
        )}
      </main>
    )
  }

  const unreadTotal = conversations.reduce((sum, conversation) => sum + conversation.unreadCount, 0)
  const normalizedSearch = globalSearch.trim().toLocaleLowerCase('vi-VN')
  const searchedConversations = conversations.filter((conversation) => {
    if (!normalizedSearch) return true
    return (
      conversation.name.toLocaleLowerCase('vi-VN').includes(normalizedSearch) ||
      conversation.lastMessage.toLocaleLowerCase('vi-VN').includes(normalizedSearch)
    )
  })
  const visibleConversations = searchedConversations
  const searchedPosts = (feedFilter === 'saved' ? savedPosts : visiblePosts).filter((post) => {
    if (!normalizedSearch || tab !== 'feed') return true
    return (
      post.author.toLocaleLowerCase('vi-VN').includes(normalizedSearch) ||
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

  return (
    <main className={`app-shell modern-shell ${tab === 'chat' && activeConversation ? 'conversation-open' : ''}`}>
      {qrOpen && <Suspense fallback={<div role="status">Đang mở QR...</div>}>
        <ProfileQr username={session.user.username} displayName={session.user.displayName || session.user.username}
          url={connectUrl()} initialMode={qrOpen} onClose={() => setQrOpen(null)}
          onConnect={(username) => { setQrOpen(null); openConnectSurface(username) }} />
      </Suspense>}
      {mediaUploading && mediaUploadProgress && (
        <div className="media-upload-progress" role="status" aria-live="polite">
          <span>Đang tải tệp: {Math.round(mediaUploadProgress.loaded / Math.max(1, mediaUploadProgress.total) * 100)}%</span>
          <progress value={mediaUploadProgress.loaded} max={mediaUploadProgress.total} aria-label="Tiến độ tải tệp" />
          <button type="button" onClick={() => mediaUploadAbort.current?.abort()}>Hủy tải</button>
        </div>
      )}
      {friendPreview && (
        <div className="connect-modal-layer">
          <button type="button" className="connect-modal-scrim" aria-label="Đóng hồ sơ" onClick={() => setFriendPreview(null)} />
          <section className="friend-profile-preview" role="dialog" aria-modal="true" aria-label={`Hồ sơ ${friendPreview.displayName || friendPreview.username}`}>
            <button type="button" className="friend-profile-close" aria-label="Đóng" onClick={() => setFriendPreview(null)}><X size={20} /></button>
            <UserAvatar name={friendPreview.displayName || friendPreview.username} className="friend-profile-avatar" online={friendPreview.online} />
            <h2>{friendPreview.displayName || friendPreview.username}</h2>
            <p>@{friendPreview.username}</p>
            <p>{friendPreview.online ? 'Đang hoạt động' : 'Ngoại tuyến'}</p>
            <div className="friend-profile-actions">
              <button type="button" onClick={() => { setFriendPreview(null); void openDirectByUsername(friendPreview.username) }}>Nhắn tin</button>
              <button type="button" onClick={() => setFriendPreview(null)}>Đóng</button>
            </div>
          </section>
        </div>
      )}
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
                      <UserAvatar name={session.user.username} className="connect-identity-avatar" online />
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
                            <UserAvatar name={friend.username} className="friend-avatar" online={friend.online} />
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

              <div className="conversation-list zalo-conversation-list">
                {visibleConversations.length === 0 && (
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
                      name={conversation.name}
                      className="conversation-avatar"
                      group={conversation.type === 'group'}
                      online={conversation.type === 'direct' && conversation.online}
                    />
                    <div className="conversation-copy">
                      <div>
                        <strong>{conversation.name}</strong>
                        <time>{formatTime(conversation.lastMessageAt) || (conversation.online ? 'online' : '')}</time>
                      </div>
                      <div>
                        <span>{conversation.lastMessage || (conversation.type === 'group' ? `${conversation.memberCount} thành viên` : 'Bắt đầu trò chuyện')}</span>
                        {conversation.unreadCount > 0 && <b>{conversation.unreadCount > 99 ? '99+' : conversation.unreadCount}</b>}
                      </div>
                    </div>
                  </button>
                ))}
                {hasMoreConversations && (
                  <button type="button" className="soco-load-more soco-conversation-load-more"
                    onClick={() => void loadMoreConversations()} disabled={conversationLoadingMore}
                    aria-busy={conversationLoadingMore}>
                    <RefreshCw size={15} aria-hidden="true" />
                    {conversationLoadingMore ? 'Đang tải...' : 'Tải thêm hội thoại'}
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
                        name={activeConversation.name}
                        className="room-avatar"
                        group={activeConversation.type === 'group'}
                        online={activeConversation.type === 'direct' && activeConversation.online}
                      />
                      <div>
                        <strong>{activeConversation.name}</strong>
                        <small>
                          {activeConversation.type === 'group'
                            ? `${activeConversation.memberCount} thành viên`
                            : activeConversation.online ? '● Đang online' : 'Chat riêng'}
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
                    <section className="group-settings-panel" role="region" aria-label="Quản lý nhóm">
                      <div className="group-settings-heading">
                        <div>
                          <strong>Quản lý nhóm</strong>
                          <small>
                            {activeGroupMember
                              ? activeGroupMember.role === 'owner'
                                ? 'Bạn là chủ nhóm'
                                : activeGroupMember.role === 'admin'
                                  ? 'Bạn là quản trị viên'
                                  : 'Bạn là thành viên'
                              : 'Đang tải quyền...'}
                          </small>
                        </div>
                        <button type="button" onClick={() => setGroupSettingsOpen(false)} aria-label="Quay lại cuộc trò chuyện">
                          <X size={21} aria-hidden="true" />
                        </button>
                      </div>

                      {canManageActiveGroup && (
                        <div className="group-admin-tools">
                          <div className="group-tool-row">
                            <input
                              value={groupNameDraft}
                              onChange={(event) => setGroupNameDraft(event.target.value)}
                              placeholder="Tên nhóm"
                              maxLength={120}
                            />
                            <button
                              type="button"
                              onClick={() => void renameActiveGroup()}
                              disabled={groupBusy || !groupNameDraft.trim() || groupNameDraft.trim() === activeConversation.name}
                            >
                              Đổi tên
                            </button>
                          </div>

                          <div className="group-invite-friends">
                            <div className="group-invite-title">
                              <strong>Mời bạn bè</strong>
                              <span>{groupInviteSelection.length ? `${groupInviteSelection.length} đã chọn` : 'Chọn trực tiếp từ danh bạ'}</span>
                            </div>
                            <input
                              className="group-invite-search"
                              type="search"
                              value={groupInviteSearch}
                              onChange={(event) => setGroupInviteSearch(event.target.value)}
                              placeholder="Tìm bạn theo tên hoặc @username"
                              autoComplete="off"
                            />
                            <div className="group-invite-list">
                              {groupInviteCandidates.length === 0 && (
                                <div className="group-invite-empty">
                                  {friends.some((friend) => friend.status === 'accepted')
                                    ? 'Không còn bạn phù hợp để thêm vào nhóm.'
                                    : 'Chưa có bạn bè trong danh bạ để mời.'}
                                </div>
                              )}
                              {groupInviteCandidates.map((friend) => {
                                const selected = groupInviteSelection.includes(friend.id)
                                return (
                                  <button
                                    key={friend.id}
                                    type="button"
                                    className={selected ? 'group-invite-friend selected' : 'group-invite-friend'}
                                    aria-pressed={selected}
                                    onClick={() => setGroupInviteSelection((current) =>
                                      current.includes(friend.id)
                                        ? current.filter((id) => id !== friend.id)
                                        : [...current, friend.id])}
                                  >
                                    <UserAvatar
                                      name={friend.displayName || friend.username}
                                      className="group-member-avatar"
                                      online={friend.online}
                                    />
                                    <span>
                                      <strong>{friend.displayName || friend.username}</strong>
                                      <small>@{friend.username}</small>
                                    </span>
                                    <span className="group-invite-check" aria-hidden="true">✓</span>
                                  </button>
                                )
                              })}
                            </div>
                          </div>

                          <div className="group-tool-row">
                            <input
                              value={groupInviteDraft}
                              onChange={(event) => setGroupInviteDraft(event.target.value)}
                              placeholder="Hoặc nhập @username"
                            />
                            <button
                              type="button"
                              onClick={() => void inviteGroupMembers()}
                              disabled={groupBusy || (!groupInviteDraft.trim() && groupInviteSelection.length === 0)}
                            >
                              {groupInviteSelection.length > 0 ? `Thêm ${groupInviteSelection.length}` : 'Thêm'}
                            </button>
                          </div>
                        </div>
                      )}

                      <div className="group-members-heading">
                        <strong>Thành viên nhóm</strong>
                        <span>{groupMembers.length} thành viên</span>
                      </div>
                      <div className="group-member-list">
                        {groupMembers.map((member) => (
                          <div className="group-member-row" key={member.id}>
                            <UserAvatar name={member.username} className="group-member-avatar" online={member.online} />
                            <div className="group-member-copy">
                              <strong>@{member.username}{member.id === session.user.id ? ' · Bạn' : ''}</strong>
                              <span>
                                {member.role === 'owner' ? 'Chủ nhóm' : member.role === 'admin' ? 'Quản trị viên' : 'Thành viên'}
                                {member.online ? ' · online' : ''}
                              </span>
                            </div>
                            <div className="group-member-actions">
                              {activeGroupMember?.role === 'owner' && member.id !== session.user.id && member.role !== 'owner' && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => void changeGroupMemberRole(member, member.role === 'admin' ? 'member' : 'admin')}
                                    disabled={groupBusy}
                                  >
                                    {member.role === 'admin' ? 'Gỡ admin' : 'Đặt admin'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => void changeGroupMemberRole(member, 'owner')}
                                    disabled={groupBusy}
                                  >
                                    Chuyển chủ
                                  </button>
                                </>
                              )}
                              {canManageActiveGroup &&
                                member.id !== session.user.id &&
                                member.role !== 'owner' &&
                                !(activeGroupMember?.role === 'admin' && member.role === 'admin') && (
                                  <button
                                    type="button"
                                    className="danger"
                                    onClick={() => void removeGroupMember(member)}
                                    disabled={groupBusy}
                                  >
                                    Xóa
                                  </button>
                                )}
                              {member.id === session.user.id && member.role !== 'owner' && (
                                <button
                                  type="button"
                                  className="danger"
                                  onClick={() => void removeGroupMember(member)}
                                  disabled={groupBusy}
                                >
                                  Rời nhóm
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
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
                            if (event.target instanceof Element && event.target.closest('.message-selectable-text')) return
                            event.preventDefault()
                            openMessageActions(message)
                          }}
                        >
                          {!mine && <div className="message-meta">{message.sender}</div>}
                          {message.replyToMessageId && (
                            <div className="message-reply-quote">
                              <strong>@{message.replyToSender || 'user'}</strong>
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
                                    className="translation-flip-content message-selectable-text"
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
                            <strong>@{outgoingMessage.replyToSender}</strong><span>{outgoingMessage.replyToText}</span>
                          </div>
                        )}
                        {outgoingMessage.text && (
                          <div className="bubble">
                            <span className="message-selectable-text">{outgoingMessage.text}</span>
                          </div>
                        )}
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
                          <strong>Đang trả lời @{replyingTo.sender}</strong>
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
          <div className="simple-view contacts-view">
            {friendQuery.trim() ? (
              <section className="contacts-suggestions contacts-search-section" aria-label="Kết quả tìm kiếm bạn bè">
                <div className="contacts-heading contacts-search-heading">
                  <span>Kết quả tìm kiếm</span>
                  <button type="button" onClick={() => setFriendQuery('')}>Xóa tìm kiếm</button>
                </div>
                {friendSearching && <div className="friend-search-state" role="status">Đang tìm người dùng...</div>}
                {friendSearchError && !friendSearching && (
                  <div className="friend-search-state" role="alert">
                    Không thể tìm kiếm lúc này. <button type="button" onClick={() => setFriendSearchRetry((n) => n + 1)}>Thử lại</button>
                  </div>
                )}
                {!friendSearching && !friendSearchError && contactSearchResults.length === 0 && (
                  <div className="friend-search-state">Không tìm thấy kết quả. Thử tên, @username hoặc email chính xác.</div>
                )}
                {contactSearchResults.map((friend) => {
                  const relationship = friendRelationship(friend.id)
                  const actionLabel = relationship === 'accepted' ? 'Nhắn tin'
                    : relationship === 'incoming' ? 'Chấp nhận'
                      : relationship === 'outgoing' ? 'Hủy lời mời' : 'Kết bạn'
                  return (
                    <div className="friend-result contact-result contact-search-row" key={friend.id}>
                      <UserAvatar name={friend.displayName || friend.username} className="friend-avatar" online={friend.online} />
                      <div className="friend-result-copy">
                        <strong>{friend.displayName || friend.username}</strong>
                        <span>@{friend.username}{relationship === 'accepted' ? ' · Bạn bè' : relationship === 'incoming' ? ' · Đã nhận lời mời' : relationship === 'outgoing' ? ' · Đã gửi lời mời' : ''}</span>
                      </div>
                      <button
                        type="button"
                        className="contact-search-action"
                        disabled={friendBusyIds.has(friend.id)}
                        onClick={() => void actOnFriend(friend)}
                      >{actionLabel}</button>
                      <div className="friend-contact-controls" onBlur={(event) => {
                        if (!event.currentTarget.contains(event.relatedTarget)) setFriendMenuId(null)
                      }}>
                        <button type="button" className="friend-contact-more"
                          aria-label={`Tùy chọn của ${friend.displayName || friend.username}`}
                          aria-expanded={friendMenuId === friend.id} aria-haspopup="menu"
                          onClick={() => setFriendMenuId((old) => old === friend.id ? null : friend.id)}>
                          <MoreHorizontal size={19} aria-hidden="true" />
                        </button>
                        {friendMenuId === friend.id && (
                          <div className="friend-contact-popover" role="menu">
                            <button type="button" role="menuitem" className="friend-contact-danger"
                              disabled={friendBusyIds.has(friend.id)}
                              onClick={() => void blockContact(friend)}>Chặn người dùng</button>
                            <button type="button" role="menuitem"
                              onClick={() => void reportContact(friend)}>Báo cáo người dùng</button>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </section>
            ) : (
              <>
            <div className="contact-shortcuts">
              <button type="button" onClick={() => { setTab('chat'); setNewChatMode('friends') }}>
                <span className="shortcut-icon">＋</span><div><strong>Lời mời kết bạn</strong><small>Tìm và kết nối người mới</small></div><b>›</b>
              </button>
              <button type="button" onClick={() => { setFriendQuery(''); setChatCreateError(''); setTab('chat'); setNewChatMode('group') }}>
                <span className="shortcut-icon">👥</span><div><strong>Nhóm và cộng đồng</strong><small>Tạo cuộc trò chuyện nhóm</small></div><b>›</b>
              </button>
            </div>

            {friendRequests.some((item) => item.direction === 'incoming') && (
              <section className="contacts-suggestions">
                <div className="contacts-heading">
                  Lời mời kết bạn ({friendRequests.filter((item) => item.direction === 'incoming').length})
                </div>
                {friendRequests.filter((item) => item.direction === 'incoming').map((friend) => (
                  <div className="friend-result contact-result friend-request-row" key={friend.id}>
                    <UserAvatar name={friend.username} className="friend-avatar" online={friend.online} />
                    <div className="friend-result-copy">
                      <strong>@{friend.username}</strong>
                      <span>Muốn kết bạn với bạn</span>
                    </div>
                    <div className="friend-request-actions">
                      <button type="button" onClick={() => void actOnFriend(friend)} disabled={friendBusyIds.has(friend.id)}>Chấp nhận</button>
                      <button type="button" className="secondary" onClick={() => void declineFriendRequest(friend)} disabled={friendBusyIds.has(friend.id)}>Từ chối</button>
                    </div>
                  </div>
                ))}
              </section>
            )}

            <section className="contacts-suggestions">
              <div className="contacts-heading">Bạn bè ({friends.length})</div>
              {friends.length === 0 && (
                <SocoEmptyState kind="friends" title="Chưa có bạn bè"
                  description="Gửi lời mời để bắt đầu những cuộc trò chuyện mới."
                  action={<SocoTextAction onClick={() => { setTab('chat'); setNewChatMode('friends') }}>Tìm bạn bè</SocoTextAction>}
                />
              )}
              {[...friends].sort((a, b) => Number(Boolean(contactMetadata[b.id]?.favorite)) - Number(Boolean(contactMetadata[a.id]?.favorite))).map((friend) => (
                <div
                  className="friend-result contact-result friend-contact-row"
                  key={friend.id}
                  onBlur={(event) => {
                    if (!event.currentTarget.contains(event.relatedTarget)) setFriendMenuId(null)
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Escape') setFriendMenuId(null)
                  }}
                >
                  <button
                    type="button"
                    className="friend-contact-primary"
                    onClick={() => void openDirectByUsername(friend.username)}
                  >
                    <UserAvatar name={friend.displayName || friend.username} className="friend-avatar" online={friend.online} />
                    <span className="friend-result-copy">
                      <strong>{contactMetadata[friend.id]?.favorite ? '⭐ ' : ''}{contactMetadata[friend.id]?.nickname || friend.displayName || friend.username}</strong>
                      <span>@{friend.username} · {friend.online ? 'Đang hoạt động' : 'Ngoại tuyến'}</span>
                      {contactMetadata[friend.id]?.note && <small className="friend-private-note">{contactMetadata[friend.id].note}</small>}
                    </span>
                  </button>
                  <div className="friend-contact-controls">
                    <button
                      type="button"
                      className="friend-contact-more"
                      aria-label={`Tùy chọn của ${friend.displayName || friend.username}`}
                      aria-expanded={friendMenuId === friend.id}
                      aria-haspopup="menu"
                      onClick={() => setFriendMenuId((current) => current === friend.id ? null : friend.id)}
                    >
                      <MoreHorizontal size={20} aria-hidden="true" />
                    </button>
                    {friendMenuId === friend.id && (
                      <div className="friend-contact-popover" role="menu">
                        <button type="button" role="menuitem" onClick={() => { setFriendPreview(friend); setFriendMenuId(null) }}>Xem hồ sơ</button>
                        <button type="button" role="menuitem" onClick={() => { setFriendMenuId(null); void openDirectByUsername(friend.username) }}>Nhắn tin</button>
                        <button type="button" role="menuitem" onClick={() => void changePersonalContact(friend, 'nickname')}>Đặt biệt danh</button>
                        <button type="button" role="menuitem" onClick={() => void changePersonalContact(friend, 'note')}>Ghi chú riêng</button>
                        <button type="button" role="menuitem" onClick={() => void changePersonalContact(friend, 'favorite')}>{contactMetadata[friend.id]?.favorite ? 'Bỏ bạn thân' : 'Đánh dấu bạn thân'}</button>
                        <button type="button" role="menuitem" className="friend-contact-danger" disabled={friendBusyIds.has(friend.id)} onClick={() => void removeAcceptedFriend(friend)}>Hủy kết bạn</button>
                        <button type="button" role="menuitem" className="friend-contact-danger" disabled={friendBusyIds.has(friend.id)} onClick={() => void blockContact(friend)}>Chặn người dùng</button>
                        <button type="button" role="menuitem" onClick={() => void reportContact(friend)}>Báo cáo người dùng</button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </section>

            {friendRequests.some((item) => item.direction === 'outgoing') && (
              <section className="contacts-suggestions">
                <div className="contacts-heading">Lời mời đã gửi</div>
                {friendRequests.filter((item) => item.direction === 'outgoing').map((friend) => (
                  <button
                    type="button"
                    className="friend-result contact-result"
                    key={friend.id}
                    onClick={() => void actOnFriend(friend)}
                    disabled={friendBusyIds.has(friend.id)}
                  >
                    <UserAvatar name={friend.username} className="friend-avatar" online={friend.online} />
                    <div className="friend-result-copy">
                      <strong>@{friend.username}</strong>
                      <span>Đang chờ phản hồi</span>
                    </div>
                    <div className="friend-result-action"><small>Hủy lời mời</small><span>×</span></div>
                  </button>
                ))}
              </section>
            )}

            <section className="contacts-suggestions">
              <div className="contacts-heading">Người bạn có thể biết</div>
              {friendSearching && <div className="friend-search-state">Đang tải gợi ý...</div>}
              {!friendSearching && friendResults.filter((friend) => friendRelationship(friend.id) === 'none').length === 0 && (
                <div className="friend-search-state">Chưa có gợi ý mới phù hợp.</div>
              )}
              {friendResults.filter((friend) => friendRelationship(friend.id) === 'none').map((friend) => (
                <button
                  type="button"
                  className="friend-result contact-result"
                  key={friend.id}
                  onClick={() => void actOnFriend(friend)}
                  disabled={friendBusyIds.has(friend.id)}
                >
                  <UserAvatar name={friend.username} className="friend-avatar" online={friend.online} />
                  <div className="friend-result-copy">
                    <strong>@{friend.username}</strong>
                    <span>{friend.reason || (friend.online ? 'Đang hoạt động' : 'Ngoại tuyến')}</span>
                  </div>
                  <div className="friend-result-action"><small>Kết bạn</small><span>＋</span></div>
                </button>
              ))}
            </section>
              </>
            )}
          </div>
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
                  aria-label={`Xem Story của @${story.author}`}
                >
                  <div className="story-visual">
                    {story.attachment.kind === 'video' ? (
                      <video src={story.attachment.url} muted playsInline preload="metadata" />
                    ) : (
                      <img src={story.attachment.url} alt="" loading="lazy" />
                    )}
                    <span className="story-avatar-mini">{story.author.slice(0, 1).toUpperCase()}</span>
                  </div>
                  <span>{story.author === name ? 'Story của bạn' : story.author}</span>
                </button>
              ))}
            </div>

            <form className="post-box zalo-post-composer" onSubmit={createPost}>
              <div className="post-prompt compact-post-prompt">
                <UserAvatar name={name} className="avatar self-avatar" />
                <textarea
                  ref={postComposerRef}
                  className={postBackground ? 'feed-composer-bg bg-' + postBackground : ''}
                  disabled={!!pendingPost}
                  aria-label="Nội dung bài viết"
                  placeholder="Hôm nay bạn thế nào?"
                  value={postText}
                  onChange={(event) => setPostText(event.target.value)}
                  rows={1}
                  maxLength={5000}
                />
              </div>
              <input
                ref={feedImageInputRef}
                className="hidden-media-input"
                type="file"
                accept="image/*"
                onChange={(event) => {
                  const files = Array.from(event.currentTarget.files || [])
                  event.currentTarget.value = ''
                  void addFeedFiles(files)
                }}
              />
              <input
                ref={feedVideoInputRef}
                className="hidden-media-input"
                type="file"
                accept="video/*"
                onChange={(event) => {
                  const files = Array.from(event.currentTarget.files || [])
                  event.currentTarget.value = ''
                  void addFeedFiles(files)
                }}
              />
              <input
                ref={feedAlbumInputRef}
                className="hidden-media-input"
                type="file"
                accept="image/*"
                multiple
                onChange={(event) => {
                  const files = Array.from(event.currentTarget.files || [])
                  event.currentTarget.value = ''
                  void addFeedFiles(files)
                }}
              />
              {postAttachments.length > 0 && (
                <div className="feed-pending-media">
                  <MediaAttachmentsView
                    items={postAttachments}
                    pending
                    onRemove={pendingPost ? undefined : (index) => setPostAttachments((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                  />
                </div>
              )}
              <div className="composer-shortcuts">
                <button type="button" disabled={!!pendingPost || mediaUploading === 'feed'} onClick={() => feedImageInputRef.current?.click()}><UiIcon name="photo" size={20} />Ảnh</button>
                <button type="button" disabled={!!pendingPost || mediaUploading === 'feed'} onClick={() => feedVideoInputRef.current?.click()}><UiIcon name="video" size={20} />Video</button>
                <button type="button" disabled={!!pendingPost || mediaUploading === 'feed'} onClick={() => feedAlbumInputRef.current?.click()}><UiIcon name="album" size={20} />Album</button>
                <button type="button" aria-expanded={showPostBackgrounds} onClick={() => { setShowPostBackgrounds(v => !v); postComposerRef.current?.focus() }}><UiIcon name="text" size={20} />Nền chữ</button>
              </div>
              <div className="feed-composer-settings">
                <label>Ai có thể xem?
                  <select value={postVisibility} onChange={event => setPostVisibility(event.target.value as typeof postVisibility)}>
                    <option value="public">🌐 Công khai</option>
                    <option value="friends">👥 Bạn bè</option>
                    <option value="private">🔒 Chỉ mình tôi</option>
                  </select>
                </label>
                {showPostBackgrounds && <div className="feed-background-palette" aria-label="Chọn nền bài viết">
                  {['', 'violet', 'blue', 'sunset', 'mint', 'night'].map(bg => (
                    <button key={bg || 'none'} type="button" className={'feed-palette-dot bg-' + (bg || 'none')}
                      aria-pressed={postBackground === bg} aria-label={bg || 'Không nền'} onClick={() => setPostBackground(bg)}>
                      {postBackground === bg ? '✓' : ''}
                    </button>
                  ))}
                </div>}
              </div>
              {mediaUploading === 'feed' && <div className="media-uploading-note">Đang tải media thẳng lên kho lưu trữ…</div>}
              {(postText.trim() || postAttachments.length > 0) && (
                <button className="feed-submit" disabled={!!pendingPost || !!mediaUploading}>{pendingPost ? 'Đang đăng...' : 'Đăng'}</button>
              )}
            </form>

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
                  <UserAvatar name={pendingPost.author} className="avatar" />
                  <div className="post-body">
                    <div className="post-author"><strong>{pendingPost.author}</strong><small role="status">Đang đăng...</small></div>
                    <p className="pending-content">{pendingPost.content}</p>
                    <MediaAttachmentsView items={pendingPost.attachments} />
                  </div>
                </article>
              )}
              {searchedPosts.map((post) => (
                <article className="post zalo-post" key={post.id}>
                  <UserAvatar name={post.author} className="avatar" />
                  <div className="post-body">
                    <div className="post-author">
                      <div><strong>{post.author}</strong><small>{new Date(post.createdAt).toLocaleString('vi-VN')}</small></div>
                      <FeedPostActions post={post} mine={post.author === name} request={apiFetch}
                        onUpdated={syncFeedPost} onDeleted={removeFeedPost}
                        onFeedback={(text, kind) => setNotice(text, kind || 'success')} />
                    </div>
                    {post.content && (
                      <div className={post.background ? 'feed-text-background bg-' + post.background : ''}>
                        <FeedText api={API} token={session.token}
                          target={translationPreferencesLoaded ? targetLanguage : ''}
                          text={post.content} maxLines={5} onExpand={() => setActivePostId(post.id)} />
                      </div>
                    )}
                    <div className="feed-media-preview" onClick={() => setActivePostId(post.id)}>
                      <MediaAttachmentsView items={post.attachments} />
                    </div>
                    {(post.likes > 0 || (post.comments?.length || 0) > 0) && (
                      <div className="post-engagement-summary">
                        {post.likes > 0 && <span>{post.likes} lượt thích</span>}
                        {(post.comments?.length || 0) > 0 && <span>{post.comments.length} bình luận</span>}
                      </div>
                    )}
                    <div className="post-toolbar">
                      <button type="button" className={post.liked ? 'liked' : ''} disabled={likePreviews[post.id] !== undefined}
                        aria-pressed={post.liked} aria-busy={likePreviews[post.id] !== undefined} onClick={() => void like(post)}>
                        <UiIcon name="heart" size={21} /><span>Thích</span>
                      </button>
                      <button type="button" className="post-stat post-detail-trigger" onClick={() => setActivePostId(post.id)}>
                        <UiIcon name="comment" size={21} />
                        <span>Bình luận</span>
                      </button>
                      <FeedShareAction postId={post.id}
                        onFeedback={(text, kind) => setNotice(text, kind || 'success')} />
                    </div>
                  </div>
                </article>
              ))}
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

        {activeMessageAction && (() => {
          const mine = activeMessageAction.senderId === session.user.id
          const preview = activeMessageAction.text.trim() || attachmentLabel(activeMessageAction.attachments)
          return (
            <div
              className="message-context-backdrop"
              role="dialog"
              aria-modal="true"
              aria-label="Tùy chọn tin nhắn"
              onMouseDown={(event) => {
                if (event.currentTarget === event.target) setMessageActionId(null)
              }}
            >
              <section className="message-context-sheet">
                <div className={mine ? 'message-context-preview mine' : 'message-context-preview'}>
                  <small>{mine ? 'Bạn' : `@${activeMessageAction.sender}`}</small>
                  <div className="message-context-preview-bubble">{preview || 'Tin nhắn'}</div>
                  <time>{formatTime(activeMessageAction.createdAt)}</time>
                </div>

                <div className="message-context-reactions" aria-label="Thả cảm xúc">
                  {['❤️', '👍', '😂', '😮', '😢', '🙏'].map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      className={(activeMessageAction.reactions || []).some((reaction) => reaction.emoji === emoji && reaction.mine) ? 'active' : ''}
                      aria-label={`Thả cảm xúc ${emoji}`}
                      onClick={() => {
                        setMessageActionId(null)
                        void toggleReaction(activeMessageAction, emoji)
                      }}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>

                <div className="message-context-actions">
                  <button
                    type="button"
                    onClick={() => {
                      setReplyingTo(activeMessageAction)
                      setMessageActionId(null)
                    }}
                  >
                    <span aria-hidden="true">↩</span>
                    <b>Trả lời</b>
                  </button>

                  {Boolean(activeMessageAction.text.trim()) && (
                    <button type="button" onClick={() => void copyMessage(activeMessageAction)}>
                      <span aria-hidden="true">▣</span>
                      <b>Sao chép</b>
                    </button>
                  )}

                  {!mine && Boolean(activeMessageAction.text.trim()) && (
                    <button
                      type="button"
                      onClick={() => {
                        setMessageActionId(null)
                        void translateMessage(activeMessageAction)
                      }}
                    >
                      <span aria-hidden="true">文</span>
                      <b>Dịch</b>
                    </button>
                  )}

                  {mine && Boolean(activeMessageAction.text.trim()) && (
                    <button
                      type="button"
                      onClick={() => {
                        setMessageActionId(null)
                        void editOwnMessage(activeMessageAction)
                      }}
                    >
                      <span aria-hidden="true">✎</span>
                      <b>Sửa</b>
                    </button>
                  )}

                  {mine && (
                    <button
                      type="button"
                      className="danger"
                      onClick={() => {
                        setMessageActionId(null)
                        void recallOwnMessage(activeMessageAction)
                      }}
                    >
                      <span aria-hidden="true">⌫</span>
                      <b>Thu hồi</b>
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  className="message-context-cancel"
                  onClick={() => setMessageActionId(null)}
                >
                  Đóng
                </button>
              </section>
            </div>
          )
        })()}

        {activePost && (
          <div
            className="post-detail-backdrop"
            role="dialog"
            aria-modal="true"
            aria-label={`Chi tiết bài viết của @${activePost.author}`}
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
                  <UserAvatar name={activePost.author} className="avatar" />
                  <div className="post-body">
                    <div className="post-author">
                      <div>
                        <strong>{activePost.author}</strong>
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

        {activeStory && (
          <div
            className="story-viewer-backdrop"
            role="dialog"
            aria-modal="true"
            aria-label={`Story của @${activeStory.author}`}
            onMouseDown={(event) => {
              if (event.currentTarget === event.target) setActiveStoryId(null)
            }}
          >
            <section className="story-viewer">
              <div className="story-progress" aria-hidden="true">
                <span key={activeStory.id} className={activeStory.attachment.kind === 'image' ? 'running' : ''} />
              </div>
              <header>
                <UserAvatar name={activeStory.author} className="story-viewer-avatar" />
                <div className="story-viewer-owner">
                  <strong>@{activeStory.author}</strong>
                  <time dateTime={activeStory.createdAt}>
                    {new Date(activeStory.createdAt).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'numeric' })}
                  </time>
                </div>
                {activeStory.author === name && (
                  <button type="button" className="story-delete" aria-label="Xóa Story" title="Xóa Story" disabled={storyBusy} onClick={() => void deleteStory(activeStory)}>
                    <UiIcon name="trash" size={20} />
                  </button>
                )}
                <button type="button" className="story-close" aria-label="Đóng Story" title="Đóng" onClick={() => setActiveStoryId(null)}>×</button>
              </header>
              <div className="story-viewer-media">
                {activeStory.attachment.kind === 'video' ? (
                  <video src={activeStory.attachment.url} autoPlay controls playsInline onEnded={nextStory} />
                ) : (
                  <img src={activeStory.attachment.url} alt={activeStory.attachment.name} />
                )}
              </div>
              <button type="button" className="story-nav story-previous" aria-label="Story trước" title="Story trước"
                disabled={activeStoryIndex === 0} onClick={previousStory}>‹</button>
              <button type="button" className="story-nav story-next" aria-label="Story tiếp theo" title="Story tiếp theo"
                onClick={nextStory}>›</button>
            </section>
          </div>
        )}

        {tab === 'profile' && (
          <div className="simple-view profile-view">
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

              <div className="profile-identity">
                <div className="profile-avatar-editor">
                  <UserAvatar name={name} className="profile-avatar" online />
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
                <div className="profile-identity-copy">
                  <strong>{profileMedia?.displayName || session.user.displayName || name}</strong>
                  <span>@{name}</span>
                  <small className="profile-email">{session.user.email}</small>
                  <small className="profile-media-hint">
                    {profileBusy === 'avatar' ? t('profile.avatarUpdating') : t('profile.avatarHint')}
                  </small>
                </div>
              </div>
            </section>

            <form className="profile-edit-card" onSubmit={saveProfileIdentity}>
              <div className="profile-edit-heading">
                <div>
                  <strong>{t('profile.personalInfo')}</strong>
                  <small>{t('profile.personalInfoHint')}</small>
                </div>
              </div>
              <label className="profile-edit-field">
                <span>{t('profile.displayName')}</span>
                <input
                  type="text"
                  value={profileDisplayNameDraft}
                  onChange={(event) => setProfileDisplayNameDraft(event.target.value)}
                  maxLength={100}
                  autoComplete="name"
                  placeholder={t('profile.displayNamePlaceholder')}
                  disabled={profileSaving}
                />
              </label>
              <label className="profile-edit-field">
                <span>{t('profile.username')}</span>
                <div className="profile-username-input">
                  <b aria-hidden="true">@</b>
                  <input
                    type="text"
                    value={profileUsernameDraft}
                    onChange={(event) => setProfileUsernameDraft(event.target.value.toLowerCase())}
                    minLength={3}
                    maxLength={32}
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    autoComplete="username"
                    placeholder="username"
                    disabled={profileSaving}
                  />
                </div>
                <small>{t('profile.usernameHint')}</small>
              </label>
              <button
                type="submit"
                className="profile-save-button"
                disabled={
                  profileSaving ||
                  !profileMedia ||
                  (
                    profileDisplayNameDraft.trim() === profileMedia.displayName &&
                    profileUsernameDraft.trim().toLowerCase() === profileMedia.username
                  )
                }
              >
                {profileSaving ? t('common.saving') : t('common.save')}
              </button>
            </form>

            <div className="soco-profile-section-label">TÙY CHỌN & CÀI ĐẶT</div>
            <section className="settings-card">
              <div className="settings-row">
                <div>
                  <strong>Quyền riêng tư tài khoản</strong>
                  <small>Kiểm soát ai có thể tìm, gửi lời mời và thấy bạn trực tuyến. Thiết lập lưu trên máy chủ.</small>
                </div>
              </div>
              {privacyLoading && <div className="settings-row" role="status">Đang tải quyền riêng tư...</div>}
              {privacyError && <div className="settings-row" role="alert">
                <span>{privacyError}</span>
                <button type="button" className="settings-action" onClick={() => setPrivacyRetry((n) => n + 1)}>Thử lại</button>
              </div>}
              {privacy && ([
                ['searchableByUsername', 'Cho phép tìm bằng username', 'Người khác có thể tìm @username của bạn.'],
                ['searchableByName', 'Cho phép tìm bằng tên', 'Tên hiển thị của bạn có thể xuất hiện trong kết quả.'],
                ['searchableByEmail', 'Cho phép tìm bằng email', 'Chỉ tìm bằng email khớp chính xác; địa chỉ email không được hiển thị.'],
                ['allowFriendRequests', 'Cho phép lời mời mới', 'Tắt để ngăn lời mời kết bạn mới từ người khác.'],
                ['showOnlineStatus', 'Hiển thị trạng thái online', 'Ẩn sự hiện diện trong danh sách và kết quả tìm kiếm.'],
              ] as const).map(([key, label, hint]) => (
                <div className="settings-row" key={key}>
                  <div><strong>{label}</strong><small>{hint}</small></div>
                  <button
                    type="button"
                    className={`switch-button ${privacy[key] ? 'on' : ''}`}
                    role="switch"
                    aria-label={label}
                    aria-checked={privacy[key]}
                    disabled={privacyBusy}
                    onClick={() => void changePrivacy(key)}
                  ><span /></button>
                </div>
              ))}
              <div className="settings-row">
                <div>
                  <strong>Thiết bị đã đăng nhập</strong>
                  <small>Kiểm tra và thu hồi những phiên đăng nhập không còn sử dụng.</small>
                </div>
                <button type="button" className="settings-action"
                  disabled={sessionsBusy || !session.refreshToken}
                  onClick={() => {
                    if (sessionsOpen) setSessionsOpen(false)
                    else void fetchAccountSessions()
                  }}>
                  {sessionsBusy ? 'Đang xử lý...' : sessionsOpen ? 'Thu gọn' : 'Xem thiết bị'}
                </button>
              </div>
              {sessionsError && <div className="settings-row" role="alert">
                <small>{sessionsError}</small>
                <button type="button" className="settings-action" disabled={sessionsBusy}
                  onClick={() => void fetchAccountSessions()}>Thử lại</button>
              </div>}
              {sessionsOpen && (
                <div className="account-sessions-panel">
                  <p>Thu hồi phiên sẽ ngăn gia hạn đăng nhập bằng refresh token. Access token đã phát hành có thể tiếp tục hoạt động đến khi hết hạn (tối đa 24 giờ).</p>
                  {managedSessions.length === 0 && <small>Không có phiên đang hoạt động.</small>}
                  {managedSessions.map((device) => (
                    <div className="account-session-item" key={device.id}>
                      <div className="account-session-details">
                        <strong>{device.current ? 'Thiết bị này' : device.userAgent || 'Trình duyệt khác'}</strong>
                        {device.current && <small>{device.userAgent || 'Trình duyệt hiện tại'}</small>}
                        <small>Hoạt động: {new Date(device.lastSeenAt).toLocaleString('vi-VN')}</small>
                      </div>
                      <button type="button" className="settings-action"
                        disabled={sessionsBusy}
                        onClick={() => void revokeAccountSessions(device.id)}>
                        {device.current ? 'Đăng xuất' : 'Thu hồi'}
                      </button>
                    </div>
                  ))}
                  {managedSessions.some((device) => !device.current) && (
                    <button type="button" className="settings-action account-revoke-others"
                      disabled={sessionsBusy} onClick={() => void revokeAccountSessions()}>
                      Đăng xuất tất cả thiết bị khác
                    </button>
                  )}
                </div>
              )}
              <div className="settings-row">
                <div><strong>Người dùng đã chặn</strong><small>Quản lý những tài khoản không thể nhắn tin hoặc kết bạn với bạn.</small></div>
                <button type="button" className="settings-action" disabled={blockedBusy}
                  onClick={() => blockedOpen ? setBlockedOpen(false) : void loadBlockedUsers()}>
                  {blockedBusy ? 'Đang tải...' : blockedOpen ? 'Thu gọn' : 'Xem danh sách'}
                </button>
              </div>
              {blockedError && <div className="settings-row" role="alert">
                <small>{blockedError}</small>
                <button type="button" className="settings-action" disabled={blockedBusy}
                  onClick={() => void loadBlockedUsers()}>Thử lại</button>
              </div>}
              {blockedOpen && (
                <div className="account-sessions-panel">
                  {blockedUsers.length === 0 && <p>Chưa chặn tài khoản nào.</p>}
                  {blockedUsers.map((item) => (
                    <div className="account-session-item" key={item.id}>
                      <div className="account-session-details">
                        <strong>{item.displayName || item.username}</strong>
                        <small>@{item.username}</small>
                      </div>
                      <button type="button" className="settings-action" disabled={blockedBusy}
                        onClick={() => void unblockContact(item.id)}>Bỏ chặn</button>
                    </div>
                  ))}
                </div>
              )}
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

      <CallManager
        request={apiFetch}
        apiBase={API}
        token={session.token}
        userId={session.user.id}
        sourceLanguage={effectiveAppLocale}
        targetLanguage={targetLanguage}
        conversations={conversations.map(({ id, name, type }) => ({ id, name, type }))}
      />

      <nav className="bottom-navigation" aria-label="Điều hướng chính">
        <button
          type="button"
          aria-label={t('nav.chat')}
          title={t('nav.chat')}
          className={tab === 'chat' ? 'active' : ''}
          onClick={() => switchTab('chat')}
        >
          <span className="nav-icon"><UiIcon name="chat" size={25} />{unreadTotal > 0 && <b>{unreadTotal > 99 ? '99+' : unreadTotal}</b>}</span>
        </button>
        <button
          type="button"
          aria-label={t('nav.contacts')}
          title={t('nav.contacts')}
          className={tab === 'contacts' ? 'active' : ''}
          onClick={() => switchTab('contacts')}
        >
          <span className="nav-icon"><UiIcon name="contacts" size={25} /></span>
        </button>
        <button
          type="button"
          aria-label={t('nav.discover')}
          title={t('nav.discover')}
          className={tab === 'discover' ? 'active' : ''}
          onClick={() => switchTab('discover')}
        >
          <span className="nav-icon"><UiIcon name="discover" size={25} /></span>
        </button>
        <button
          type="button"
          aria-label={t('nav.feed')}
          title={t('nav.feed')}
          className={tab === 'feed' ? 'active' : ''}
          onClick={() => switchTab('feed')}
        >
          <span className="nav-icon"><UiIcon name="wall" size={25} /></span>
        </button>
        <button
          type="button"
          aria-label={t('nav.profile')}
          title={t('nav.profile')}
          className={tab === 'profile' ? 'active' : ''}
          onClick={() => switchTab('profile')}
        >
          <span className="nav-icon"><UiIcon name="profile" size={25} />{!pushEnabled && <b>!</b>}</span>
        </button>
      </nav>
    </main>
  )
}
