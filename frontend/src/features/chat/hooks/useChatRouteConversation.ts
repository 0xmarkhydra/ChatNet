import { useEffect, type Dispatch, type RefObject, type SetStateAction } from "react";
import { useLatest } from "../../../shared/hooks/useLatest";
import type { ApiRequest } from "../../../shared/types/api";
import { findConversation } from "../api/conversations";
import type { Conversation } from "../types";

type Options = {
  conversationId: number | null;
  known: boolean;
  sessionId: string | null;
  sessionRef: RefObject<{ sessionId: string } | null>;
  request: ApiRequest;
  setConversations: Dispatch<SetStateAction<Conversation[]>>;
  revokedIds: RefObject<Set<number>>;
  membershipIds: RefObject<Set<number> | null>;
  onUnavailable: () => void;
  onError: () => void;
};

/** Resolve a direct chat URL even when its conversation is outside the paginated list. */
export function useChatRouteConversation({
  conversationId, known, sessionId, sessionRef, request, setConversations,
  revokedIds, membershipIds, onUnavailable, onError,
}: Options) {
  // Keep one lookup per URL/session while using the latest handlers on completion.
  const handlers = useLatest({ request, setConversations, revokedIds, membershipIds, onUnavailable, onError });
  useEffect(() => {
    if (!conversationId || !sessionId || known) return;
    const controller = new AbortController();
    const current = () => !controller.signal.aborted && sessionRef.current?.sessionId === sessionId;

    const load = async () => {
      if (handlers.current.revokedIds.current.has(conversationId) ||
          (handlers.current.membershipIds.current && !handlers.current.membershipIds.current.has(conversationId))) {
        if (current()) handlers.current.onUnavailable();
        return;
      }
      try {
        const response = await findConversation(handlers.current.request, conversationId, controller.signal);
        if (!current()) return;
        if (response.status === 403 || response.status === 404) {
          handlers.current.onUnavailable();
          return;
        }
        if (!response.ok) throw new Error("conversation request failed");
        const rows: unknown = await response.json();
        if (!current()) return;
        if (!Array.isArray(rows) || rows.length !== 1 || rows[0]?.id !== conversationId) {
          handlers.current.onUnavailable();
          return;
        }
        if (handlers.current.revokedIds.current.has(conversationId) ||
            (handlers.current.membershipIds.current && !handlers.current.membershipIds.current.has(conversationId))) {
          handlers.current.onUnavailable();
          return;
        }
        const conversation = rows[0] as Conversation;
        handlers.current.setConversations((existing) => existing.some((item) => item.id === conversationId)
          ? existing : [conversation, ...existing]);
      } catch {
        if (current()) handlers.current.onError();
      }
    };

    void load();
    return () => controller.abort();
  }, [conversationId, known, sessionId, sessionRef, handlers]);
}
