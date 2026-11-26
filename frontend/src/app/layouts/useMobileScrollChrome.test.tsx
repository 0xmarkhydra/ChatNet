// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useMobileScrollChrome } from "./useMobileScrollChrome";

afterEach(() => vi.unstubAllGlobals());

// Synthetic events carry a 16ms (one frame) clock so scroll speed is deterministic.
let clock = 0;
const stamped = (event: Event, advance = 16) => {
  clock += advance;
  Object.defineProperty(event, "timeStamp", { value: clock });
  return event;
};
const scrollEvent = () => stamped(new Event("scroll"));

function ScrollShell({ activeTab = "feed" }: { activeTab?: string }) {
  const ref = useMobileScrollChrome(activeTab);
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
        act(() => scroller.dispatchEvent(scrollEvent()));
      };

      scroll(0);
      scroll(60);
      scroll(98);
      expect(shell.classList.contains("mobile-chrome-hidden")).toBe(true);

      scroll(92);
      expect(shell.classList.contains("mobile-chrome-hidden")).toBe(true);
      scroll(84);
      expect(shell.classList.contains("mobile-chrome-hidden")).toBe(true);
      scroll(60); // A quick upward flick reveals the bars.
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

  it("hides bars for short Chat/Friends lists and resets between tabs", () => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: true, addEventListener() {}, removeEventListener() {} })));
    vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);

    try {
      act(() => root.render(<MemoryRouter><ScrollShell activeTab="chat" /></MemoryRouter>));
      const shell = host.querySelector("main")!;
      const scroller = host.querySelector("section")!;
      Object.defineProperty(scroller, "scrollHeight", { value: 480 });
      Object.defineProperty(scroller, "clientHeight", { value: 400 });
      const scroll = (top: number) => {
        scroller.scrollTop = top;
        act(() => scroller.dispatchEvent(scrollEvent()));
      };

      // A short list may have only 80px of available scroll range.
      scroll(0);
      scroll(24);
      scroll(47);
      expect(shell.classList.contains("mobile-chrome-hidden")).toBe(true);

      // Switching tabs must not inherit the previous screen's hidden bar.
      act(() => root.render(<MemoryRouter><ScrollShell activeTab="contacts" /></MemoryRouter>));
      expect(shell.classList.contains("mobile-chrome-hidden")).toBe(false);
      scroll(0);
      scroll(25);
      scroll(50);
      expect(shell.classList.contains("mobile-chrome-hidden")).toBe(true);
      scroll(41);
      expect(shell.classList.contains("mobile-chrome-hidden")).toBe(true);
      scroll(27);
      expect(shell.classList.contains("mobile-chrome-hidden")).toBe(false);
    } finally {
      act(() => root.unmount());
      host.remove();
    }
  });

  it("keeps header and footer hidden at the bottom until the user scrolls upward", () => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: true, addEventListener() {}, removeEventListener() {} })));
    vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);

    try {
      act(() => root.render(<MemoryRouter><ScrollShell activeTab="contacts" /></MemoryRouter>));
      const shell = host.querySelector("main")!;
      const scroller = host.querySelector("section")!;
      const header = host.querySelector("header")!;
      const footer = host.querySelector("nav")!;
      let contentHeight = 1200;
      Object.defineProperty(scroller, "scrollHeight", { get: () => contentHeight });
      Object.defineProperty(scroller, "clientHeight", { value: 400 });
      const scroll = (top: number) => {
        scroller.scrollTop = top;
        act(() => scroller.dispatchEvent(scrollEvent()));
      };

      scroll(0);
      scroll(250); // A single event >150px from a fast flick.
      expect(shell.classList.contains("mobile-chrome-hidden")).toBe(true);
      scroll(800); // Reaching the bottom alone must not reveal the chrome.
      expect(shell.classList.contains("mobile-chrome-hidden")).toBe(true);
      expect(header.isConnected && footer.isConnected).toBe(true);
      // Momentum and minor oscillation near the bottom must not blink.
      scroll(792);
      scroll(798);
      scroll(790);
      expect(shell.classList.contains("mobile-chrome-hidden")).toBe(true);
      scroll(760); // A deliberate upward swipe shows both bars.
      expect(shell.classList.contains("mobile-chrome-hidden")).toBe(false);

      scroll(200);
      scroll(260);
      expect(shell.classList.contains("mobile-chrome-hidden")).toBe(true);
      contentHeight = 400; // Filtering leaves a non-scrollable screen.
      scroll(0);
      expect(shell.classList.contains("mobile-chrome-hidden")).toBe(false);
      scroll(0);
      expect(shell.classList.contains("mobile-chrome-hidden")).toBe(false);
    } finally {
      act(() => root.unmount());
      host.remove();
    }
  });

  it("ignores a scroll-range correction caused by collapsing bars", () => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: true, addEventListener() {}, removeEventListener() {} })));
    vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    try {
      act(() => root.render(<MemoryRouter><ScrollShell activeTab="chat" /></MemoryRouter>));
      const shell = host.querySelector("main")!;
      const scroller = host.querySelector("section")!;
      let height = 1200;
      Object.defineProperty(scroller, "scrollHeight", { get: () => height });
      Object.defineProperty(scroller, "clientHeight", { value: 400 });
      const scroll = (top: number) => {
        scroller.scrollTop = top;
        act(() => scroller.dispatchEvent(scrollEvent()));
      };
      scroll(0);
      scroll(240);
      expect(shell.classList.contains("mobile-chrome-hidden")).toBe(true);

      // The viewport grows by the collapsed header/footer height.
      // The synthetic correction must not look like a user reached the bottom.
      height = 1400;
      scroll(995);
      expect(shell.classList.contains("mobile-chrome-hidden")).toBe(true);
      scroll(985);
      expect(shell.classList.contains("mobile-chrome-hidden")).toBe(true);
      scroll(960);
      expect(shell.classList.contains("mobile-chrome-hidden")).toBe(false);
    } finally {
      act(() => root.unmount());
      host.remove();
    }
  });

  it("restores the footer on an upward swipe even if the list is already at its boundary", () => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: true, addEventListener() {}, removeEventListener() {} })));
    vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    try {
      act(() => root.render(<MemoryRouter><ScrollShell activeTab="contacts" /></MemoryRouter>));
      const shell = host.querySelector("main")!;
      const scroller = host.querySelector("section")!;
      Object.defineProperty(scroller, "scrollHeight", { value: 490 });
      Object.defineProperty(scroller, "clientHeight", { value: 400 });
      scroller.scrollTop = 0;
      act(() => scroller.dispatchEvent(scrollEvent()));
      scroller.scrollTop = 56;
      act(() => scroller.dispatchEvent(scrollEvent()));
      expect(shell.classList.contains("mobile-chrome-hidden")).toBe(true);

      const touch = (type: string, x: number, y: number) => {
        const e = stamped(new Event(type, { bubbles: true }));
        Object.defineProperty(e, "touches", { value: [{ clientX: x, clientY: y }] });
        act(() => scroller.dispatchEvent(e));
      };
      touch("touchstart", 100, 200);
      touch("touchmove", 100, 219);
      expect(shell.classList.contains("mobile-chrome-hidden")).toBe(false);

      scroller.scrollTop = 90;
      act(() => scroller.dispatchEvent(scrollEvent()));
      expect(shell.classList.contains("mobile-chrome-hidden")).toBe(true);
      act(() => scroller.dispatchEvent(new WheelEvent("wheel", { bubbles: true, deltaY: -16 })));
      expect(shell.classList.contains("mobile-chrome-hidden")).toBe(false);
    } finally {
      act(() => root.unmount());
      host.remove();
    }
  });

  it("does not reveal Chat chrome from bottom bounce or non-scrollable nested regions", () => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: true, addEventListener() {}, removeEventListener() {} })));
    vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    try {
      act(() => root.render(<MemoryRouter><ScrollShell activeTab="chat" /></MemoryRouter>));
      const shell = host.querySelector("main")!;
      const scroller = host.querySelector("section")!;
      const nested = document.createElement("div");
      scroller.append(nested);
      Object.defineProperty(scroller, "scrollHeight", { value: 1200 });
      Object.defineProperty(scroller, "clientHeight", { value: 400 });
      Object.defineProperty(nested, "scrollHeight", { value: 100 });
      Object.defineProperty(nested, "clientHeight", { value: 100 });
      const scroll = (node: HTMLElement, top: number) => {
        node.scrollTop = top;
        act(() => node.dispatchEvent(scrollEvent()));
      };

      scroll(scroller, 0);
      scroll(scroller, 240);
      expect(shell.classList.contains("mobile-chrome-hidden")).toBe(true);
      scroll(scroller, 800);
      expect(shell.classList.contains("mobile-chrome-hidden")).toBe(true);
      scroll(nested, 0);
      expect(shell.classList.contains("mobile-chrome-hidden")).toBe(true);
      scroll(scroller, 794); // Elastic bounce is not a real upward gesture.
      expect(shell.classList.contains("mobile-chrome-hidden")).toBe(true);
      scroll(scroller, 788);
      expect(shell.classList.contains("mobile-chrome-hidden")).toBe(true);
      scroll(scroller, 765); // A meaningful upward scroll does restore chrome.
      expect(shell.classList.contains("mobile-chrome-hidden")).toBe(false);
    } finally {
      act(() => root.unmount());
      host.remove();
    }
  });

  it("does not reveal Chat bars during rubber-band recovery after a downward touch flick", () => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: true, addEventListener() {}, removeEventListener() {} })));
    vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    try {
      act(() => root.render(<MemoryRouter><ScrollShell activeTab="chat" /></MemoryRouter>));
      const shell = host.querySelector("main")!;
      const scroller = host.querySelector("section")!;
      Object.defineProperty(scroller, "scrollHeight", { value: 1200 });
      Object.defineProperty(scroller, "clientHeight", { value: 400 });
      const scroll = (top: number) => {
        scroller.scrollTop = top;
        act(() => scroller.dispatchEvent(scrollEvent()));
      };
      const touch = (type: string, x: number, y: number) => {
        const e = stamped(new Event(type, { bubbles: true }));
        Object.defineProperty(e, "touches", { value: [{ clientX: x, clientY: y }] });
        act(() => scroller.dispatchEvent(e));
      };

      scroll(0);
      touch("touchstart", 100, 230);
      touch("touchmove", 100, 130); // Finger up: scrolling downward.
      scroll(240);
      scroll(800);
      expect(shell.classList.contains("mobile-chrome-hidden")).toBe(true);
      scroll(755); // Safari bounces upward even without a user reversal.
      scroll(710);
      expect(shell.classList.contains("mobile-chrome-hidden")).toBe(true);

      touch("touchstart", 100, 140);
      touch("touchmove", 100, 164); // New deliberate upward-scroll gesture.
      expect(shell.classList.contains("mobile-chrome-hidden")).toBe(false);
    } finally {
      act(() => root.unmount());
      host.remove();
    }
  });

  it("does not reveal Feed chrome from scroll events of non-scrollable nested regions", () => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: true, addEventListener() {}, removeEventListener() {} })));
    vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    try {
      act(() => root.render(<MemoryRouter><ScrollShell activeTab="feed" /></MemoryRouter>));
      const shell = host.querySelector("main")!;
      const scroller = host.querySelector("section")!;
      const nested = document.createElement("div");
      scroller.append(nested);
      Object.defineProperty(scroller, "scrollHeight", { value: 1200 });
      Object.defineProperty(scroller, "clientHeight", { value: 400 });
      Object.defineProperty(nested, "scrollHeight", { value: 100 });
      Object.defineProperty(nested, "clientHeight", { value: 100 });
      const scroll = (node: HTMLElement, top: number) => {
        node.scrollTop = top;
        act(() => node.dispatchEvent(scrollEvent()));
      };

      scroll(scroller, 0);
      scroll(scroller, 250);
      scroll(scroller, 800);
      expect(shell.classList.contains("mobile-chrome-hidden")).toBe(true);
      scroll(nested, 0);
      scroll(nested, 0);
      expect(shell.classList.contains("mobile-chrome-hidden")).toBe(true);
      scroll(scroller, 760); // A deliberate upward scroll still restores the chrome.
      expect(shell.classList.contains("mobile-chrome-hidden")).toBe(false);
    } finally {
      act(() => root.unmount());
      host.remove();
    }
  });

  it("keeps bars hidden on slow upward scrolling and reveals them on a quick flick or touch swipe", () => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: true, addEventListener() {}, removeEventListener() {} })));
    vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    try {
      act(() => root.render(<MemoryRouter><ScrollShell activeTab="feed" /></MemoryRouter>));
      const shell = host.querySelector("main")!;
      const scroller = host.querySelector("section")!;
      Object.defineProperty(scroller, "scrollHeight", { value: 3000 });
      Object.defineProperty(scroller, "clientHeight", { value: 400 });
      const hidden = () => shell.classList.contains("mobile-chrome-hidden");
      const scroll = (top: number, advance = 16) => {
        scroller.scrollTop = top;
        act(() => scroller.dispatchEvent(stamped(new Event("scroll"), advance)));
      };
      const touch = (type: string, y: number, advance = 16) => {
        const e = stamped(new Event(type, { bubbles: true }), advance);
        Object.defineProperty(e, "touches", { value: [{ clientX: 100, clientY: y }] });
        act(() => scroller.dispatchEvent(e));
      };

      scroll(0);
      scroll(300);
      expect(hidden()).toBe(true);
      for (let top = 292; top >= 100; top -= 8) scroll(top); // 0.5px/ms: reading back up.
      expect(hidden()).toBe(true);
      scroll(70); // 30px in one frame is a quick flick.
      expect(hidden()).toBe(false);

      scroll(300);
      scroll(500);
      expect(hidden()).toBe(true);
      touch("touchstart", 200);
      touch("touchmove", 215, 80); // Slow pull: 0.19px/ms.
      touch("touchmove", 230, 80);
      expect(hidden()).toBe(true);
      touch("touchstart", 200);
      touch("touchmove", 225); // Quick swipe: 1.6px/ms.
      expect(hidden()).toBe(false);

      scroll(500);
      scroll(600);
      expect(hidden()).toBe(true);
      scroll(1, 16); // Reaching the very top always restores the bars.
      expect(hidden()).toBe(false);
    } finally {
      act(() => root.unmount());
      host.remove();
    }
  });

  it("does not collapse the header when scrolling reaches the end of the list", () => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: true, addEventListener() {}, removeEventListener() {} })));
    vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    try {
      act(() => root.render(<MemoryRouter><ScrollShell activeTab="feed" /></MemoryRouter>));
      const shell = host.querySelector("main")!;
      const scroller = host.querySelector("section")!;
      Object.defineProperty(host.querySelector("header")!, "offsetHeight", { value: 68 });
      Object.defineProperty(scroller, "scrollHeight", { value: 1307 });
      Object.defineProperty(scroller, "clientHeight", { value: 888 });
      const scroll = (top: number) => {
        scroller.scrollTop = top;
        act(() => scroller.dispatchEvent(scrollEvent()));
      };

scroll(0);      scroll(419); // Collapsing at the very end would clamp scrollTop and make the feed slide.      scroll(419);      expect(shell.classList.contains("mobile-chrome-hidden")).toBe(false);      scroll(0);      scroll(150);      scroll(300); // 119px from the end: the header may still collapse mid-list.      expect(shell.classList.contains("mobile-chrome-hidden")).toBe(true);
    } finally {
      act(() => root.unmount());
      host.remove();
    }
  });

  it("shifts scrollTop by the header height so content stays still when the bars collapse and return", () => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: true, addEventListener() {}, removeEventListener() {} })));
    vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    try {
      act(() => root.render(<MemoryRouter><ScrollShell activeTab="feed" /></MemoryRouter>));
      const shell = host.querySelector("main")!;
      const scroller = host.querySelector("section")!;
      Object.defineProperty(host.querySelector("header")!, "offsetHeight", { value: 68 });
      Object.defineProperty(scroller, "scrollHeight", { value: 3000 });
      Object.defineProperty(scroller, "clientHeight", { value: 800 });
      const scroll = (top: number) => {
        scroller.scrollTop = top;
        act(() => scroller.dispatchEvent(scrollEvent()));
      };

      scroll(0);
      scroll(100);
      expect(shell.classList.contains("mobile-chrome-hidden")).toBe(true);
      expect(scroller.scrollTop).toBe(32);

      // A finger drag keeps firing small events while hidden: none of them may be pulled back.
      for (const top of [72, 112, 200, 240, 280]) {
        scroll(top);
        expect(scroller.scrollTop).toBe(top);
      }
      scroll(100); // Quick flick up reveals the bars again.
      expect(shell.classList.contains("mobile-chrome-hidden")).toBe(false);
      expect(scroller.scrollTop).toBe(168);

      scroll(300);
      expect(shell.classList.contains("mobile-chrome-hidden")).toBe(true);
      scroll(0); // At the very top the returning header must not cover the first rows.
      expect(shell.classList.contains("mobile-chrome-hidden")).toBe(false);
      expect(scroller.scrollTop).toBe(0);
    } finally {
      act(() => root.unmount());
      host.remove();
    }
  });

  it("waits until the list has scrolled past the header height before collapsing", () => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: true, addEventListener() {}, removeEventListener() {} })));
    vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    try {
      act(() => root.render(<MemoryRouter><ScrollShell activeTab="feed" /></MemoryRouter>));
      const shell = host.querySelector("main")!;
      const scroller = host.querySelector("section")!;
      Object.defineProperty(host.querySelector("header")!, "offsetHeight", { value: 68 });
      Object.defineProperty(scroller, "scrollHeight", { value: 1000 });
      Object.defineProperty(scroller, "clientHeight", { value: 800 });
      const scroll = (top: number) => {
        scroller.scrollTop = top;
        act(() => scroller.dispatchEvent(scrollEvent()));
      };

      scroll(0);
      scroll(65);
      expect(shell.classList.contains("mobile-chrome-hidden")).toBe(false);
      expect(scroller.scrollTop).toBe(65);
      scroll(100);
      expect(shell.classList.contains("mobile-chrome-hidden")).toBe(true);
      expect(scroller.scrollTop).toBe(32);
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
      act(() => scroller.dispatchEvent(scrollEvent()));
      scroller.scrollTop = 260;
      act(() => scroller.dispatchEvent(scrollEvent()));
      expect(host.querySelector("main")!.classList.contains("mobile-chrome-hidden")).toBe(false);
    } finally {
      act(() => root.unmount());
      host.remove();
    }
  });
});
