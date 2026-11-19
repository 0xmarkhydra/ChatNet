import { useEffect, useRef, useState, type RefObject } from "react";
import type { Session } from "../../../shared/types/session";
import type { ToastKind } from "../../../shared/utils/toast";
import { persistChatOutboxChange, type QueuedChatMessage } from "../lib/chatOutbox";
import { restoreChatOutbox } from "../utils/outboxRecovery";

/**
 * Owns the session-bound durable outbox, its atomic persistence and retry locks.
 * Keep a synchronous ref so send/retry callbacks never observe stale React state.
 */
export function useChatOutboxState({
  session,
  sessionRef,
  actionLocksRef,
  setNotice,
}: {
  session: Session | null;
  sessionRef: RefObject<Session | null>;
  actionLocksRef: RefObject<Set<string>>;
  setNotice: (message: string, kind?: ToastKind) => void;
}) {
  const [chatOutbox, setChatOutbox] = useState<QueuedChatMessage[]>(() =>
    restoreChatOutbox(session?.user.id ?? 0, session?.sessionId ?? ""),
  );
  const chatOutboxRef = useRef(chatOutbox);
  const chatOutboxSession = useRef(session?.sessionId ?? "");
  const sendingClientIDs = useRef(new Set<string>());
  const retryOutboxBusy = useRef(false);
  const [chatOnline, setChatOnline] = useState(() => navigator.onLine);

  function updateChatOutbox(
    transform: (items: QueuedChatMessage[]) => QueuedChatMessage[],
  ) {
    const current = sessionRef.current;
    if (!current || current.sessionId !== chatOutboxSession.current)
      return chatOutboxRef.current;
    const previous = chatOutboxRef.current;
    const next = transform(previous);
    if (previous === next) return next;
    if (
      !persistChatOutboxChange(
        current.user.id,
        current.sessionId,
        previous,
        next,
      )
    ) {
      setNotice("Không lưu được hàng đợi tin nhắn trên thiết bị này.", "warning");
      return previous;
    }
    chatOutboxRef.current = next;
    setChatOutbox(next);
    return next;
  }

  useEffect(() => {
    const nextSessionId = session?.sessionId ?? "";
    if (nextSessionId === chatOutboxSession.current) return;
    chatOutboxSession.current = nextSessionId;
    const restored = restoreChatOutbox(session?.user.id ?? 0, nextSessionId);
    chatOutboxRef.current = restored;
    setChatOutbox(restored);
    sendingClientIDs.current = new Set<string>();
    actionLocksRef.current = new Set<string>();
    retryOutboxBusy.current = false;
  }, [session?.sessionId, session?.user.id, actionLocksRef]);

  return {
    chatOutbox,
    setChatOutbox,
    chatOutboxRef,
    chatOutboxSession,
    sendingClientIDs,
    retryOutboxBusy,
    chatOnline,
    setChatOnline,
    updateChatOutbox,
  };
}
