// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useMobileScrollChrome } from "./useMobileScrollChrome";

afterEach(() => vi.unstubAllGlobals());

function ScrollShell({ activeTab = "feed", showHeader = true }: { activeTab?: string; showHeader?: boolean }) {
  const ref = useMobileScrollChrome(activeTab);
  return (
    <main ref={ref} className="modern-shell app-layout">
      {showHeader && <header className="chatnet-appbar">Header</header>}
      <section><input aria-label="Search" /></section>
      <nav className="bottom-navigation">Navigation</nav>
    </main>
  );
}

describe("stable mobile chrome", () => {
  it.each(["feed", "chat", "contacts", "profile", "discover"])("never hides bars or shifts scrollTop on %s", (activeTab) => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    try {
      act(() => root.render(<MemoryRouter><ScrollShell activeTab={activeTab} /></MemoryRouter>));
      const shell = host.querySelector("main")!;
      const scroller = host.querySelector("section")!;
      Object.defineProperty(scroller, "scrollHeight", { value: 1200 });
      Object.defineProperty(scroller, "clientHeight", { value: 400 });
      for (const top of [0, 60, 150, 450, 800, 780, 300, 0]) {
        scroller.scrollTop = top;
        act(() => scroller.dispatchEvent(new Event("scroll")));
        expect(shell.classList.contains("mobile-chrome-hidden")).toBe(false);
        expect(scroller.scrollTop).toBe(top);
      }
      for (const event of ["touchstart", "touchmove", "wheel", "focusin"]) {
        act(() => scroller.dispatchEvent(new Event(event, { bubbles: true })));
        expect(shell.classList.contains("mobile-chrome-hidden")).toBe(false);
      }
    } finally {
      act(() => root.unmount());
      host.remove();
    }
  });

  it("measures both bars, updates on resize, handles an absent header and cleans up", () => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    let measure: () => void = () => {};
    const observe = vi.fn();
    const disconnect = vi.fn();
    vi.stubGlobal("ResizeObserver", class {
      constructor(callback: () => void) { measure = callback; }
      observe = observe;
      disconnect = disconnect;
    });
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    try {
      act(() => root.render(<MemoryRouter><ScrollShell /></MemoryRouter>));
      const shell = host.querySelector("main")!;
      const header = host.querySelector("header")!;
      const nav = host.querySelector("nav")!;
      Object.defineProperty(header, "offsetHeight", { value: 64 });
      Object.defineProperty(nav, "offsetHeight", { value: 56 });
      act(() => measure());
      expect(observe).toHaveBeenCalledWith(header);
      expect(observe).toHaveBeenCalledWith(nav);
      expect(shell.style.getPropertyValue("--mobile-header-height")).toBe("64px");
      expect(shell.style.getPropertyValue("--mobile-nav-height")).toBe("56px");
      act(() => root.render(<MemoryRouter><ScrollShell activeTab="profile" showHeader={false} /></MemoryRouter>));
      expect(shell.style.getPropertyValue("--mobile-header-height")).toBe("0px");
      expect(shell.style.getPropertyValue("--mobile-nav-height")).toBe("56px");
      expect(disconnect).toHaveBeenCalledOnce();
    } finally {
      act(() => root.unmount());
      host.remove();
    }
    expect(disconnect).toHaveBeenCalledTimes(2);
  });
});
