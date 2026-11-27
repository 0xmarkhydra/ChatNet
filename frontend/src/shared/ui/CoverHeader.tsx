import { useEffect, useRef, useState, type ReactNode, type ComponentProps, type CSSProperties } from "react";
import { cn } from "../lib/utils";
import { Button } from "./button";

/** Shared sticky offset for content that docks below the cover toolbar. */
export const COVER_HEADER_OFFSET = "calc(var(--soco-control-touch) + var(--soco-space-2) * 2)";

type CoverHeaderProps = {
  label: string;
  leading?: ReactNode;
  children?: ReactNode;
  className?: string;
};

/** Sticky overlay: mount as a direct child of the scrolling content, before its cover. */
export function CoverHeader({ label, leading, children, className }: CoverHeaderProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let scroller = ref.current?.parentElement;
    while (scroller && !/auto|scroll/.test(getComputedStyle(scroller).overflowY)) {
      scroller = scroller.parentElement;
    }
    const source = scroller ?? window;
    const measure = () => {
      const offset = scroller ? scroller.scrollTop : window.scrollY;
      setProgress(Math.min(1, Math.max(0, offset / 160)));
    };
    measure();
    source.addEventListener("scroll", measure, { passive: true });
    return () => source.removeEventListener("scroll", measure);
  }, []);

  return (
    <div ref={ref} className="sticky top-0 z-30 h-0 w-full shrink-0">
      <header aria-label={label}
        style={{ "--cover-header-progress": `${progress * 100}%`, "--cover-header-height": COVER_HEADER_OFFSET } as CSSProperties}
        className={cn("absolute inset-x-0 top-0 isolate flex h-[var(--cover-header-height)] box-border min-w-0 items-center justify-between px-ui-4 py-ui-2 text-[color:color-mix(in_srgb,white,var(--soco-text)_var(--cover-header-progress))]", className)}>
        <span aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-black/30 to-transparent" style={{ opacity: 1 - progress }} />
        <span aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 bg-card" style={{ opacity: progress }} />
        {leading}
        <div className="ml-auto flex min-w-0 items-center gap-ui-2">{children}</div>
      </header>
    </div>
  );
}

type CoverHeaderActionProps = Omit<ComponentProps<typeof Button>, "aria-label" | "variant" | "size"> & { label: string };

export function CoverHeaderAction({ label, className, ...props }: CoverHeaderActionProps) {
  return (
    <Button {...props} aria-label={label} variant="ghost" size="icon" className={cn("size-control-touch rounded-full bg-transparent text-current! no-underline hover:bg-current/10 focus-visible:ring-current focus-visible:ring-offset-0", className)} />
  );
}