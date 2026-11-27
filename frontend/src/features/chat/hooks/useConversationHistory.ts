import { useMemo, type Dispatch, type RefObject, type SetStateAction } from "react";
import { useLatest } from "../../../shared/hooks/useLatest";
import { useApi } from "../../../shared/context/ApiContext";
import { useNotice } from "../../../shared/context/NoticeContext";
import { useSession } from "../../../shared/context/SessionContext";
import { SessionResponseCache } from "../../../shared/lib/sessionCache";
import { clearConversationHistory } from "../api/conversations";
import type { Conversation, Message } from "../types";

export type UseConversationHistoryDeps = {
  activeConversationId: number | null;
  activeConversationIdRef: RefObject<number | null>;
  conversations: Conversation[];
  historyActionBusy: boolean;
  refreshConversations: () => Promise<void>;
  onHistoryCleared: (id: number) => void;
  responseCache: RefObject<SessionResponseCache>;
  setActiveConversationId: Dispatch<SetStateAction<number | null>>;
  setConversationDetailsOpen: Dispatch<SetStateAction<boolean>>;
  setHasMoreMessages: Dispatch<SetStateAction<boolean>>;
  setHistoryActionBusy: Dispatch<SetStateAction<boolean>>;
  setMessageSearchOpen: Dispatch<SetStateAction<boolean>>;
  setMessages: Dispatch<SetStateAction<Message[]>>;
  setReplyingTo: Dispatch<SetStateAction<Message | null>>;
  setSharedContentOpen: Dispatch<SetStateAction<boolean>>;
  setTranslations: Dispatch<SetStateAction<Record<number, string>>>;
};

/** Clears the signed-in user's own history for the active conversation. */
export function useConversationHistory({
  activeConversationId,
  activeConversationIdRef,
  conversations,
  historyActionBusy,
  refreshConversations,
  onHistoryCleared,
  responseCache,
  setActiveConversationId,
  setConversationDetailsOpen,
  setHasMoreMessages,
  setHistoryActionBusy,
  setMessageSearchOpen,
  setMessages,
  setReplyingTo,
  setSharedContentOpen,
  setTranslations,
}: UseConversationHistoryDeps) {
  const { apiFetch } = useApi();
  const { setNotice } = useNotice();
  const { session, sessionRef } = useSession();
  // Guard the whole visit, not just sessionId: returning A → B → A is a new visit.
  const visit = useMemo(() => ({ sessionId: session?.sessionId, userId: session?.user.id }),
    [session?.sessionId, session?.user.id]);
  const latestVisit = useLatest(visit);
  const latestHistoryCleared = useLatest(onHistoryCleared);
  async function clearActiveConversationHistory() {
    const current = conversations.find((item) => item.id === activeConversationId)
    if (current) await clearSelectedConversationHistory(current)
  }

  async function clearSelectedConversationHistory(current: Conversation) {
    const sessionId = session?.sessionId
    const isCurrent = () => latestVisit.current === visit && sessionRef.current?.sessionId === sessionId
    if (!current || !sessionId || !isCurrent() || historyActionBusy) return
    if (!window.confirm(`Xóa lịch sử trò chuyện với ${current.name} trên tài khoản của bạn?\nNgười khác vẫn giữ lịch sử của họ. Bạn không thể khôi phục các tin nhắn cũ sau thao tác này.`)) return
    setHistoryActionBusy(true)
    try {
      const response = await clearConversationHistory(apiFetch, current.id)
      if (!response.ok) {
        const data = await response.json().catch(() => null) as { error?: string } | null
        throw new Error(data?.error || 'Không xóa được lịch sử trò chuyện.')
      }
      const result = await response.json().catch(() => null) as { historyHidden?: boolean } | null
      if (!isCurrent()) return
      responseCache.current.invalidate(['conversations', 'messages'])
      latestHistoryCleared.current(current.id)
      // A cleared history must never be resurrected from the mobile
      // recently-visited conversation cache.
      window.dispatchEvent(new CustomEvent('chatnet:message-history-cleared',
        { detail: { conversationId: current.id } }))
      if (activeConversationIdRef.current === current.id) {
        setActiveConversationId(null)
        setMessages([])
        setHasMoreMessages(false)
        setTranslations({})
        setReplyingTo(null)
        setSharedContentOpen(false)
        setMessageSearchOpen(false)
        setConversationDetailsOpen(false)
      }
      if (result?.historyHidden === true) {
        setNotice('Đã xóa cuộc trò chuyện khỏi tài khoản của bạn.', 'success')
      } else {
        setNotice('Đã xóa lịch sử, nhưng máy chủ chưa hỗ trợ ẩn hội thoại. Cần cập nhật Backend.', 'warning')
      }
      void refreshConversations()
    } catch (error) {
      if (isCurrent()) setNotice(error instanceof Error ? error.message : 'Không xóa được lịch sử trò chuyện.', 'error')
    } finally {
      setHistoryActionBusy(false)
    }
  }

  return { clearActiveConversationHistory, clearSelectedConversationHistory };
}
