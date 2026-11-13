import { useEffect, useRef, useState, type Dispatch, type RefObject, type SetStateAction } from 'react'
import type { Session } from '../../auth/lib/session'
import { listPins, setConversationPinned, setMessagePinned } from '../api/pins'
import type { Conversation, Message, PinnedMessage } from '../types'

type Options = {
  session: Session | null
  sessionRef: RefObject<Session | null>
  activeConversationId: number | null
  activeConversationIdRef: RefObject<number | null>
  apiFetch: (path: string, init?: RequestInit) => Promise<Response>
  setConversations: Dispatch<SetStateAction<Conversation[]>>
  refreshConversations: () => Promise<void>
  setNotice: (text: string, kind?: 'success' | 'error' | 'warning' | 'info') => void
}

export function useChatPins({
  session, sessionRef, activeConversationId, activeConversationIdRef,
  apiFetch, setConversations, refreshConversations, setNotice,
}: Options) {
  const [pinnedMessages, setPinnedMessages] = useState<PinnedMessage[]>([])
  const [pinScope, setPinScope] = useState<number | null>(null)
  const [pinBusy, setPinBusy] = useState(false)
  const pending = useRef(new Set<string>())
  // Discard older responses when SSE and local writes refresh the same conversation.
  const refreshSequence = useRef(0)

  async function refreshPinnedMessages(conversationId: number) {
    const sessionId = sessionRef.current?.sessionId
    if (!sessionId) return
    const sequence = ++refreshSequence.current
    try {
      const response = await listPins(apiFetch, conversationId)
      if (sessionRef.current?.sessionId !== sessionId ||
        activeConversationIdRef.current !== conversationId ||
        sequence !== refreshSequence.current) return
      if (response.status === 403) {
        setPinnedMessages([])
        setPinScope(null)
        return
      }
      if (!response.ok) throw new Error('Không tải được tin nhắn đã ghim')
      const data = (await response.json()) as PinnedMessage[]
      if (sessionRef.current?.sessionId === sessionId &&
        activeConversationIdRef.current === conversationId &&
        sequence === refreshSequence.current) {
        setPinnedMessages(data)
        setPinScope(conversationId)
      }
    } catch {
      // Keep the last confirmed state on transient network failures.
    }
  }

  useEffect(() => {
    pending.current = new Set()
    setPinBusy(false)
    refreshSequence.current += 1
    setPinnedMessages([])
    setPinScope(null)
    if (session?.token && activeConversationId) void refreshPinnedMessages(activeConversationId)
  }, [session?.sessionId, activeConversationId])

  async function toggleMessagePin(message: Message) {
    const conversationId = message.conversationId
    if (!sessionRef.current || activeConversationIdRef.current !== conversationId) return
    const key = `message:${message.id}`
    if (pending.current.has(key)) return
    const sessionId = sessionRef.current.sessionId
    const currentlyPinned = pinnedMessages.some((pin) => pin.message.id === message.id)
    const requestPending = pending.current
    requestPending.add(key)
    setPinBusy(true)
    try {
      const response = await setMessagePinned(apiFetch, message.id, !currentlyPinned)
      if (!response.ok) {
        if (response.status === 404 || response.status === 405) {
          throw new Error('Backend đang kết nối chưa hỗ trợ ghim tin nhắn. Cần cập nhật backend để sử dụng chức năng này.')
        }
        const data = await response.json().catch(() => ({})) as { error?: string }
        throw new Error(data.error || 'Không cập nhật được ghim tin nhắn')
      }
      if (sessionRef.current?.sessionId !== sessionId) return
      await refreshPinnedMessages(conversationId)
      if (sessionRef.current?.sessionId === sessionId && activeConversationIdRef.current === conversationId)
        setNotice(currentlyPinned ? 'Đã bỏ ghim tin nhắn.' : 'Đã ghim tin nhắn.', 'success')
    } catch (error) {
      if (sessionRef.current?.sessionId === sessionId)
        setNotice(error instanceof Error ? error.message : 'Không cập nhật được ghim tin nhắn.', 'error')
    } finally {
      requestPending.delete(key)
      if (sessionRef.current?.sessionId === sessionId && pending.current === requestPending)
        setPinBusy(requestPending.size > 0)
    }
  }

  async function toggleConversationPin(conversation: Conversation) {
    const key = `conversation:${conversation.id}`
    if (pending.current.has(key)) return
    const currentlyPinned = Boolean(conversation.pinnedAt)
    const sessionId = sessionRef.current?.sessionId
    const requestPending = pending.current
    requestPending.add(key)
    setPinBusy(true)
    try {
      const response = await setConversationPinned(apiFetch, conversation.id, !currentlyPinned)
      if (!response.ok) {
        if (response.status === 404 || response.status === 405) {
          throw new Error('Backend đang kết nối chưa hỗ trợ ghim hội thoại. Cần cập nhật backend để sử dụng chức năng này.')
        }
        const data = await response.json().catch(() => ({})) as { error?: string }
        throw new Error(data.error || 'Không cập nhật được ghim hội thoại')
      }
      if (sessionRef.current?.sessionId === sessionId) {
        setConversations((current) => current.map((item) => item.id === conversation.id ?
          { ...item, pinnedAt: currentlyPinned ? undefined : new Date().toISOString() } : item))
        void refreshConversations()
        setNotice(currentlyPinned ? 'Đã bỏ ghim cuộc trò chuyện.' : 'Đã ghim cuộc trò chuyện.', 'success')
      }
    } catch (error) {
      if (sessionRef.current?.sessionId === sessionId)
        setNotice(error instanceof Error ? error.message : 'Không cập nhật được ghim hội thoại.', 'error')
    } finally {
      requestPending.delete(key)
      if (sessionRef.current?.sessionId === sessionId && pending.current === requestPending)
        setPinBusy(requestPending.size > 0)
    }
  }

  function clearPinnedMessages() { refreshSequence.current += 1; setPinnedMessages([]); setPinScope(null) }

  return { pinnedMessages: pinScope === activeConversationId ? pinnedMessages : [], pinBusy,
    refreshPinnedMessages, clearPinnedMessages, toggleMessagePin, toggleConversationPin }
}