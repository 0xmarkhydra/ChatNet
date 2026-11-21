// @vitest-environment jsdom
import { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useGroupChannelLiveSync } from "./useGroupChannelLiveSync";
import type { Conversation } from "../types";
import type { GroupChannel } from "../utils/groupChannels";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const cleanups: Array<() => void> = [];
afterEach(() => {
  while (cleanups.length) cleanups.pop()!();
  vi.restoreAllMocks();
});

const channel = (id: number, unreadCount?: number) => ({
  id, name: `Channel ${id}`, ...(unreadCount === undefined ? {} : { unreadCount }),
});
const reply = (body: unknown) => new Response(JSON.stringify(body), {
  status: 200, headers: { "content-type": "application/json" },
});
type RequestFn = (path: string, init?: RequestInit) => Promise<Response>;

function mountSync(request: RequestFn) {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const notice = vi.fn();
  let snapshot!: {
    channelState: { conversationId: number | null; channels: GroupChannel[] };
    selected: { conversationId: number | null; channelId: number };
    conversations: Conversation[];
    unreadAvailable: boolean;
  };
  let chooseChannel!: (channelId: number) => void;
  const initial = [{ id: 4, type: "group", unreadCount: 99 }, { id: 5, type: "group", unreadCount: 7 }] as Conversation[];

  function Probe({ id, token }: { id: number | null; token: string | null }) {
    const [channelState, setChannelState] = useState<{ conversationId: number | null; channels: GroupChannel[] }>({
      conversationId: null, channels: [],
    });
    const [selected, setSelected] = useState({ conversationId: 4 as number | null, channelId: 2 });
    const [conversations, setConversations] = useState(initial);
    const { groupChannelUnreadAvailable } = useGroupChannelLiveSync({
      groupConversationId: id,
      sessionToken: token,
      request,
      setGroupChannelState: setChannelState,
      setChannelSelection: setSelected,
      setConversations,
      setNotice: notice,
    });
    chooseChannel = channelId => setSelected({ conversationId: id, channelId });
    snapshot = { channelState, selected, conversations, unreadAvailable: groupChannelUnreadAvailable };
    return null;
  }
  const render = async (id: number | null, token = "session-A") => {
    await act(async () => { root.render(<Probe id={id} token={token} />); });
    return snapshot;
  };
  const close = () => { act(() => root.unmount()); host.remove(); };
  cleanups.push(close);
  return { render, get state() { return snapshot; }, notice, chooseChannel, close };
}

describe("useGroupChannelLiveSync", () => {
  it("aggregates reliable unread counts and resets an invalid selected channel", async () => {
    const request = vi.fn(async () => reply([channel(1, 2), channel(3, 4)]));
    const app = mountSync(request);
    await app.render(4);
    expect(request).toHaveBeenCalledWith("/api/conversations/4/channels", {
      signal: expect.any(AbortSignal),
    });
    expect(app.state.channelState.channels.map(item => item.id)).toEqual([0, 1, 3]);
    expect(app.state.conversations[0].unreadCount).toBe(6);
    expect(app.state.conversations[1].unreadCount).toBe(7);
    expect(app.state.selected.channelId).toBe(0);
    expect(app.state.unreadAvailable).toBe(true);
  });

  it("preserves server unread when endpoint lacks metadata", async () => {
    const app = mountSync(vi.fn(async () => reply([channel(1)])));
    await app.render(4);
    expect(app.state.unreadAvailable).toBe(false);
    expect(app.state.conversations[0].unreadCount).toBe(99);
    expect(app.state.channelState.channels.find(item => item.id === 1)?.unreadCount).toBe(0);
  });

  it("ignores a late response from the previous group and aborts its request", async () => {
    const pending: Array<{ resolve: (value: Response) => void; signal: AbortSignal }> = [];
    const request = vi.fn((_path: string, init?: RequestInit) =>
      new Promise<Response>(resolve => pending.push({ resolve, signal: init!.signal as AbortSignal })));
    const app = mountSync(request);
    await app.render(4);
    const old = pending[0];
    await app.render(5);
    expect(old.signal.aborted).toBe(true);
    await act(async () => { pending[1].resolve(reply([channel(8, 3)])); });
    await act(async () => { old.resolve(reply([channel(9, 99)])); });
    expect(app.state.channelState.conversationId).toBe(5);
    expect(app.state.channelState.channels.some(item => item.id === 9)).toBe(false);
    expect(app.state.conversations[0].unreadCount).toBe(99);
    expect(app.state.conversations[1].unreadCount).toBe(3);
  });

  it("refreshes the active group only on its events and removes listeners on unmount", async () => {
    const request = vi.fn(async () => reply([channel(2, 1)]));
    const app = mountSync(request);
    await app.render(4);
    await act(async () => {
      window.dispatchEvent(new CustomEvent("chatnet:group-community-updated", { detail: { conversationId: 5 } }));
    });
    expect(request).toHaveBeenCalledTimes(1);
    await act(async () => {
      window.dispatchEvent(new CustomEvent("chatnet:group-community-updated", { detail: { conversationId: 4 } }));
    });
    expect(request).toHaveBeenCalledTimes(2);
    await act(async () => {
      window.dispatchEvent(new CustomEvent("chatnet:channel-read", { detail: { conversationId: 4, channelId: 2 } }));
    });
    expect(request).toHaveBeenCalledTimes(3);
    app.close();
    cleanups.pop();
    window.dispatchEvent(new CustomEvent("chatnet:group-channel-event", { detail: { message: { conversationId: 4 } } }));
    expect(request).toHaveBeenCalledTimes(3);
  });
});
