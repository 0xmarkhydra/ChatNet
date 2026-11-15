// @vitest-environment jsdom
import { act, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ApiRequest } from "../../../shared/types/api";
import type { Conversation } from "../types";
import { useChatRouteConversation } from "./useChatRouteConversation";

const mockFindConversation = vi.hoisted(() => vi.fn());
vi.mock("../api/conversations", () => ({ findConversation: mockFindConversation }));
vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
const cleanups: Array<() => void> = [];

function renderRoute(
  onUnavailable = vi.fn(), onError = vi.fn(),
  request = vi.fn() as unknown as ApiRequest,
) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const state = { sessionRef: { current: { sessionId: "A" } as { sessionId: string } | null } };

  function Probe() {
    const sessionRef = state.sessionRef;
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const revokedIds = useRef(new Set<number>());
    const membershipIds = useRef<Set<number> | null>(null);
    useChatRouteConversation({
      conversationId: 42,
      known: conversations.some((item) => item.id === 42),
      sessionId: "A",
      sessionRef, request, setConversations, revokedIds, membershipIds,
      onUnavailable, onError,
    });
    return <output>{conversations.map((item) => item.id).join(",")}</output>;
  }

  act(() => root.render(<Probe />));
  const close = () => { act(() => root.unmount()); container.remove(); };
  cleanups.push(close);
  return { container, state, close };
}

beforeEach(() => mockFindConversation.mockReset());
afterEach(() => { while (cleanups.length) cleanups.pop()!(); });

describe("chat URL conversation resolution", () => {
  it("loads a conversation missing from the first page of the conversation list", async () => {
    mockFindConversation.mockResolvedValue({
      ok: true, status: 200, json: async () => [{ id: 42, name: "Older conversation" }],
    });
    const { container } = renderRoute();
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(mockFindConversation).toHaveBeenCalledTimes(1);
    expect(mockFindConversation.mock.calls[0][1]).toBe(42);
    expect(container.querySelector("output")?.textContent).toBe("42");
  });

  it("rejects inaccessible conversation IDs without inserting them into state", async () => {
    mockFindConversation.mockResolvedValue({ ok: false, status: 404 });
    const onUnavailable = vi.fn();
    const { container } = renderRoute(onUnavailable);
    await act(async () => { await Promise.resolve(); });
    expect(onUnavailable).toHaveBeenCalledOnce();
    expect(container.querySelector("output")?.textContent).toBe("");
  });

  it("does not commit results if the session changed while fetching", async () => {
    mockFindConversation.mockResolvedValue({
      ok: true, status: 200, json: async () => [{ id: 42 }],
    });
    const { container, state } = renderRoute();
    state.sessionRef.current = { sessionId: "B" };
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(container.querySelector("output")?.textContent).toBe("");
  });
  it("does not refetch on callback changes and routes a late 404 to the latest handler", async () => {
    let resolve!: (value: { ok: boolean; status: number }) => void;
    mockFindConversation.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    const sessionRef = { current: { sessionId: "A" } };
    const revokedIds = { current: new Set<number>() };
    const membershipIds = { current: null as Set<number> | null };
    const initialHandler = vi.fn();
    const latestHandler = vi.fn();
    const request = vi.fn() as unknown as ApiRequest;
    function Probe({ unavailable }: { unavailable: () => void }) {
      const [conversations, setConversations] = useState<Conversation[]>([]);
      useChatRouteConversation({
        conversationId: 42, known: false, sessionId: "A",
        sessionRef, request, setConversations, revokedIds, membershipIds,
        onUnavailable: unavailable, onError: vi.fn(),
      });
      return <output>{conversations.length}</output>;
    }
    try {
      await act(async () => root.render(<Probe unavailable={initialHandler} />));
      expect(mockFindConversation).toHaveBeenCalledTimes(1);
      const oldSignal = mockFindConversation.mock.calls[0][2] as AbortSignal;
      await act(async () => root.render(<Probe unavailable={latestHandler} />));
      expect(mockFindConversation).toHaveBeenCalledTimes(1);
      expect(oldSignal.aborted).toBe(false);
      await act(async () => { resolve({ ok: false, status: 404 }); });
      expect(initialHandler).not.toHaveBeenCalled();
      expect(latestHandler).toHaveBeenCalledOnce();
    } finally {
      await act(async () => root.unmount());
      host.remove();
    }
  });


});