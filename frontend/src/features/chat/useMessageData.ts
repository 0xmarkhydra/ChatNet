import { useEffect, useRef, useState, type Dispatch, type RefObject, type SetStateAction } from 'react'
import type { AppDataContext } from '../../app/dataTypes'
import type { Tab } from '../../app/types'
import type { useConversationData } from './useConversationData'
import { MESSAGE_PAGE_SIZE, type Message, type MessageDraft } from './types'
import { clearPendingSend, loadPendingSend } from './chatPersistence'
import { canMarkConversationRead } from './conversationRead'

type Options = Omit<AppDataContext, 'setStatus'> &
  Pick<ReturnType<typeof useConversationData>, 'setConversations'> & {
    activeConversationId: number | null
    activeConversationIdRef: RefObject<number | null>
    translationPreferencesLoaded: boolean
    targetLanguage: string
    setTranslations: Dispatch<SetStateAction<Record<number, string>>>
    messageChanges: RefObject<Set<number>>
    pendingSend: RefObject<{
      sessionId: string; conversationId: number; signature: string; clientId: string; draft: MessageDraft
    } | null>
    setMessageDrafts: Dispatch<SetStateAction<Record<number, MessageDraft>>>
    tabRef: RefObject<Tab>
    messagesScrollRef: RefObject<HTMLDivElement | null>
    purgeConversation: (id: number) => void
  }

export function useMessageData({
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
}: Options) {
  const [messages, setMessages] = useState<Message[]>([])
  const [hasMoreMessages, setHasMoreMessages] = useState(false)
  const [messagesLoadingMore, setMessagesLoadingMore] = useState(false)
  const messagesPagingBusy = useRef(false)
  const pendingMessageScrollRestore = useRef<{ height: number; top: number } | null>(null)

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


  return {
    messages,
    setMessages,
    hasMoreMessages,
    setHasMoreMessages,
    messagesLoadingMore,
    setMessagesLoadingMore,
    messagesPagingBusy,
    pendingMessageScrollRestore,
    loadOlderMessages,
  }
}
