import type { SessionResponseCache } from '../../shared/lib/sessionCache'
import { useEffect, type Dispatch, type RefObject, type SetStateAction } from 'react'
import { API } from '../../shared/lib/config'
import { isDesktopBuild } from '../../platform/desktop'
import { notifyDesktopMessage, clearDesktopNotifications, refreshDesktopUnread } from '../../features/chat/hooks/useDesktopNotifications'
import { attachmentLabel } from '../../shared/utils/format'
import { mergeById } from '../../shared/utils/optimistic'
import { canMarkConversationRead } from '../../features/chat/utils/conversationRead'
import { clearPendingSend, loadPendingSend } from '../../features/chat/lib/chatPersistence'
import type { Message, MessageDraft } from '../../features/chat/types'
import { parseRealtimeEvent } from './parseRealtimeEvent'
import type { IncomingMessageSound } from '../../features/notifications/lib/incomingSound'
import type { AppDataContext } from '../../shared/types/api'
import type { Tab } from '../../shared/types/navigation'
import type { useConversationData } from '../../features/chat/hooks/useConversationData'
import type { useFeedData } from '../../features/feed/hooks/useFeedData'
import type { useContactData } from '../../features/contacts/hooks/useContactData'

type Options = Omit<AppDataContext, 'setNotice'> &
  Pick<ReturnType<typeof useConversationData>,
    'refreshConversations' | 'reconcileConversationMemberships' | 'revokedConversationIds' |
    'membershipSnapshot' | 'membershipEventSequence' | 'membershipSyncSequence' | 'setConversations'> &
  Pick<ReturnType<typeof useFeedData>, 'refreshPosts' | 'refreshStories'> &
  Pick<ReturnType<typeof useContactData>, 'refreshFriendConnections'> & {
    onCategoryAssignmentChanged: (id: number, categoryId: number | null) => void
    onCategoriesChanged: () => void
    refreshCategoryConversations: () => void
    responseCache: RefObject<SessionResponseCache>
    expireSession: () => void
    checkSession: () => Promise<boolean>
    purgeConversation: (id: number) => void
    activeConversationIdRef: RefObject<number | null>
    activeChannelIdRef: RefObject<number>
    activeConversationTypeRef: RefObject<'group' | 'direct' | null>
    refreshGroupMembers: (id: number) => Promise<void>
    refreshPinnedMessages: (id: number) => Promise<void>
    clearPinnedMessages: () => void
    setMessages: Dispatch<SetStateAction<Message[]>>
    messageChanges: RefObject<Set<number>>
    setTranslations: Dispatch<SetStateAction<Record<number, string>>>
    messageSound: RefObject<IncomingMessageSound | null>
    messageSoundEnabledRef: RefObject<boolean>
    tabRef: RefObject<Tab>
    pendingSend: RefObject<{
      sessionId: string; conversationId: number; signature: string; clientId: string; draft: MessageDraft
    } | null>
    setMessageDrafts: Dispatch<SetStateAction<Record<number, MessageDraft>>>
    messageReceipts: RefObject<Map<string, Message | null>>
    setOutgoingMessage: Dispatch<SetStateAction<Message | null>>
    onMessageConfirmed: (message: Message) => void
  }

export function useAppRealtime({
  onCategoryAssignmentChanged,
  onCategoriesChanged,
  refreshCategoryConversations,
  responseCache,
  expireSession,
  checkSession,
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
  onMessageConfirmed,
}: Options) {
  useEffect(() => {
    if (!session?.token || sessionRef.current?.sessionId !== session.sessionId) return

    void refreshConversations()
    void refreshPosts()
    void refreshStories()

    let active = true
    let lastSSECheckAt = 0
    const events = new EventSource(
      `${API}/api/events?token=${encodeURIComponent(session.token)}`,
    )
    events.onopen = () => {
      if (!active || sessionRef.current?.sessionId !== session.sessionId) return
      lastSSECheckAt = Date.now()
      setStatus('Đang online')
      void refreshFriendConnections()
      void reconcileConversationMemberships()
    }
    events.onerror = () => {
      if (!active || sessionRef.current?.sessionId !== session.sessionId) return
      setStatus('Đang kết nối lại...')
      if (Date.now() - lastSSECheckAt < 30_000) return
      lastSSECheckAt = Date.now()
      if (document.visibilityState === 'visible' && sessionRef.current?.sessionId === session.sessionId) {
        void checkSession().catch(() => undefined)
      }
    }
    events.addEventListener('session-revoked', () => {
      if (active && sessionRef.current?.sessionId === session.sessionId) expireSession()
    })
    events.addEventListener('update', (event) => {
      if (!active || sessionRef.current?.sessionId !== session.sessionId) return
      const update = parseRealtimeEvent((event as MessageEvent).data)
      if (!update) return
      if (['message', 'conversation.read', 'conversation.created', 'conversation.removed', 'privacy.updated'].includes(update.type)) refreshDesktopUnread()
      if (update.type === 'privacy.updated' || update.type === 'conversation.removed') clearDesktopNotifications(session.sessionId)
      if (update.type === 'privacy.updated') {
        // Remove potentially forbidden content immediately; refetch using current access rules.
        responseCache.current.invalidate(['messages', 'conversations', 'friends', 'feed', 'stories', 'profiles', 'notes'])
        setMessages([])
        window.dispatchEvent(new Event('chatnet:privacy-updated'))
        clearPinnedMessages()
        if (activeConversationIdRef.current) void refreshPinnedMessages(activeConversationIdRef.current)
        void refreshConversations()
        void refreshFriendConnections()
        void refreshPosts()
        void refreshStories()
        void reconcileConversationMemberships()
        return
      }
      if (update.type === 'group.activity') {
        window.dispatchEvent(new CustomEvent('chatnet:group-activity', { detail: update.conversationId }))
        return
      }
      if (update.type === 'category.updated') {
        if (update.conversationId > 0) {
          responseCache.current.invalidate(['conversations'])
          onCategoryAssignmentChanged(update.conversationId, update.categoryId || null)
          return
        }
        responseCache.current.invalidate(['categories','conversations'])
        onCategoriesChanged()
        void refreshConversations()
        return
      }
      if (update.type === 'friend.updated') {
        responseCache.current.invalidate(['friends','feed','stories','profiles','notes'])
        void refreshFriendConnections()
        return
      }

      if (update.type === 'conversation.removed') {
        responseCache.current.invalidate(['conversations','messages'])
        if (activeConversationIdRef.current === update.conversationId) clearPinnedMessages()
        purgeConversation(update.conversationId)
        refreshCategoryConversations()
        return
      }

      if (update.type === 'pins.updated') {
        if (activeConversationIdRef.current === update.conversationId) {
          void refreshPinnedMessages(update.conversationId)
        }
        return
      }

      if (update.type === 'conversation.created' || update.type === 'conversation.updated') {
        responseCache.current.invalidate(['conversations','messages'])
        window.dispatchEvent(new CustomEvent('chatnet:group-community-updated',{detail:{conversationId:update.conversationId}}))
        revokedConversationIds.current.delete(update.conversationId)
        membershipSnapshot.current?.add(update.conversationId)
        membershipEventSequence.current += 1
        void refreshConversations()
        refreshCategoryConversations()
        if (activeConversationIdRef.current === update.conversationId) {
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
        responseCache.current.invalidate(['messages','conversations'])
        const changed = update.message
        if (activeConversationTypeRef.current === 'group' && activeConversationIdRef.current === changed.conversationId)
          window.dispatchEvent(new CustomEvent('chatnet:group-channel-event',{detail:{type:'updated',message:changed}}))
        messageChanges.current.add(changed.id)
        if ((changed.channelId || 0) === activeChannelIdRef.current && activeConversationIdRef.current === update.conversationId) {
          setMessages((current) => {
            const item = current.find((message) => message.id === changed.id)
            return mergeById(current, {
              ...changed,
              readByUserIds: [...new Set([...(item?.readByUserIds || []), ...(changed.readByUserIds || [])])],
              // The backend now personalizes "mine" for each realtime recipient.
              reactions: changed.reactions || [],
            }).sort((a, b) => a.id - b.id)
          })
          setTranslations((current) => {
            const next = { ...current }
            delete next[changed.id]
            return next
          })
          // Edits and recalls must refresh the preview shown in the pinned banner.
          void refreshPinnedMessages(update.conversationId)
        }
        void refreshConversations()
        refreshCategoryConversations()
        return
      }

      if (update.type === 'message' && update.message) {
        responseCache.current.invalidate(['messages','conversations'])
        const incoming = update.message
        if (activeConversationTypeRef.current === 'group' && activeConversationIdRef.current === incoming.conversationId)
          window.dispatchEvent(new CustomEvent('chatnet:group-channel-event',{detail:{type:'message',message:incoming}}))
        // Only genuine, recent messages from other users make a sound. Loading
        // history, updating reactions and our own sends never trigger one.
        const viewingDesktopChat = isDesktopBuild && document.hasFocus() && document.visibilityState === 'visible' &&
          tabRef.current === 'chat' && activeConversationIdRef.current === incoming.conversationId &&
          (activeConversationTypeRef.current !== 'group' || activeChannelIdRef.current === (incoming.channelId || 0))
        messageSound.current?.onIncoming(incoming, session.user.id, messageSoundEnabledRef.current && !viewingDesktopChat)
        notifyDesktopMessage(session, incoming)
        messageChanges.current.add(incoming.id)
        if (incoming.senderId === session.user.id && incoming.clientId) {
          onMessageConfirmed(incoming)
          const recovered = loadPendingSend(session.user.id, session.sessionId)
          if (recovered?.clientId === incoming.clientId && recovered.conversationId === incoming.conversationId) {
            clearPendingSend(session.user.id, incoming.clientId)
            if (!incoming.channelId) setMessageDrafts((current) => {
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
                      (!canMarkConversationRead(currentId, item.id, tabRef.current, document.visibilityState, !isDesktopBuild || document.hasFocus()) ||
                        (activeConversationTypeRef.current === 'group' && activeChannelIdRef.current !== (incoming.channelId || 0)))
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
        refreshCategoryConversations()

        if ((incoming.channelId || 0) === activeChannelIdRef.current && currentId === update.conversationId) {
          setMessages((current) =>
            current.some((item) => item.id === incoming.id)
              ? current
              : [...current, incoming],
          )
          if (incoming.senderId !== session.user.id &&
              canMarkConversationRead(currentId, update.conversationId, tabRef.current, document.visibilityState, !isDesktopBuild || document.hasFocus())) {
            const group = activeConversationTypeRef.current === 'group'
            void apiFetch(group
              ? `/api/conversations/${update.conversationId}/channel-read`
              : `/api/conversations/${update.conversationId}/read`, group
              ? { method: 'POST', headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ channelId: activeChannelIdRef.current }) }
              : { method: 'POST' })
              .then(response => {
                if (active && sessionRef.current?.sessionId === session.sessionId && response.ok && group)
                  window.dispatchEvent(new CustomEvent('chatnet:channel-read',{detail:{
                    conversationId:update.conversationId, channelId:incoming.channelId || 0,
                  }}))
              })
              .catch(() => {
                if (active && sessionRef.current?.sessionId === session.sessionId) setStatus('Đang kết nối lại...')
              })
          }
        }
      }
    })

    const refreshTimer = window.setInterval(() => {
      if (!active || sessionRef.current?.sessionId !== session.sessionId || document.visibilityState !== 'visible') return
      void refreshConversations()
      void refreshFriendConnections()
      refreshCategoryConversations()
    }, 20000)
    const membershipTimer = window.setInterval(() => {
      if (!active || sessionRef.current?.sessionId !== session.sessionId) return
      void reconcileConversationMemberships()
    }, 90000)
    const checkMembership = () => {
      if (active && sessionRef.current?.sessionId === session.sessionId) void reconcileConversationMemberships()
    }
    const checkVisibleMembership = () => {
      if (active && sessionRef.current?.sessionId === session.sessionId && document.visibilityState === 'visible') {
        checkMembership()
        void refreshConversations()
        refreshCategoryConversations()
        void refreshFriendConnections()
      }
    }
    window.addEventListener('online', checkMembership)
    document.addEventListener('visibilitychange', checkVisibleMembership)
    return () => {
      active = false
      events.close()
      window.clearInterval(refreshTimer)
      window.clearInterval(membershipTimer)
      window.removeEventListener('online', checkMembership)
      document.removeEventListener('visibilitychange', checkVisibleMembership)
      membershipSyncSequence.current += 1
    }
  }, [session?.token, session?.sessionId])

}