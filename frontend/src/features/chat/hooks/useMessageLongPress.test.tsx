// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useMessageLongPress } from "./useMessageLongPress";
import type { UseMessageLongPressDeps } from "./useMessageLongPress";
import type { Message } from "../types";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const cleanup: Array<() => void> = [];
afterEach(() => {
  while (cleanup.length) cleanup.pop()!();
  vi.useRealTimers();
});

function mountPress() {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const handlers = {
    setConversationActionId: vi.fn(),
    setConversationMenuPosition: vi.fn(),
    setMessageActionId: vi.fn(),
    setMessageActionMode: vi.fn(),
    setMessageCopyTarget: vi.fn(),
  } satisfies Omit<UseMessageLongPressDeps, "activeConversationId">;
  let state!: ReturnType<typeof useMessageLongPress>;
  function Probe({ id }: { id: number }) {
    state = useMessageLongPress({ ...handlers, activeConversationId: id });
    return null;
  }
  const render = (id: number) => {
    act(() => root.render(<Probe id={id} />));
    return state;
  };
  const unmount = () => { act(() => root.unmount()); host.remove(); };
  cleanup.push(unmount);
  return { render, handlers, unmount };
}

describe("useMessageLongPress lifecycle", () => {
  it("cancels pending conversation hold on conversation switch", () => {
    vi.useFakeTimers();
    const ui = mountPress();
    const old = ui.render(4);
    act(() => old.beginConversationLongPress(4, 12, 12));
    ui.render(5);
    act(() => vi.advanceTimersByTime(600));
    expect(ui.handlers.setConversationActionId).not.toHaveBeenCalled();
    expect(ui.render(5).suppressConversationClick.current).toBeNull();
  });

  it("cancels pending message hold on unmount", () => {
    vi.useFakeTimers();
    const ui = mountPress();
    const state = ui.render(4);
    const bubble = document.createElement("div");
    bubble.className = "bubble";
    document.body.append(bubble);
    act(() => state.beginMessageLongPress({ id: 18, deleted: false } as Message, 20, 20, 0, "touch", bubble));
    ui.unmount();
    cleanup.pop();
    act(() => vi.advanceTimersByTime(600));
    expect(ui.handlers.setMessageActionId).not.toHaveBeenCalled();
    bubble.remove();
  });

  it("clears stale suppress-click markers between conversations", () => {
    vi.useFakeTimers();
    const ui = mountPress();
    const state = ui.render(4);
    act(() => state.beginConversationLongPress(4, 0, 0));
    act(() => vi.advanceTimersByTime(600));
    expect(state.suppressConversationClick.current).toBe(4);
    const next = ui.render(5);
    expect(next.suppressConversationClick.current).toBeNull();
  });
});
