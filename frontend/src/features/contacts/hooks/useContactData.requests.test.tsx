// @vitest-environment jsdom
import { act, useLayoutEffect } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import type { AppDataContext } from "../../../shared/types/api";
import type { Session } from "../../../shared/types/session";
import { useContactData } from "./useContactData";

it("coalesces overlapping refreshes while retaining independent metadata loading", async () => {
  const old = (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const session = { sessionId: "A" } as Session;
  const sessionRef = { current: session };
  let finishFriends!: (value: Response) => void;
  const apiFetch = vi.fn((path: string): Promise<Response> => {
    if (path === "/api/friends") return new Promise(resolve => { finishFriends = resolve; });
    return Promise.resolve(Response.json(path === "/api/contacts"
      ? [{ id: 4, nickname: "Preferred", note: "", favorite: true }]
      : [{ id: 4, username: "requested" }]));
  });
  let refresh!: () => Promise<void>;
  function Probe() {
    const data = useContactData({
      session, sessionRef, apiFetch, setStatus: () => {}, setNotice: () => {},
    } as AppDataContext);
    useLayoutEffect(() => { refresh = data.refreshFriendConnections; });
    return <span>{data.friends.length}|{data.friendRequests.length}|{data.contactMetadata[4]?.nickname ?? ""}|{data.friendSyncBusy ? "busy" : "idle"}</span>;
  }

  try {
    await act(async () => root.render(<Probe />));
    let first!: Promise<void>;
    let second!: Promise<void>;
    await act(async () => {
      first = refresh();
      second = refresh();
      await Promise.resolve();
    });
    expect(apiFetch.mock.calls.map(([path]) => path).sort()).toEqual([
      "/api/contacts", "/api/friends", "/api/friends/requests",
    ]);
    expect(host.textContent).toContain("0|1|Preferred|busy");
    await act(async () => finishFriends(Response.json([{ id: 4, username: "friend" }])));
    await Promise.all([first, second]);
    expect(host.textContent).toBe("1|1|Preferred|idle");
  } finally {
    await act(async () => root.unmount());
    host.remove();
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = old;
  }
});

it("aborts superseded contact requests and ignores their late results", async () => {
  const oldAct = (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const session = { sessionId: "A" } as Session;
  const sessionRef = { current: session };
  const calls: Array<{ path: string; signal?: AbortSignal; resolve: (response: Response) => void }> = [];
  const apiFetch = (path: string, options?: RequestInit) => new Promise<Response>(resolve => {
    calls.push({ path, signal: options?.signal ?? undefined, resolve });
  });
  let refresh!: () => Promise<void>;
  let invalidate!: () => void;
  function Probe() {
    const data = useContactData({
      session, sessionRef, apiFetch, setStatus: () => {}, setNotice: () => {},
    } as AppDataContext);
    useLayoutEffect(() => {
      refresh = data.refreshFriendConnections;
      invalidate = () => { data.friendSyncRequest.current += 1; };
    });
    return <span>{data.friends.map(friend => friend.id).join(",")}|{data.contactMetadata[4]?.nickname ?? ""}</span>;
  }
  try {
    await act(async () => root.render(<Probe />));
    let first!: Promise<void>;
    let second!: Promise<void>;
    await act(async () => { first = refresh(); });
    expect(calls).toHaveLength(3);
    invalidate();
    await act(async () => { second = refresh(); });
    expect(calls).toHaveLength(6);
    expect(calls.slice(0, 3).every(item => item.signal?.aborted)).toBe(true);
    expect(calls.slice(3).every(item => !item.signal?.aborted)).toBe(true);
    await act(async () => {
      for (const call of calls.slice(3)) {
        call.resolve(Response.json(call.path === "/api/friends" ? [{ id: 4 }] : call.path === "/api/contacts"
          ? [{ id: 4, nickname: "New", note: "", favorite: true }] : []));
      }
    });
    await second;
    await act(async () => {
      for (const call of calls.slice(0, 3)) {
        call.resolve(Response.json(call.path === "/api/friends" ? [{ id: 99 }] : call.path === "/api/contacts"
          ? [{ id: 4, nickname: "Old", note: "", favorite: false }] : []));
      }
    });
    await first;
    expect(host.textContent).toBe("4|New");
  } finally {
    await act(async () => root.unmount());
    host.remove();
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = oldAct;
  }
});

it("aborts contacts requests when the owning component unmounts", async () => {
  const oldAct = (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const session = { sessionId: "A" } as Session;
  const signals: AbortSignal[] = [];
  const apiFetch = (_path: string, options?: RequestInit) => {
    if (options?.signal) signals.push(options.signal);
    return new Promise<Response>(() => undefined);
  };
  let refresh!: () => Promise<void>;
  function Probe() {
    const data = useContactData({
      session, sessionRef: { current: session }, apiFetch, setStatus: () => {}, setNotice: () => {},
    } as AppDataContext);
    useLayoutEffect(() => { refresh = data.refreshFriendConnections; });
    return null;
  }
  try {
    await act(async () => root.render(<Probe />));
    await act(async () => { void refresh(); });
    expect(signals).toHaveLength(3);
    await act(async () => root.unmount());
    expect(signals.every(signal => signal.aborted)).toBe(true);
  } finally {
    host.remove();
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = oldAct;
  }
});
