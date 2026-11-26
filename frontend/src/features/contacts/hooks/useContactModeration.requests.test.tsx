// @vitest-environment jsdom
import { act, useLayoutEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import type { Session } from "../../../shared/types/session";
import { useContactModeration } from "./useContactModeration";

const useActEnvironment = () => {
  const state = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
  const previous = state.IS_REACT_ACT_ENVIRONMENT;
  state.IS_REACT_ACT_ENVIRONMENT = true;
  return () => { state.IS_REACT_ACT_ENVIRONMENT = previous; };
};

it("shares an in-flight blocked-list request and keeps one response", async () => {
  const restore = useActEnvironment();
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const session = { sessionId: "A" } as Session;
  const sessionRef = { current: session };
  let resolve!: (response: Response) => void;
  const request = vi.fn((_path: string, _options?: RequestInit) =>
    new Promise<Response>(finish => { resolve = finish; }));
  let load!: () => Promise<void>;
  function Probe() {
    const [busy, setBusy] = useState(false);
    const [blocked, setBlocked] = useState<Array<{id: number; username: string; displayName: string}>>([]);
    const [open, setOpen] = useState(false);
    const actions = useContactModeration({
      apiFetch: request, session, sessionRef,
      blockedBusy: busy, setBlockedBusy: setBusy, setBlockedUsers: setBlocked,
      setBlockedOpen: setOpen, setBlockedError: vi.fn(), setNotice: vi.fn(),
      friendActionRef: { current: new Set<number>() },
      friendBusyIds: new Set(), refreshConversations: async () => {},
      refreshFriendConnections: async () => {},
      setFriendBusyIds: vi.fn(), setFriendMenuId: vi.fn(),
      setFriendPreview: vi.fn(), setFriendRequests: vi.fn(),
      setFriendResults: vi.fn(), setFriends: vi.fn(), setConversations: vi.fn(),
    });
    useLayoutEffect(() => { load = actions.loadBlockedUsers; });
    return <span>{blocked.map(friend => friend.username).join(",")}|{busy ? "busy" : "idle"}|{open ? "open" : "closed"}</span>;
  }
  try {
    await act(async () => root.render(<Probe />));
    let first!: Promise<void>;
    let second!: Promise<void>;
    await act(async () => {
      first = load();
      second = load();
    });
    expect(request).toHaveBeenCalledTimes(1);
    expect(request.mock.calls[0]?.[0]).toBe("/api/users/blocked");
    expect(host.textContent).toBe("|busy|closed");
    await act(async () => resolve(Response.json([{ id: 8, username: "alice", displayName: "Alice" }])));
    await Promise.all([first, second]);
    expect(host.textContent).toBe("alice|idle|open");
  } finally {
    await act(async () => root.unmount());
    host.remove();
    restore();
  }
});

it("cancels a blocked-list fetch after logout and does not publish stale results", async () => {
  const restore = useActEnvironment();
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const session = { sessionId: "A" } as Session;
  const sessionRef = { current: session as Session | null };
  let resolve!: (response: Response) => void;
  let signal: AbortSignal | undefined;
  const request = (_path: string, options?: RequestInit) => {
    signal = options?.signal ?? undefined;
    return new Promise<Response>(finish => { resolve = finish; });
  };
  const setBlockedUsers = vi.fn();
  const setBlockedOpen = vi.fn();
  const setBlockedError = vi.fn();
  let load!: () => Promise<void>;
  function Probe({ current }: {current: Session | null}) {
    const actions = useContactModeration({
      apiFetch: request, session: current, sessionRef,
      blockedBusy: false, setBlockedBusy: vi.fn(), setBlockedUsers,
      setBlockedOpen, setBlockedError, setNotice: vi.fn(),
      friendActionRef: { current: new Set<number>() },
      friendBusyIds: new Set(), refreshConversations: async () => {},
      refreshFriendConnections: async () => {},
      setFriendBusyIds: vi.fn(), setFriendMenuId: vi.fn(),
      setFriendPreview: vi.fn(), setFriendRequests: vi.fn(),
      setFriendResults: vi.fn(), setFriends: vi.fn(), setConversations: vi.fn(),
    });
    useLayoutEffect(() => { load = actions.loadBlockedUsers; });
    return null;
  }
  try {
    await act(async () => root.render(<Probe current={session} />));
    let task!: Promise<void>;
    await act(async () => { task = load(); });
    expect(signal?.aborted).toBe(false);
    sessionRef.current = null;
    await act(async () => root.render(<Probe current={null} />));
    expect(signal?.aborted).toBe(true);
    await act(async () => resolve(Response.json([{id: 8, username: "stale", displayName: "Stale"}])));
    await task;
    expect(setBlockedUsers).not.toHaveBeenCalled();
    expect(setBlockedOpen).not.toHaveBeenCalled();
    expect(setBlockedError).toHaveBeenCalledOnce();
    expect(setBlockedError).toHaveBeenCalledWith("");
  } finally {
    await act(async () => root.unmount());
    host.remove();
    restore();
  }
});

it("prevents two block mutations for the same friend before busy state commits", async () => {
  const restore = useActEnvironment();
  const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const session = { sessionId: "A" } as Session;
  const sessionRef = { current: session };
  const friendActionRef = { current: new Set<number>() };
  let finish!: (response: Response) => void;
  const request = vi.fn((_path: string, _options?: RequestInit) =>
    new Promise<Response>(resolve => { finish = resolve; }));
  const setBlockedUsers = vi.fn();
  let block!: (friend: { id: number; username: string; displayName: string }) => Promise<void>;
  function Probe() {
    const actions = useContactModeration({
      apiFetch: request, session, sessionRef, blockedBusy: false,
      friendActionRef, friendBusyIds: new Set(), setBlockedBusy: vi.fn(),
      setBlockedUsers, setBlockedOpen: vi.fn(), setBlockedError: vi.fn(),
      setNotice: vi.fn(), refreshConversations: async () => {},
      refreshFriendConnections: async () => {},
      setFriendBusyIds: vi.fn(), setFriendMenuId: vi.fn(),
      setFriendPreview: vi.fn(), setFriendRequests: vi.fn(),
      setFriendResults: vi.fn(), setFriends: vi.fn(), setConversations: vi.fn(),
    });
    useLayoutEffect(() => { block = actions.blockContact; });
    return null;
  }
  try {
    await act(async () => root.render(<Probe />));
    const friend = { id: 9, username: "alice", displayName: "Alice" };
    let first!: Promise<void>;
    let second!: Promise<void>;
    await act(async () => {
      first = block(friend);
      second = block(friend);
    });
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledTimes(1);
    expect(friendActionRef.current.has(friend.id)).toBe(true);
    await act(async () => finish(Response.json({})));
    await Promise.all([first, second]);
    expect(setBlockedUsers).toHaveBeenCalledOnce();
    expect(friendActionRef.current.has(friend.id)).toBe(false);
  } finally {
    await act(async () => root.unmount());
    host.remove();
    confirm.mockRestore();
    restore();
  }
});

it("coalesces rapid unblock clicks and unlocks after the mutation resolves", async () => {
  const restore = useActEnvironment();
  const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const session = { sessionId: "A" } as Session;
  const sessionRef = { current: session };
  let finish!: (response: Response) => void;
  const request = vi.fn((_path: string, _options?: RequestInit) =>
    new Promise<Response>(resolve => { finish = resolve; }));
  let unblock!: (userId: number) => Promise<void>;
  function Probe() {
    const actions = useContactModeration({
      apiFetch: request, session, sessionRef,
      blockedBusy: false, friendActionRef: { current: new Set<number>() },
      friendBusyIds: new Set(), setBlockedBusy: vi.fn(),
      setBlockedUsers: vi.fn(), setBlockedOpen: vi.fn(), setBlockedError: vi.fn(),
      setNotice: vi.fn(), refreshConversations: async () => {},
      refreshFriendConnections: async () => {},
      setFriendBusyIds: vi.fn(), setFriendMenuId: vi.fn(),
      setFriendPreview: vi.fn(), setFriendRequests: vi.fn(),
      setFriendResults: vi.fn(), setFriends: vi.fn(), setConversations: vi.fn(),
    });
    useLayoutEffect(() => { unblock = actions.unblockContact; });
    return null;
  }
  try {
    await act(async () => root.render(<Probe />));
    let first!: Promise<void>;
    let duplicate!: Promise<void>;
    await act(async () => {
      first = unblock(9);
      duplicate = unblock(9);
    });
    expect(request).toHaveBeenCalledTimes(1);
    expect(confirm).toHaveBeenCalledTimes(1);
    await act(async () => finish(Response.json({})));
    await Promise.all([first, duplicate]);
    await act(async () => { void unblock(9); });
    expect(request).toHaveBeenCalledTimes(2);
    await act(async () => finish(Response.json({})));
  } finally {
    await act(async () => root.unmount());
    host.remove();
    confirm.mockRestore();
    restore();
  }
});
