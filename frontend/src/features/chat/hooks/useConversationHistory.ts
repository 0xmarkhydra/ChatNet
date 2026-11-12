import type { Dispatch, RefObject, SetStateAction } from "react";
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
  const { sessionRef } = useSession();
  async function clearActiveConversationHistory() {
    const current = conversations.find((item) => item.id === activeConversationId)
    const sessionId = sessionRef.current?.sessionId
    if (!current || !sessionId || historyActionBusy) return
    if (!window.confirm(`Xóa lịch sử trò chuyện với ${current.name} trên tài khoản của bạn?\nNgười khác vẫn giữ lịch sử của họ. Bạn không thể khôi phục các tin nhắn cũ sau thao tác này.`)) return
    setHistoryActionBusy(true)
    try {
      const response = await clearConversationHistory(apiFetch, current.id)
      if (!response.ok) {
        const data = await response.json().catch(() => null) as { error?: string } | null
        throw new Error(data?.error || 'Không xóa được lịch sử trò chuyện.')
      }
      if (sessionRef.current?.sessionId !== sessionId) return
      responseCache.current.invalidate(['conversations', 'messages'])
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
      setNotice('Đã xóa lịch sử trò chuyện khỏi tài khoản của bạn.', 'success')
      void refreshConversations()
    } catch (error) {
      if (sessionRef.current?.sessionId === sessionId) setNotice(error instanceof Error ? error.message : 'Không xóa được lịch sử trò chuyện.', 'error')
    } finally {
      setHistoryActionBusy(false)
    }
  }

  return { clearActiveConversationHistory };
}
