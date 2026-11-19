// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useAppChatSearchState } from "./useAppChatSearchState";

vi.mock("./usePhoneSearchLayout", () => ({ usePhoneSearchLayout: () => false }));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
type Search = ReturnType<typeof useAppChatSearchState>;

const hosts: Array<{ close: () => void }> = [];
afterEach(() => {
  while (hosts.length) hosts.pop()!.close();
  vi.restoreAllMocks();
});

function mountSearch() {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  let state!: Search;
  function Probe() {
    state = useAppChatSearchState();
    return <div ref={state.quickSearchAnchorRef}><button>Inside</button></div>;
  }
  const render = () => {
    act(() => root.render(<Probe />));
    return state;
  };
  const close = () => { act(() => root.unmount()); host.remove(); };
  hosts.push({ close });
  return { render, get state() { return state; }, host };
}

describe("useAppChatSearchState", () => {
  it("keeps search, filter and jump revisions independent", () => {
    const app = mountSearch();
    const initial = app.render();
    act(() => {
      initial.setGlobalSearch("feed");
      initial.setChatListQuery("hello");
      initial.setChatListFilter("unread");
      initial.setChatSearchJump({ conversationId: 5, messageId: 10, revision: initial.nextChatSearchJumpRevision() });
    });
    const next = app.state;
    expect(next.globalSearch).toBe("feed");
    expect(next.chatListQuery).toBe("hello");
    expect(next.chatListFilter).toBe("unread");
    expect(next.chatSearchJump).toEqual({ conversationId: 5, messageId: 10, revision: 1 });
    expect(next.nextChatSearchJumpRevision()).toBe(2);
  });

  it("dismisses quick search on Escape or pointer outside, not inside", () => {
    const app = mountSearch();
    const state = app.render();
    act(() => state.setQuickSearchOpen(true));
    expect(app.state.quickSearchOpen).toBe(true);
    act(() => app.host.querySelector("button")!.dispatchEvent(new Event("pointerdown", { bubbles: true })));
    expect(app.state.quickSearchOpen).toBe(true);
    act(() => document.body.dispatchEvent(new Event("pointerdown", { bubbles: true })));
    expect(app.state.quickSearchOpen).toBe(false);
    act(() => app.state.setQuickSearchOpen(true));
    act(() => document.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Escape" })));
    expect(app.state.quickSearchOpen).toBe(false);
  });
});
