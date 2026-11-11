import { useState, useRef, useEffect } from "react";
import { type ConversationTranslationSettingsMap, readConversationTranslationSettings } from "../lib/conversationTranslationSettings";
import { type Session } from "../../auth/lib/session";

export type UseTranslationStateDeps = {
  session: Session | null;
};

export function useTranslationState({
  session,
}: UseTranslationStateDeps) {  const [translations, setTranslations] = useState<Record<number, string>>({});
  const [translationOriginals, setTranslationOriginals] = useState<
    Record<number, boolean>
  >({});
  const [manuallyTranslated, setManuallyTranslated] = useState<Record<number, boolean>>({});
  const [translationPending, setTranslationPending] = useState<Record<number, boolean>>({});
  const [translationFailures, setTranslationFailures] = useState<Record<number, boolean>>({});
  const translationAttempted = useRef(new Set<string>());
  const [translationMenuOpen, setTranslationMenuOpen] = useState(false);
  useEffect(() => {
    if (!translationMenuOpen) return;
    const onOutsidePointer = (event: PointerEvent) => {
      if (
        event.target instanceof Element &&
        !event.target.closest(".translation-hub, .translation-dialog-modal, .translation-hub-scrim")
      ) {
        setTranslationMenuOpen(false);
      }
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setTranslationMenuOpen(false);
    };
    document.addEventListener("pointerdown", onOutsidePointer, true);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("pointerdown", onOutsidePointer, true);
      document.removeEventListener("keydown", onEscape);
    };
  }, [translationMenuOpen]);
  const [targetLanguage, setTargetLanguage] = useState("en");
  const translationLanguageRef = useRef(targetLanguage);
  useEffect(() => {
    translationAttempted.current.clear();
    setManuallyTranslated({});
    setTranslationPending({});
    setTranslationFailures({});
    setTranslationOriginals({});
  }, [session?.sessionId, targetLanguage]);
  const [autoTranslate, setAutoTranslate] = useState(true);
  const [conversationTranslationOverrides, setConversationTranslationOverrides] = useState<ConversationTranslationSettingsMap>(
    () => session?.user.id ? readConversationTranslationSettings(session.user.id) : {},
  );

  return {
    autoTranslate,
    conversationTranslationOverrides,
    manuallyTranslated,
    setAutoTranslate,
    setConversationTranslationOverrides,
    setManuallyTranslated,
    setTargetLanguage,
    setTranslationFailures,
    setTranslationMenuOpen,
    setTranslationOriginals,
    setTranslationPending,
    setTranslations,
    targetLanguage,
    translationAttempted,
    translationFailures,
    translationLanguageRef,
    translationMenuOpen,
    translationOriginals,
    translationPending,
    translations,
  };
}
