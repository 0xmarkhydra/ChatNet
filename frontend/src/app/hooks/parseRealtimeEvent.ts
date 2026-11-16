import type { RealtimeEvent } from "../../features/chat/types";

/** Ignore malformed SSE frames; a bad frame must not disrupt subsequent events. */
export function parseRealtimeEvent(data: string): RealtimeEvent | null {
  try {
    const value: unknown = JSON.parse(data);
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    if (typeof (value as { type?: unknown }).type !== "string") return null;
    return value as RealtimeEvent;
  } catch {
    return null;
  }
}
