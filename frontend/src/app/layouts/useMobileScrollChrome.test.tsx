// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useMobileScrollChrome } from "./useMobileScrollChrome";

afterEach(() => vi.unstubAllGlobals());

function ScrollShell() {
  const ref = useMobileScrollChrome();
  return (
    <main ref={ref} className="modern-shell app-layout">
      <header className="chatnet-appbar">Header</header>
      <section data-testid="scroller"><input aria-label="Search" /></section>
      <nav className="bottom-navigation">Navigation</nav>
    </main>
  );
}

describe("mobile chrome scrolling", () => {
  it("hides both bars on downward scrolling and reveals them upward, at the top or on input focus", () => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    const media = { matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() };
    vi.stubGlobal("matchMedia", vi.fn(() => media));
    vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);

    try {
      act(() => root.render(<MemoryRouter><ScrollShell /></MemoryRouter>));
      const shell = host.querySelector("main")!;
      const scroller = host.querySelector("section")!;
      Object.defineProperty(scroller, "scrollHeight", { value: 1200 });
      Object.defineProperty(scroller, "clientHeight", { value: 400 });
      const scroll = (top: number) => {
        scroller.scrollTop = top;
        act(() => scroller.dispatchEvent(new Event("scroll")));
      };

      scroll(0);
      scroll(60);
      scroll(98);
      expect(shell.classList.contains("mobile-chrome-hidden")).toBe(true);

      scroll(92);
      expect(shell.classList.contains("mobile-chrome-hidden")).toBe(true);
      scroll(79);
      expect(shell.classList.contains("mobile-chrome-hidden")).toBe(false);

      scroll(140);
      scroll(164);
      expect(shell.classList.contains("mobile-chrome-hidden")).toBe(true);
      act(() => host.querySelector("input")!.dispatchEvent(new Event("focusin", { bubbles: true })));
      expect(shell.classList.contains("mobile-chrome-hidden")).toBe(false);

      scroll(170);
      scroll(195);
      expect(shell.classList.contains("mobile-chrome-hidden")).toBe(true);
      scroll(0);
      expect(shell.classList.contains("mobile-chrome-hidden")).toBe(false);
    } finally {
      act(() => root.unmount());
      host.remove();
    }
  });

  it("does not hide the bars at desktop widths", () => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false, addEventListener() {}, removeEventListener() {} })));
    vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);

    try {
      act(() => root.render(<MemoryRouter><ScrollShell /></MemoryRouter>));
      const scroller = host.querySelector("section")!;
      Object.defineProperty(scroller, "scrollHeight", { value: 1200 });
      Object.defineProperty(scroller, "clientHeight", { value: 400 });
      scroller.scrollTop = 120;
      act(() => scroller.dispatchEvent(new Event("scroll")));
      scroller.scrollTop = 260;
      act(() => scroller.dispatchEvent(new Event("scroll")));
      expect(host.querySelector("main")!.classList.contains("mobile-chrome-hidden")).toBe(false);
    } finally {
      act(() => root.unmount());
      host.remove();
    }
  });
});
