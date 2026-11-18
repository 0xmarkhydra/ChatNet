import { useCallback, useEffect, useRef, type Dispatch, type SetStateAction } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { chatConversationIdFromPath, chatConversationPath, TAB_PATH } from "./routes";

/** Synchronize the selected chat with shareable routes without remounting the chat shell. */
export function useChatConversationRoute(
  activeConversationId: number | null,
  setActiveConversationId: Dispatch<SetStateAction<number | null>>,
) {
  const location = useLocation();
  const navigate = useNavigate();
  const routeId = chatConversationIdFromPath(location.pathname);
  const previousRouteIdRef = useRef<number | null>(null);

  useEffect(() => {
    const previousId = previousRouteIdRef.current;
    previousRouteIdRef.current = routeId;
    if (routeId !== null) {
      setActiveConversationId((current) => current === routeId ? current : routeId);
    } else if (previousId !== null && location.pathname === TAB_PATH.chat) {
      setActiveConversationId(null);
    }
  }, [routeId, location.pathname, setActiveConversationId]);

  const selectConversation: Dispatch<SetStateAction<number | null>> = useCallback((next) => {
    const nextId = typeof next === "function" ? next(activeConversationId) : next;
    // Reject invalid IDs before they reach chat state or navigation.
    if (nextId !== null && (!Number.isSafeInteger(nextId) || nextId <= 0)) return;
    setActiveConversationId(nextId);
    if (nextId !== null) {
      const path = chatConversationPath(nextId);
      if (location.pathname !== path) navigate(path);
    } else if (location.pathname.startsWith(`${TAB_PATH.chat}/`)) {
      navigate(TAB_PATH.chat);
    }
  }, [activeConversationId, location.pathname, navigate, setActiveConversationId]);

  return selectConversation;
}
