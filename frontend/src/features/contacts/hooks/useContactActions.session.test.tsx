// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import type { Session } from "../../../shared/types/session";
import type { UseContactActionsDeps } from "./contactActionTypes";
import { useContactActions } from "./useContactActions";

it("clears pending contact mutation locks on session changes and unmount", async () => {
  const env = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
  const previous = env.IS_REACT_ACT_ENVIRONMENT;
  env.IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const friendActionRef = { current: new Set<number>() };
  const sessionA = { sessionId: "A" } as Session;
  const sessionB = { sessionId: "B" } as Session;
  const sessionRef = { current: sessionA as Session | null };
  const setter = vi.fn();
  function Probe({ session }: { session: Session }) {
    const dependencies = {
      apiFetch: async () => Response.json([]), blockedBusy: false,
      contactMetadata: {}, conversations: [], friendActionRef,
      friendBusyIds: new Set(), friendRelationship: () => "none", friends: [],
      friendSyncRequest: { current: 0 }, openDirectByUsername: async () => {},
      refreshConversations: async () => {}, refreshFriendConnections: async () => {},
      session, sessionRef, setActiveConversationId: setter, setBlockedBusy: setter,
      setBlockedError: setter, setBlockedOpen: setter, setBlockedUsers: setter,
      setContactMetadata: setter, setConversations: setter, setDesktopSection: setter,
      setFriendActionBusy: setter, setFriendBusyIds: setter, setFriendMenuId: setter,
      setFriendPreview: setter, setFriendRequests: setter, setFriendResults: setter,
      setFriends: setter, setNotice: setter, setTab: setter,
    } as unknown as UseContactActionsDeps;
    useContactActions(dependencies);
    return null;
  }
  try {
    await act(async () => root.render(<Probe session={sessionA} />));
    friendActionRef.current.add(12);
    sessionRef.current = sessionB;
    await act(async () => root.render(<Probe session={sessionB} />));
    expect(friendActionRef.current.size).toBe(0);
    friendActionRef.current.add(14);
    await act(async () => root.unmount());
    expect(friendActionRef.current.size).toBe(0);
  } finally {
    container.remove();
    env.IS_REACT_ACT_ENVIRONMENT = previous;
  }
});
