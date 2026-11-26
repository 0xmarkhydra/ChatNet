import { expect, it, vi } from "vitest";
import type { Session } from "../../../shared/types/session";
import type { Conversation } from "../../chat";
import type { FriendConnection } from "../types";
import type { UseContactActionsDeps } from "./contactActionTypes";
import { createBlockedConversationActions } from "./blockedConversationActions";

const friend = { id: 19, username: "friend" } as FriendConnection;
const direct = { id: 42, type: "direct", otherUserId: 19 } as Conversation;

function setup(
  overrides: Partial<Pick<UseContactActionsDeps, "apiFetch" | "conversations" | "friends">> = {},
) {
  const session = { sessionId: "A" } as Session;
  const sessionRef = { current: session as Session | null };
  const setConversations = vi.fn();
  const setDesktopSection = vi.fn();
  const setTab = vi.fn();
  const setActiveConversationId = vi.fn();
  const setNotice = vi.fn();
  const apiFetch = overrides.apiFetch ?? vi.fn(async () => Response.json([]));
  const actions = createBlockedConversationActions({
    apiFetch,
    conversations: overrides.conversations ?? [],
    friends: overrides.friends ?? [friend],
    session, sessionRef, setConversations, setDesktopSection,
    setTab, setActiveConversationId, setNotice,
  });
  return {
    actions, apiFetch, sessionRef, setConversations, setDesktopSection,
    setTab, setActiveConversationId, setNotice,
  };
}

it("opens an existing direct chat without another API request", async () => {
  const fetch = vi.fn(async () => Response.json([]));
  const state = setup({ apiFetch: fetch, conversations: [direct] });
  await state.actions.openBlockedFriendConversation(19);
  expect(fetch).not.toHaveBeenCalled();
  expect(state.setActiveConversationId).toHaveBeenCalledWith(42);
  expect(state.setTab).toHaveBeenCalledWith("chat");
  expect(state.setDesktopSection).toHaveBeenCalledWith(null);
});

it("finds a paginated direct chat and inserts it once into the conversation list", async () => {
  const fetch = vi.fn(async (_path: string) => Response.json([direct]));
  const state = setup({ apiFetch: fetch });
  await state.actions.openBlockedFriendConversation(19);
  expect(fetch).toHaveBeenCalledWith("/api/conversations?type=direct&q=friend&limit=100", { cache: "no-store" });
  const update = state.setConversations.mock.calls[0][0] as (items: Conversation[]) => Conversation[];
  expect(update([direct])).toEqual([direct]);
  expect(state.setActiveConversationId).toHaveBeenCalledWith(42);
});

it("ignores a paginated response belonging to a previous session", async () => {
  let finish!: (response: Response) => void;
  const state = setup({ apiFetch: () => new Promise(resolve => { finish = resolve; }) });
  const request = state.actions.openBlockedFriendConversation(19);
  state.sessionRef.current = { sessionId: "B" } as Session;
  finish(Response.json([direct]));
  await request;
  expect(state.setConversations).not.toHaveBeenCalled();
  expect(state.setActiveConversationId).not.toHaveBeenCalled();
  expect(state.setNotice).not.toHaveBeenCalled();
});

it("preserves the blocked contact when no existing conversation is found", async () => {
  const state = setup();
  await state.actions.openBlockedFriendConversation(19);
  expect(state.setActiveConversationId).not.toHaveBeenCalled();
  expect(state.setNotice).toHaveBeenCalledWith("Chưa tìm thấy hội thoại cũ để mở.", "warning");
});
