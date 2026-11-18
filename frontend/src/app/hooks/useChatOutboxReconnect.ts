import { useEffect } from "react";
import { useLatest } from "../../shared/hooks/useLatest";

/** Keep outbox retry triggers bound to the current callback and session visit. */
export function useChatOutboxReconnect({
  sessionId,
  retryQueuedMessages,
  setChatOnline,
}: {
  sessionId: string | null;
  retryQueuedMessages: () => void | Promise<unknown>;
  setChatOnline: (online: boolean) => void;
}) {
  const retryRef = useLatest(retryQueuedMessages);
  const onlineRef = useLatest(setChatOnline);

  useEffect(() => {
    if (!sessionId) return;
    const retry = () => { void retryRef.current(); };
    const onOnline = () => {
      onlineRef.current(true);
      retry();
    };
    const onOffline = () => onlineRef.current(false);
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      if (navigator.onLine === false) onOffline();
      else onOnline();
    };

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    document.addEventListener("visibilitychange", onVisible);
    const timer = window.setInterval(retry, 15_000);
    const initial = window.setTimeout(retry, 250);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(timer);
      window.clearTimeout(initial);
    };
  }, [sessionId, retryRef, onlineRef]);
}