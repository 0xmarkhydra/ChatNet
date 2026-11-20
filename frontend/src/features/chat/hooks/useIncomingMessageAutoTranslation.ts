import { useEffect, type RefObject } from "react";
import { useLatest } from "../../../shared/hooks/useLatest";
import type { Message } from "../types";
import { selectIncomingMessagesForTranslation } from "../lib/selectIncomingTranslations";

export function useIncomingMessageAutoTranslation({
  enabled,
  preferencesLoaded,
  messages,
  targetLanguage,
  userId,
  sessionId,
  activeConversationId,
  translations,
  attempted,
  translateMessage,
}: {
  enabled: boolean;
  preferencesLoaded: boolean;
  messages: readonly Message[];
  targetLanguage: string;
  userId: number | null;
  sessionId: string | null;
  activeConversationId: number | null;
  translations: Readonly<Record<number, string>>;
  attempted: RefObject<Set<string>>;
  translateMessage: (message: Message, manually: boolean) => unknown;
}) {
  const latest = useLatest({ translations, attempted, translateMessage });

  useEffect(() => {
    if (!enabled || !preferencesLoaded || !sessionId || !userId || !activeConversationId) return;
    const { translations, attempted, translateMessage } = latest.current;
    const missing = selectIncomingMessagesForTranslation({
      messages, userId, sessionId, targetLanguage, translations,
      attempted: attempted.current,
    });
    missing.forEach(message => void translateMessage(message, false));
  }, [enabled, preferencesLoaded, messages, targetLanguage, sessionId, userId, activeConversationId, latest]);
}
