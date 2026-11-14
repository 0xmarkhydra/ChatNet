// @vitest-environment jsdom
import { act, createElement, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useOutboxDelivery, type UseOutboxDeliveryDeps } from "./useOutboxDelivery";
import type { Message } from "../types";
import type { QueuedChatMessage } from "../lib/chatOutbox";

const mocked = vi.hoisted(() => ({
  apiFetch: vi.fn(),
  postFetch: vi.fn(),
  sessionRef: {
    current: { sessionId: "old-session", user: { id: 17 } },
  } as { current: { sessionId: string; user: { id: number } } },
}));

vi.mock("../../../shared/context/ApiContext", () => ({
  useApi: () => ({ apiFetch: mocked.apiFetch }),
}));
vi.mock("../../../shared/context/SessionContext", () => ({
  useSession: () => ({ sessionRef: mocked.sessionRef }),
}));

const pending: QueuedChatMessage = {
  conversationId: 12,
  clientId: "stable-client-id",
  text: "Hello",
  attachments: [],
  createdAt: "2026-11-13T00:00:00Z",
  status: "queued",
};

async function createDelivery() {
  let outbox = [{ ...pending }];
  const setMessages = vi.fn();
  const refreshConversations = vi.fn(async () => {});
  const updateChatOutbox = vi.fn((transform: (items: QueuedChatMessage[]) => QueuedChatMessage[]) => {
    outbox = transform(outbox);
    return outbox;
  });
  const deps = {
    activeChannelIdRef: { current: 0 },
    activeConversationIdRef: { current: 12 },
    chatOutboxRef: { get current() { return outbox; } },
    chatOutboxSession: { current: "old-session" },
    messageChanges: { current: new Set<number>() },
    refreshConversations,
    retryOutboxBusyRef: { current: false },
    sendingClientIDs: { current: new Set<string>() },
    setMessages,
    updateChatOutbox,
  } as unknown as UseOutboxDeliveryDeps;
  let retry!: () => Promise<void>;
  const host = document.createElement("div");
  const root = createRoot(host);
  function Harness() {
    const { retryQueuedChatMessages } = useOutboxDelivery(deps);
    useEffect(() => { retry = retryQueuedChatMessages; }, [retryQueuedChatMessages]);
    return null;
  }
  await act(async () => { root.render(createElement(Harness)); });
  return {
    retry,
    cleanup: async () => { await act(async () => root.unmount()); },
    getOutbox: () => outbox,
    updateChatOutbox,
    setMessages,
    refreshConversations,
  };
}

describe("outbox delivery session races", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("navigator", { onLine: true });
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    mocked.sessionRef.current = { sessionId: "old-session", user: { id: 17 } };
    mocked.apiFetch.mockImplementation((path: string) => {
      if (path.endsWith("/e2ee/status")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ mode: "legacy", epoch: 0 }),
        });
      }
      return mocked.postFetch(path);
    });
  });

  it("never posts a queued plaintext message to an MLS-encrypted room", async () => {
    mocked.apiFetch.mockImplementation(async (path: string) => {
      if (path.endsWith("/e2ee/status")) return {
        ok: true, json: async () => ({ mode: "e2ee", epoch: 1 }),
      };
      throw new Error("Legacy plaintext POST must never run");
    });
    const delivery = await createDelivery();
    await delivery.retry();
    expect(delivery.getOutbox()).toEqual([
      expect.objectContaining({
        clientId: pending.clientId,
        status: "failed",
        error: expect.stringContaining("E2EE"),
      }),
    ]);
    expect(mocked.apiFetch).toHaveBeenCalledTimes(1);
    expect(delivery.setMessages).not.toHaveBeenCalled();
    await delivery.cleanup();
  });

  it("fails closed when encryption status cannot be fetched", async () => {
    mocked.apiFetch.mockRejectedValue(new Error("offline"));
    const delivery = await createDelivery();
    await delivery.retry();
    expect(mocked.apiFetch).toHaveBeenCalledTimes(1);
    expect(delivery.getOutbox()[0].status).toBe("unconfirmed");
    expect(mocked.postFetch).not.toHaveBeenCalled();
    await delivery.cleanup();
  });

  it("does not confirm a receipt parsed after the account switches", async () => {
    let finishBody!: (message: Message) => void;
    mocked.postFetch.mockResolvedValue({
      ok: true,
      json: () => new Promise<Message>((resolve) => { finishBody = resolve; }),
    });
    const delivery = await createDelivery();
    const task = delivery.retry();
    await vi.waitFor(() => expect(finishBody).toBeTypeOf("function"));
    mocked.sessionRef.current = { sessionId: "new-session", user: { id: 22 } };
    finishBody({ id: 55, conversationId: 12, senderId: 17, clientId: pending.clientId } as Message);
    await task;
    expect(delivery.getOutbox()).toEqual([pending]);
    expect(delivery.setMessages).not.toHaveBeenCalled();
    expect(delivery.refreshConversations).not.toHaveBeenCalled();
    await delivery.cleanup();
  });

  it("does not mark a delayed 4xx response failed after the account switches", async () => {
    let finishBody!: (body: { error: string }) => void;
    mocked.postFetch.mockResolvedValue({
      ok: false,
      status: 403,
      json: () => new Promise((resolve) => { finishBody = resolve; }),
    });
    const delivery = await createDelivery();
    const task = delivery.retry();
    await vi.waitFor(() => expect(finishBody).toBeTypeOf("function"));
    mocked.sessionRef.current = { sessionId: "new-session", user: { id: 22 } };
    finishBody({ error: "Forbidden" });
    await task;
    expect(delivery.getOutbox()).toEqual([pending]);
    expect(delivery.updateChatOutbox).not.toHaveBeenCalled();
    await delivery.cleanup();
  });
});