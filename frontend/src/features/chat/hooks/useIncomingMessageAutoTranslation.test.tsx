// @vitest-environment jsdom
import { act, useRef } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Message } from "../types";
import { useIncomingMessageAutoTranslation } from "./useIncomingMessageAutoTranslation";
import { selectIncomingMessagesForTranslation } from "../lib/selectIncomingTranslations";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const cleanups: Array<() => void> = [];
afterEach(() => { while (cleanups.length) cleanups.pop()!(); });
const message = (id: number, fields: Partial<Message> = {}) => ({
  id, conversationId: 8, senderId: 2, text: "Xin chào", deleted: false, ...fields,
}) as Message;

describe("incoming auto translation", () => {
  it("excludes own, deleted, blank, already translated, and attempted messages", () => {
    const messages = [
      message(1), message(2, { senderId: 7 }), message(3, { deleted: true }),
      message(4, { text: "  " }), message(5), message(6),
    ];
    const selected = selectIncomingMessagesForTranslation({
      messages, userId: 7, sessionId: "A", targetLanguage: "en",
      translations: { 5: "Translated" }, attempted: new Set(["A:en:6:"]),
    });
    expect(selected.map(item => item.id)).toEqual([1]);
  });

  it("retries edited messages while isolating attempts by session and language", () => {
    const msg = message(4, { editedAt: "2026-11-20T00:00:00Z" });
    const select = (sessionId: string, targetLanguage: string, editedAt: string) =>
      selectIncomingMessagesForTranslation({
        messages: [{ ...msg, editedAt }],
        userId: 7, sessionId, targetLanguage, translations: {},
        attempted: new Set(["A:en:4:2026-11-20T00:00:00Z"]),
      });
    expect(select("A", "en", "2026-11-20T00:00:00Z")).toHaveLength(0);
    expect(select("A", "en", "2026-11-20T00:00:01Z")).toHaveLength(1);
    expect(select("A", "vi", "2026-11-20T00:00:00Z")).toHaveLength(1);
    expect(select("B", "en", "2026-11-20T00:00:00Z")).toHaveLength(1);
  });

  it("runs only when enabled, scoped to a valid session/conversation, and deduplicates attempts", () => {
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    const translate = vi.fn();
    const rows = [message(1), message(2)];
    function Probe({ enabled, sessionId, conversationId }: {
      enabled: boolean; sessionId: string | null; conversationId: number | null;
    }) {
      const attempted = useRef(new Set<string>());
      useIncomingMessageAutoTranslation({
        enabled, preferencesLoaded: true, messages: rows, targetLanguage: "en",
        userId: 7, sessionId, activeConversationId: conversationId,
        translations: {}, attempted, translateMessage: (item, manual) => {
          attempted.current.add(`${sessionId}:en:${item.id}:${item.editedAt ?? ""}`);
          translate(item, manual);
        },
      });
      return null;
    }
    const render = (enabled: boolean, sessionId: string | null, conversationId: number | null) =>
      act(() => root.render(<Probe enabled={enabled} sessionId={sessionId} conversationId={conversationId} />));
    cleanups.push(() => { act(() => root.unmount()); host.remove(); });
    render(false, "A", 8);
    render(true, null, 8);
    render(true, "A", null);
    expect(translate).not.toHaveBeenCalled();
    render(true, "A", 8);
    expect(translate).toHaveBeenCalledTimes(2);
    expect(translate).toHaveBeenCalledWith(rows[0], false);
    render(true, "A", 8);
    expect(translate).toHaveBeenCalledTimes(2);
    render(true, "B", 8);
    expect(translate).toHaveBeenCalledTimes(4);
  });
});
