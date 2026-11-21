// @vitest-environment jsdom
import { act, useRef } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Session } from "../../../shared/types/session";
import type { QueuedChatMessage } from "../lib/chatOutbox";
import { persistChatOutboxChange } from "../lib/chatOutbox";
import { restoreChatOutbox } from "../utils/outboxRecovery";
import { useChatOutboxState } from "./useChatOutboxState";

vi.mock("../lib/chatOutbox", () => ({ persistChatOutboxChange: vi.fn(() => true) }));
vi.mock("../utils/outboxRecovery", () => ({ restoreChatOutbox: vi.fn(() => []) }));

const previousAct = (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
const hosts: Array<{ host: HTMLDivElement; unmount: () => void }> = [];

afterEach(() => {
  while (hosts.length) {
    const item = hosts.pop()!;
    act(item.unmount);
    item.host.remove();
  }
  vi.resetAllMocks();
  vi.mocked(persistChatOutboxChange).mockReturnValue(true);
  vi.mocked(restoreChatOutbox).mockReturnValue([]);
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = previousAct;
});

const userSession = (sessionId: string, userId = 21) =>
  ({ sessionId, user: { id: userId } }) as Session;

type State = ReturnType<typeof useChatOutboxState>;

function mountOutbox() {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  hosts.push({ host, unmount: () => root.unmount() });
  const notice = vi.fn();
  let state!: State;
  let sessionRef!: { current: Session | null };
  let actionLocks!: { current: Set<string> };

  function Probe({ session }: { session: Session }) {
    const currentRef = useRef<Session | null>(session);
    const locks = useRef(new Set<string>());
    currentRef.current = session;
    sessionRef = currentRef;
    actionLocks = locks;
    state = useChatOutboxState({ session, sessionRef: currentRef, actionLocksRef: locks, setNotice: notice });
    return null;
  }
  const render = (session: Session) => {
    act(() => root.render(<Probe session={session} />));
    return state;
  };
  return { render, notice, get state() { return state; }, get sessionRef() { return sessionRef; }, get actionLocks() { return actionLocks; } };
}

describe("useChatOutboxState", () => {
  it("persists before publishing an outbox update and preserves the synchronous ref", () => {
    const app = mountOutbox();
    const state = app.render(userSession("A"));
    const item = { clientId: "one" } as QueuedChatMessage;
    act(() => state.updateChatOutbox(() => [item]));
    expect(persistChatOutboxChange).toHaveBeenCalledWith(21, "A", [], [item]);
    expect(app.state.chatOutbox).toEqual([item]);
    expect(state.chatOutboxRef.current).toEqual([item]);
  });

  it("does not publish changes if persistence fails or the session is stale", () => {
    const app = mountOutbox();
    const state = app.render(userSession("A"));
    vi.mocked(persistChatOutboxChange).mockReturnValue(false);
    const item = { clientId: "two" } as QueuedChatMessage;
    act(() => state.updateChatOutbox(() => [item]));
    expect(state.chatOutboxRef.current).toEqual([]);
    expect(app.notice).toHaveBeenCalledWith(expect.any(String), "warning");
    app.sessionRef.current = userSession("B");
    act(() => state.updateChatOutbox(() => [item]));
    expect(persistChatOutboxChange).toHaveBeenCalledTimes(1);
    expect(state.chatOutboxRef.current).toEqual([]);
  });

  it("restores a new session and clears retry and action locks", () => {
    const app = mountOutbox();
    const state = app.render(userSession("A"));
    state.sendingClientIDs.current.add("pending");
    state.retryOutboxBusy.current = true;
    app.actionLocks.current.add("reaction");
    const restored = [{ clientId: "restored" }] as QueuedChatMessage[];
    vi.mocked(restoreChatOutbox).mockReturnValueOnce(restored);
    const next = app.render(userSession("B", 22));
    expect(restoreChatOutbox).toHaveBeenCalledWith(22, "B");
    expect(next.chatOutbox).toEqual(restored);
    expect(next.chatOutboxRef.current).toEqual(restored);
    expect(next.sendingClientIDs.current.size).toBe(0);
    expect(next.retryOutboxBusy.current).toBe(false);
    expect(app.actionLocks.current.size).toBe(0);
  });
});
