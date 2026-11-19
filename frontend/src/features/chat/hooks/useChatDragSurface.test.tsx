// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { useChatDragSurface } from "./useChatDragSurface";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type DragSurface = ReturnType<typeof useChatDragSurface>;
const mounted: Array<() => void> = [];

function mountDragSurface() {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  let state!: DragSurface;

  function Probe({ conversationId }: { conversationId: number | null }) {
    state = useChatDragSurface(conversationId);
    return <input type="file" ref={state.chatFileInputRef} />;
  }

  const render = (conversationId: number | null) => {
    act(() => root.render(<Probe conversationId={conversationId} />));
    return state;
  };
  mounted.push(() => {
    act(() => root.unmount());
    host.remove();
  });
  return { render };
}

afterEach(() => { while (mounted.length) mounted.pop()!(); });

describe("useChatDragSurface", () => {
  it("owns its file input and resets drag state when selecting another conversation", () => {
    const app = mountDragSurface();
    let state = app.render(4);
    const input = state.chatFileInputRef.current;
    expect(input).toBeInstanceOf(HTMLInputElement);
    act(() => {
      state.setChatDragActive(true);
      state.setChatDragDepth(2);
    });
    expect(app.render(4).chatDragActive).toBe(true);
    expect(state.chatDragDepth.current).toBe(2);

    state = app.render(5);
    expect(state.chatDragActive).toBe(false);
    expect(state.chatDragDepth.current).toBe(0);
    expect(state.chatFileInputRef.current).toBe(input);

    state = app.render(4);
    expect(state.chatDragActive).toBe(false);
  });

  it("discards a delayed drag update from an earlier conversation visit", () => {
    const app = mountDragSurface();
    const old = app.render(4);
    app.render(5);
    app.render(4);
    act(() => old.setChatDragActive(true));
    expect(app.render(4).chatDragActive).toBe(false);
  });

  it("starts fresh when the Chat section remounts", () => {
    const first = mountDragSurface();
    const state = first.render(8);
    act(() => state.setChatDragActive(true));
    expect(first.render(8).chatDragActive).toBe(true);
    const second = mountDragSurface();
    expect(second.render(8).chatDragActive).toBe(false);
  });
});
