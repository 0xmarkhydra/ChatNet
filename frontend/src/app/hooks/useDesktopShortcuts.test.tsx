// @vitest-environment jsdom
import { act, type RefObject } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useDesktopShortcuts } from "./useDesktopShortcuts";

vi.mock("../../platform/desktop", () => ({ isDesktopBuild: true }));

const previousAct = (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
afterEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = previousAct;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("desktop shortcuts", () => {
  it("uses current navigation callbacks and cancels pending focus on cleanup", () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const firstNavigate = vi.fn();
    const latestNavigate = vi.fn();
    const frames = new Map<number, FrameRequestCallback>();
    const raf = vi.fn((callback: FrameRequestCallback) => {
      frames.set(1, callback);
      return 1;
    });
    const cancel = vi.fn((id: number) => frames.delete(id));
    vi.stubGlobal("requestAnimationFrame", raf);
    vi.stubGlobal("cancelAnimationFrame", cancel);
    const sessionRef = { current: {} } as RefObject<unknown>;
    const messageInputRef = { current: null } as RefObject<HTMLTextAreaElement | null>;
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    const Probe = ({ onOpenChat }: { onOpenChat: () => void }) => {
      useDesktopShortcuts({ sessionRef, messageInputRef, onOpenChat });
      return null;
    };
    try {
      act(() => root.render(<Probe onOpenChat={firstNavigate} />));
      act(() => root.render(<Probe onOpenChat={latestNavigate} />));
      act(() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true, cancelable: true })));
      expect(firstNavigate).not.toHaveBeenCalled();
      expect(latestNavigate).toHaveBeenCalledOnce();
      expect(raf).toHaveBeenCalledOnce();
    } finally {
      act(() => root.unmount());
      host.remove();
    }
    expect(cancel).toHaveBeenCalledWith(1);
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true }));
    expect(latestNavigate).toHaveBeenCalledOnce();
  });

  it("ignores shortcuts without a session or while a modal is active", () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const onOpenChat = vi.fn();
    const sessionRef = { current: null } as RefObject<unknown | null>;
    const messageInputRef = { current: null } as RefObject<HTMLTextAreaElement | null>;
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    try {
      act(() => root.render(<Probe sessionRef={sessionRef} messageInputRef={messageInputRef} onOpenChat={onOpenChat} />));
      act(() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true })));
      expect(onOpenChat).not.toHaveBeenCalled();
      sessionRef.current = {};
      const dialog = document.createElement("div");
      dialog.setAttribute("role", "dialog");
      dialog.setAttribute("aria-modal", "true");
      document.body.append(dialog);
      try {
        act(() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true })));
        expect(onOpenChat).not.toHaveBeenCalled();
      } finally { dialog.remove(); }
    } finally {
      act(() => root.unmount());
      host.remove();
    }
  });
});

function Probe(props: {
  sessionRef: RefObject<unknown | null>;
  messageInputRef: RefObject<HTMLTextAreaElement | null>;
  onOpenChat: () => void;
}) {
  useDesktopShortcuts(props);
  return null;
}
