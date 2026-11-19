// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { useChatComposerSurface } from "./useChatComposerSurface";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type Composer = ReturnType<typeof useChatComposerSurface>;
function mountComposer() {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  let state!: Composer;
  function Probe({ tab, conversationId, text }: { tab: string; conversationId: number; text: string }) {
    state = useChatComposerSurface({ tab, activeConversationId: conversationId, desktopSection: null, messageText: text });
    return <textarea ref={state.messageInputRef} />;
  }
  const render = (tab = "chat", conversationId = 4, text = "") => {
    act(() => root.render(<Probe tab={tab} conversationId={conversationId} text={text} />));
    return state;
  };
  return { host, render, close: () => { act(() => root.unmount()); host.remove(); } };
}
const mounted: Array<ReturnType<typeof mountComposer>> = [];
afterEach(() => { while (mounted.length) mounted.pop()!.close(); });

describe("useChatComposerSurface", () => {
  it("scopes drag overlay to the current conversation and resets depth", () => {
    const app = mountComposer();
    mounted.push(app);
    let state = app.render();
    act(() => {
      state.setChatDragActive(true);
      state.setChatDragDepth(2);
    });
    expect(app.render().chatDragActive).toBe(true);
    expect(state.chatDragDepth.current).toBe(2);
    state = app.render("chat", 5);
    expect(state.chatDragActive).toBe(false);
    expect(state.chatDragDepth.current).toBe(0);
    state = app.render("chat", 4);
    expect(state.chatDragActive).toBe(false);
  });

  it("resizes the composer on draft changes and retains the textarea ref", () => {
    const app = mountComposer();
    mounted.push(app);
    let state = app.render();
    const input = state.messageInputRef.current;
    expect(input?.style.height).toBe("0px");
    Object.defineProperty(input!, "scrollHeight", { configurable: true, value: 220 });
    state = app.render("chat", 4, "Updated");
    expect(state.messageInputRef.current).toBe(input);
    expect(input?.style.height).toBe("154px");
  });

  it("prevents document file drops, but allows text-only drops and cleans up", () => {
    const app = mountComposer();
    mounted.push(app);
    app.render();
    const dropped = (types: string[]) => {
      const event = new Event("drop", { bubbles: true, cancelable: true }) as DragEvent;
      Object.defineProperty(event, "dataTransfer", { value: { types } });
      document.dispatchEvent(event);
      return event.defaultPrevented;
    };
    expect(dropped(["Files"])).toBe(true);
    expect(dropped(["text/plain"])).toBe(false);
    app.close();
    mounted.pop();
    expect(dropped(["Files"])).toBe(false);
  });
});
