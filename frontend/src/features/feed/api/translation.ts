export type FeedTranslationRequest = {
  api: string;
  token: string;
  text: string;
  target: string;
  signal: AbortSignal;
};

/** Sends a translation request. The caller owns response and error handling. */
export function requestFeedTranslation({ api, token, text, target, signal }: FeedTranslationRequest) {
  return fetch(`${api}/api/translate`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ text, target }),
    signal,
  });
}
