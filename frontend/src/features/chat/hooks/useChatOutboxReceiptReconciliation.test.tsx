// @vitest-environment jsdom
import { act, useRef } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Message } from "../types";
import type { QueuedChatMessage } from "../lib/chatOutbox";
import { useChatOutboxReceiptReconciliation } from "./useChatOutboxReceiptReconciliation";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const cleanups: Array<() => void> = [];
afterEach(() => { while (cleanups.length) cleanups.pop()!(); });

const queued = (conversationId: number, clientId: string) => ({
  conversationId, clientId, status: "queued", attachments: [], text: "hello",
  createdAt: "2026-11-20T00:00:00Z",
}) as QueuedChatMessage;
const confirmed = (conversationId: number, clientId: string, senderId = 10) => ({
  id: 123, conversationId, clientId, senderId, sender: "owner",
  text: "hello", createdAt: "2026-11-20T00:00:00Z",
}) as Message;

function mountReceipts(initialItems: QueuedChatMessage[]) {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const itemsRef = { current: initialItems };
  const update = vi.fn((transform: (items: QueuedChatMessage[]) => QueuedChatMessage[]) => {
    itemsRef.current = transform(itemsRef.current);
    return itemsRef.current;
  });
  function Probe({ messages, sessionId, userId }: {
    messages: Message[];
    sessionId: string | null;
    userId: number | null;
  }) {
    const outboxRef = useRef(itemsRef.current);
    outboxRef.current = itemsRef.current;
    useChatOutboxReceiptReconciliation({
      messages, sessionId, userId, chatOutboxRef: outboxRef,
      updateChatOutbox: update,
    });
    return null;
  }
  const render = (messages: Message[], sessionId = "sessionA", userId: number | null = 10) => {
    act(() => root.render(<Probe messages={messages} sessionId={sessionId} userId={userId} />));
  };
  cleanups.push(() => { act(() => root.unmount()); host.remove(); });
  return { render, itemsRef, update };
}

describe("useChatOutboxReceiptReconciliation", () => {
  it("removes only receipts matching the own user, conversation and client id", () => {
    const app = mountReceipts([queued(1, "a"), queued(2, "a"), queued(1, "b")]);
    app.render([confirmed(1, "a"), confirmed(2, "a", 99)]);
    expect(app.itemsRef.current.map(item => `${item.conversationId}:${item.clientId}`)).toEqual(["2:a", "1:b"]);
    expect(app.update).toHaveBeenCalledTimes(1);
  });
  it("ignores other accounts and messages without matching receipts", () => {
    const items = [queued(1, "a")];
    const app = mountReceipts(items);
    app.render([confirmed(1, "a", 11)]);
    app.render([confirmed(1, "a")], "sessionB", null);
    app.render([confirmed(2, "a")], "sessionB", 10);
    expect(app.itemsRef.current).toEqual(items);
    expect(app.itemsRef.current).toBe(items);
  });
  it("keeps unrelated queued items and skips redundant writes", () => {
    const app = mountReceipts([queued(1, "a"), queued(1, "b")]);
    app.render([confirmed(1, "a")]);
    expect(app.itemsRef.current.map(item => item.clientId)).toEqual(["b"]);
    app.render([confirmed(1, "a")]);
    expect(app.itemsRef.current.map(item => item.clientId)).toEqual(["b"]);
    expect(app.update).toHaveBeenCalledTimes(2);
    expect(app.update.mock.results[1].value).toBe(app.itemsRef.current);
  });
});
