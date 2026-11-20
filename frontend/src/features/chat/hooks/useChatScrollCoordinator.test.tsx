// @vitest-environment jsdom
import { act, useRef } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import type { Message } from "../types";
import type { QueuedChatMessage } from "../lib/chatOutbox";
import { useChatScrollCoordinator } from "./useChatScrollCoordinator";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const cleanups: Array<() => void> = [];
afterEach(() => { while (cleanups.length) cleanups.pop()!(); });

function mountScroll() {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  let state!: {
    container: HTMLDivElement | null;
    follow: { current: boolean };
    pendingSend: { current: number | null };
    restore: { current: { top: number; height: number } | null };
  };

  function Probe({ id, channel, messages }: { id: number; channel: number; messages: Message[] }) {
    const messagesScrollRef = useRef<HTMLDivElement>(null);
    const messageScrollAtBottom = useRef(true);
    const ownSendScrollConversation = useRef<number | null>(null);
    const pendingMessageScrollRestore = useRef<{ top: number; height: number } | null>(null);
    useChatScrollCoordinator({
      activeConversationId: id,
      selectedChannelId: channel,
      messages,
      outgoingMessage: null,
      chatOutbox: [] as QueuedChatMessage[],
      messagesScrollRef,
      messageScrollAtBottom,
      ownSendScrollConversation,
      pendingMessageScrollRestore,
    });
    state = {
      container: messagesScrollRef.current,
      follow: messageScrollAtBottom,
      pendingSend: ownSendScrollConversation,
      restore: pendingMessageScrollRestore,
    };
    return <div ref={messagesScrollRef} />;
  }
  const render = (id: number, channel: number, messages: Message[]) =>
    act(() => root.render(<Probe id={id} channel={channel} messages={messages} />));
  cleanups.push(() => { act(() => root.unmount()); host.remove(); });
  return { render, get state() { return state; }, get element() { return host.firstElementChild as HTMLDivElement; } };
}

const msg = (id: number) => ({ id }) as Message;
describe("useChatScrollCoordinator", () => {
  it("follows incoming messages only when reader is at the bottom", () => {
    const app = mountScroll();
    app.render(1, 0, []);
    const element = app.element;
    Object.defineProperty(element, "scrollHeight", { configurable: true, value: 500 });
    element.scrollTop = 150;
    app.state.follow.current = false;
    app.render(1, 0, [msg(1)]);
    expect(element.scrollTop).toBe(150);
    app.state.follow.current = true;
    app.render(1, 0, [msg(1), msg(2)]);
    expect(element.scrollTop).toBe(500);
  });

  it("restores position on paging before deciding whether to follow bottom", () => {
    const app = mountScroll();
    app.render(1, 0, []);
    const element = app.element;
    Object.defineProperty(element, "scrollHeight", { configurable: true, value: 1000 });
    element.scrollTop = 100;
    app.state.restore.current = { top: 100, height: 600 };
    app.render(1, 0, [msg(1)]);
    expect(element.scrollTop).toBe(500);
    expect(app.state.restore.current).toBeNull();
  });

  it("prioritizes a local send and ignores one pending for another conversation", () => {
    const app = mountScroll();
    app.render(1, 0, []);
    const element = app.element;
    Object.defineProperty(element, "scrollHeight", { configurable: true, value: 1000 });
    app.state.pendingSend.current = 1;
    app.state.restore.current = { top: 30, height: 500 };
    app.state.follow.current = false;
    app.render(1, 0, [msg(1)]);
    expect(element.scrollTop).toBe(1000);
    expect(app.state.restore.current).toBeNull();
    expect(app.state.follow.current).toBe(true);
    app.state.pendingSend.current = 2;
    app.state.follow.current = false;
    app.render(1, 0, [msg(1), msg(2)]);
    expect(app.state.pendingSend.current).toBeNull();
    expect(element.scrollTop).toBe(1000);
  });

  it("resets follow-bottom state when selecting a different group channel", () => {
    const app = mountScroll();
    app.render(1, 0, []);
    app.state.follow.current = false;
    app.render(1, 3, []);
    expect(app.state.follow.current).toBe(true);
  });
});
