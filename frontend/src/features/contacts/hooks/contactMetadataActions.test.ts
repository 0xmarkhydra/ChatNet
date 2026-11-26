// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import type { Session } from "../../../shared/types/session";
import type { FriendConnection } from "../types";
import type { UseContactActionsDeps } from "./contactActionTypes";
import { createContactMetadataActions } from "./contactMetadataActions";

const friend = { id: 12, username: "friend" } as FriendConnection;

function setup(apiFetch: UseContactActionsDeps["apiFetch"] = async () =>
  Response.json({ id: 12, favorite: true })) {
  const session = { sessionId: "A" } as Session;
  const sessionRef = { current: session as Session | null };
  const metadata: UseContactActionsDeps["contactMetadata"] = {
    12: { nickname: "", note: "", favorite: false },
  };
  const friendActionRef = { current: new Set<number>() };
  const setContactMetadata = vi.fn();
  const setFriendBusyIds = vi.fn();
  const setFriendMenuId = vi.fn();
  const setNotice = vi.fn();
  const action = createContactMetadataActions({
    apiFetch, contactMetadata: metadata, friendActionRef, friendBusyIds: new Set<number>(),
    session, sessionRef, setContactMetadata, setFriendBusyIds,
    setFriendMenuId, setNotice,
  });
  return {
    action, sessionRef, friendActionRef, setContactMetadata, setFriendBusyIds,
    setFriendMenuId, setNotice,
  };
}

afterEach(() => vi.restoreAllMocks());

it("saves favorite metadata and releases the busy state", async () => {
  const apiFetch = vi.fn(async (_path: string, _init?: RequestInit) => Response.json({ id: 12, favorite: true }));
  const state = setup(apiFetch);
  await state.action.changePersonalContact(friend, "favorite");
  expect(apiFetch).toHaveBeenCalledOnce();
  expect(apiFetch.mock.calls[0]?.[0]).toBe("/api/contacts/12");
  expect(state.setContactMetadata).toHaveBeenCalledOnce();
  expect(state.setFriendBusyIds).toHaveBeenCalledTimes(2);
  expect(state.setFriendMenuId).toHaveBeenCalledWith(null);
  expect(state.setNotice).toHaveBeenCalledWith("Đã lưu thông tin liên hệ riêng.");
});

it("rejects an overlong nickname before making a network request", async () => {
  const apiFetch = vi.fn(async () => Response.json({ id: 12 }));
  vi.spyOn(window, "prompt").mockReturnValue("x".repeat(61));
  const state = setup(apiFetch);
  await state.action.changePersonalContact(friend, "nickname");
  expect(apiFetch).not.toHaveBeenCalled();
  expect(state.setNotice).toHaveBeenCalledWith("Nội dung vượt quá độ dài cho phép.", "warning");
});

it("does not apply a stale response after the session changes", async () => {
  let finish!: (value: Response) => void;
  const state = setup(() => new Promise(resolve => { finish = resolve; }));
  const task = state.action.changePersonalContact(friend, "favorite");
  state.sessionRef.current = { sessionId: "B" } as Session;
  finish(Response.json({ id: 12, favorite: true }));
  await task;
  expect(state.setContactMetadata).not.toHaveBeenCalled();
  expect(state.setFriendBusyIds).toHaveBeenCalledTimes(1);
  expect(state.setNotice).not.toHaveBeenCalled();
});
it("uses a safe fallback when an error response contains a non-string message", async () => {
  const state = setup(async () => Response.json({ error: { message: "unexpected" } }, { status: 400 }));
  await state.action.changePersonalContact(friend, "favorite");
  expect(state.setContactMetadata).not.toHaveBeenCalled();
  expect(state.setNotice).toHaveBeenCalledWith("Không lưu được liên hệ.", "error");
});

it("does not send duplicate metadata mutations while the first request is pending", async () => {
  let finish!: (value: Response) => void;
  const apiFetch = vi.fn(() => new Promise<Response>(resolve => { finish = resolve; }));
  const state = setup(apiFetch);
  const first = state.action.changePersonalContact(friend, "favorite");
  const second = state.action.changePersonalContact(friend, "favorite");
  expect(apiFetch).toHaveBeenCalledOnce();
  expect(state.friendActionRef.current.has(friend.id)).toBe(true);
  finish(Response.json({ id: 12, favorite: true }));
  await Promise.all([first, second]);
  expect(state.friendActionRef.current.has(friend.id)).toBe(false);
  expect(state.setContactMetadata).toHaveBeenCalledOnce();
});

it("releases metadata mutation lock after a failed request", async () => {
  const apiFetch = vi.fn(async () => Response.json({ error: "failed" }, { status: 400 }));
  const state = setup(apiFetch);
  await state.action.changePersonalContact(friend, "favorite");
  expect(state.friendActionRef.current.has(friend.id)).toBe(false);
  await state.action.changePersonalContact(friend, "favorite");
  expect(apiFetch).toHaveBeenCalledTimes(2);
});
