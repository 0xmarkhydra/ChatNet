import { useRef, useState, type Dispatch, type RefObject, type SetStateAction } from 'react'
import type { AppDataContext } from '../../app/dataTypes'
import { CHAT_LIST_PAGE_SIZE, type Conversation, type MessageDraft } from './types'
type Options = AppDataContext & {
  activeConversationIdRef: RefObject<number | null>
  setMessageDrafts: Dispatch<SetStateAction<Record<number, MessageDraft>>>
  purgeConversation: (id: number) => void
}
export function useConversationData({
  session,
  sessionRef,
  apiFetch,
  setStatus,
  setNotice,
  activeConversationIdRef,
  setMessageDrafts,
  purgeConversation,
}: Options) {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const revokedConversationIds = useRef(new Set<number>())
  const membershipSnapshot = useRef<Set<number> | null>(null)
  const membershipSyncSequence = useRef(0)
  const membershipEventSequence = useRef(0)
  const [hasMoreConversations, setHasMoreConversations] = useState(false)
  const [conversationLoadingMore, setConversationLoadingMore] = useState(false)
  const conversationPagingBusy = useRef(false)
  const conversationOffset = useRef(0)

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


  return {
    conversations,
    setConversations,
    revokedConversationIds,
    membershipSnapshot,
    membershipSyncSequence,
    membershipEventSequence,
    hasMoreConversations,
    setHasMoreConversations,
    conversationLoadingMore,
    setConversationLoadingMore,
    conversationPagingBusy,
    conversationOffset,
    reconcileConversationMemberships,
    refreshConversations,
    loadMoreConversations,
  }
}
