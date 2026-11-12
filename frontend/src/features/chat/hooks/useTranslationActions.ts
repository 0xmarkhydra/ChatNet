import { useRef, type SetStateAction } from "react";
import { isSupportedLanguageCode } from "../../i18n/utils/languages";
import { saveAppLocalePreference } from "../../i18n/lib/i18n";
import { type ChatTranslationSettings, persistConversationTranslationSettings, type ConversationTranslationSettingsMap } from "../lib/conversationTranslationSettings";
import { type Message } from "../types";
import { type Session } from "../../auth/lib/session";
import { type ToastKind } from "../../notifications/utils/toast";
import type { Dispatch, RefObject } from "react";

export type UseTranslationActionsDeps = {
  activeChatTranslationSettings: ChatTranslationSettings | undefined;
  activeConversationId: number | null;
  activeConversationIdRef: RefObject<number | null>;
  apiFetch: (path: string, init?: RequestInit) => Promise<Response>;
  appLocale: string;
  autoTranslate: boolean;
  conversationTranslationOverrides: ConversationTranslationSettingsMap;
  effectiveTargetLanguage: string;
  preferenceRevision: RefObject<number>;
  session: Session | null;
  sessionRef: RefObject<Session | null>;
  setAppLocale: Dispatch<SetStateAction<string>>;
  setAutoTranslate: Dispatch<SetStateAction<boolean>>;
  setConversationTranslationOverrides: Dispatch<SetStateAction<ConversationTranslationSettingsMap>>;
  setLanguageSearch: Dispatch<SetStateAction<string>>;
  setLocalePickerOpen: Dispatch<SetStateAction<boolean>>;
  setLocaleSearch: Dispatch<SetStateAction<string>>;
  setManuallyTranslated: Dispatch<SetStateAction<Record<number, boolean>>>;
  setNotice: (message: string, kind?: ToastKind) => void;
  setTargetLanguage: Dispatch<SetStateAction<string>>;
  setTranslationFailures: Dispatch<SetStateAction<Record<number, boolean>>>;
  setTranslationMenuOpen: Dispatch<SetStateAction<boolean>>;
  setTranslationOriginals: Dispatch<SetStateAction<Record<number, boolean>>>;
  setTranslationPending: Dispatch<SetStateAction<Record<number, boolean>>>;
  setTranslationPickerOpen: Dispatch<SetStateAction<boolean>>;
  setTranslations: Dispatch<SetStateAction<Record<number, string>>>;
  setTranslationSettingsSearch: Dispatch<SetStateAction<string>>;
  targetLanguage: string;
  translationAttempted: RefObject<Set<string>>;
  translationFailures: Record<number, boolean>;
  translationLanguageRef: RefObject<string>;
  translations: Record<number, string>;
};

export function useTranslationActions({
  activeChatTranslationSettings,
  activeConversationId,
  activeConversationIdRef,
  apiFetch,
  appLocale,
  autoTranslate,
  conversationTranslationOverrides,
  effectiveTargetLanguage,
  preferenceRevision,
  session,
  sessionRef,
  setAppLocale,
  setAutoTranslate,
  setConversationTranslationOverrides,
  setLanguageSearch,
  setLocalePickerOpen,
  setLocaleSearch,
  setManuallyTranslated,
  setNotice,
  setTargetLanguage,
  setTranslationFailures,
  setTranslationMenuOpen,
  setTranslationOriginals,
  setTranslationPending,
  setTranslationPickerOpen,
  setTranslations,
  setTranslationSettingsSearch,
  targetLanguage,
  translationAttempted,
  translationFailures,
  translationLanguageRef,
  translations,
}: UseTranslationActionsDeps) {
  const preferenceQueue = useRef(Promise.resolve());
  const translationInFlight = useRef(new Set<string>());
  async function savePreferences(
    nextTarget: string,
    nextAuto: boolean,
    nextAppLocale: string,
  ) {
    if (!session?.token) return;
    const sessionId = session.sessionId;
    const revision = ++preferenceRevision.current;
    const preferenceKey = `chatnet-preferences:${session.user.id}`;
    localStorage.setItem(
      preferenceKey,
      JSON.stringify({
        targetLanguage: nextTarget,
        autoTranslate: nextAuto,
        appLocale: nextAppLocale,
      }),
    );
    const save = async () => {
      if (
        sessionRef.current?.sessionId !== sessionId ||
        revision !== preferenceRevision.current
      )
        return;
      const response = await apiFetch("/api/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetLanguage: nextTarget,
          autoTranslate: nextAuto,
          appLocale: nextAppLocale,
        }),
      });
      if (
        !response.ok &&
        sessionRef.current?.sessionId === sessionId &&
        revision === preferenceRevision.current
      ) {
        setNotice(
          "Cài đặt đã áp dụng trên máy này nhưng chưa đồng bộ được. Chọn lại cài đặt để thử lại.",
          "warning",
        );
      }
    };
    preferenceQueue.current = preferenceQueue.current
      .catch(() => undefined)
      .then(save);
    await preferenceQueue.current;
  }
  async function saveTranslationPreferences(
    nextTarget: string,
    nextAuto: boolean,
  ) {
    await savePreferences(nextTarget, nextAuto, appLocale);
  }
  async function changeAppLocale(nextLocale: string) {
    const normalized =
      nextLocale === "auto" ? "auto" : nextLocale.toLowerCase().split("-")[0];
    if (normalized !== "auto" && !isSupportedLanguageCode(normalized)) return;
    setAppLocale(normalized);
    saveAppLocalePreference(normalized);
    setLocalePickerOpen(false);
    setLocaleSearch("");
    if (session?.token) {
      await savePreferences(targetLanguage, autoTranslate, normalized);
    }
  }
  function saveConversationTranslationSettings(conversationId: number, settings: ChatTranslationSettings) {
    if (!session?.user.id || !Number.isSafeInteger(conversationId)) return false;
    const updated = { ...conversationTranslationOverrides, [conversationId]: settings };
    if (!persistConversationTranslationSettings(session.user.id, updated)) {
      setNotice('Không lưu được cài đặt dịch trên thiết bị này.', 'error');
      return false;
    }
    setConversationTranslationOverrides(updated);
    setTranslations({});
    setTranslationOriginals({});
    setManuallyTranslated({});
    setTranslationPending({});
    setTranslationFailures({});
    translationAttempted.current.clear();
    return true;
  }
  function changeAutoTranslate(next: boolean) {
    if (activeConversationId !== null && activeChatTranslationSettings) {
      saveConversationTranslationSettings(activeConversationId, { ...activeChatTranslationSettings, enabled: next });
      return;
    }
    setAutoTranslate(next);
    void saveTranslationPreferences(targetLanguage, next);
  }
  function changeTargetLanguage(next: string) {
    if (activeConversationId !== null && activeChatTranslationSettings) {
      saveConversationTranslationSettings(activeConversationId, { ...activeChatTranslationSettings, targetLanguage: next });
      setTranslationMenuOpen(false);
      setLanguageSearch('');
      return;
    }
    setTargetLanguage(next);
    setTranslations({});
    setTranslationOriginals({});
    setManuallyTranslated({});
    setTranslationPending({});
    setTranslationFailures({});
    translationAttempted.current.clear();
    setTranslationMenuOpen(false);
    setTranslationPickerOpen(false);
    setLanguageSearch("");
    setTranslationSettingsSearch("");
    void saveTranslationPreferences(next, autoTranslate);
  }
  async function requestTranslation(text: string, messageId?: number, showError = true) {
    const response = await apiFetch("/api/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        target: effectiveTargetLanguage,
        ...(messageId ? { messageId } : {}),
      }),
    });
    const result = await response.json().catch(() => null);
    if (sessionRef.current?.sessionId !== session?.sessionId) return null;
    if (!response.ok || typeof result?.translatedText !== "string") {
      // A proxy or unavailable AI service may return HTML/empty text instead of JSON.
      // Do not leak message contents or provider credentials into diagnostics.
      console.warn("Translation request failed", {
        status: response.status,
        error: typeof result?.error === "string" ? result.error : "invalid response",
      });
      if (showError) {
        const serverError = typeof result?.error === "string" ? result.error : "";
        const message = /not configured|missing_ai_config/i.test(serverError)
          ? "Dịch vụ AI trên máy chủ chưa được cấu hình. Kiểm tra AI_API_KEY, AI_BASE_URL và AI_MODEL."
          : response.status === 401 || response.status === 403
            ? "Phiên đăng nhập hoặc quyền truy cập dịch AI không hợp lệ."
            : response.status === 429
              ? "Dịch vụ AI đang giới hạn yêu cầu (HTTP 429). Hãy thử lại sau."
              : response.status === 502 && /service unavailable/i.test(serverError)
                ? "Gateway không kết nối được đến dịch vụ translate (HTTP 502). Kiểm tra dịch vụ translate trên Railway."
                : response.status === 502 && /AI translation failed/i.test(serverError)
                  ? "Dịch vụ translate không nhận được bản dịch từ nhà cung cấp AI (HTTP 502). Kiểm tra log AI provider."
                  : response.status >= 500
                    ? `Dịch vụ AI hoặc backend không phản hồi (HTTP ${response.status}). Kiểm tra dịch vụ translate và nhà cung cấp AI.`
                    : response.status === 404
                  ? "Không tìm thấy tin nhắn hoặc API dịch AI (HTTP 404)."
                  : response.ok
                    ? "Dịch vụ AI trả dữ liệu không hợp lệ."
                    : `Không dịch được tin nhắn (HTTP ${response.status})${serverError ? `: ${serverError}` : "."}`;
        setNotice(message, "error");
      }
      return null;
    }
    return result as { translatedText: string };
  }
  async function translateMessage(message: Message, reveal = true) {
    if (message.deleted || !message.text.trim()) return;
    const sessionId = sessionRef.current?.sessionId;
    if (!sessionId) return;
    const language = effectiveTargetLanguage;
    const conversationId = activeConversationIdRef.current;
    const requestKey = `${sessionId}:${language}:${message.id}:${message.editedAt ?? ""}`;
    if (reveal) {
      setManuallyTranslated((current) => ({ ...current, [message.id]: true }));
    }
    if (translations[message.id] && !translationFailures[message.id]) return;
    if (translationInFlight.current.has(requestKey)) return;
    // An automatic failure must not re-trigger for every incoming event.
    // A manual retry remains available when translation fails.
    if (!reveal && translationAttempted.current.has(requestKey)) return;
    translationAttempted.current.add(requestKey);
    translationInFlight.current.add(requestKey);
    setTranslationPending((current) => ({ ...current, [message.id]: true }));
    setTranslationFailures((current) => ({ ...current, [message.id]: false }));
    try {
      const result = await requestTranslation(message.text, message.id, reveal);
      if (sessionRef.current?.sessionId !== sessionId ||
          translationLanguageRef.current !== language ||
          activeConversationIdRef.current !== conversationId) return;
      if (!result?.translatedText.trim()) {
        setTranslationFailures((current) => ({ ...current, [message.id]: true }));
        return;
      }
      setTranslations((current) => ({ ...current, [message.id]: result.translatedText }));
    } catch (error) {
      if (sessionRef.current?.sessionId === sessionId &&
          translationLanguageRef.current === language &&
          activeConversationIdRef.current === conversationId) {
        setTranslationFailures((current) => ({ ...current, [message.id]: true }));
        if (reveal) setNotice(
          error instanceof TypeError
            ? "Không kết nối được API dịch AI. Kiểm tra kết nối tới backend cloud."
            : error instanceof Error ? error.message : "Không dịch được tin nhắn",
          "error",
        );
      }
    } finally {
      translationInFlight.current.delete(requestKey);
      if (sessionRef.current?.sessionId === sessionId &&
          translationLanguageRef.current === language &&
          activeConversationIdRef.current === conversationId) {
        setTranslationPending((current) => ({ ...current, [message.id]: false }));
      }
    }
  }

  return {
    changeAppLocale,
    changeAutoTranslate,
    changeTargetLanguage,
    saveConversationTranslationSettings,
    translateMessage,
  };
}
