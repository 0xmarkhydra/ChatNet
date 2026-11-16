// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { usePhoneSearchLayout } from "./usePhoneSearchLayout";

const originalMatchMedia = window.matchMedia;
vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);

afterEach(() => {
  Object.defineProperty(window, "matchMedia", { configurable: true, writable: true, value: originalMatchMedia });
});

describe("usePhoneSearchLayout", () => {
  it("tracks media-query changes and unsubscribes on unmount", () => {
    let matches = false;
    const listeners = new Set<() => void>();
    const addEventListener = vi.fn((_event: string, callback: () => void) => listeners.add(callback));
    const removeEventListener = vi.fn((_event: string, callback: () => void) => listeners.delete(callback));
    const matchMedia = vi.fn(() => ({
      matches,
      addEventListener,
      removeEventListener,
    }));
    Object.defineProperty(window, "matchMedia", { configurable: true, writable: true, value: matchMedia });

    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    function Probe() {
      const phone = usePhoneSearchLayout();
      return <output>{phone ? "phone" : "desktop"}</output>;
    }

    try {
      act(() => root.render(<Probe />));
      expect(host.textContent).toBe("desktop");
      expect(listeners.size).toBe(1);
      expect(matchMedia).toHaveBeenCalledWith("(max-width: 760px)");

      act(() => {
        matches = true;
        listeners.forEach((listener) => listener());
      });
      expect(host.textContent).toBe("phone");

      act(() => {
        matches = false;
        listeners.forEach((listener) => listener());
      });
      expect(host.textContent).toBe("desktop");
    } finally {
      act(() => root.unmount());
      host.remove();
    }
    expect(listeners.size).toBe(0);
    expect(removeEventListener).toHaveBeenCalledTimes(1);
  });
});
