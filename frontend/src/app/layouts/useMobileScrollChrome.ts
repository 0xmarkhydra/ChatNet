import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

/** Upward scrolling slower than this (px/ms) keeps the bars hidden; only a quick flick reveals them. */
const REVEAL_SPEED = 0.8;

/** Keep mobile chrome stable while independently scrolling Chat, Contacts, Feed and Profile. */
export function useMobileScrollChrome(activeTab?: string) {
  const shellRef = useRef<HTMLElement>(null);
  const { pathname } = useLocation();

  useEffect(() => {
    const shell = shellRef.current;
    if (!shell) return;

    const media = window.matchMedia("(max-width: 760px)");
    const header = shell.querySelector<HTMLElement>(":scope > .chatnet-appbar");
    const navigation = shell.querySelector<HTMLElement>(":scope > .bottom-navigation");
    const previous = new WeakMap<HTMLElement, { top: number; range: number }>();
    let directionDistance = 0;
    let lastDirection = 0;
    let lastScroller: HTMLElement | null = null;
    let hidden = false;
    let lastScrollTime = 0;
    let touchStart: { x: number; y: number } | null = null;
    let touchLast = { y: 0, t: 0 };
    let chatTouchDirection: "down" | "up" | null = null;

    const setHidden = (next: boolean) => {
      if (hidden === next) return;
      hidden = next;
      shell.classList.toggle("mobile-chrome-hidden", hidden);
    };
    const resetMomentum = () => {
      directionDistance = 0;
      lastDirection = 0;
    };
    const reveal = () => {
      setHidden(false);
      resetMomentum();
    };
    const measure = () => {
      shell.style.setProperty("--mobile-header-height", `${header?.offsetHeight ?? 0}px`);
      shell.style.setProperty("--mobile-nav-height", `${navigation?.offsetHeight ?? 0}px`);
    };

    const observer = new ResizeObserver(measure);
    if (header) observer.observe(header);
    if (navigation) observer.observe(navigation);
    measure();

    const onScroll = (event: Event) => {
      if (!media.matches) return;
      const target = event.target;
      if (!(target instanceof HTMLElement) || !shell.contains(target)) return;
      if (target.closest('[role="dialog"], [role="menu"], .app-notifications-overlay')) return;
      if (header?.querySelector(".mobile-search-expanded")) {
        reveal();
        return;
      }

      const range = Math.max(0, target.scrollHeight - target.clientHeight);
      const top = Math.max(0, Math.min(target.scrollTop, range));
      const old = previous.get(target);
      previous.set(target, { top, range });
      const elapsed = event.timeStamp - lastScrollTime;
      lastScrollTime = event.timeStamp;

      // When header/footer collapse, available scroll space changes instantly.
      // Ignore the browser's resulting scroll correction BEFORE edge detection,
      // otherwise it can reveal and re-hide both bars repeatedly.
      if (range <= 2) {
        // Chat contains nested scroll regions (including non-scrollable menus).
        // Such events must not resurrect the bars when the list is at its end (Chat, Feed).
        if ((activeTab !== "chat" && activeTab !== "feed") || !hidden) reveal();
        return;
      }
      if (old && Math.abs(old.range - range) > 2) {
        resetMomentum();
        return;
      }

      // Safari's rubber-band bounce at the bottom produces a small *negative*
      // scroll delta after a downward fling. Do not treat that as an upward
      // user gesture on Chat; a genuine upward swipe still reveals the bars.
      if (activeTab === "chat" && hidden && old &&
          top >= range - 12 && old.top >= old.range - 12) {
        resetMomentum();
        return;
      }

      // Reaching the end must NOT reveal the bars. A deliberate upward
      // gesture is required; on an empty/non-scrollable page we revealed above.
      if (lastScroller !== target) {
        lastScroller = target;
        resetMomentum();
      }

      const delta = top - (old?.top ?? 0);
      if (Math.abs(delta) < 1) return;
      // Preserve the direction of fast flicks but avoid excessive momentum from one event.
      const direction = Math.sign(delta);
      // A downward finger flick can produce upward *scroll events* during
      // rubber-band recovery. Only a new upward gesture may reveal Chat chrome.
      if (activeTab === "chat" && hidden && direction < 0 && chatTouchDirection === "down") {
        resetMomentum();
        return;
      }
      const speed = Math.abs(delta) / Math.max(elapsed, 8);
      directionDistance = lastDirection === direction
        ? directionDistance + Math.min(Math.abs(delta), 60)
        : Math.min(Math.abs(delta), 60);
      lastDirection = direction;

      const hideAfter = Math.min(90, Math.max(20, range * 0.3));
      // Collapsing the header grows the scrollport; at the very end that clamps
      // scrollTop every frame of the transition and makes the content slide.
      const headerHeight = header?.offsetHeight ?? 0;
      const nearEnd = activeTab !== "chat" && headerHeight > 0 && range - top <= headerHeight;
      if (direction > 0 && top > hideAfter && directionDistance >= 20 && !nearEnd) {
        setHidden(true);
        resetMomentum();
      } else if (direction < 0 && (top <= 1 || speed >= REVEAL_SPEED)) {
        reveal();
      }
    };

    // The bottom of a short list may not produce a scroll event. Recognize
    // a real upward-scroll gesture (finger moving down) even at the boundary.
    const onTouchStart = (event: TouchEvent) => {
      const target = event.target;
      const point = event.touches[0];
      chatTouchDirection = null;
      touchStart = media.matches && target instanceof HTMLElement && shell.contains(target)
        && !target.closest('[role="dialog"], [role="menu"], .app-notifications-overlay') && point
        ? { x: point.clientX, y: point.clientY } : null;
      if (point) touchLast = { y: point.clientY, t: event.timeStamp };
    };
    const onTouchMove = (event: TouchEvent) => {
      if (!touchStart || !media.matches) return;
      const point = event.touches[0];
      if (!point) return;
      const dy = point.clientY - touchStart.y;
      const dx = Math.abs(point.clientX - touchStart.x);
      const speed = (point.clientY - touchLast.y) / Math.max(event.timeStamp - touchLast.t, 8);
      touchLast = { y: point.clientY, t: event.timeStamp };
      if (activeTab === "chat" && dy <= -12 && -dy > dx * 1.2) {
        chatTouchDirection = "down";
      } else if (dy >= 12 && dy > dx * 1.2 && speed >= REVEAL_SPEED) {
        chatTouchDirection = "up";
        if (hidden) reveal();
        touchStart = null;
      }
    };
    const onWheel = (event: WheelEvent) => {
      if (!hidden || !media.matches || event.deltaY >= -8) return;
      const target = event.target;
      if (target instanceof HTMLElement && shell.contains(target)
        && !target.closest('[role="dialog"], [role="menu"], .app-notifications-overlay')) {
        chatTouchDirection = null;
        reveal();
      }
    };

    const onBreakpointChange = () => reveal();
    const onFocusIn = (event: FocusEvent) => {
      if (event.target instanceof HTMLElement && event.target.matches("input, textarea, [contenteditable='true']")) {
        reveal();
      }
    };

    shell.addEventListener("scroll", onScroll, { capture: true, passive: true });
    shell.addEventListener("touchstart", onTouchStart, { capture: true, passive: true });
    shell.addEventListener("touchmove", onTouchMove, { capture: true, passive: true });
    shell.addEventListener("wheel", onWheel, { capture: true, passive: true });
    shell.addEventListener("focusin", onFocusIn);
    media.addEventListener("change", onBreakpointChange);

    return () => {
      shell.removeEventListener("scroll", onScroll, true);
      shell.removeEventListener("touchstart", onTouchStart, true);
      shell.removeEventListener("touchmove", onTouchMove, true);
      shell.removeEventListener("wheel", onWheel, true);
      shell.removeEventListener("focusin", onFocusIn);
      media.removeEventListener("change", onBreakpointChange);
      observer.disconnect();
      shell.classList.remove("mobile-chrome-hidden");
      shell.style.removeProperty("--mobile-header-height");
      shell.style.removeProperty("--mobile-nav-height");
    };
  }, [pathname, activeTab]);

  return shellRef;
}
