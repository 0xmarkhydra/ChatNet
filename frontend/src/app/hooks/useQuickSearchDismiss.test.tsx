// @vitest-environment jsdom
import { act, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useQuickSearchDismiss } from "./useQuickSearchDismiss";

const previousAct = (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
afterEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = previousAct;
});

describe("useQuickSearchDismiss", () => {
  it("keeps search open for inside clicks and dismisses on outside click or Escape", () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    function Probe() {
      const anchorRef = useRef<HTMLDivElement>(null);
      const [open, setOpen] = useState(true);
      useQuickSearchDismiss(open, anchorRef, setOpen);
      return <><div ref={anchorRef}><button data-testid="inside">Inside</button></div>
        <output>{open ? "open" : "closed"}</output>
        <button data-testid="reopen" onClick={() => setOpen(true)}>Reopen</button></>;
    }
    try {
      act(() => root.render(<Probe />));
      const inside = host.querySelector('[data-testid="inside"]')!;
      act(() => inside.dispatchEvent(new Event("pointerdown", { bubbles: true })));
      expect(host.querySelector("output")?.textContent).toBe("open");
      act(() => document.body.dispatchEvent(new Event("pointerdown", { bubbles: true })));
      expect(host.querySelector("output")?.textContent).toBe("closed");

      act(() => host.querySelector('[data-testid="reopen"]')?.dispatchEvent(new MouseEvent("click", { bubbles: true })));
      expect(host.querySelector("output")?.textContent).toBe("open");
      act(() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })));
      expect(host.querySelector("output")?.textContent).toBe("closed");
    } finally {
      act(() => root.unmount());
      host.remove();
    }
  });

  it("does not retain document listeners when disabled or unmounted", () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const add = vi.spyOn(document, "addEventListener");
    const remove = vi.spyOn(document, "removeEventListener");
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    function Probe({ open }: { open: boolean }) {
      const anchor = useRef<HTMLDivElement>(null);
      const [, setOpen] = useState(false);
      useQuickSearchDismiss(open, anchor, setOpen);
      return <div ref={anchor}/>;
    }
    try {
      act(() => root.render(<Probe open={false} />));
      expect(add.mock.calls.filter(([name]) => name === "pointerdown")).toHaveLength(0);
      act(() => root.render(<Probe open />));
      expect(add.mock.calls.filter(([name]) => name === "pointerdown")).toHaveLength(1);
      act(() => root.render(<Probe open={false} />));
      expect(remove.mock.calls.filter(([name]) => name === "pointerdown")).toHaveLength(1);
    } finally {
      act(() => root.unmount());
      host.remove();
      add.mockRestore();
      remove.mockRestore();
    }
  });
});
