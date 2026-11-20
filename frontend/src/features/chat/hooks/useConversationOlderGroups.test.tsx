// @vitest-environment jsdom
import { act, useRef } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Session } from "../../../shared/types/session";
import type { Conversation } from "../types";
import { useConversationData } from "./useConversationData";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const cleanups: Array<() => void> = [];
afterEach(() => { while (cleanups.length) cleanups.pop()!(); vi.restoreAllMocks(); });
const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(r => { resolve = r; });
  return { promise, resolve };
};
const group = (id: number) => ({ id, type: "group", name: `Group ${id}` }) as Conversation;
const response = (rows: unknown, status = 200) => new Response(JSON.stringify(rows), { status });
const session = (sessionId: string): Session => ({
  sessionId, token: sessionId, user: { id: 1, email: "user@example.test", username: "user", displayName: "User" },
});

function mountData(request: (url: string) => Promise<Response>) {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const sessionRef = { current: session("A") as Session | null };
  let data!: ReturnType<typeof useConversationData>;
  function Probe({ id }: { id: string }) {
    const activeConversationIdRef = useRef<number | null>(null);
    data = useConversationData({
      session: session(id), sessionRef, apiFetch: request,
      setStatus: vi.fn(), setNotice: vi.fn(),
      activeConversationIdRef, setMessageDrafts: vi.fn(), purgeConversation: vi.fn(),
    });
    return null;
  }
  const render = (id: string) => {
    sessionRef.current = session(id);
    act(() => root.render(<Probe id={id} />));
  };
  const refresh = async () => {
    await act(async () => { await data.refreshConversations(); });
  };
  const settle = async () => { await act(async () => { await Promise.resolve(); await Promise.resolve(); }); };
  cleanups.push(() => { act(() => root.unmount()); host.remove(); });
  return { render, refresh, settle, get data() { return data; } };
}

describe("older group sync from conversation refresh", () => {
  it("deduplicates overlapping group scans and caches only completed scans", async () => {
    const groupRequest = deferred<Response>();
    let scans = 0;
    const request = vi.fn(async (url: string) => {
      if (url.includes("type=group")) {
        scans++;
        return groupRequest.promise;
      }
      return response([]);
    });
    const app = mountData(request);
    app.render("A");
    await app.refresh();
    await app.refresh();
    expect(scans).toBe(1);
    await act(async () => { groupRequest.resolve(response([group(30)])); });
    await app.settle();
    expect(app.data.conversations.map(c => c.id)).toEqual([30]);
    await app.refresh();
    expect(scans).toBe(1);
  });

  it("retries group fetching after a failure instead of caching the failure for two minutes", async () => {
    let scans = 0;
    const request = vi.fn(async (url: string) => {
      if (url.includes("type=group")) {
        scans++;
        return scans === 1 ? response([], 503) : response([group(20)]);
      }
      return response([]);
    });
    const app = mountData(request);
    app.render("A");
    await app.refresh();
    await app.settle();
    await app.refresh();
    await app.settle();
    expect(scans).toBe(2);
    expect(app.data.conversations.map(c => c.id)).toEqual([20]);
    await app.refresh();
    expect(scans).toBe(2);
  });

  it("invalidates a completed group scan when membership revision changes", async () => {
    let scans = 0;
    const request = vi.fn(async (url: string) => {
      if (url.includes("type=group")) {
        scans++;
        return response([group(scans === 1 ? 10 : 20)]);
      }
      return response([]);
    });
    const app = mountData(request);
    app.render("A");
    await app.refresh();
    await app.settle();
    expect(scans).toBe(1);
    app.data.membershipEventSequence.current++;
    await app.refresh();
    await app.settle();
    expect(scans).toBe(2);
    expect(app.data.conversations.some(c => c.id === 20)).toBe(true);
  });

  it("starts a fresh scan after membership changes without waiting for a stale request", async () => {
    const stalePage = deferred<Response>();
    let scans = 0;
    const request = vi.fn(async (url: string) => {
      if (url.includes("type=group")) {
        scans++;
        return scans === 1 ? stalePage.promise : response([group(55)]);
      }
      return response([]);
    });
    const app = mountData(request);
    app.render("A");
    await app.refresh();
    await app.settle();
    expect(scans).toBe(1);
    app.data.membershipEventSequence.current++;
    await app.refresh();
    await app.settle();
    expect(scans).toBe(2);
    expect(app.data.conversations.some(c => c.id === 55)).toBe(true);
    await act(async () => { stalePage.resolve(response([group(44)])); });
    await app.settle();
    expect(app.data.conversations.some(c => c.id === 44)).toBe(false);
  });

  it("ignores late results from account A while account B has started a new scan", async () => {
    const oldPage = deferred<Response>();
    let scans = 0;
    const request = vi.fn(async (url: string) => {
      if (url.includes("type=group")) {
        scans++;
        return scans === 1 ? oldPage.promise : response([group(45)]);
      }
      return response([]);
    });
    const app = mountData(request);
    app.render("A");
    await app.refresh();
    app.render("B");
    await app.refresh();
    await app.settle();
    await act(async () => { oldPage.resolve(response([group(44)])); });
    await app.settle();
    expect(scans).toBe(2);
    expect(app.data.conversations.some(c => c.id === 44)).toBe(false);
    expect(app.data.conversations.some(c => c.id === 45)).toBe(true);
  });
});
