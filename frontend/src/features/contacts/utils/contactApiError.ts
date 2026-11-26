/** Extract a safe, user-facing error from an untrusted API response. */
export function contactApiError(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return fallback;
  if (!Object.prototype.hasOwnProperty.call(payload, "error")) return fallback;
  const value = (payload as Record<string, unknown>).error;
  return typeof value === "string" && value.trim() ? value : fallback;
}
