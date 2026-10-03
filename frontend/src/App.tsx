import { FormEvent, type SetStateAction, useEffect, useMemo, useRef, useState } from 'react'
import { FeedDiscussion, FeedText, type FeedComment, type DiscussionDraft } from './FeedDiscussion'
import {
  disableOneSignalPush,
  enableOneSignalPush,
  getOneSignalPushState,
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

type Message = {
  id: number
  conversationId: number
  senderId: number
  sender: string
  text: string
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
  type: 'message' | 'conversation.created'
  conversationId: number
  message?: Message
  conversation?: Conversation
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
  mutualGroups?: number
  reason?: string
}

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const languages = [
  { value: 'en', label: 'English' },
  { value: 'vi', label: 'Tiếng Việt' },
  { value: 'ja', label: '日本語' },
  { value: 'ko', label: '한국어' },
  { value: 'zh', label: '中文' },
  { value: 'th', label: 'ไทย' },
  { value: 'fr', label: 'Français' },
]

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
  return (
    <div
      className={`${className} smart-avatar avatar-tone-${avatarTone(name)} ${group ? 'group' : ''}`}
      aria-label={name}
      title={name}
    >
      <span className="avatar-initials">{group ? '👥' : avatarInitials(name)}</span>
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
              <img src={item.url} alt={item.name} loading="lazy" />
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
  const [directUsername, setDirectUsername] = useState('')
  const [groupName, setGroupName] = useState('')
  const [groupUsers, setGroupUsers] = useState('')
  const [chatCreateError, setChatCreateError] = useState('')
  const [nearbyUsers, setNearbyUsers] = useState<FriendSearchResult[]>([])
  const [nearbyBusy, setNearbyBusy] = useState(false)
  const [nearbyUntil, setNearbyUntil] = useState(0)
  const [nearbyError, setNearbyError] = useState('')
  const nearbyRequest = useRef(0)

  const [posts, setPosts] = useState<Post[]>([])
  const [stories, setStories] = useState<Story[]>([])
  const [activeStoryId, setActiveStoryId] = useState<number | null>(null)
  const [storyBusy, setStoryBusy] = useState(false)
  const [commentEditors, setCommentEditors] = useState<Record<number, DiscussionDraft>>({})
  const [postText, setPostText] = useState('')
  const [postAttachments, setPostAttachments] = useState<MediaAttachment[]>([])
  const [mediaUploading, setMediaUploading] = useState<'chat' | 'feed' | 'story' | null>(null)
  const [translations, setTranslations] = useState<Record<number, string>>({})
  const [targetLanguage, setTargetLanguage] = useState('en')
  const [autoTranslate, setAutoTranslate] = useState(true)
  const [translationPreferencesLoaded, setTranslationPreferencesLoaded] = useState(false)
  const [status, setStatus] = useState('Đang kết nối...')
  const [notice, setNotice] = useState('')
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null)
  const [isStandalone, setIsStandalone] = useState(false)
  const [pushConfigured, setPushConfigured] = useState(false)
  const [pushAppId, setPushAppId] = useState('')
  const [pushEnabled, setPushEnabled] = useState(false)
  const [pushBusy, setPushBusy] = useState(false)
  const [pushInitFailed, setPushInitFailed] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const postComposerRef = useRef<HTMLTextAreaElement>(null)
  const chatFileInputRef = useRef<HTMLInputElement>(null)
  const feedImageInputRef = useRef<HTMLInputElement>(null)
  const feedVideoInputRef = useRef<HTMLInputElement>(null)
  const feedAlbumInputRef = useRef<HTMLInputElement>(null)
  const storyFileInputRef = useRef<HTMLInputElement>(null)

  const name = session?.user.username || ''
  const activeConversation = conversations.find((item) => item.id === activeConversationId) || null
  const activeStoryIndex = stories.findIndex((item) => item.id === activeStoryId)
  const activeStory = activeStoryIndex < 0 ? null : stories[activeStoryIndex]

  useEffect(() => {
    activeConversationIdRef.current = activeConversationId
    setMessages([])
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

  async function findNearby() {
    if (!session || nearbyBusy) return
    const request = ++nearbyRequest.current
    const token = session.token
    setNearbyBusy(true)
    setNearbyError('')
    try {
      if (!navigator.geolocation) throw new Error('Trình duyệt không hỗ trợ định vị.')
      const position = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 15000, maximumAge: 60000 }),
      )
      if (request !== nearbyRequest.current || sessionRef.current?.token !== token) return
      const response = await apiFetch('/api/users/nearby', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ latitude: position.coords.latitude, longitude: position.coords.longitude }),
      })
      if (request !== nearbyRequest.current || sessionRef.current?.token !== token) return
      if (!response.ok) throw new Error(response.status === 429 ? 'Chờ 10 giây trước khi tìm lại.' : 'Không tìm được bạn quanh đây. Thử lại sau.')
      const result = await response.json() as { users: FriendSearchResult[]; expiresAt: string }
      if (request !== nearbyRequest.current || sessionRef.current?.token !== token) return
      setNearbyUsers(result.users)
      setNearbyUntil(Date.parse(result.expiresAt))
    } catch (error) {
      if (request !== nearbyRequest.current) return
      setNearbyError(error instanceof Error ? error.message : 'Không lấy được vị trí. Kiểm tra quyền định vị rồi thử lại.')
    } finally {
      if (request === nearbyRequest.current) setNearbyBusy(false)
    }
  }

  async function stopNearby() {
    if (!session || nearbyBusy) return
    const request = ++nearbyRequest.current
    setNearbyBusy(true)
    setNearbyError('')
    try {
      const response = await apiFetch('/api/users/nearby', { method: 'DELETE' })
      if (request !== nearbyRequest.current) return
      if (!response.ok) throw new Error('Chưa tắt được Quanh đây. Thử lại sau.')
      setNearbyUntil(0)
      setNearbyUsers([])
    } catch (error) {
      if (request !== nearbyRequest.current) return
      setNearbyError(error instanceof Error ? error.message : 'Mất kết nối. Chưa xác nhận đã tắt Quanh đây.')
    } finally {
      if (request === nearbyRequest.current) setNearbyBusy(false)
    }
  }

  useEffect(() => {
    if (!nearbyUntil) return
    const timer = window.setTimeout(() => {
      setNearbyUntil(0)
      setNearbyUsers([])
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

  async function uploadMediaFiles(files: File[], scope: 'chat' | 'feed' | 'story') {
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

    await apiFetch('/api/push/subscription', {
      method: state.optedIn ? 'POST' : 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscriptionId: state.subscriptionId }),
    })
  }

  useEffect(() => {
    if (!session?.token) {
      setTranslationPreferencesLoaded(false)
      setAutoTranslate(true)
      setTargetLanguage('en')
      return
    }

    let cancelled = false
    const preferenceKey = `chatnet-translation-preferences:${session.user.id}`
    try {
      const cached = JSON.parse(localStorage.getItem(preferenceKey) || 'null') as
        | { targetLanguage?: string; autoTranslate?: boolean }
        | null
      if (cached?.targetLanguage) setTargetLanguage(cached.targetLanguage)
      if (typeof cached?.autoTranslate === 'boolean') setAutoTranslate(cached.autoTranslate)
    } catch {
      // Ignore malformed local fallback; server preferences remain authoritative.
    }

    apiFetch('/api/preferences/translation')
      .then(async (response) => {
        if (!response.ok) return null
        return response.json() as Promise<{ targetLanguage: string; autoTranslate: boolean }>
      })
      .then((preferences) => {
        if (cancelled) return
        if (preferences) {
          const nextTarget = preferences.targetLanguage || 'en'
          const nextAuto = preferences.autoTranslate !== false
          setTargetLanguage(nextTarget)
          setAutoTranslate(nextAuto)
          localStorage.setItem(
            `chatnet-translation-preferences:${session.user.id}`,
            JSON.stringify({ targetLanguage: nextTarget, autoTranslate: nextAuto }),
          )
        } else {
          setTargetLanguage('en')
          setAutoTranslate(true)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setTargetLanguage('en')
          setAutoTranslate(true)
        }
      })
      .finally(() => {
        if (!cancelled) setTranslationPreferencesLoaded(true)
      })

    return () => {
      cancelled = true
    }
  }, [session?.token])

  async function saveTranslationPreferences(nextTarget: string, nextAuto: boolean) {
    if (!session?.token) return
    localStorage.setItem(
      `chatnet-translation-preferences:${session.user.id}`,
      JSON.stringify({ targetLanguage: nextTarget, autoTranslate: nextAuto }),
    )
    try {
      await apiFetch('/api/preferences/translation', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetLanguage: nextTarget,
          autoTranslate: nextAuto,
        }),
      })
    } catch {
      // Keep the UI responsive; the next successful save/read will reconcile server state.
    }
  }

  useEffect(() => {
    if (!session?.token) return

    const params = new URLSearchParams(window.location.search)
    if (params.get('tab') === 'feed') {
      setTab('feed')
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
            await syncPushState(nextState)
          })

          if (!cancelled) {
            setPushEnabled(state.optedIn)
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
      await syncPushState(state)

      if (state.permission === 'denied') {
        setNotice(
          'Thông báo đang bị chặn. Hãy mở cài đặt của trình duyệt/PWA → Notifications → Allow rồi quay lại ChatNet.',
        )
      } else if (state.permission === 'unsupported') {
        setNotice('Thiết bị hoặc trình duyệt này chưa hỗ trợ Web Push.')
      } else if (!pushEnabled && !state.optedIn) {
        setNotice(
          'Chưa đăng ký được Push Notification. Hãy Allow thông báo rồi bấm 🔕 thêm một lần.',
        )
      } else if (state.optedIn) {
        setNotice('Đã bật thông báo ChatNet. Đang gửi thông báo test...')
        window.setTimeout(() => {
          void sendTestPush(false, true)
        }, 500)
      } else {
        setNotice('Đã tắt thông báo ChatNet')
      }
    } catch {
      setNotice('Không thể bật thông báo. Kiểm tra quyền Notification của trình duyệt/PWA rồi thử lại.')
    } finally {
      setPushBusy(false)
    }
  }

  useEffect(() => {
    const friendSurfaceOpen = newChatMode === 'friends' || tab === 'contacts'
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
    setNearbyError('')
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
    events.onopen = () => setStatus('Đang online')
    events.onerror = () => setStatus('Đang kết nối lại...')
    events.addEventListener('update', (event) => {
      const update = JSON.parse((event as MessageEvent).data) as RealtimeEvent

      if (update.type === 'conversation.created') {
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

    const refreshTimer = window.setInterval(() => void refreshConversations(), 20000)
    return () => {
      events.close()
      window.clearInterval(refreshTimer)
    }
  }, [session?.token])

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

  async function createGroup(event: FormEvent) {
    event.preventDefault()
    setChatCreateError('')
    const usernames = groupUsers
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)

    const response = await apiFetch('/api/conversations/groups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: groupName.trim(), usernames }),
    })
    const result = await response.json()
    if (!response.ok) {
      setChatCreateError(result.error || 'Không thể tạo nhóm')
      return
    }

    const created = result as Conversation
    await refreshConversations()
    setActiveConversationId(created.id)
    setGroupName('')
    setGroupUsers('')
    setNewChatMode('none')
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
        body: JSON.stringify({ text, attachments }),
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
    } catch {
      setNotice('Chưa xác nhận được tin đã gửi. Bản nháp được giữ lại; kiểm tra hội thoại trước khi gửi lại.')
    } finally {
      sendingRef.current = false
      setMessageSending(false)
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
  const visibleNearbyUsers = nearbyUsers.filter((user) =>
    user.username.toLocaleLowerCase('vi-VN').includes(normalizedSearch.replace(/^@/, '')),
  )
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
            placeholder={tab === 'contacts' ? 'Email hoặc @username' : tab === 'discover' ? 'Lọc theo @username' : 'Tìm kiếm'}
            aria-label={tab === 'contacts' ? 'Tìm bạn bằng email hoặc username' : 'Tìm kiếm'}
          />
        </label>

        <div className="appbar-actions">
          {tab === 'chat' && (
            <>
              <button
                className="appbar-icon-button"
                type="button"
                aria-label="Quét QR"
                onClick={() => setNotice('QR sẽ được dùng để chia sẻ hồ sơ/kết nối nhanh trong bản tiếp theo.')}
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

          {tab === 'discover' && (
            <button
              className="appbar-icon-button"
              type="button"
              aria-label="Tìm lại quanh đây"
              onClick={() => void findNearby()}
              disabled={nearbyBusy || !nearbyUntil}
            >
              <UiIcon name="discover" size={28} />
            </button>
          )}

          {tab === 'profile' && (
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
          )}
        </div>
      </header>

      {notice && <div className="notice" role="status">{notice} <button type="button" aria-label="Đóng thông báo" onClick={() => setNotice('')}>×</button></div>}

      <section className={`phone-frame modern-frame ${tab === 'chat' && activeConversation ? 'mobile-conversation-open' : ''}`}>
        {tab === 'chat' && (
          <div className={`messenger-layout modern-messenger ${activeConversation ? 'has-active' : ''}`}>
            <aside className="conversation-sidebar">
              {quickCreateOpen && (
                <div className="quick-create-menu">
                  <button type="button" onClick={() => { setNewChatMode('friends'); setQuickCreateOpen(false) }}>
                    <span>⌕</span><div><strong>Tìm bạn bè</strong><small>Gợi ý người bạn có thể biết</small></div>
                  </button>
                  <button type="button" onClick={() => { setNewChatMode('direct'); setQuickCreateOpen(false) }}>
                    <span>＋</span><div><strong>Chat riêng</strong><small>Bắt đầu cuộc trò chuyện 1-1</small></div>
                  </button>
                  <button type="button" onClick={() => { setNewChatMode('group'); setQuickCreateOpen(false) }}>
                    <span>👥</span><div><strong>Tạo nhóm</strong><small>Nhắn tin với nhiều người</small></div>
                  </button>
                </div>
              )}

              {newChatMode === 'friends' && (
                <section className="friend-search-panel compact-friend-panel">
                  <div className="friend-search-title">
                    <div><strong>Tìm bạn bè</strong><small>Email hoặc @username</small></div>
                    <button
                      type="button"
                      className="friend-search-close"
                      onClick={() => { setNewChatMode('none'); setFriendQuery(''); setFriendResults([]) }}
                      aria-label="Đóng tìm bạn bè"
                    >×</button>
                  </div>
                  <div className="friend-search-input-wrap">
                    <UiIcon name="search" size={19} />
                    <input
                      value={friendQuery}
                      onChange={(event) => setFriendQuery(event.target.value)}
                      placeholder="Email hoặc @username"
                      aria-label="Tìm bạn bằng email hoặc username"
                      autoCapitalize="none"
                      autoComplete="off"
                      maxLength={254}
                      autoFocus
                    />
                  </div>
                  <div className="friend-search-results">
                    {friendSearching && <div className="friend-search-state">Đang tìm...</div>}
                    {!friendSearching && !friendQuery.trim() && friendResults.length > 0 && (
                      <div className="friend-suggestion-label">Người bạn có thể biết</div>
                    )}
                    {!friendSearching && friendQuery.trim() && friendResults.length === 0 && (
                      <div className="friend-search-state">Không tìm thấy người dùng phù hợp.</div>
                    )}
                    {friendResults.map((friend) => (
                      <button
                        type="button"
                        className="friend-result"
                        key={friend.id}
                        onClick={() => void openDirectByUsername(friend.username)}
                      >
                        <UserAvatar name={friend.username} className="friend-avatar" online={friend.online} />
                        <div className="friend-result-copy">
                          <strong>@{friend.username}</strong>
                          <span>{friend.reason || (friend.online ? 'Đang hoạt động' : 'Ngoại tuyến')}</span>
                        </div>
                        <div className="friend-result-action"><span>›</span></div>
                      </button>
                    ))}
                  </div>
                </section>
              )}

              {newChatMode === 'direct' && (
                <form className="new-chat-panel" onSubmit={createDirect}>
                  <div className="panel-line"><strong>Tạo chat riêng</strong><button type="button" onClick={() => setNewChatMode('none')}>×</button></div>
                  <input value={directUsername} onChange={(event) => setDirectUsername(event.target.value)} placeholder="Username người muốn chat" maxLength={64} autoFocus />
                  <button>Tạo cuộc trò chuyện</button>
                </form>
              )}

              {newChatMode === 'group' && (
                <form className="new-chat-panel" onSubmit={createGroup}>
                  <div className="panel-line"><strong>Tạo nhóm</strong><button type="button" onClick={() => setNewChatMode('none')}>×</button></div>
                  <input value={groupName} onChange={(event) => setGroupName(event.target.value)} placeholder="Tên nhóm" maxLength={120} autoFocus />
                  <input value={groupUsers} onChange={(event) => setGroupUsers(event.target.value)} placeholder="Username: linh, ken, ..." />
                  <button>Tạo nhóm</button>
                </form>
              )}

              {chatCreateError && <div className="inline-error">{chatCreateError}</div>}

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
                      <label className="auto-translate">
                        <input
                          type="checkbox"
                          checked={autoTranslate}
                          onChange={(event) => changeAutoTranslate(event.target.checked)}
                        />
                        <span>Tự dịch AI</span>
                      </label>
                      <select aria-label="Ngôn ngữ dịch" value={targetLanguage} onChange={(event) => changeTargetLanguage(event.target.value)}>
                        {languages.map((language) => <option key={language.value} value={language.value}>→ {language.label}</option>)}
                      </select>
                    </div>
                  </header>

                  <div className="messages">
                    <div className="day-divider"><span>Cuộc trò chuyện</span></div>
                    {messages.map((message) => {
                      const mine = message.senderId === session.user.id
                      return (
                        <article key={message.id} className={mine ? 'message mine' : 'message'}>
                          {!mine && <div className="message-meta">{message.sender}</div>}
                          {message.text && <div className="bubble">{message.text}</div>}
                          <MediaAttachmentsView items={message.attachments} />
                          <div className="message-stamp">{formatTime(message.createdAt)}</div>
                          {translations[message.id] && <div className="translation"><span>✨</span>{translations[message.id]}</div>}
                          {!mine && Boolean(message.text.trim()) && <button className="translate-btn" type="button" onClick={() => translateMessage(message)}>✨ Dịch bằng AI</button>}
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
              <button type="button" onClick={() => { setTab('chat'); setNewChatMode('group') }}>
                <span className="shortcut-icon">👥</span><div><strong>Nhóm và cộng đồng</strong><small>Tạo cuộc trò chuyện nhóm</small></div><b>›</b>
              </button>
            </div>

            <section className="contacts-suggestions">
              <div className="contacts-heading">Người bạn có thể biết</div>
              {friendSearching && <div className="friend-search-state">Đang tải gợi ý...</div>}
              {!friendSearching && friendResults.length === 0 && (
                <div className="friend-search-state">Chưa có gợi ý phù hợp.</div>
              )}
              {friendResults.map((friend) => (
                <button
                  type="button"
                  className="friend-result contact-result"
                  key={friend.id}
                  onClick={() => void openDirectByUsername(friend.username)}
                >
                  <UserAvatar name={friend.username} className="friend-avatar" online={friend.online} />
                  <div className="friend-result-copy">
                    <strong>@{friend.username}</strong>
                    <span>{friend.reason || (friend.online ? 'Đang hoạt động' : 'Ngoại tuyến')}</span>
                  </div>
                  <div className="friend-result-action"><small>Nhắn tin</small><span>›</span></div>
                </button>
              ))}
            </section>
          </div>
        )}

        {tab === 'discover' && (
          <div className="simple-view discover-view">
            <div className="simple-view-title"><strong>Tìm bạn quanh đây</strong><small>Trong phạm vi 5 km</small></div>
            <div className="nearby-controls">
              <div className="nearby-radar"><UiIcon name="discover" size={80} /></div>
              <p>{nearbyUntil ? 'Đang hiển thị với người dùng quanh đây.' : 'Bật Quanh đây để tìm người cùng bật trong phạm vi 5 km.'}</p>
              <p className="nearby-privacy">Vị trí chỉ dùng khi bạn bật. Tự ẩn sau 15 phút. Không hiển thị tọa độ hoặc khoảng cách chính xác. Nếu mất kết nối, bạn có thể vẫn hiển thị đến hết thời hạn.</p>
              <div className="nearby-actions">
                <button type="button" onClick={() => void findNearby()} disabled={nearbyBusy}>
                  <UiIcon name="discover" size={20} />{nearbyBusy ? 'Đang xử lý...' : nearbyUntil ? 'Tìm lại' : 'Bật Quanh đây'}
                </button>
                <button type="button" className="secondary" onClick={() => void stopNearby()} disabled={nearbyBusy}>Tắt Quanh đây</button>
              </div>
              {nearbyError && <p role="alert" className="inline-error">{nearbyError}</p>}
              {nearbyUntil > 0 && <p role="status">{visibleNearbyUsers.length ? `${visibleNearbyUsers.length} người quanh đây` : 'Chưa tìm thấy người phù hợp quanh đây.'}</p>}
            </div>
            <section className="friend-results" aria-label="Người dùng quanh đây">
              {visibleNearbyUsers.map((friend) => (
                <button key={friend.id} type="button" className="friend-result contact-result" aria-label={`Nhắn tin với @${friend.username}`} onClick={() => void openDirectByUsername(friend.username)}>
                  <UserAvatar name={friend.username} className="friend-avatar" online={friend.online} />
                  <div className="friend-result-copy"><strong>@{friend.username}</strong><span>Trong phạm vi 5 km</span></div>
                  <div className="friend-result-action"><small>Nhắn tin</small><span>›</span></div>
                </button>
              ))}
            </section>
          </div>
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
                    {post.content && <FeedText api={API} token={session.token} target={translationPreferencesLoaded ? targetLanguage : ''} text={post.content} />}
                    <MediaAttachmentsView items={post.attachments} />
                    <div className="post-toolbar">
                      <button type="button" className={post.liked ? 'liked' : ''} onClick={() => like(post)}>
                        <UiIcon name="heart" size={21} /><span>Thích</span>{post.likes > 0 && <b>{post.likes}</b>}
                      </button>
                      <span className="post-stat"><UiIcon name="comment" size={21} />{post.comments?.length || ''}</span>
                    </div>
                    <FeedDiscussion comments={post.comments || []}
                      editor={commentEditors[post.id] || { replyTo: null, drafts: {} }}
                      updateEditor={(editor) => {
                        if (sessionRef.current?.token === session.token) {
                          setCommentEditors((current) => ({ ...current, [post.id]: editor }))
                        }
                      }}
                      api={API} token={session.token} target={translationPreferencesLoaded ? targetLanguage : ''}
                      submit={(content, parentId) => addComment(post, content, parentId)} />
                  </div>
                </article>
              ))}
              {searchedPosts.length === 0 && <div className="feed-empty">Chưa có bài viết phù hợp.</div>}
            </div>
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
            <section className="profile-hero">
              <div className="profile-cover-art" aria-hidden="true">
                <strong>ChatNet</strong>
                <small>Kết nối không biên giới</small>
              </div>
              <div className="profile-identity">
                <UserAvatar name={name} className="profile-avatar" online />
                <div><strong>@{name}</strong><span>{session.user.email}</span></div>
              </div>
            </section>

            <section className="settings-card">
              <div className="settings-row">
                <div><strong>Thông báo</strong><small>Cho phép bật/tắt bất cứ lúc nào</small></div>
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
                <div><strong>Test thông báo</strong><small>Bắn một push thử tới thiết bị này</small></div>
                <button type="button" className="settings-action" onClick={() => void sendTestPush()} disabled={pushBusy || !pushEnabled}>Test</button>
              </div>
              <div className="settings-row">
                <div><strong>Tự động dịch tin nhắn</strong></div>
                <button
                  type="button"
                  className={`switch-button ${autoTranslate ? 'on' : ''}`}
                  onClick={() => changeAutoTranslate(!autoTranslate)}
                  aria-label="Tự động dịch"
                  role="switch"
                  aria-checked={autoTranslate}
                ><span /></button>
              </div>
              <label className="settings-row settings-language">
                <div><strong>Ngôn ngữ dịch</strong><small>Giữ nguyên sau khi F5/mở lại app</small></div>
                <select value={targetLanguage} onChange={(event) => changeTargetLanguage(event.target.value)}>
                  {languages.map((language) => <option key={language.value} value={language.value}>{language.label}</option>)}
                </select>
              </label>
            </section>

            <section className="profile-actions">
              {!isStandalone && <button type="button" onClick={() => void installApp()}>Cài ChatNet vào điện thoại</button>}
              <button type="button" className="danger-action" onClick={logout}>Đăng xuất</button>
            </section>
          </div>
        )}
      </section>

      <nav className="bottom-navigation" aria-label="Điều hướng chính">
        <button type="button" className={tab === 'chat' ? 'active' : ''} onClick={() => switchTab('chat')}>
          <span className="nav-icon"><UiIcon name="chat" size={25} />{unreadTotal > 0 && <b>{unreadTotal > 99 ? '99+' : unreadTotal}</b>}</span>
          <span>Tin nhắn</span>
        </button>
        <button type="button" className={tab === 'contacts' ? 'active' : ''} onClick={() => switchTab('contacts')}>
          <span className="nav-icon"><UiIcon name="contacts" size={25} /></span>
          <span>Danh bạ</span>
        </button>
        <button type="button" className={tab === 'discover' ? 'active' : ''} onClick={() => switchTab('discover')}>
          <span className="nav-icon"><UiIcon name="discover" size={25} /></span>
          <span>Quanh đây</span>
        </button>
        <button type="button" className={tab === 'feed' ? 'active' : ''} onClick={() => switchTab('feed')}>
          <span className="nav-icon"><UiIcon name="wall" size={25} /></span>
          <span>Tường nhà</span>
        </button>
        <button type="button" className={tab === 'profile' ? 'active' : ''} onClick={() => switchTab('profile')}>
          <span className="nav-icon"><UiIcon name="profile" size={25} />{!pushEnabled && <b>!</b>}</span>
          <span>Cá nhân</span>
        </button>
      </nav>
    </main>
  )
}
