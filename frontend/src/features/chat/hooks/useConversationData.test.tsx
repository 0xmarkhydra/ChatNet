// @vitest-environment jsdom
import { act, useRef } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Session } from "../../../shared/types/session";
import type { Conversation } from "../types";
import { useConversationData } from "./useConversationData";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const disposers: Array<() => void> = [];
afterEach(() => { while (disposers.length) disposers.pop()!(); vi.restoreAllMocks(); });
const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(r => { resolve = r; });
  return { promise, resolve };
};
const conversation = (id: number) => ({ id, name: `Conversation ${id}`, type: "direct" }) as Conversation;
const response = (rows: unknown) => new Response(JSON.stringify(rows));
const session = (sessionId: string) => ({
  sessionId, token: sessionId,
  user: { id: 1, email: "a@example.test", username: "a", displayName: "A" },
}) satisfies Session;

function mountConversationData(request: (url: string) => Promise<Response>) {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  let data!: ReturnType<typeof useConversationData>;
  const sessionRef = { current: session("A") as Session | null };
  const setNotice = vi.fn();
  const setStatus = vi.fn();
  const purgeConversation = vi.fn();
  function Probe({ sessionId }: { sessionId: string }) {
    const activeConversationIdRef = useRef<number | null>(null);
    const setMessageDrafts = vi.fn();
    data = useConversationData({
      session: session(sessionId), sessionRef,
      apiFetch: request,
      setStatus,
      setNotice,
      activeConversationIdRef,
      setMessageDrafts,
      purgeConversation,
    });
    return null;
  }
  const render = (sessionId = "A") => {
    sessionRef.current = session(sessionId);
    act(() => root.render(<Probe sessionId={sessionId} />));
    return data;
  };
  disposers.push(() => { act(() => root.unmount()); host.remove(); });
  return { render, get data() { return data; }, setNotice, sessionRef };
}

describe("useConversationData request ordering", () => {
  it("does not replace a newer refresh with an older response from the same session", async () => {
    const older = deferred<Response>();
    const newer = deferred<Response>();
    let count = 0;
    const request = vi.fn(async (url: string) => {
      if (url.includes("type=group")) return response([]);
      return ++count === 1 ? older.promise : newer.promise;
    });
    const app = mountConversationData(request);
    app.render();
    const first = app.data.refreshConversations();
    const second = app.data.refreshConversations();
    await act(async () => { newer.resolve(response([conversation(22)])); await second; });
    await act(async () => { older.resolve(response([conversation(11)])); await first; });
    expect(app.data.conversations.map(item => item.id)).toEqual([22]);
  });

  it("never advances the pagination offset on a malformed page, then retries at the same offset", async () => {
    const first = Array.from({ length: 25 }, (_, i) => conversation(i + 1));
    const visited: string[] = [];
    let pageAttempt = 0;
    const request = vi.fn(async (url: string) => {
      visited.push(url);
      if (url.includes("type=group")) return response([]);
      if (!url.includes("offset=")) return response(first);
      return ++pageAttempt === 1
        ? response([{ id: "invalid" }])
        : response([conversation(26)]);
    });
    const app = mountConversationData(request);
    app.render();
    await act(async () => { await app.data.refreshConversations(); });
    expect(app.data.hasMoreConversations).toBe(true);
    expect(app.data.conversationOffset.current).toBe(25);
    await act(async () => { await app.data.loadMoreConversations(); });
    expect(app.data.conversationOffset.current).toBe(25);
    expect(app.data.conversations).toHaveLength(25);
    expect(app.setNotice).toHaveBeenCalledOnce();
    await act(async () => { await app.data.loadMoreConversations(); });
    expect(app.data.conversationOffset.current).toBe(26);
    expect(app.data.conversations).toHaveLength(26);
    expect(visited.filter(url => url.includes("offset=25"))).toHaveLength(2);
  });

  it("lets a new session load its own page while a previous session's request is pending", async () => {
    const pageA = deferred<Response>();
    const pageB = deferred<Response>();
    let requestNumber = 0;
    const request = vi.fn(async (url: string) => {
      if (url.includes("type=group")) return response([]);
      if (!url.includes("offset=")) return response(Array.from({ length: 25 }, (_, i) => conversation(i + 1)));
      return ++requestNumber === 1 ? pageA.promise : pageB.promise;
    });
    const app = mountConversationData(request);
    app.render("A");
    await act(async () => { await app.data.refreshConversations(); });
    let oldRequest!: Promise<void>;
    await act(async () => { oldRequest = app.data.loadMoreConversations(); });
    expect(app.data.conversationLoadingMore).toBe(true);

    app.render("B");
    let newRequest!: Promise<void>;
    await act(async () => { newRequest = app.data.loadMoreConversations(); });
    expect(requestNumber).toBe(2);
    expect(app.data.conversationLoadingMore).toBe(true);

    await act(async () => { pageA.resolve(response([conversation(80)])); await oldRequest; });
    expect(app.data.conversationLoadingMore).toBe(true);
    expect(app.data.conversations.some(item => item.id === 80)).toBe(false);

    await act(async () => { pageB.resolve(response([conversation(81)])); await newRequest; });
    expect(app.data.conversationLoadingMore).toBe(false);
    expect(app.data.conversations.some(item => item.id === 81)).toBe(true);
  });

  it("discards a late pagination response after switching accounts", async () => {
    const pageA = deferred<Response>();
    const request = vi.fn(async (url: string) => {
      if (url.includes("type=group")) return response([]);
      if (url.includes("offset=")) return pageA.promise;
      return response(Array.from({ length: 25 }, (_, i) => conversation(i + 1)));
    });
    const app = mountConversationData(request);
    app.render("A");
    await act(async () => { await app.data.refreshConversations(); });
    let oldRequest!: Promise<void>;
    await act(async () => { oldRequest = app.data.loadMoreConversations(); });
    app.render("B");
    await act(async () => { pageA.resolve(response([conversation(66)])); await oldRequest; });
    expect(app.data.conversations.some(item => item.id === 66)).toBe(false);
    expect(app.data.conversationOffset.current).toBe(25);
  });
});
