import type { ApiRequest } from "../../../shared/types/api";

const JSON_HEADERS = { "Content-Type": "application/json" };

export function savePreferences(
  request: ApiRequest,
  preferences: { targetLanguage: string; autoTranslate: boolean; appLocale: string },
) {
  return request("/api/preferences", {
    method: "PUT",
    headers: JSON_HEADERS,
    body: JSON.stringify({
      targetLanguage: preferences.targetLanguage,
      autoTranslate: preferences.autoTranslate,
      appLocale: preferences.appLocale,
    }),
  });
}

export function translateText(
  request: ApiRequest,
  input: { text: string; target: string; messageId?: number },
) {
  return request("/api/translate", {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({
      text: input.text,
      target: input.target,
      ...(input.messageId ? { messageId: input.messageId } : {}),
    }),
  });
}
