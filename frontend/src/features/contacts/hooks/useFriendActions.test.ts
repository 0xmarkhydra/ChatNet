import { expect, it, vi } from "vitest";
import type { Session } from "../../../shared/types/session";
import type { FriendConnection } from "../types";
import type { UseContactActionsDeps } from "./contactActionTypes";
import { createFriendActions } from "./useFriendActions";

const friend: FriendConnection = {
  id: 8, username: "alice", displayName: "Alice", online: false,
  updatedAt: "2026-11-26T00:00:00Z", status: "pending", direction: "incoming",
};

function setup(apiFetch: UseContactActionsDeps["apiFetch"], relationship: "incoming" | "accepted" = "incoming") {
  const session = { sessionId: "A", user: { id: 1 } } as Session;
  const sessionRef = { current: session as Session | null };
  const friendActionRef = { current: new Set<number>() };
  const friendSyncRequest = { current: 0 };
  const setFriendBusyIds = vi.fn();
  const setFriendActionBusy = vi.fn();
  const setFriendRequests = vi.fn();
  const setFriends = vi.fn();
  const setNotice = vi.fn();
  const refreshFriendConnections = vi.fn(async () => {});
  const options = {
    apiFetch, session, sessionRef, friendActionRef, friendSyncRequest,
    friendRelationship: () => relationship, friends: [],
    setFriendBusyIds, setFriendActionBusy, setFriendRequests, setFriends,
    setNotice, refreshFriendConnections,
    setFriendMenuId: vi.fn(), setFriendPreview: vi.fn(),
    openDirectByUsername: vi.fn(async () => {}),
    openBlockedFriendConversation: vi.fn(async () => {}),
  } as unknown as Parameters<typeof createFriendActions>[0];
  return {
    actions: createFriendActions(options), sessionRef, friendActionRef,
    setFriendRequests, setFriends, setNotice, setFriendBusyIds,
    refreshFriendConnections,
  };
}

it("coalesces duplicate actions for the same friend before React updates busy state", async () => {
  let respond!: (response: Response) => void;
  const fetch = vi.fn(() => new Promise<Response>(resolve => { respond = resolve; }));
  const state = setup(fetch);
  const first = state.actions.actOnFriend(friend);
  const duplicate = state.actions.actOnFriend(friend);
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(state.friendActionRef.current.has(friend.id)).toBe(true);
  respond(Response.json({ ...friend, status: "accepted" }));
  await Promise.all([first, duplicate]);
  expect(state.setFriends).toHaveBeenCalledOnce();
  expect(state.friendActionRef.current.size).toBe(0);
});

it("refreshes canonical data instead of publishing malformed mutation results", async () => {
  const state = setup(async () => Response.json({ id: 8, status: "accepted", username: "alice" }));
  await state.actions.actOnFriend(friend);
  expect(state.setFriends).not.toHaveBeenCalled();
  expect(state.setFriendRequests).not.toHaveBeenCalled();
  expect(state.refreshFriendConnections).toHaveBeenCalledOnce();
});

it("ignores a late mutation response after switching sessions", async () => {
  let respond!: (response: Response) => void;
  const state = setup(() => new Promise(resolve => { respond = resolve; }));
  const first = state.actions.actOnFriend(friend);
  state.sessionRef.current = { sessionId: "B", user: { id: 2 } } as Session;
  respond(Response.json({ ...friend, status: "accepted" }));
  await first;
  expect(state.setFriends).not.toHaveBeenCalled();
  expect(state.setNotice).not.toHaveBeenCalled();
});
