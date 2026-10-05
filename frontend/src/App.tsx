import { FormEvent, lazy, Suspense, type SetStateAction, useEffect, useMemo, useRef, useState } from 'react'
import { FeedDiscussion, FeedText, type FeedComment, type DiscussionDraft } from './FeedDiscussion'
import type { NearbyUser } from './NearbyExplorer'
import GroupCreator from './GroupCreator'
import { Bell, Check, RefreshCw, UserCheck, UserPlus, X } from 'lucide-react'

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

type Session = {
  token: string
  user: User
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
  type: 'message' | 'message.updated' | 'conversation.created' | 'conversation.updated' | 'conversation.read' | 'friend.updated'
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

function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem('chatnet-session')
    const value = raw ? JSON.parse(raw) : null
    if (
      !value || typeof value.token !== 'string' || !value.token ||
      !Number.isSafeInteger(value.user?.id) || value.user.id <= 0 ||
      !['email', 'username', 'displayName'].every((key) => typeof value.user[key] === 'string')
    ) return null
    return value as Session
  } catch {
    return null
  }
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

function geolocationErrorMessage(error: unknown) {
  if (!window.isSecureContext) {
    return 'Không thể dùng định vị vì trang không chạy trong ngữ cảnh HTTPS an toàn. Mở lại ChatNet bằng https://chat.codelocal.cloud.'
  }

  const geoError = error as { code?: unknown; message?: unknown } | null
  const code = typeof geoError?.code === 'number' ? geoError.code : 0
  const browserMessage =
    typeof geoError?.message === 'string' && geoError.message.trim()
      ? geoError.message.trim().slice(0, 180)
      : ''

  const detail = browserMessage ? ` Chi tiết trình duyệt: ${browserMessage}` : ''

  if (code === 1) {
    return `Quyền vị trí bị từ chối (PERMISSION_DENIED · mã GPS 1). macOS có thể đã bật Location Services nhưng trình duyệt vẫn có thể chặn riêng chat.codelocal.cloud. Hãy mở quyền của trang → Location → Allow, rồi tải lại trang.${detail}`
  }
  if (code === 2) {
    return `Không xác định được vị trí hiện tại (POSITION_UNAVAILABLE · mã GPS 2). Hãy bật Wi‑Fi, kiểm tra Location Services và thử đứng ở nơi máy có thể xác định vị trí tốt hơn rồi quét lại.${detail}`
  }
  if (code === 3) {
    return `Lấy vị trí quá thời gian cho phép (TIMEOUT · mã GPS 3). Kết nối hoặc dịch vụ định vị đang phản hồi chậm. Hãy bật Wi‑Fi, chờ vài giây rồi Quét quanh đây lại.${detail}`
  }

  if (error instanceof Error && error.message) return error.message
  return `Không lấy được vị trí do lỗi không xác định.${detail || ' Hãy kiểm tra quyền Location của trình duyệt và thử lại.'}`
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
  sessionRef.current = session
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
  const [globalSearch, setGlobalSearch] = useState('')
  const [quickCreateOpen, setQuickCreateOpen] = useState(false)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeConversationId, setActiveConversationId] = useState<number | null>(null)
  const activeConversationIdRef = useRef<number | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [replyingTo, setReplyingTo] = useState<Message | null>(null)
  const [messageActionId, setMessageActionId] = useState<number | null>(null)
  const messageLongPressTimer = useRef<number | null>(null)
  const messageLongPressStart = useRef<{ x: number; y: number; messageId: number } | null>(null)
  const [groupSettingsOpen, setGroupSettingsOpen] = useState(false)
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([])
  const [groupNameDraft, setGroupNameDraft] = useState('')
  const [groupInviteDraft, setGroupInviteDraft] = useState('')
  const [groupBusy, setGroupBusy] = useState(false)
  // ponytail: drafts live in memory per conversation; add persistence only with an explicit retention policy.
  const [messageDrafts, setMessageDrafts] = useState<Record<number, MessageDraft>>({})
  const draft = messageDrafts[activeConversationId ?? 0] ?? emptyDraft
  const messageText = draft.text
  const messageAttachments = draft.attachments
  const [messageSending, setMessageSending] = useState(false)
  const sendingRef = useRef(false)
  const [newChatMode, setNewChatMode] = useState<NewChatMode>('none')
  const [friendQuery, setFriendQuery] = useState('')
  const [friendResults, setFriendResults] = useState<FriendSearchResult[]>([])
  const [friendSearching, setFriendSearching] = useState(false)
  const [friends, setFriends] = useState<FriendConnection[]>([])
  const [friendRequests, setFriendRequests] = useState<FriendConnection[]>([])
  const [friendActionBusy, setFriendActionBusy] = useState<number | null>(null)
  const friendActionRef = useRef(false)
  const friendSyncRequest = useRef(0)
  const [friendSyncToken, setFriendSyncToken] = useState('')
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
  const [activePostId, setActivePostId] = useState<number | null>(null)
  const [stories, setStories] = useState<Story[]>([])
  const [activeStoryId, setActiveStoryId] = useState<number | null>(null)
  const [storyBusy, setStoryBusy] = useState(false)
  const [commentEditors, setCommentEditors] = useState<Record<number, DiscussionDraft>>({})
  const [postText, setPostText] = useState('')
  const [postAttachments, setPostAttachments] = useState<MediaAttachment[]>([])
  const [mediaUploading, setMediaUploading] = useState<'chat' | 'feed' | 'story' | 'profile' | null>(null)
  const [profileMedia, setProfileMedia] = useState<ProfileMediaState | null>(null)
  const [profileBusy, setProfileBusy] = useState<'avatar' | 'cover' | null>(null)
  const [profileDisplayNameDraft, setProfileDisplayNameDraft] = useState('')
  const [profileUsernameDraft, setProfileUsernameDraft] = useState('')
  const [profileSaving, setProfileSaving] = useState(false)
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
  const [pushBusy, setPushBusy] = useState(false)
  const [pushInitFailed, setPushInitFailed] = useState(false)
  const [pushPrompt, setPushPrompt] = useState(false)
  const [pushPromptDismissed, setPushPromptDismissed] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const postComposerRef = useRef<HTMLTextAreaElement>(null)
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
  const activePost = activePostId ? posts.find((item) => item.id === activePostId) || null : null
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
      title: `Kết nối với @${session.user.username} trên ChatNet`,
      text: `Kết nối với ${session.user.displayName || '@' + session.user.username} trên ChatNet`,
      url,
    }
    try {
      if (typeof navigator.share === 'function') {
        await navigator.share(shareData)
        return
      }
      await navigator.clipboard.writeText(url)
      setNotice('Đã sao chép link hồ sơ ChatNet.', 'success')
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      setNotice('Không thể chia sẻ hồ sơ trên thiết bị này.', 'error')
    }
  }

  async function copyInviteLink() {
    if (!session?.user.username) return
    try {
      await navigator.clipboard.writeText(connectUrl(session.user.username))
      setNotice('Đã sao chép link kết nối ChatNet.', 'success')
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
      openConnectSurface(requestedUser)
    }

    params.delete('connect')
    params.delete('invite')
    const nextSearch = params.toString()
    window.history.replaceState({}, '', `${window.location.pathname}${nextSearch ? '?' + nextSearch : ''}${window.location.hash}`)
  }, [session?.token])

  useEffect(() => {
    activeConversationIdRef.current = activeConversationId
    cancelMessageLongPress()
    setMessageActionId(null)
    setMessages([])
    setReplyingTo(null)
    setGroupSettingsOpen(false)
    setGroupMembers([])
    setGroupInviteDraft('')
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
      setNotice('ChatNet đã được cài vào thiết bị')
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

  function authHeaders(extra?: HeadersInit) {
    const headers = new Headers(extra)
    if (session?.token) headers.set('Authorization', `Bearer ${session.token}`)
    return headers
  }

  async function apiFetch(path: string, init: RequestInit = {}) {
    const response = await fetch(`${API}${path}`, {
      ...init,
      headers: authHeaders(init.headers),
    })
    if (response.status === 401) logout()
    return response
  }

  async function loadProfileMedia() {
    if (!session?.token) return
    const token = session.token
    const response = await apiFetch('/api/profile')
    if (!response.ok || sessionRef.current?.token !== token) return
    const profile = await response.json() as ProfileMediaState
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
        token: result.token,
        user: {
          ...session.user,
          username: result.username,
          displayName: result.displayName,
        },
      }
      localStorage.setItem('chatnet-session', JSON.stringify(nextSession))
      setSession(nextSession)
      setNotice('Đã cập nhật tên và username.', 'success')
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Không cập nhật được thông tin cá nhân.', 'error')
    } finally {
      setProfileSaving(false)
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
      if (!response.ok || !result) {
        throw new Error(result?.error || 'Không cập nhật được ảnh hồ sơ.')
      }
      avatarRefreshVersions.set(result.username, result.updatedAt)
      setProfileMedia(result)
      setNotice(kind === 'avatar' ? 'Đã cập nhật ảnh đại diện.' : 'Đã cập nhật ảnh bìa.', 'success')
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Không cập nhật được ảnh hồ sơ.', 'error')
    } finally {
      setProfileBusy(null)
    }
  }

  useEffect(() => {
    if (!session?.token) {
      setProfileMedia(null)
      return
    }
    void loadProfileMedia()
  }, [session?.token])

  async function findNearby() {
    if (!session || nearbyBusy) return
    const request = ++nearbyRequest.current
    const token = session.token
    setNearbyBusy(true)
    setNearbyScanning(true)
    try {
      if (!navigator.geolocation) throw new Error('Trình duyệt không hỗ trợ định vị.')
      const position = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 30000,
        }),
      )
      if (request !== nearbyRequest.current || sessionRef.current?.token !== token) return
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
      if (request !== nearbyRequest.current || sessionRef.current?.token !== token) return
      if (!response.ok) throw new Error(response.status === 429 ? 'Chờ 10 giây trước khi tìm lại.' : 'Không tìm được bạn quanh đây. Thử lại sau.')
      const result = await response.json() as {
        users: FriendSearchResult[]
        expiresAt: string
        cacheExpiresAt?: string
        radiusKm?: number
      }
      if (request !== nearbyRequest.current || sessionRef.current?.token !== token) return
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
      setNotice(geolocationErrorMessage(error), 'error')
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

    setMediaUploading(scope)
    try {
      const result = new Array<MediaAttachment>(files.length)
      let nextIndex = 0
      const workerCount = Math.min(4, files.length)

      async function worker() {
        while (true) {
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
          })
          const ticket = (await presignResponse.json().catch(() => null)) as
            | (PresignedUpload & { error?: string })
            | null

          if (!presignResponse.ok || !ticket?.uploadUrl) {
            throw new Error(ticket?.error || 'Không cấp được quyền upload file. Hãy kiểm tra cấu hình S3.')
          }

          const put = await fetch(ticket.uploadUrl, {
            method: 'PUT',
            body: file,
            headers: { 'Content-Type': contentType },
            credentials: 'omit',
          })
          if (!put.ok) {
            throw new Error(`S3 từ chối upload ${file.name} (HTTP ${put.status}). Kiểm tra CORS/quyền bucket.`)
          }

          result[index] = {
            storageRef: ticket.storageRef,
            name: file.name,
            sizeBytes: file.size,
            contentType,
            kind: ticket.kind,
            url: ticket.downloadUrl,
          }
        }
      }

      const outcomes = await Promise.allSettled(Array.from({ length: workerCount }, () => worker()))
      const failed = outcomes.find((outcome) => outcome.status === 'rejected')
      if (failed?.status === 'rejected') throw failed.reason
      return result
    } finally {
      setMediaUploading(null)
    }
  }

  async function addChatFiles(files: File[]) {
    if (!files.length || mediaUploading || messageSending || !activeConversationId) return
    const conversationId = activeConversationId
    const token = session?.token
    const remaining = Math.max(0, 10 - messageAttachments.length)
    if (remaining === 0) {
      setNotice('Mỗi tin nhắn tối đa 10 file đính kèm.')
      return
    }
    const selected = files.slice(0, remaining)
    if (selected.length < files.length) setNotice('Mỗi tin nhắn tối đa 10 file đính kèm.')
    try {
      const uploaded = await uploadMediaFiles(selected, 'chat')
      if (sessionRef.current?.token !== token) return
      setMessageDrafts((current) => {
        const previous = current[conversationId] ?? emptyDraft
        return {
          ...current,
          [conversationId]: { ...previous, attachments: [...previous.attachments, ...uploaded].slice(0, 10) },
        }
      })
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Không upload được file')
    }
  }

  async function addFeedFiles(files: File[]) {
    if (!files.length) return
    const remaining = Math.max(0, 12 - postAttachments.length)
    if (remaining === 0) {
      setNotice('Mỗi bài viết tối đa 12 ảnh/video.')
      return
    }
    const selected = files.slice(0, remaining)
    if (selected.length < files.length) setNotice('Mỗi bài viết tối đa 12 ảnh/video.')
    try {
      const uploaded = await uploadMediaFiles(selected, 'feed')
      setPostAttachments((current) => [...current, ...uploaded].slice(0, 12))
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Không upload được media')
    }
  }

  async function createStory(file?: File) {
    if (!file || storyBusy || mediaUploading) return
    const token = session?.token
    setStoryBusy(true)
    try {
      const [attachment] = await uploadMediaFiles([file], 'story')
      if (sessionRef.current?.token !== token) return
      const response = await apiFetch('/api/stories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attachment }),
      })
      const result = await response.json().catch(() => null) as (Story & { error?: string }) | null
      if (!response.ok || !result) throw new Error(result?.error || 'Không đăng được Story')
      setStories((current) => [result, ...current])
      setActiveStoryId(result.id)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Không đăng được Story')
    } finally {
      setStoryBusy(false)
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
    setStoryBusy(true)
    try {
      const response = await apiFetch(`/api/stories/${story.id}`, { method: 'DELETE' })
      if (!response.ok) throw new Error('Không xóa được Story')
      setStories((current) => current.filter((item) => item.id !== story.id))
      setActiveStoryId(null)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Không xóa được Story')
    } finally {
      setStoryBusy(false)
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
        if (cancelled) return
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
  }, [session?.token])

  async function savePreferences(
    nextTarget: string,
    nextAuto: boolean,
    nextAppLocale: string,
  ) {
    if (!session?.token) return
    const preferenceKey = `chatnet-preferences:${session.user.id}`
    localStorage.setItem(
      preferenceKey,
      JSON.stringify({
        targetLanguage: nextTarget,
        autoTranslate: nextAuto,
        appLocale: nextAppLocale,
      }),
    )
    try {
      await apiFetch('/api/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetLanguage: nextTarget,
          autoTranslate: nextAuto,
          appLocale: nextAppLocale,
        }),
      })
    } catch {
      // Keep the UI responsive; the next successful save/read will reconcile server state.
    }
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

    const token = session.token
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
        if (cancelled || sessionRef.current?.token !== token || result.locale !== effectiveAppLocale) return
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
  }, [session?.token])

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
      setNotice('Trên iPhone: thêm ChatNet vào Màn hình chính trước, rồi mở app và bật thông báo.')
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
          'Thông báo đang bị chặn. Hãy mở cài đặt của trình duyệt/PWA → Notifications → Allow rồi quay lại ChatNet.',
        )
      } else if (state.permission === 'unsupported') {
        setNotice('Thiết bị hoặc trình duyệt này chưa hỗ trợ Web Push.')
      } else if (!pushEnabled && !state.optedIn) {
        setNotice(
          'Chưa bật được thông báo. Vui lòng thử lại và chọn Cho phép.',
        )
      } else if (state.optedIn) {
        setNotice('Đã bật thông báo ChatNet.')
      } else {
        setNotice('Đã tắt thông báo ChatNet')
      }
    } catch {
      setNotice('Không thể bật thông báo. Kiểm tra quyền Notification của trình duyệt/PWA rồi thử lại.')
    } finally {
      setPushBusy(false)
    }
  }

  async function refreshFriendConnections() {
    const token = session?.token
    if (!token) return
    const request = ++friendSyncRequest.current
    setFriendSyncBusy(true)
    try {
      const [friendsResponse, requestsResponse] = await Promise.all([
        apiFetch('/api/friends'),
        apiFetch('/api/friends/requests'),
      ])
      if (!friendsResponse.ok || !requestsResponse.ok) throw new Error('Friend sync failed')
      const [nextFriends, nextRequests] = await Promise.all([
        friendsResponse.json() as Promise<FriendConnection[]>,
        requestsResponse.json() as Promise<FriendConnection[]>,
      ])
      if (sessionRef.current?.token !== token || request !== friendSyncRequest.current) return
      setFriends(nextFriends)
      setFriendRequests(nextRequests)
      setFriendSyncToken(token)
      setFriendSyncError('')
    } catch {
      if (sessionRef.current?.token === token && request === friendSyncRequest.current) {
        setFriendSyncError('Chưa tải được trạng thái kết bạn.')
      }
    } finally {
      if (sessionRef.current?.token === token && request === friendSyncRequest.current) setFriendSyncBusy(false)
    }
  }

  function friendRelationship(userId: number) {
    if (friends.some((item) => item.id === userId)) return 'accepted' as const
    const request = friendRequests.find((item) => item.id === userId)
    if (request?.direction === 'incoming') return 'incoming' as const
    if (request?.direction === 'outgoing') return 'outgoing' as const
    return 'none' as const
  }

  async function actOnFriend(friend: FriendSearchResult | FriendConnection, decline = false) {
    const token = session?.token
    if (!token || friendActionRef.current || friend.id === session.user.id) return
    const relationship = friendRelationship(friend.id)
    if (decline && relationship !== 'incoming') return
    if (relationship === 'accepted') {
      if (friend.username) await openDirectByUsername(friend.username)
      return
    }

    friendActionRef.current = true
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
      if (sessionRef.current?.token !== token) return
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
      if (sessionRef.current?.token === token) {
        setNotice('Không cập nhật được lời mời kết bạn. Kiểm tra kết nối rồi thử lại.')
        await refreshFriendConnections()
      }
    } finally {
      friendActionRef.current = false
      setFriendActionBusy(null)
    }
  }

  async function declineFriendRequest(friend: FriendConnection) {
    await actOnFriend(friend, true)
  }

  useEffect(() => {
    if (!session?.token) {
      setFriends([])
      setFriendRequests([])
      setFriendSyncToken('')
      setFriendSyncError('')
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
      return
    }

    const controller = new AbortController()
    const query = friendQuery.trim()
    setFriendResults([])
    setFriendSearching(true)

    if (!query) {
      apiFetch('/api/users/suggestions', { signal: controller.signal })
        .then(async (response) => {
          if (!response.ok) return []
          return response.json() as Promise<FriendSearchResult[]>
        })
        .then((items) => {
          if (!controller.signal.aborted) setFriendResults(items)
        })
        .catch(() => {
          if (!controller.signal.aborted) setFriendResults([])
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
        if (!response.ok) {
          if (!controller.signal.aborted) setFriendResults([])
          return
        }
        const items = (await response.json()) as FriendSearchResult[]
        if (!controller.signal.aborted) setFriendResults(items)
      } catch {
        if (!controller.signal.aborted) setFriendResults([])
      } finally {
        if (!controller.signal.aborted) setFriendSearching(false)
      }
    }, 250)

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [friendQuery, newChatMode, session?.token, tab])

  async function refreshConversations() {
    try {
      const response = await apiFetch('/api/conversations')
      if (!response.ok) return
      const data = (await response.json()) as Conversation[]
      if (sessionRef.current?.token === session?.token) setConversations(data)
    } catch {
      setStatus('Đang kết nối lại...')
    }
  }

  async function refreshPosts() {
    try {
      const response = await apiFetch('/api/posts')
      if (!response.ok) return
      const data = (await response.json()) as Post[]
      if (sessionRef.current?.token === session?.token) setPosts(data)
    } catch {
      setStatus('Đang kết nối lại...')
    }
  }

  async function refreshStories() {
    try {
      const response = await apiFetch('/api/stories')
      if (!response.ok) return
      const data = (await response.json()) as Story[]
      if (sessionRef.current?.token === session?.token) {
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

      const next = result as Session
      localStorage.setItem('chatnet-session', JSON.stringify(next))
      setSession(next)
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

  function logout() {
    const currentToken = session?.token
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

    localStorage.removeItem('chatnet-session')
    resetRegistration()
    setAuthMode('login')
    setSession(null)
    setConversations([])
    setActiveConversationId(null)
    setMessages([])
    setMessageDrafts({})
    setFriends([])
    setFriendRequests([])
    setPostText('')
    setPosts([])
    setStories([])
    setActiveStoryId(null)
    setCommentEditors({})
    setPostAttachments([])
    setTranslations({})
  }

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
    }
    events.onerror = () => setStatus('Đang kết nối lại...')
    events.addEventListener('update', (event) => {
      const update = JSON.parse((event as MessageEvent).data) as RealtimeEvent
      if (update.type === 'friend.updated') {
        void refreshFriendConnections()
        return
      }

      if (update.type === 'conversation.created' || update.type === 'conversation.updated') {
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
              return { ...message, readByUserIds: [...readers, update.readerId as number] }
            }),
          )
        }
        return
      }

      if (update.type === 'message.updated' && update.message) {
        const changed = update.message
        if (activeConversationIdRef.current === update.conversationId) {
          setMessages((current) =>
            current.map((item) => {
              if (item.id !== changed.id) return item
              const mineByEmoji = new Map(
                (item.reactions || []).map((reaction) => [reaction.emoji, reaction.mine]),
              )
              return {
                ...changed,
                reactions: (changed.reactions || []).map((reaction) => ({
                  ...reaction,
                  mine: mineByEmoji.get(reaction.emoji) ?? false,
                })),
              }
            }),
          )
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
                    incoming.senderId !== session.user.id && currentId !== item.id
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
          void apiFetch(`/api/conversations/${update.conversationId}/read`, { method: 'POST' })
        }
      }
    })

    const refreshTimer = window.setInterval(() => {
      void refreshConversations()
      void refreshFriendConnections()
    }, 20000)
    return () => {
      events.close()
      window.clearInterval(refreshTimer)
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
    setTranslations({})
    apiFetch(
      `/api/conversations/${activeConversationId}/messages?target=${encodeURIComponent(targetLanguage)}`,
    )
      .then(async (response) => {
        if (!response.ok) throw new Error('Không tải được tin nhắn')
        const data = (await response.json()) as Message[]
        if (cancelled) return

        setMessages(data)
        const restored: Record<number, string> = {}
        for (const message of data) {
          if (
            message.translatedText &&
            message.translationLanguage === targetLanguage
          ) {
            restored[message.id] = message.translatedText
          }
        }
        setTranslations(restored)
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
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

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
    if (!normalized) return

    try {
      const response = await apiFetch('/api/conversations/direct', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: normalized }),
      })
      const result = await response.json()
      if (!response.ok) {
        setNotice(result.error || 'Không thể mở cuộc trò chuyện')
        return
      }

      if (sessionRef.current?.token !== session?.token) return
      const created = result as Conversation
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
      setNotice('Không mở được cuộc trò chuyện. Kiểm tra kết nối rồi thử lại.')
    }
  }

  async function createDirect(event: FormEvent) {
    event.preventDefault()
    await openDirectByUsername(directUsername)
  }

  async function createGroup(name: string, usernames: string[]) {
    setChatCreateError('')
    const token = session?.token
    try {
      const response = await apiFetch('/api/conversations/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, usernames }),
      })
      const result = await response.json()
      if (sessionRef.current?.token !== token) return
      if (!response.ok) {
        setChatCreateError(result.error || 'Không thể tạo nhóm')
        return
      }
      const created = result as Conversation
      setConversations((current) => [created, ...current.filter((item) => item.id !== created.id)])
      setActiveConversationId(created.id)
      setTab('chat')
      setFriendQuery('')
      setNewChatMode('none')
      void refreshConversations()
    } catch {
      if (sessionRef.current?.token === token) setChatCreateError('Không thể tạo nhóm. Kiểm tra kết nối rồi thử lại.')
    }
  }

  async function sendMessage(event: FormEvent) {
    event.preventDefault()
    if (!canSend || !activeConversationId || sendingRef.current) return

    const conversationId = activeConversationId
    const submittedDraft = draft
    const text = messageText.trim()
    const attachments = messageAttachments
    sendingRef.current = true
    setMessageSending(true)
    try {
      const response = await apiFetch(`/api/conversations/${conversationId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          attachments,
          ...(replyingTo ? { replyToMessageId: replyingTo.id } : {}),
        }),
      })
      if (!response.ok) {
        const result = await response.json().catch(() => null) as { error?: string } | null
        setNotice(result?.error || 'Gửi tin nhắn thất bại')
        return
      }
      setMessageDrafts((current) => {
        if (current[conversationId] !== submittedDraft) return current
        const next = { ...current }
        delete next[conversationId]
        return next
      })
      setReplyingTo(null)
    } catch {
      setNotice('Chưa xác nhận được tin đã gửi. Bản nháp được giữ lại; kiểm tra hội thoại trước khi gửi lại.')
    } finally {
      sendingRef.current = false
      setMessageSending(false)
    }
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
    if (!activeConversationId || !groupNameDraft.trim()) return
    setGroupBusy(true)
    try {
      const response = await apiFetch(`/api/conversations/${activeConversationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: groupNameDraft.trim() }),
      })
      const result = await response.json().catch(() => null) as { error?: string } | null
      if (!response.ok) {
        setNotice(result?.error || 'Không đổi được tên nhóm')
        return
      }
      setNotice('Đã cập nhật tên nhóm.')
      await refreshConversations()
    } finally {
      setGroupBusy(false)
    }
  }

  async function inviteGroupMembers() {
    if (!activeConversationId) return
    const usernames = groupInviteDraft
      .split(/[\s,;]+/)
      .map((item) => item.trim())
      .filter(Boolean)
    if (usernames.length === 0) return

    setGroupBusy(true)
    try {
      const response = await apiFetch(`/api/conversations/${activeConversationId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usernames }),
      })
      const result = await response.json().catch(() => null) as { error?: string } | null
      if (!response.ok) {
        setNotice(result?.error || 'Không thêm được thành viên')
        return
      }
      setGroupInviteDraft('')
      setNotice('Đã thêm thành viên vào nhóm.')
      await Promise.all([refreshGroupMembers(activeConversationId), refreshConversations()])
    } finally {
      setGroupBusy(false)
    }
  }

  async function changeGroupMemberRole(member: GroupMember, role: GroupMember['role']) {
    if (!activeConversationId) return
    const message = role === 'owner'
      ? `Chuyển quyền chủ nhóm cho @${member.username}?`
      : role === 'admin'
        ? `Đặt @${member.username} làm quản trị viên?`
        : `Gỡ quyền quản trị của @${member.username}?`
    if (!window.confirm(message)) return

    setGroupBusy(true)
    try {
      const response = await apiFetch(`/api/conversations/${activeConversationId}/members/${member.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      })
      const result = await response.json().catch(() => null) as { error?: string } | null
      if (!response.ok) {
        setNotice(result?.error || 'Không cập nhật được quyền thành viên')
        return
      }
      setNotice(role === 'owner' ? 'Đã chuyển quyền chủ nhóm.' : 'Đã cập nhật quyền thành viên.')
      await refreshGroupMembers(activeConversationId)
    } finally {
      setGroupBusy(false)
    }
  }

  async function removeGroupMember(member: GroupMember) {
    if (!activeConversationId) return
    const self = member.id === session?.user.id
    if (!window.confirm(self ? 'Rời khỏi nhóm này?' : `Xóa @${member.username} khỏi nhóm?`)) return

    setGroupBusy(true)
    try {
      const response = await apiFetch(`/api/conversations/${activeConversationId}/members/${member.id}`, {
        method: 'DELETE',
      })
      const result = await response.json().catch(() => null) as { error?: string } | null
      if (!response.ok) {
        setNotice(result?.error || (self ? 'Không rời được nhóm' : 'Không xóa được thành viên'))
        return
      }
      if (self) {
        setGroupSettingsOpen(false)
        setActiveConversationId(null)
        setNotice('Bạn đã rời nhóm.')
        await refreshConversations()
        return
      }
      setNotice(`Đã xóa @${member.username} khỏi nhóm.`)
      await Promise.all([refreshGroupMembers(activeConversationId), refreshConversations()])
    } finally {
      setGroupBusy(false)
    }
  }

  async function editOwnMessage(message: Message) {
    if (message.deleted || message.senderId !== session?.user.id) return
    const next = window.prompt('Sửa tin nhắn', message.text)
    if (next === null || next.trim() === message.text.trim()) return
    if (!next.trim()) {
      setNotice('Tin nhắn sau khi sửa không được để trống.')
      return
    }

    const response = await apiFetch(`/api/messages/${message.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: next.trim() }),
    })
    const result = await response.json().catch(() => null) as Message | { error?: string } | null
    if (!response.ok) {
      setNotice((result as { error?: string } | null)?.error || 'Không sửa được tin nhắn')
      return
    }
    const updated = result as Message
    setMessages((current) => current.map((item) => (item.id === updated.id ? updated : item)))
    setTranslations((current) => {
      const nextTranslations = { ...current }
      delete nextTranslations[message.id]
      return nextTranslations
    })
  }

  async function recallOwnMessage(message: Message) {
    if (message.deleted || message.senderId !== session?.user.id) return
    if (!window.confirm('Thu hồi tin nhắn này?')) return

    const response = await apiFetch(`/api/messages/${message.id}`, { method: 'DELETE' })
    const result = await response.json().catch(() => null) as Message | { error?: string } | null
    if (!response.ok) {
      setNotice((result as { error?: string } | null)?.error || 'Không thu hồi được tin nhắn')
      return
    }
    const updated = result as Message
    setMessages((current) => current.map((item) => (item.id === updated.id ? updated : item)))
    setTranslations((current) => {
      const next = { ...current }
      delete next[message.id]
      return next
    })
    if (replyingTo?.id === message.id) setReplyingTo(null)
  }

  async function toggleReaction(message: Message, emoji: string) {
    if (message.deleted) return
    const response = await apiFetch(`/api/messages/${message.id}/reactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emoji }),
    })
    const result = await response.json().catch(() => null) as Message | { error?: string } | null
    if (!response.ok) {
      setNotice((result as { error?: string } | null)?.error || 'Không thả cảm xúc được')
      return
    }
    const updated = result as Message
    setMessages((current) => current.map((item) => (item.id === updated.id ? updated : item)))
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
    const result = await response.json()
    if (!response.ok) {
      setNotice(result.error || 'AI dịch thất bại')
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
    if (mediaUploading || (!postText.trim() && postAttachments.length === 0)) return

    const content = postText.trim()
    const attachments = postAttachments
    const response = await apiFetch('/api/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, attachments }),
    })
    if (!response.ok) {
      const result = await response.json().catch(() => null) as { error?: string } | null
      setNotice(result?.error || 'Không đăng được bài viết')
      return
    }
    const post = (await response.json()) as Post
    setPosts((current) => [post, ...current])
    setPostText('')
    setPostAttachments([])
  }

  async function like(post: Post) {
    const response = await apiFetch(`/api/posts/${post.id}/like`, { method: 'POST' })
    if (!response.ok) return
    const updated = (await response.json()) as Post
    setPosts((current) => current.map((item) => (item.id === updated.id ? updated : item)))
  }

  async function addComment(post: Post, content: string, parentId?: number) {
    const token = session?.token
    let response: Response
    try {
      response = await apiFetch(`/api/posts/${post.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, parentId }),
      })
    } catch {
      throw new Error('Chưa xác nhận được bình luận đã gửi. Bản nháp được giữ lại; kiểm tra bài viết trước khi gửi lại.')
    }
    if (!response.ok) throw new Error('Không gửi được bình luận. Bản nháp được giữ lại.')
    const updated = (await response.json()) as Post
    if (sessionRef.current?.token !== token) return
    setPosts((current) => current.map((item) => (item.id === updated.id ? updated : item)))
  }

  if (!session) {
    return (
      <main className="auth-screen">
        <section className="auth-copy">
          <img src="/icon.svg" width="52" height="52" alt="" />
          <h1>ChatNet</h1>
          <p>Kết nối không biên giới</p>
        </section>

        {registerStep === 'otp' ? (
          <form className="auth-card otp-card" onSubmit={verifyOTP}>
            <div className="otp-icon">✉️</div>
            <h2>Kiểm tra email của bạn</h2>
            <p className="auth-hint">
              ChatNet đã gửi mã xác minh 6 số tới <strong>{verificationEmail || 'email của bạn'}</strong>.
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
              {authLoading ? 'Đang xác minh...' : 'Xác minh & vào ChatNet'}
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
  const searchedPosts = posts.filter((post) => {
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
      {newChatMode === 'group' && <GroupCreator ownerId={session.user.id}
        friends={friends.filter((friend) => friend.status === 'accepted')} results={friendResults}
        searching={friendSearching} query={friendQuery} onQuery={setFriendQuery} onCreate={createGroup}
        error={chatCreateError} onClose={() => { setNewChatMode('none'); setFriendQuery(''); setChatCreateError('') }} />}
      {tab !== 'profile' && tab !== 'discover' && (
      <header className="chatnet-appbar">
        <div className="appbar-brand"><img src="/icon.svg" width="32" height="32" alt="" /><strong>ChatNet</strong></div>
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
              <button
                className="appbar-icon-button"
                type="button"
                aria-label="Tạo mới"
                onClick={() => setQuickCreateOpen((current) => !current)}
              >
                <UiIcon name="plus" size={31} />
              </button>
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

      <section className={`phone-frame modern-frame ${tab === 'chat' && activeConversation ? 'mobile-conversation-open' : ''}`}>
        {tab === 'chat' && (
          <div className={`messenger-layout modern-messenger ${activeConversation ? 'has-active' : ''}`}>
            <aside className="conversation-sidebar">
              {quickCreateOpen && (
                <div className="quick-create-menu">
                  <button type="button" onClick={() => openConnectSurface()}>
                    <span>⌕</span><div><strong>Tìm & kết nối</strong><small>Tên, username, email hoặc link mời</small></div>
                  </button>
                  <button type="button" onClick={() => { setNewChatMode('direct'); setQuickCreateOpen(false) }}>
                    <span>＋</span><div><strong>Chat riêng</strong><small>Bắt đầu cuộc trò chuyện 1-1</small></div>
                  </button>
                  <button type="button" onClick={() => { setFriendQuery(''); setChatCreateError(''); setNewChatMode('group'); setQuickCreateOpen(false) }}>
                    <span>👥</span><div><strong>Tạo nhóm</strong><small>Nhắn tin với nhiều người</small></div>
                  </button>
                </div>
              )}

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
                        <small>Tìm bạn bè trên ChatNet</small>
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
                      {!friendSearching && friendQuery.trim() && friendResults.length === 0 && (
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
                                ? 'Đã gửi'
                                : 'Kết bạn'
                        return (
                          <button
                            type="button"
                            className="friend-result connect-result"
                            key={friend.id}
                            onClick={() => void actOnFriend(friend)}
                            disabled={friendActionBusy === friend.id}
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
                    {normalizedSearch ? 'Không tìm thấy cuộc trò chuyện phù hợp.' : 'Chưa có cuộc trò chuyện.'}
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
              </div>
            </aside>

            <section className="conversation-panel">
              {!activeConversation ? (
                <div className="conversation-empty">
                  <div className="empty-icon"><UiIcon name="chat" size={36} /></div>
                  <h2>Chọn một cuộc trò chuyện</h2>
                  <p>Chat riêng, chat nhóm và tự động dịch AI ngay trong cùng một luồng.</p>
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

                    <div className="translate-controls">
                      {activeConversation.type === 'group' && (
                        <button
                          type="button"
                          className={groupSettingsOpen ? 'group-settings-toggle active' : 'group-settings-toggle'}
                          onClick={() => {
                            const next = !groupSettingsOpen
                            setGroupSettingsOpen(next)
                            if (next) {
                              setGroupNameDraft(activeConversation.name)
                              void refreshGroupMembers(activeConversation.id)
                            }
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

                  {chatFriend && (
                    <div className={`chat-friend-bar relationship-${chatFriendRelationship}`} aria-label="Kết bạn trong cuộc trò chuyện">
                      <span role="status">
                        {chatFriendRelationship === 'accepted' ? <UserCheck size={18} aria-hidden="true" /> : <UserPlus size={18} aria-hidden="true" />}
                        {friendSyncError || (friendSyncToken !== session?.token ? 'Đang tải trạng thái kết bạn...' :
                          chatFriendRelationship === 'accepted' ? 'Hai bạn đã là bạn bè' :
                          chatFriendRelationship === 'incoming' ? 'Bạn nhận được lời mời kết bạn' :
                          chatFriendRelationship === 'outgoing' ? 'Đã gửi lời mời kết bạn' : 'Hai bạn chưa kết bạn')}
                      </span>
                      {friendSyncError ? (
                        <button type="button" disabled={friendSyncBusy} onClick={() => void refreshFriendConnections()}>
                          <RefreshCw size={16} aria-hidden="true" /> Thử lại
                        </button>
                      ) : friendSyncToken === session?.token && chatFriendRelationship !== 'accepted' && (
                        <div className="chat-friend-actions">
                          <button
                            type="button"
                            className={chatFriendRelationship === 'outgoing' ? '' : 'primary'}
                            disabled={friendActionBusy !== null}
                            onClick={() => void actOnFriend(chatFriend)}
                          >
                            {chatFriendRelationship === 'incoming' ? <Check size={16} aria-hidden="true" /> :
                              chatFriendRelationship === 'outgoing' ? <X size={16} aria-hidden="true" /> : <UserPlus size={16} aria-hidden="true" />}
                            {chatFriendRelationship === 'incoming' ? 'Chấp nhận' : chatFriendRelationship === 'outgoing' ? 'Hủy lời mời' : 'Gửi lời mời kết bạn'}
                          </button>
                          {chatFriendRelationship === 'incoming' && (
                            <button type="button" disabled={friendActionBusy !== null} onClick={() => void actOnFriend(chatFriend, true)}>
                              <X size={16} aria-hidden="true" /> Từ chối
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {groupSettingsOpen && activeConversation.type === 'group' && (
                    <section className="group-settings-panel" aria-label="Quản lý nhóm">
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
                        <button type="button" onClick={() => setGroupSettingsOpen(false)} aria-label="Đóng quản lý nhóm">×</button>
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
                          <div className="group-tool-row">
                            <input
                              value={groupInviteDraft}
                              onChange={(event) => setGroupInviteDraft(event.target.value)}
                              placeholder="Username cần thêm, cách nhau bằng dấu phẩy"
                            />
                            <button
                              type="button"
                              onClick={() => void inviteGroupMembers()}
                              disabled={groupBusy || !groupInviteDraft.trim()}
                            >
                              Thêm
                            </button>
                          </div>
                        </div>
                      )}

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

                  <div className="messages">
                    <div className="day-divider"><span>Cuộc trò chuyện</span></div>
                    {messages.map((message) => {
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
                    <input
                      aria-label="Tin nhắn"
                      disabled={messageSending}
                      placeholder={mediaUploading === 'chat' ? 'Đang tải file lên...' : activeConversation.type === 'group' ? `Nhắn vào ${activeConversation.name}...` : `Nhắn ${activeConversation.name}...`}
                      value={messageText}
                      onChange={(event) => setMessageText(event.target.value)}
                      maxLength={4000}
                    />
                    <button className="send-button polished-send" disabled={!canSend} aria-label="Gửi tin nhắn">
                      {mediaUploading === 'chat' ? <span className="send-loading">•••</span> : <><span className="send-label">Gửi</span><UiIcon name="send" size={19} /></>}
                    </button>
                  </form>
                </>
              )}
            </section>
          </div>
        )}

        {tab === 'contacts' && (
          <div className="simple-view contacts-view">
            <div className="simple-view-title"><strong>Danh bạ</strong><small>{status}</small></div>
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
                      <button type="button" onClick={() => void actOnFriend(friend)} disabled={friendActionBusy === friend.id}>Chấp nhận</button>
                      <button type="button" className="secondary" onClick={() => void declineFriendRequest(friend)} disabled={friendActionBusy === friend.id}>Từ chối</button>
                    </div>
                  </div>
                ))}
              </section>
            )}

            <section className="contacts-suggestions">
              <div className="contacts-heading">Bạn bè ({friends.length})</div>
              {friends.length === 0 && (
                <div className="friend-search-state">Chưa có bạn bè. Hãy gửi một lời mời kết bạn.</div>
              )}
              {friends.map((friend) => (
                <button
                  type="button"
                  className="friend-result contact-result"
                  key={friend.id}
                  onClick={() => void openDirectByUsername(friend.username)}
                >
                  <UserAvatar name={friend.username} className="friend-avatar" online={friend.online} />
                  <div className="friend-result-copy">
                    <strong>@{friend.username}</strong>
                    <span>{friend.online ? 'Đang hoạt động' : 'Ngoại tuyến'}</span>
                  </div>
                  <div className="friend-result-action"><small>Nhắn tin</small><span>›</span></div>
                </button>
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
                    disabled={friendActionBusy === friend.id}
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
                  disabled={friendActionBusy === friend.id}
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
                    onRemove={(index) => setPostAttachments((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                  />
                </div>
              )}
              <div className="composer-shortcuts">
                <button type="button" disabled={mediaUploading === 'feed'} onClick={() => feedImageInputRef.current?.click()}><UiIcon name="photo" size={20} />Ảnh</button>
                <button type="button" disabled={mediaUploading === 'feed'} onClick={() => feedVideoInputRef.current?.click()}><UiIcon name="video" size={20} />Video</button>
                <button type="button" disabled={mediaUploading === 'feed'} onClick={() => feedAlbumInputRef.current?.click()}><UiIcon name="album" size={20} />Album</button>
                <button type="button" onClick={() => postComposerRef.current?.focus()}><UiIcon name="text" size={20} />Nền chữ</button>
              </div>
              {mediaUploading === 'feed' && <div className="media-uploading-note">Đang tải media thẳng lên kho lưu trữ…</div>}
              {(postText.trim() || postAttachments.length > 0) && (
                <button className="feed-submit" disabled={mediaUploading === 'feed'}>Đăng</button>
              )}
            </form>

            <div className="feed zalo-feed">
              {searchedPosts.map((post) => (
                <article className="post zalo-post" key={post.id}>
                  <UserAvatar name={post.author} className="avatar" />
                  <div className="post-body">
                    <div className="post-author">
                      <div><strong>{post.author}</strong><small>{new Date(post.createdAt).toLocaleString('vi-VN')}</small></div>
                      <button type="button" className="post-more" aria-label="Thêm">•••</button>
                    </div>
                    {post.content && (
                      <FeedText
                        api={API}
                        token={session.token}
                        target={translationPreferencesLoaded ? targetLanguage : ''}
                        text={post.content}
                        maxLines={5}
                        onExpand={() => setActivePostId(post.id)}
                      />
                    )}
                    <div className="feed-media-preview" onClick={() => setActivePostId(post.id)}>
                      <MediaAttachmentsView items={post.attachments} />
                    </div>
                    <div className="post-toolbar">
                      <button type="button" className={post.liked ? 'liked' : ''} onClick={() => like(post)}>
                        <UiIcon name="heart" size={21} /><span>Thích</span>{post.likes > 0 && <b>{post.likes}</b>}
                      </button>
                      <button type="button" className="post-stat post-detail-trigger" onClick={() => setActivePostId(post.id)}>
                        <UiIcon name="comment" size={21} />
                        <span>{post.comments?.length ? `${post.comments.length} bình luận` : 'Xem chi tiết'}</span>
                      </button>
                    </div>
                  </div>
                </article>
              ))}
              {searchedPosts.length === 0 && <div className="feed-empty">Chưa có bài viết phù hợp.</div>}
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
                      <button type="button" className={activePost.liked ? 'liked' : ''} onClick={() => like(activePost)}>
                        <UiIcon name="heart" size={21} /><span>Thích</span>{activePost.likes > 0 && <b>{activePost.likes}</b>}
                      </button>
                      <span className="post-stat"><UiIcon name="comment" size={21} />{activePost.comments?.length || 0} bình luận</span>
                    </div>
                    <FeedDiscussion
                      comments={activePost.comments || []}
                      editor={commentEditors[activePost.id] || { replyTo: null, drafts: {} }}
                      updateEditor={(editor) => {
                        if (sessionRef.current?.token === session.token) {
                          setCommentEditors((current) => ({ ...current, [activePost.id]: editor }))
                        }
                      }}
                      api={API}
                      token={session.token}
                      target={translationPreferencesLoaded ? targetLanguage : ''}
                      submit={(content, parentId) => addComment(activePost, content, parentId)}
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
                  <strong>ChatNet</strong>
                  <small>{t('profile.tagline')}</small>
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

            <section className="settings-card">
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

            <section className="profile-actions">
              {!isStandalone && <button type="button" onClick={() => void installApp()}>{t('profile.install')}</button>}
              <button type="button" className="danger-action" onClick={logout}>{t('profile.logout')}</button>
            </section>
          </div>
        )}
      </section>

      <nav className="bottom-navigation" aria-label="Điều hướng chính">
        <button type="button" className={tab === 'chat' ? 'active' : ''} onClick={() => switchTab('chat')}>
          <span className="nav-icon"><UiIcon name="chat" size={25} />{unreadTotal > 0 && <b>{unreadTotal > 99 ? '99+' : unreadTotal}</b>}</span>
          <span>{t('nav.chat')}</span>
        </button>
        <button type="button" className={tab === 'contacts' ? 'active' : ''} onClick={() => switchTab('contacts')}>
          <span className="nav-icon"><UiIcon name="contacts" size={25} /></span>
          <span>{t('nav.contacts')}</span>
        </button>
        <button type="button" className={tab === 'discover' ? 'active' : ''} onClick={() => switchTab('discover')}>
          <span className="nav-icon"><UiIcon name="discover" size={25} /></span>
          <span>{t('nav.discover')}</span>
        </button>
        <button type="button" className={tab === 'feed' ? 'active' : ''} onClick={() => switchTab('feed')}>
          <span className="nav-icon"><UiIcon name="wall" size={25} /></span>
          <span>{t('nav.feed')}</span>
        </button>
        <button type="button" className={tab === 'profile' ? 'active' : ''} onClick={() => switchTab('profile')}>
          <span className="nav-icon"><UiIcon name="profile" size={25} />{!pushEnabled && <b>!</b>}</span>
          <span>{t('nav.profile')}</span>
        </button>
      </nav>
    </main>
  )
}
