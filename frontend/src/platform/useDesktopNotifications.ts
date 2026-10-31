import { useEffect, useRef, useState, type RefObject } from 'react'
import type { Session } from '../features/auth/session'
import type { Conversation, Message } from '../features/chat/types'
import { desktopBridge, isDesktopBuild } from './desktop'

const unreadEvent = 'soco:unread-refresh'
const unavailableEvent = 'soco:notification-unavailable'
const settingKey = (userId: number) => `soco:native-notifications:v1:${userId}`
function readEnabled(userId: number) {
  try { return localStorage.getItem(settingKey(userId)) !== 'false' } catch { return true }
}
export function refreshDesktopUnread() {
  if (isDesktopBuild) window.dispatchEvent(new Event(unreadEvent))
}
export function clearDesktopNotifications(sessionId: string) {
  if (!isDesktopBuild) return
  window.dispatchEvent(new Event('soco:notification-invalidated'))
  void desktopBridge().notifications.clear(sessionId).catch(() => undefined)
}
function deliver(input: Parameters<ReturnType<typeof desktopBridge>['notifications']['show']>[0]) {
  if (!isDesktopBuild) return
  void desktopBridge().notifications.show(input).then((result) => {
    if (result.reason === 'unavailable') window.dispatchEvent(new Event(unavailableEvent))
  }).catch(() => window.dispatchEvent(new Event(unavailableEvent)))
}
export function notifyDesktopMessage(session: Session, message: Message) {
  deliver({ sessionId: session.sessionId, conversationId: message.conversationId, eventId: String(message.id),
    kind: 'message', senderId: message.senderId, createdAt: message.createdAt })
}
export function notifyDesktopCall(sessionId: string, call: { id: string; conversationId: number; createdBy: number; createdAt: string }) {
  deliver({ sessionId, conversationId: call.conversationId, eventId: call.id, kind: 'call',
    senderId: call.createdBy, createdAt: call.createdAt })
}
export function dismissDesktopCall(sessionId: string, eventId: string) {
  if (isDesktopBuild) void desktopBridge().notifications.dismiss({ sessionId, eventId, kind: 'call' }).catch(() => undefined)
}

type Options = {
  session: Session | null
  sessionRef: RefObject<Session | null>
  apiFetch: (path: string, init?: RequestInit) => Promise<Response>
  checkSession: () => Promise<boolean>
  activeConversationId: number | null
  tab: string
  sound: boolean
  onOpen: (conversation: Conversation) => void
  onError: (message: string) => void
}

export function useDesktopNotifications(options: Options) {
  const current = useRef(options)
  current.current = options
  const sessionId = options.session?.sessionId
  const userId = options.session?.user.id || 0
  const [setting, setSetting] = useState(() => ({ userId, enabled: readEnabled(userId) }))
  const enabled = setting.userId === userId ? setting.enabled : readEnabled(userId)
  const [unread, setUnread] = useState<{ sessionId?: string; value: number | null }>({ value: null })
  const unreadCount = unread.sessionId === sessionId ? unread.value : null
  const setUnreadCount = (value: number | null) => setUnread({ sessionId, value })
  const [syncWarning, setSyncWarning] = useState('')
  const [nativeWarning, setNativeWarning] = useState('')

  useEffect(() => {
    if (!isDesktopBuild || !sessionId || !options.session) return
    setUnreadCount(null); setSyncWarning(''); setNativeWarning('')
    let alive = true, busy = false, dirty = false, opening = false
    let timer = 0, accessRevision = 0
    const invalidateAccess = () => { accessRevision++ }
    window.addEventListener('soco:notification-invalidated', invalidateAccess)
    const abort = new AbortController()
    const requestSignal = () => AbortSignal.any([abort.signal, AbortSignal.timeout(15000)])
    const matches = () => alive && current.current.sessionRef.current?.sessionId === sessionId
    const refresh = async () => {
      if (!matches()) return
      if (busy) { dirty = true; return }
      busy = true
      try {
        const response = await current.current.apiFetch('/api/conversations/unread', { cache: 'no-store', signal: requestSignal() })
        if (!response.ok) throw new Error(response.status === 404 ? 'backend-update' : 'network')
        const data = await response.json() as { unreadCount?: unknown }
        if (!Number.isSafeInteger(data.unreadCount) || Number(data.unreadCount) < 0) throw new Error('invalid-count')
        if (matches()) { setUnreadCount(Number(data.unreadCount)); setSyncWarning('') }
      } catch (error) {
        if (matches()) {
          setUnreadCount(null)
          setSyncWarning(error instanceof Error && error.message === 'backend-update'
            ? 'Backend chưa hỗ trợ tổng unread. Badge chưa khả dụng; không suy đoán từ trang chat đầu.'
            : 'Chưa đồng bộ được số tin chưa đọc. Sẽ thử lại khi kết nối phục hồi.')
        }
      } finally { busy = false; if (dirty && matches()) { dirty = false; schedule() } }
    }
    const schedule = () => { window.clearTimeout(timer); timer = window.setTimeout(() => void refresh(), 400) }
    const unavailable = () => { if (matches()) setNativeWarning('Hệ điều hành chưa hiển thị được thông báo SOCO. Kiểm tra quyền thông báo và bản cài có ký.') }
    const unsubscribe = desktopBridge().notifications.onClicked((input) => {
      if (!matches() || input.sessionId !== sessionId || !Number.isSafeInteger(input.conversationId) || input.conversationId <= 0 || opening) return
      opening = true
      const revision = accessRevision
      void (async () => {
        // The native click contains no message content and grants no membership rights.
        if (!await current.current.checkSession() || !matches() || revision !== accessRevision) return
        const response = await current.current.apiFetch(`/api/conversations?limit=1&id=${input.conversationId}`, { cache: 'no-store', signal: requestSignal() })
        if (!response.ok) throw new Error('unavailable')
        const data = await response.json() as Conversation[]
        if (!matches() || revision !== accessRevision) return
        if (!Array.isArray(data) || data.length !== 1 || data[0].id !== input.conversationId) throw new Error('unavailable')
        current.current.onOpen(data[0])
      })().catch(() => {
        if (matches()) current.current.onError('Không mở được hội thoại từ thông báo. Quyền truy cập có thể đã thay đổi; hãy kiểm tra kết nối và thử lại.')
      }).finally(() => { opening = false })
    })
    window.addEventListener(unreadEvent, schedule)
    window.addEventListener('focus', schedule)
    window.addEventListener('online', schedule)
    window.addEventListener(unavailableEvent, unavailable)
    const interval = window.setInterval(() => void refresh(), 30000)
    void refresh()
    return () => {
      alive = false; abort.abort(); unsubscribe(); window.clearTimeout(timer); window.clearInterval(interval)
      window.removeEventListener('soco:notification-invalidated', invalidateAccess)
      window.removeEventListener(unreadEvent, schedule); window.removeEventListener('focus', schedule)
      window.removeEventListener('online', schedule); window.removeEventListener(unavailableEvent, unavailable)
    }
  }, [sessionId])

  useEffect(() => {
    if (!isDesktopBuild || !sessionId) return
    void desktopBridge().notifications.sync({ sessionId, conversationId: options.tab === 'chat' ? options.activeConversationId : null,
      unreadCount, enabled, sound: options.sound }).catch(() => {
      if (current.current.sessionRef.current?.sessionId === sessionId) setNativeWarning('Không đồng bộ được thông báo với Desktop. Hãy khởi động lại ứng dụng.')
    })
  }, [sessionId, options.activeConversationId, options.tab, options.sound, enabled, unreadCount])

  function toggle() {
    const session = current.current.sessionRef.current
    if (!session) return
    const next = !enabled
    setSetting({ userId: session.user.id, enabled: next })
    try { localStorage.setItem(settingKey(session.user.id), String(next)) } catch { /* Current session setting remains effective. */ }
    if (next) { setNativeWarning(''); refreshDesktopUnread() }
  }
  return { enabled, toggle, warning: nativeWarning || syncWarning }
}
