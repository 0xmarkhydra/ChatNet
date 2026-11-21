// @vitest-environment jsdom
import { act, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { useConversationViewReset } from "./useConversationViewReset";
import type { GroupMember } from "../types";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const cleanup: Array<() => void> = [];
afterEach(() => { while (cleanup.length) cleanup.pop()!(); });

function mountReset() {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  let state!: {
    conversation: { current: number | null };
    follow: { current: boolean };
    pagingBusy: { current: boolean };
    hasMore: boolean;
    loadingMore: boolean;
    members: GroupMember[];
    dirty: () => void;
  };
  function Probe({ id }: { id: number | null }) {
    const conversation = useRef<number | null>(null);
    const follow = useRef(false);
    const pagingBusy = useRef(false);
    const [hasMore, setHasMoreMessages] = useState(true);
    const [loadingMore, setMessagesLoadingMore] = useState(true);
    const [members, setGroupMembers] = useState<GroupMember[]>([{} as GroupMember]);
    useConversationViewReset(id, {
      activeConversationIdRef: conversation,
      messageScrollAtBottom: follow,
      messagesPagingBusy: pagingBusy,
      setHasMoreMessages,
      setMessagesLoadingMore,
      setGroupMembers,
    });
    state = {
      conversation, follow, pagingBusy, hasMore, loadingMore, members,
      dirty: () => {
        follow.current = false;
        pagingBusy.current = true;
        setHasMoreMessages(true);
        setMessagesLoadingMore(true);
        setGroupMembers([{} as GroupMember]);
      },
    };
    return null;
  }
  const render = (id: number | null) => {
    act(() => root.render(<Probe id={id} />));
    return state;
  };
  cleanup.push(() => { act(() => root.unmount()); host.remove(); });
  return { render };
}

describe("useConversationViewReset", () => {
  it("clears transient paging and members on A → B → A, without touching message cache", () => {
    const app = mountReset();
    let state = app.render(4);
    expect(state.conversation.current).toBe(4);
    expect(state.follow.current).toBe(true);
    expect(state.pagingBusy.current).toBe(false);
    expect(state.hasMore).toBe(false);
    expect(state.loadingMore).toBe(false);
    expect(state.members).toEqual([]);
    const messageCache = new Map([[4, ["retained message"]]]);
    act(() => state.dirty());
    state = app.render(5);
    expect(state.conversation.current).toBe(5);
    expect(state.follow.current).toBe(true);
    expect(state.pagingBusy.current).toBe(false);
    expect(state.members).toEqual([]);
    state = app.render(4);
    expect(state.conversation.current).toBe(4);
    expect(messageCache.get(4)).toEqual(["retained message"]);
  });

  it("does not reset when unrelated UI state re-renders", () => {
    const app = mountReset();
    const state = app.render(8);
    act(() => state.dirty());
    const again = app.render(8);
    expect(again.hasMore).toBe(true);
    expect(again.loadingMore).toBe(true);
    expect(again.members).toHaveLength(1);
    expect(again.follow.current).toBe(false);
  });
});
