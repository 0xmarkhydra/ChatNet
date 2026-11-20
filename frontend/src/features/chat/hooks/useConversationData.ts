import { useRef, useState, type Dispatch, type RefObject, type SetStateAction } from 'react'
import type { AppDataContext } from '../../../shared/types/api'
import { listConversations, listGroupConversations, listMembershipIds } from '../api/conversations'
import { loadVerifiedMembershipSnapshot } from '../lib/membershipSnapshot'
import { appendConversationPage, loadVerifiedConversationPage } from '../lib/conversationPages'
import { mergeOlderGroups, scanOlderGroupPages } from '../lib/olderGroupPages'
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

  // Avoid overlapping scans of the same session, but never cache a failed one.
  const olderGroupScan = useRef<{ sessionId: string; promise: Promise<void> } | null>(null)
  const olderGroupScanSequence = useRef(0)

  // The avatar rail also needs groups beyond the first direct-message page.
  function loadEarlierGroups(sessionId: string): Promise<void> {
    if (sessionRef.current?.sessionId !== sessionId) return Promise.resolve()
    if (olderGroupScan.current?.sessionId === sessionId) {
      return olderGroupScan.current.promise
    }
    if (lastGroupSync.current?.sessionId === sessionId &&
        Date.now() - lastGroupSync.current.at < 120_000) return Promise.resolve()

    const membershipRevision = membershipEventSequence.current
    const sequence = ++olderGroupScanSequence.current
    const isCurrent = () => sessionRef.current?.sessionId === sessionId &&
      olderGroupScanSequence.current === sequence &&
      membershipEventSequence.current === membershipRevision

    const promise = (async () => {
      // Yield once so the new scan lease is installed before the first request.
      await Promise.resolve()
      const completed = await scanOlderGroupPages({
        fetchPage: (limit, offset) => listGroupConversations(apiFetch, limit, offset),
        isCurrent,
        onBatch: groups => {
          if (!isCurrent()) return
          setConversations(current => {
            if (!isCurrent()) return current
            return mergeOlderGroups(current, groups, item =>
              !revokedConversationIds.current.has(item.id) &&
              (!membershipSnapshot.current || membershipSnapshot.current.has(item.id)))
          })
        },
      })
      if (completed && isCurrent()) {
        lastGroupSync.current = { sessionId, at: Date.now() }
      }
    })()
    const scan = { sessionId, promise }
    olderGroupScan.current = scan
    void promise.finally(() => {
      if (olderGroupScan.current === scan) olderGroupScan.current = null
    })
    return promise
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
