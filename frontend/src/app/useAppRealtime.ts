import type { SessionResponseCache } from '../shared/lib/sessionCache'
import { useEffect, type Dispatch, type RefObject, type SetStateAction } from 'react'
import { API } from '../shared/lib/config'
import { attachmentLabel } from '../shared/lib/format'
import { mergeById } from '../shared/lib/optimistic'
import { canMarkConversationRead } from '../features/chat/conversationRead'
import { clearPendingSend, loadPendingSend } from '../features/chat/chatPersistence'
import type { Message, MessageDraft, RealtimeEvent } from '../features/chat/types'
import type { IncomingMessageSound } from '../features/notifications/incomingSound'
import type { AppDataContext } from './dataTypes'
import type { Tab } from './types'
import type { useConversationData } from '../features/chat/useConversationData'
import type { useFeedData } from '../features/feed/useFeedData'
import type { useContactData } from '../features/contacts/useContactData'

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
    groupSettingsOpen: boolean
    activeConversationIdRef: RefObject<number | null>
    refreshGroupMembers: (id: number) => Promise<void>
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
}: Options) {
  useEffect(() => {
    if (!session?.token) return

    void refreshConversations()
    void refreshPosts()
    void refreshStories()

    let lastSSECheckAt = 0
    const events = new EventSource(
      `${API}/api/events?token=${encodeURIComponent(session.token)}`,
    )
    events.onopen = () => {
      lastSSECheckAt = Date.now()
      setStatus('Đang online')
      void refreshFriendConnections()
      void reconcileConversationMemberships()
    }
    events.onerror = () => {
      setStatus('Đang kết nối lại...')
      if (Date.now() - lastSSECheckAt < 30_000) return
      lastSSECheckAt = Date.now()
      if (document.visibilityState === 'visible' && sessionRef.current?.sessionId === session.sessionId) {
        void checkSession().catch(() => undefined)
      }
    }
    events.addEventListener('session-revoked', () => {
      if (sessionRef.current?.sessionId === session.sessionId) expireSession()
    })
    events.addEventListener('update', (event) => {
      if (sessionRef.current?.sessionId !== session.sessionId) return
      const update = JSON.parse((event as MessageEvent).data) as RealtimeEvent
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
        purgeConversation(update.conversationId)
        refreshCategoryConversations()
        return
      }

      if (update.type === 'conversation.created' || update.type === 'conversation.updated') {
        responseCache.current.invalidate(['conversations','messages'])
        revokedConversationIds.current.delete(update.conversationId)
        membershipSnapshot.current?.add(update.conversationId)
        membershipEventSequence.current += 1
        void refreshConversations()
        refreshCategoryConversations()
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
        responseCache.current.invalidate(['messages','conversations'])
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
        refreshCategoryConversations()
        return
      }

      if (update.type === 'message' && update.message) {
        responseCache.current.invalidate(['messages','conversations'])
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
        refreshCategoryConversations()

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
      if (document.visibilityState !== 'visible') return
      void refreshConversations()
      void refreshFriendConnections()
      refreshCategoryConversations()
    }, 20000)
    const membershipTimer = window.setInterval(() => {
      void reconcileConversationMemberships()
    }, 90000)
    const checkMembership = () => { void reconcileConversationMemberships() }
    const checkVisibleMembership = () => {
      if (document.visibilityState === 'visible') {
        checkMembership()
        void refreshConversations()
        refreshCategoryConversations()
        void refreshFriendConnections()
      }
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

}