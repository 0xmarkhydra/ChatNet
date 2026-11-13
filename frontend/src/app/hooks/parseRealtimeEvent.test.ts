import { describe, expect, it } from "vitest";
import { parseRealtimeEvent } from "./parseRealtimeEvent";

describe("realtime SSE frames", () => {
  it("ignores malformed JSON and non-event payloads", () => {
    for (const data of ["", "{bad", "null", "[]", "42", '"message"', "{}", '{"type":42}']) {
      expect(parseRealtimeEvent(data)).toBeNull();
    }
  });

  it("preserves valid realtime payloads without altering event contracts", () => {
    const data = JSON.stringify({ type: "message", conversationId: 7, message: { id: 17 } });
    expect(parseRealtimeEvent(data)).toEqual({ type: "message", conversationId: 7, message: { id: 17 } });
  });
});
