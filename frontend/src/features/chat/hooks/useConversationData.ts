import { useRef, useState, type Dispatch, type RefObject, type SetStateAction } from 'react'
import type { AppDataContext } from '../../../shared/types/api'
import { listConversations, listGroupConversations, listMembershipIds } from '../api/conversations'
import { loadVerifiedMembershipSnapshot } from '../lib/membershipSnapshot'
import { appendConversationPage, loadVerifiedConversationPage } from '../lib/conversationPages'
import { CHAT_LIST_PAGE_SIZE, type Conversation, type MessageDraft } from '../types'
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
  const refreshSequence = useRef(0)
  const pagingSequence = useRef(0)
  const pagingOwnerSession = useRef<string | null>(null)
  const [conversationListError, setConversationListError] = useState('')
  const lastGroupSync = useRef<{ sessionId: string; at: number } | null>(null)

  // The avatar rail replaces the old list, so include older groups even when
  // their last activity falls beyond the first page of direct conversations.
  async function loadEarlierGroups(sessionId: string) {
    if (lastGroupSync.current?.sessionId === sessionId &&
        Date.now() - lastGroupSync.current.at < 120_000) return
    lastGroupSync.current = { sessionId, at: Date.now() }
    // Show the first page immediately, then merge subsequent pages in batches.
    // This avoids a full conversation-rail render for every page of old groups.
    const buffered = new Map<number, Conversation>()
    const flushGroups = () => {
      if (!buffered.size || sessionRef.current?.sessionId !== sessionId) return
      const groups = [...buffered.values()].filter(item =>
        !revokedConversationIds.current.has(item.id) &&
        (!membershipSnapshot.current || membershipSnapshot.current.has(item.id)))
      buffered.clear()
      if (!groups.length) return
      setConversations(current => {
        const fresh = new Map(groups.map(item => [item.id, item]))
        const existingIds = new Set(current.map(item => item.id))
        return [...current.map(item => fresh.get(item.id) || item),
          ...groups.filter(item => !existingIds.has(item.id))]
      })
    }
    try {
      for (let offset = 0; offset < 2000; offset += 100) {
        const response = await listGroupConversations(apiFetch, 100, offset)
        if (!response.ok) break
        const page = (await response.json()) as Conversation[]
        if (!Array.isArray(page) || sessionRef.current?.sessionId !== sessionId) return
        for (const item of page) {
          if (item.type === 'group') buffered.set(item.id, item)
        }
        if (offset === 0 || offset % 500 === 400 || page.length < 100) flushGroups()
        if (page.length < 100) break
      }
    } catch {
      // Keep groups from successful pages if a later request fails.
    } finally {
      flushGroups()
    }
  }

  async function reconcileConversationMemberships() {
    const sessionId = session?.sessionId;
    if (!sessionId) return;
    const sequence = ++membershipSyncSequence.current;
    const membershipEventAtStart = membershipEventSequence.current;
    const isCurrent = () =>
      sessionRef.current?.sessionId === sessionId &&
      sequence === membershipSyncSequence.current &&
      membershipEventAtStart === membershipEventSequence.current;

    // Never revoke access from incomplete pages, network errors, or stale data.
    const authorized = await loadVerifiedMembershipSnapshot(
      after => listMembershipIds(apiFetch, after),
      isCurrent,
    );
    if (!authorized || !isCurrent()) return;

    membershipSnapshot.current = authorized;
    for (const id of authorized) revokedConversationIds.current.delete(id);
    setConversations(current => current.filter(item => authorized.has(item.id)));
    setMessageDrafts(current => Object.fromEntries(
      Object.entries(current).filter(([id]) => authorized.has(Number(id))),
    ));
    if (activeConversationIdRef.current && !authorized.has(activeConversationIdRef.current)) {
      purgeConversation(activeConversationIdRef.current);
    }
    void refreshConversations();
  }

  async function refreshConversations() {
    const sessionId = session?.sessionId
    if (!sessionId || sessionRef.current?.sessionId !== sessionId) return
    const requestSequence = ++refreshSequence.current
    const isCurrent = () => sessionRef.current?.sessionId === sessionId &&
      refreshSequence.current === requestSequence
    const page = await loadVerifiedConversationPage(
      () => listConversations(apiFetch, CHAT_LIST_PAGE_SIZE),
      isCurrent,
    )
    if (!isCurrent()) return
    if (!page) {
      setConversationListError('Không tải được danh sách hội thoại từ máy chủ.')
      setStatus('Đang kết nối lại...')
      return
    }
    const data = page.filter(item => !revokedConversationIds.current.has(item.id) &&
      (!membershipSnapshot.current || membershipSnapshot.current.has(item.id)))
    setConversationListError('')
    setConversations(current => {
      if (!isCurrent()) return current
      const freshIds = new Set(data.map(item => item.id))
      return [...data, ...current.filter(item => !freshIds.has(item.id))]
    })
    conversationOffset.current = Math.max(conversationOffset.current, page.length)
    if (conversationOffset.current === page.length) setHasMoreConversations(page.length === CHAT_LIST_PAGE_SIZE)
    void loadEarlierGroups(sessionId)
  }

  async function loadMoreConversations() {
    if (!session || sessionRef.current?.sessionId !== session.sessionId || !hasMoreConversations) return
    const sessionId = session.sessionId
    if (conversationPagingBusy.current && pagingOwnerSession.current === sessionId) return
    const requestSequence = ++pagingSequence.current
    pagingOwnerSession.current = sessionId
    const offset = conversationOffset.current
    const isCurrent = () => sessionRef.current?.sessionId === sessionId &&
      pagingSequence.current === requestSequence
    conversationPagingBusy.current = true
    setConversationLoadingMore(true)
    try {
      const data = await loadVerifiedConversationPage(
        () => listConversations(apiFetch, CHAT_LIST_PAGE_SIZE, offset),
        isCurrent,
      )
      if (!isCurrent()) return
      if (!data) {
        setNotice('Không tải thêm được hội thoại. Hãy thử lại.', 'error')
        return
      }
      conversationOffset.current = offset + data.length
      setHasMoreConversations(data.length === CHAT_LIST_PAGE_SIZE)
      setConversations(current => {
        if (!isCurrent()) return current
        return appendConversationPage(current, data, item =>
          !revokedConversationIds.current.has(item.id) &&
          (!membershipSnapshot.current || membershipSnapshot.current.has(item.id)))
      })
    } finally {
      // An earlier session's request must never release a newer page request.
      if (isCurrent()) {
        conversationPagingBusy.current = false
        pagingOwnerSession.current = null
        setConversationLoadingMore(false)
      }
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
    conversationListError,
    setConversationLoadingMore,
    conversationPagingBusy,
    conversationOffset,
    reconcileConversationMemberships,
    refreshConversations,
    loadMoreConversations,
  }
}
