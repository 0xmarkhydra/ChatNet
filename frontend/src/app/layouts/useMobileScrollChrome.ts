import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

/** Measure the mobile bars without hiding them or modifying the scroll position. */
export function useMobileScrollChrome(activeTab?: string) {
  const shellRef = useRef<HTMLElement>(null);
  const { pathname } = useLocation();

  useEffect(() => {
    const shell = shellRef.current;
    if (!shell) return;

    const header = shell.querySelector<HTMLElement>(":scope > .chatnet-appbar");
    const navigation = shell.querySelector<HTMLElement>(":scope > .bottom-navigation");
    const measure = () => {
      shell.style.setProperty("--mobile-header-height", `${header?.offsetHeight ?? 0}px`);
      shell.style.setProperty("--mobile-nav-height", `${navigation?.offsetHeight ?? 0}px`);
    };
    const observer = new ResizeObserver(measure);
    if (header) observer.observe(header);
    if (navigation) observer.observe(navigation);
    measure();

    return () => {
      observer.disconnect();
      shell.style.removeProperty("--mobile-header-height");
      shell.style.removeProperty("--mobile-nav-height");
    };
  }, [pathname, activeTab]);

  return shellRef;
}
