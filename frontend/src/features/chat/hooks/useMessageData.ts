import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type RefObject, type SetStateAction } from 'react'
import { useLatest } from '../../../shared/hooks/useLatest'
import type { AppDataContext } from '../../../shared/types/api'
import type { Tab } from '../../../shared/types/navigation'
import type { useConversationData } from './useConversationData'
import { MESSAGE_PAGE_SIZE, type Message, type MessageDraft } from '../types'
import { listMessages, markChannelRead, markConversationRead } from '../api/messages'
import { clearPendingSend, loadPendingSend } from '../lib/chatPersistence'
import { canMarkConversationRead } from '../utils/conversationRead'
import { isDesktopBuild } from '../../../platform/desktop'
import { refreshDesktopUnread } from './useDesktopNotifications'

const emptyMessages: Message[] = []

type Options = Omit<AppDataContext, 'setStatus'> &
  Pick<ReturnType<typeof useConversationData>, 'setConversations' | 'refreshConversations'> & {
    activeConversationId: number | null
    activeChannelId: number
    activeConversationType: 'group' | 'direct' | null
    activeChannelIdRef: RefObject<number>
    activeConversationIdRef: RefObject<number | null>
    translationPreferencesLoaded: boolean
    targetLanguage: string
    setTranslations: Dispatch<SetStateAction<Record<number, string>>>
    resetMessageChanges: (next: Set<number>) => void
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
  activeConversationType,
  activeChannelIdRef,
  activeConversationIdRef,
  translationPreferencesLoaded,
  targetLanguage,
  setTranslations,
  resetMessageChanges,
  pendingSend,
  setMessageDrafts,
  setConversations,
  refreshConversations,
  tabRef,
  messagesScrollRef,
  purgeConversation,
  jumpToMessage,
}: Options) {
  const sessionId = session?.sessionId
  const userId = session?.user.id
  const token = session?.token
  const sessionScope = token && sessionId ? JSON.stringify([sessionId, userId]) : ''
  const cacheKey = sessionScope && activeConversationId
    ? [activeConversationId, activeChannelId, targetLanguage].join(':')
    : ''
  // Distinguish visits even when returning to an earlier account or channel (A → B → A).
  const visit = useMemo(() => ({ sessionId, userId, sessionScope, cacheKey,
    conversationId: activeConversationId, channelId: activeChannelId, targetLanguage }),
    [sessionId, userId, sessionScope, cacheKey, activeConversationId, activeChannelId, targetLanguage])
  const latestVisit = useLatest(visit)
  const callbacks = useLatest({
    apiFetch, purgeConversation, refreshConversations, resetMessageChanges,
    pendingSend, setConversations, setMessageDrafts, setNotice, setTranslations,
  })
  const mounted = useRef(false)
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])
  const historyGeneration = useRef(0)
  const isCurrentVisit = useCallback((expected: typeof visit) => mounted.current &&
    latestVisit.current === expected && sessionRef.current?.sessionId === expected.sessionId &&
    sessionRef.current?.user.id === expected.userId &&
    activeConversationIdRef.current === expected.conversationId &&
    activeChannelIdRef.current === expected.channelId,
  [latestVisit, sessionRef, activeConversationIdRef, activeChannelIdRef])

  // History is render state, scoped to one authenticated account and keyed by room/channel/language.
  const [history, setHistory] = useState(() => ({ scope: sessionScope, rooms: new Map<string, Message[]>() }))
  if (history.scope !== sessionScope) setHistory({ scope: sessionScope, rooms: new Map() })
  const messages = cacheKey && history.scope === sessionScope ? history.rooms.get(cacheKey) ?? emptyMessages : emptyMessages

  const setMessages = useCallback((update: SetStateAction<Message[]>) => {
    const owner = latestVisit.current
    if (!owner.cacheKey || !isCurrentVisit(owner)) return
    setHistory(previous => {
      if (previous.scope !== owner.sessionScope) return previous
      const current = previous.rooms.get(owner.cacheKey) ?? emptyMessages
      const rows = typeof update === 'function' ? update(current) : update
      if (rows === current || (rows.length === 0 && current.length === 0)) return previous
      const rooms = new Map(previous.rooms)
      rooms.delete(owner.cacheKey)
      if (rows.length > 0) rooms.set(owner.cacheKey, rows)
      while (rooms.size > 10) rooms.delete(rooms.keys().next().value!)
      return { scope: previous.scope, rooms }
    })
  }, [isCurrentVisit, latestVisit])

  const removeConversationHistory = useCallback((conversationId: number) => {
    const scope = latestVisit.current.sessionScope
    setHistory(previous => {
      if (previous.scope !== scope) return previous
      const rooms = new Map(previous.rooms)
      for (const key of rooms.keys()) {
        if (key.startsWith(conversationId + ':')) rooms.delete(key)
      }
      return rooms.size === previous.rooms.size ? previous : { scope, rooms }
    })
  }, [latestVisit])
  const [retryRevision, setRetryRevision] = useState(0)
  const retryMessageHistory = useCallback(() => setRetryRevision(current => current + 1), [])
  const [reconnectRevision, setReconnectRevision] = useState(0)
  useEffect(() => {
    const refreshOnReconnect = (event: Event) => {
      const detail = (event as CustomEvent<{ sessionId?: string }>).detail
      if (detail?.sessionId !== session?.sessionId || sessionRef.current !== session) return
      historyGeneration.current += 1
      setReconnectRevision(current => current + 1)
    }
    window.addEventListener('chatnet:sse-reconnected', refreshOnReconnect)
    return () => window.removeEventListener('chatnet:sse-reconnected', refreshOnReconnect)
  }, [session, sessionRef])
  const [hasMoreMessages, setHasMoreMessages] = useState(false)
  const [messagesLoadingMore, setMessagesLoadingMore] = useState(false)
  const [messageGapBefore, setMessageGapBefore] = useState<number | null>(null)
  const [messageGapLoading, setMessageGapLoading] = useState(false)
  const gapPagingBusy = useRef(false)
  const messagesPagingBusy = useRef(false)
  const pendingMessageScrollRestore = useRef<{ height: number; top: number } | null>(null)
  const [privacyRevision, setPrivacyRevision] = useState(0)
  const paginationVisit = useMemo(() => ({
    visit, token, translationPreferencesLoaded, activeConversationType, jumpToMessage, privacyRevision, reconnectRevision,
  }), [visit, token, translationPreferencesLoaded, activeConversationType, jumpToMessage, privacyRevision, reconnectRevision])
  const [previousPaginationVisit, setPreviousPaginationVisit] = useState(paginationVisit)
  if (paginationVisit !== previousPaginationVisit) {
    setPreviousPaginationVisit(paginationVisit)
    setHasMoreMessages(false)
    setMessagesLoadingMore(false)
    setMessageGapBefore(null)
    setMessageGapLoading(false)
  }

  // A new identity means a new load, so "loading" is derived until this exact request has a result.
  const historyRequest = useMemo(() => ({
    visit, token, translationPreferencesLoaded, activeConversationType, jumpToMessage,
    privacyRevision, reconnectRevision, retryRevision,
  }), [visit, token, translationPreferencesLoaded, activeConversationType, jumpToMessage,
    privacyRevision, reconnectRevision, retryRevision])
  const [historyResult, setHistoryResult] = useState<{
    request: typeof historyRequest; state: 'ready' | 'error'
  } | null>(null)
  const messageHistoryLoading = Boolean(token && activeConversationId && translationPreferencesLoaded &&
    historyResult?.request !== historyRequest)
  const messageHistoryError = historyResult?.request === historyRequest && historyResult.state === 'error'

  useEffect(() => {
    const refresh = () => {
      historyGeneration.current += 1
      setHistory(previous => ({ scope: previous.scope, rooms: new Map() }))
      setPrivacyRevision(current => current + 1)
    }
    const clearHistory = (event: Event) => {
      const conversationId = (event as CustomEvent<{conversationId?: number}>).detail?.conversationId
      if (conversationId === undefined) return
      if (activeConversationIdRef.current === conversationId) {
        historyGeneration.current += 1
        gapPagingBusy.current = false
        messagesPagingBusy.current = false
        setHasMoreMessages(false)
        setMessagesLoadingMore(false)
        setMessageGapBefore(null)
        setMessageGapLoading(false)
        pendingMessageScrollRestore.current = null
      }
      removeConversationHistory(conversationId)
    }
    window.addEventListener('chatnet:privacy-updated', refresh)
    window.addEventListener('chatnet:message-history-cleared', clearHistory)
    return () => {
      window.removeEventListener('chatnet:privacy-updated', refresh)
      window.removeEventListener('chatnet:message-history-cleared', clearHistory)
    }
  }, [activeConversationIdRef, removeConversationHistory])

  useEffect(() => {
    const { conversationId, channelId, sessionId, userId, targetLanguage } = visit
    if (!token || !sessionId || userId === undefined || !conversationId || !translationPreferencesLoaded) return
    const generation = historyGeneration.current
    let cancelled = false
    const isCurrent = () => !cancelled && historyGeneration.current === generation && isCurrentVisit(visit)
    const { apiFetch, purgeConversation, refreshConversations, resetMessageChanges,
      pendingSend, setConversations, setMessageDrafts, setNotice, setTranslations } = callbacks.current
    gapPagingBusy.current = false
    messagesPagingBusy.current = false
    pendingMessageScrollRestore.current = null
    const changes = new Set<number>()
    resetMessageChanges(changes)
    setTranslations({})
    const jump = jumpToMessage?.conversationId === conversationId ? jumpToMessage : null
    const pageSize = jump ? 80 : MESSAGE_PAGE_SIZE
    const page = { conversationId, target: targetLanguage, channelId }
    const requestedPages = [
      listMessages(apiFetch, { ...page, limit: pageSize, before: jump ? jump.messageId + 1 : undefined }),
      ...(jump ? [listMessages(apiFetch, { ...page, limit: 200 })] : []),
    ]
    Promise.all(requestedPages)
      .then(async (responses) => {
        if (!isCurrent()) return
        if (responses.some((response) => response.status === 403)) {
          setHistoryResult({ request: historyRequest, state: 'error' })
          removeConversationHistory(conversationId)
          purgeConversation(conversationId)
          return
        }
        if (responses.some((response) => !response.ok)) throw new Error('Không tải được tin nhắn')
        const pages = await Promise.all(responses.map(async (response) => (await response.json()) as Message[]))
        if (!isCurrent()) return
        // Include the targeted history and newer messages from BOTH participants.
        const byId = new Map(pages.flat().map((item) => [item.id, item]))
        const data = [...byId.values()].filter(item => item.conversationId === conversationId &&
          (item.channelId || 0) === channelId).sort((a, b) => a.id - b.id)
        // Reconcile a POST whose ACK vanished before refresh. A persisted
        // clientId in history is proof of delivery; no second POST is needed.
        const recovered = loadPendingSend(userId, sessionId)
        const confirmed = recovered && data.find((item) => item.clientId === recovered.clientId && item.conversationId === recovered.conversationId)
        if (confirmed && recovered) {
          clearPendingSend(userId, recovered.clientId)
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
          const live = current.filter((item) => item.conversationId === conversationId && (item.channelId || 0) === channelId && changes.has(item.id))
          const existing = jump ? current.filter((item) => item.conversationId === conversationId && (item.channelId || 0) === channelId) : []
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
        setHistoryResult({ request: historyRequest, state: 'ready' })
        if (!canMarkConversationRead(activeConversationIdRef.current, conversationId, tabRef.current, document.visibilityState, !isDesktopBuild || document.hasFocus())) return
        const read = activeConversationType === 'group'
          ? await markChannelRead(apiFetch, conversationId, channelId)
          : await markConversationRead(apiFetch, conversationId)
        if (!read.ok || !isCurrent()) return
        refreshDesktopUnread()
        if (activeConversationType === 'group') {
          window.dispatchEvent(new CustomEvent('chatnet:channel-read',{detail:{conversationId,channelId}}))
          void refreshConversations()
        } else {
          setConversations((current) =>
            current.map((item) =>
              item.id === conversationId ? { ...item, unreadCount: 0 } : item,
            ),
          )
        }
      })
      .catch(() => {
        if (isCurrent()) {
          setHistoryResult({ request: historyRequest, state: 'error' })
          setNotice('Không tải được tin nhắn. Kiểm tra kết nối rồi thử lại.', 'error')
        }
      })

    return () => {
      cancelled = true
    }
  }, [activeConversationIdRef, activeConversationType, callbacks, historyRequest, isCurrentVisit, jumpToMessage,
    removeConversationHistory, setMessages, tabRef, token, translationPreferencesLoaded, visit])

  useEffect(() => {
    const { conversationId: id, channelId } = visit
    if (!token || !id) return
    let cancelled = false
    const markWhenVisible = () => {
      if (cancelled || !isCurrentVisit(visit)) return
      if (!canMarkConversationRead(activeConversationIdRef.current, id, tabRef.current, document.visibilityState, !isDesktopBuild || document.hasFocus())) return
      const { apiFetch, refreshConversations, setConversations } = callbacks.current
      void (activeConversationType === 'group'
        ? markChannelRead(apiFetch, id, channelId)
        : markConversationRead(apiFetch, id))
        .then((response) => {
          if (!response.ok || cancelled || !isCurrentVisit(visit)) return
          refreshDesktopUnread()
          if (activeConversationType === 'group') {
            window.dispatchEvent(new CustomEvent('chatnet:channel-read',{detail:{conversationId:id,channelId}}))
            void refreshConversations()
          } else {
            setConversations((current) =>
              current.map((item) => item.id === id ? { ...item, unreadCount: 0 } : item),
            )
          }
        })
        .catch(() => undefined)
    }
    window.addEventListener('focus', markWhenVisible)
    document.addEventListener('visibilitychange', markWhenVisible)
    return () => {
      cancelled = true
      window.removeEventListener('focus', markWhenVisible)
      document.removeEventListener('visibilitychange', markWhenVisible)
    }
  }, [activeConversationIdRef, activeConversationType, callbacks, isCurrentVisit, tabRef, token, visit])

  async function loadMissingMessages() {
    if (!session || !activeConversationId || !messageGapBefore || gapPagingBusy.current) return
    const conversationId = activeConversationId
    const before = messageGapBefore
    const generation = historyGeneration.current
    gapPagingBusy.current = true
    setMessageGapLoading(true)
    try {
      const response = await listMessages(apiFetch, { conversationId, target: targetLanguage, channelId: activeChannelId, limit: 80, before })
      if (!response.ok) throw new Error('Không tải được tin nhắn ở giữa')
      const data = (await response.json()) as Message[]
      if (!isCurrentVisit(visit) || historyGeneration.current !== generation) return
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
      if (isCurrentVisit(visit) && historyGeneration.current === generation)
        setNotice('Không tải được đoạn tin nhắn ở giữa. Hãy thử lại.', 'error')
    } finally {
      if (isCurrentVisit(visit) && historyGeneration.current === generation) {
        gapPagingBusy.current = false
        setMessageGapLoading(false)
      }
    }
  }

  async function loadOlderMessages() {
    if (!session || !activeConversationId || messagesPagingBusy.current ||
        !hasMoreMessages || messages.length === 0) return
    const conversationId = activeConversationId
    const before = Math.min(...messages.map((message) => message.id))
    const generation = historyGeneration.current
    messagesPagingBusy.current = true
    setMessagesLoadingMore(true)
    try {
      const response = await listMessages(apiFetch, { conversationId, target: targetLanguage, channelId: activeChannelId, limit: MESSAGE_PAGE_SIZE, before })
      if (!response.ok) throw new Error('Không tải thêm được lịch sử tin nhắn')
      const data = (await response.json()) as Message[]
      if (!isCurrentVisit(visit) || historyGeneration.current !== generation) return
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
      if (isCurrentVisit(visit) && historyGeneration.current === generation)
        setNotice('Không tải được tin nhắn cũ. Hãy thử lại.', 'error')
    } finally {
      if (isCurrentVisit(visit) && historyGeneration.current === generation) {
        messagesPagingBusy.current = false
        setMessagesLoadingMore(false)
      }
    }
  }


  return {
    messages,
    setMessages,
    messageHistoryLoading,
    messageHistoryError,
    retryMessageHistory,
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
