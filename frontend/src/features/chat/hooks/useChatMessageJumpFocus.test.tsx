// @vitest-environment jsdom
import { act, useRef } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useChatMessageJumpFocus, type ChatMessageJump } from "./useChatMessageJumpFocus";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const mounted: Array<() => void> = [];
let nextFrame = 0;
let pending = new Map<number, FrameRequestCallback>();
let scrollIntoView: ReturnType<typeof vi.fn>;

beforeEach(() => {
  nextFrame = 0;
  pending = new Map();
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    const id = ++nextFrame;
    pending.set(id, callback);
    return id;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => { pending.delete(id); });
  vi.stubGlobal("matchMedia", () => ({ matches: false }));
  scrollIntoView = vi.fn();
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    configurable: true, value: scrollIntoView,
  });
});
afterEach(() => {
  while (mounted.length) mounted.pop()!();
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function flushFrames() {
  const tasks = Array.from(pending.values());
  pending.clear();
  act(() => { tasks.forEach(callback => callback(0)); });
}

function mountJump() {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  let lastScrolled = 0;

  function Probe({ jump, conversationId, messages }: {
    jump: ChatMessageJump | null;
    conversationId: number | null;
    messages: readonly { id: number }[];
  }) {
    const lastScrolledRevision = useRef(0);
    useChatMessageJumpFocus({
      jump, activeConversationId: conversationId, messages, lastScrolledRevision,
    });
    lastScrolled = lastScrolledRevision.current;
    return null;
  }

  const render = (jump: ChatMessageJump | null, conversationId: number | null, ids: number[]) => {
    act(() => root.render(<Probe jump={jump} conversationId={conversationId}
      messages={ids.map(id => ({ id }))} />));
  };
  mounted.push(() => { act(() => root.unmount()); host.remove(); });
  return { render, get revision() { return lastScrolled; } };
}

describe("useChatMessageJumpFocus", () => {
  it("waits for the target message to load before focusing and highlights only once", () => {
    const target = document.createElement("div");
    target.dataset.messageId = "42";
    document.body.append(target);
    const app = mountJump();
    const jump = { conversationId: 7, messageId: 42, revision: 1 };
    app.render(jump, 7, []);
    expect(pending.size).toBe(0);
    app.render(jump, 7, [42]);
    expect(pending.size).toBe(1);
    flushFrames();
    expect(scrollIntoView).toHaveBeenCalledWith({ block: "center", behavior: "smooth" });
    app.render(jump, 7, [42]);
    expect(pending.size).toBe(0);
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
  });

  it("cancels a pending frame when switching conversations", () => {
    const target = document.createElement("div");
    target.dataset.messageId = "42";
    document.body.append(target);
    const app = mountJump();
    app.render({ conversationId: 7, messageId: 42, revision: 1 }, 7, [42]);
    expect(pending.size).toBe(1);
    app.render({ conversationId: 7, messageId: 42, revision: 1 }, 8, [42]);
    expect(pending.size).toBe(0);
    flushFrames();
    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it("retries when the target enters the DOM after the first frame", () => {
    const app = mountJump();
    const jump = { conversationId: 7, messageId: 42, revision: 1 };
    app.render(jump, 7, [42]);
    flushFrames();
    expect(scrollIntoView).not.toHaveBeenCalled();
    const target = document.createElement("div");
    target.dataset.messageId = "42";
    document.body.append(target);
    app.render({ ...jump }, 7, [42]);
    flushFrames();
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
  });
});
