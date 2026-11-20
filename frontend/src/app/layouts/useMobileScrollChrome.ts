import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

/** Follow the active mobile content scroller, including nested Feed/Profile panes. */
export function useMobileScrollChrome() {
  const shellRef = useRef<HTMLElement>(null);
  const { pathname } = useLocation();

  useEffect(() => {
    const shell = shellRef.current;
    if (!shell) return;

    const media = window.matchMedia("(max-width: 760px)");
    const header = shell.querySelector<HTMLElement>(":scope > .chatnet-appbar");
    const navigation = shell.querySelector<HTMLElement>(":scope > .bottom-navigation");
    const previous = new WeakMap<EventTarget, number>();
    let directionDistance = 0;
    let lastDirection = 0;

    const reveal = () => {
      shell.classList.remove("mobile-chrome-hidden");
      directionDistance = 0;
      lastDirection = 0;
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
      if (header?.querySelector('.mobile-search-expanded')) {
        reveal();
        return;
      }
      if (target.closest('[role="dialog"], [role="menu"], .app-notifications-overlay')) return;
      if (target.scrollHeight <= target.clientHeight + 2) return;

      const top = target.scrollTop;
      const previousTop = previous.get(target);
      previous.set(target, top);
      if (top <= 20) {
        reveal();
        return;
      }
      if (previousTop === undefined) return;

      const delta = top - previousTop;
      if (Math.abs(delta) < 1 || Math.abs(delta) > 150) return;
      const direction = Math.sign(delta);
      directionDistance = lastDirection === direction ? directionDistance + Math.abs(delta) : Math.abs(delta);
      lastDirection = direction;

      if (direction > 0 && top > 90 && directionDistance >= 20) {
        shell.classList.add("mobile-chrome-hidden");
        directionDistance = 0;
      } else if (direction < 0 && directionDistance >= 12) {
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
    shell.addEventListener("focusin", onFocusIn);
    media.addEventListener("change", onBreakpointChange);

    return () => {
      shell.removeEventListener("scroll", onScroll, true);
      shell.removeEventListener("focusin", onFocusIn);
      media.removeEventListener("change", onBreakpointChange);
      observer.disconnect();
      shell.classList.remove("mobile-chrome-hidden");
      shell.style.removeProperty("--mobile-header-height");
      shell.style.removeProperty("--mobile-nav-height");
    };
  }, [pathname]);

  return shellRef;
}
