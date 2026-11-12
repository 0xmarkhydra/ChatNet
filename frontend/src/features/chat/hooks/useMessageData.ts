import { useEffect, useRef, useState, type Dispatch, type RefObject, type SetStateAction } from 'react'
import type { AppDataContext } from '../../../shared/types/api'
import type { Tab } from '../../../shared/types/navigation'
import type { useConversationData } from './useConversationData'
import { MESSAGE_PAGE_SIZE, type Message, type MessageDraft } from '../types'
import { clearPendingSend, loadPendingSend } from '../lib/chatPersistence'
import { canMarkConversationRead } from '../utils/conversationRead'
import { isDesktopBuild } from '../../../platform/desktop'
import { refreshDesktopUnread } from './useDesktopNotifications'

type Options = Omit<AppDataContext, 'setStatus'> &
  Pick<ReturnType<typeof useConversationData>, 'setConversations'> & {
    activeConversationId: number | null
    activeChannelId: number
    activeChannelIdRef: RefObject<number>
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
    jumpToMessage?: { conversationId: number; messageId: number; revision: number } | null
  }

export function useMessageData({
  session,
  sessionRef,
  apiFetch,
  setNotice,
  activeConversationId,
  activeChannelId,
  activeChannelIdRef,
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
  jumpToMessage,
}: Options) {
  const [messages, setMessages] = useState<Message[]>([])
  const [privacyRevision, setPrivacyRevision] = useState(0)
  useEffect(() => {
    const refresh = () => setPrivacyRevision(current => current + 1)
    window.addEventListener('chatnet:privacy-updated', refresh)
    return () => window.removeEventListener('chatnet:privacy-updated', refresh)
  }, [])
  const [hasMoreMessages, setHasMoreMessages] = useState(false)
  const [messagesLoadingMore, setMessagesLoadingMore] = useState(false)
  const [messageGapBefore, setMessageGapBefore] = useState<number | null>(null)
  const [messageGapLoading, setMessageGapLoading] = useState(false)
  const gapPagingBusy = useRef(false)
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
    // Never show another channel's messages while its own history is loading.
    setMessages([])
    setHasMoreMessages(false)
    const jump = jumpToMessage?.conversationId === activeConversationId ? jumpToMessage : null
    setMessageGapBefore(null)
    const pageSize = jump ? 80 : MESSAGE_PAGE_SIZE
    const before = jump ? `&before=${jump.messageId + 1}` : ''
    const basePath = `/api/conversations/${activeConversationId}/messages?target=${encodeURIComponent(targetLanguage)}&channelId=${activeChannelId}`
    const requestedPages = [
      apiFetch(`${basePath}&limit=${pageSize}${before}`),
      ...(jump ? [apiFetch(`${basePath}&limit=200`)] : []),
    ]
    Promise.all(requestedPages)
      .then(async (responses) => {
        if (responses.some((response) => response.status === 403)) {
          if (!cancelled) purgeConversation(activeConversationId)
          return
        }
        if (responses.some((response) => !response.ok)) throw new Error('Không tải được tin nhắn')
        const pages = await Promise.all(responses.map(async (response) => (await response.json()) as Message[]))
        if (cancelled) return
        // Include the targeted history and newer messages from BOTH participants.
        const byId = new Map(pages.flat().map((item) => [item.id, item]))
        const data = [...byId.values()].filter(item => (item.channelId || 0) === activeChannelId).sort((a, b) => a.id - b.id)

        // Reconcile a POST whose ACK vanished before refresh. A persisted
        // clientId in history is proof of delivery; no second POST is needed.
        const recovered = loadPendingSend(session.user.id, session.sessionId)
        const confirmed = recovered && data.find((item) => item.clientId === recovered.clientId && item.conversationId === recovered.conversationId)
        if (confirmed && recovered) {
          clearPendingSend(session.user.id, recovered.clientId)
          if (pendingSend.current?.clientId === recovered.clientId) pendingSend.current = null
          if (!confirmed.channelId) setMessageDrafts((current) => {
            const existing = current[confirmed.conversationId]
            if (!existing || existing.text.trim() !== confirmed.text || existing.attachments.length > 0) return current
            const next = { ...current }
            delete next[confirmed.conversationId]
            return next
          })
        }

        // If the latest page does not overlap the jump window, offer paged backfill.
        const anchorMax = pages[0].reduce((max, item) => Math.max(max, item.id), 0)
        const recent = pages[1] || []
        const recentMin = recent.reduce((min, item) => Math.min(min, item.id), Infinity)
        setMessageGapBefore(jump && recent.length === 200 && anchorMax > 0 && anchorMax < recentMin
          ? recentMin : null)
        // The older-page cursor applies to the anchor page, not the combined result.
        setHasMoreMessages(pages[0].length === pageSize)
        setMessages((current) => {
          const live = current.filter((item) => item.conversationId === activeConversationId && (item.channelId || 0) === activeChannelId && changes.has(item.id))
          const existing = jump ? current.filter((item) => item.conversationId === activeConversationId && (item.channelId || 0) === activeChannelId) : []
          const merged = new Map(existing.map((item) => [item.id, item]))
          for (const item of data) if (!changes.has(item.id)) merged.set(item.id, item)
          for (const item of live) merged.set(item.id, item)
          return [...merged.values()].sort((a, b) => a.id - b.id)
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
        if (!canMarkConversationRead(activeConversationIdRef.current, activeConversationId, tabRef.current, document.visibilityState, !isDesktopBuild || document.hasFocus())) return
        const read = await apiFetch(`/api/conversations/${activeConversationId}/read`, { method: 'POST' })
        if (!read.ok) return
        refreshDesktopUnread()
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
    activeChannelId,
    session?.token,
    targetLanguage,
    translationPreferencesLoaded,
    jumpToMessage?.revision,
    privacyRevision,
  ])

  useEffect(() => {
    if (!session?.token || !activeConversationId) return
    const id = activeConversationId
    const sessionId = session.sessionId
    const markWhenVisible = () => {
      if (!canMarkConversationRead(activeConversationIdRef.current, id, tabRef.current, document.visibilityState, !isDesktopBuild || document.hasFocus())) return
      void apiFetch(`/api/conversations/${id}/read`, { method: 'POST' })
        .then((response) => {
          if (!response.ok || activeConversationIdRef.current !== id || sessionRef.current?.sessionId !== sessionId) return
          refreshDesktopUnread()
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

  async function loadMissingMessages() {
    if (!session || !activeConversationId || !messageGapBefore || gapPagingBusy.current) return
    const conversationId = activeConversationId
    const sessionId = session.sessionId
    const before = messageGapBefore
    gapPagingBusy.current = true
    setMessageGapLoading(true)
    try {
      const response = await apiFetch(
        `/api/conversations/${conversationId}/messages?target=${encodeURIComponent(targetLanguage)}&channelId=${activeChannelId}&limit=80&before=${before}`,
      )
      if (!response.ok) throw new Error('Không tải được tin nhắn ở giữa')
      const data = (await response.json()) as Message[]
      if (sessionRef.current?.sessionId !== sessionId || activeConversationIdRef.current !== conversationId || activeChannelIdRef.current !== activeChannelId) return
      const lowerWindowMax = messages.reduce((max, item) => item.id < before ? Math.max(max, item.id) : max, 0)
      const newMin = data.reduce((min, item) => Math.min(min, item.id), Infinity)
      setMessageGapBefore(data.length === 80 && newMin > lowerWindowMax ? newMin : null)
      setMessages(current => {
        const merged = new Map(current.map(item => [item.id, item]))
        for (const item of data) if (!merged.has(item.id)) merged.set(item.id, item)
        return [...merged.values()].sort((a, b) => a.id - b.id)
      })
      setTranslations(current => {
        const next = { ...current }
        for (const item of data) {
          if (item.translatedText && item.translationLanguage === targetLanguage) next[item.id] = item.translatedText
        }
        return next
      })
    } catch {
      if (sessionRef.current?.sessionId === sessionId && activeConversationIdRef.current === conversationId)
        setNotice('Không tải được đoạn tin nhắn ở giữa. Hãy thử lại.', 'error')
    } finally {
      gapPagingBusy.current = false
      if (sessionRef.current?.sessionId === sessionId && activeConversationIdRef.current === conversationId)
        setMessageGapLoading(false)
    }
  }

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
        `/api/conversations/${conversationId}/messages?target=${encodeURIComponent(targetLanguage)}&channelId=${activeChannelId}&limit=${MESSAGE_PAGE_SIZE}&before=${before}`,
      )
      if (!response.ok) throw new Error('Không tải thêm được lịch sử tin nhắn')
      const data = (await response.json()) as Message[]
      if (sessionRef.current?.sessionId !== sessionId || activeConversationIdRef.current !== conversationId || activeChannelIdRef.current !== activeChannelId) return
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
    messageGapBefore,
    messageGapLoading,
    loadMissingMessages,
    messagesPagingBusy,
    pendingMessageScrollRestore,
    loadOlderMessages,
  }
}