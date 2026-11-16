// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useAppInstallState } from "./useAppInstallState";

const originalMatchMedia = window.matchMedia;
const previousAct = (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;

afterEach(() => {
  Object.defineProperty(window, "matchMedia", {
    configurable: true, writable: true, value: originalMatchMedia,
  });
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = previousAct;
  vi.restoreAllMocks();
});

describe("useAppInstallState", () => {
  it("tracks display-mode transitions and tears down the listener", () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    let matches = false;
    const listeners = new Set<() => void>();
    const addEventListener = vi.fn((_type: string, callback: () => void) => listeners.add(callback));
    const removeEventListener = vi.fn((_type: string, callback: () => void) => listeners.delete(callback));
    Object.defineProperty(window, "matchMedia", {
      configurable: true, writable: true,
      value: vi.fn(() => ({ get matches() { return matches; }, addEventListener, removeEventListener })),
    });
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    function Probe() {
      const installed = useAppInstallState(() => undefined);
      return <output>{installed ? "standalone" : "browser"}</output>;
    }

    try {
      act(() => root.render(<Probe />));
      expect(host.textContent).toBe("browser");
      expect(listeners.size).toBe(1);
      act(() => {
        matches = true;
        listeners.forEach((notify) => notify());
      });
      expect(host.textContent).toBe("standalone");
      act(() => {
        matches = false;
        listeners.forEach((notify) => notify());
      });
      expect(host.textContent).toBe("browser");
    } finally {
      act(() => root.unmount());
      host.remove();
    }
    expect(listeners.size).toBe(0);
    expect(removeEventListener).toHaveBeenCalledTimes(1);
  });

  it("uses the latest installation callback and ignores events after unmount", () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const listeners = new Set<() => void>();
    Object.defineProperty(window, "matchMedia", {
      configurable: true, writable: true,
      value: vi.fn(() => ({
        matches: false,
        addEventListener: (_type: string, callback: () => void) => listeners.add(callback),
        removeEventListener: (_type: string, callback: () => void) => listeners.delete(callback),
      })),
    });
    const oldHandler = vi.fn();
    const newHandler = vi.fn();
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    function Probe({ handler }: { handler: () => void }) {
      const installed = useAppInstallState(handler);
      return <output>{installed ? "standalone" : "browser"}</output>;
    }
    try {
      act(() => root.render(<Probe handler={oldHandler} />));
      act(() => root.render(<Probe handler={newHandler} />));
      act(() => window.dispatchEvent(new Event("appinstalled")));
      expect(host.textContent).toBe("standalone");
      expect(oldHandler).not.toHaveBeenCalled();
      expect(newHandler).toHaveBeenCalledTimes(1);
    } finally {
      act(() => root.unmount());
      host.remove();
    }
    window.dispatchEvent(new Event("appinstalled"));
    expect(newHandler).toHaveBeenCalledTimes(1);
    expect(listeners.size).toBe(0);
  });
});
