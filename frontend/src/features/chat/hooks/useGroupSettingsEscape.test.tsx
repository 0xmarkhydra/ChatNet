// @vitest-environment jsdom
import { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { useGroupSettingsEscape } from "./useGroupSettingsEscape";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const mounted: Array<() => void> = [];
afterEach(() => {
  while (mounted.length) mounted.pop()!();
  document.body.innerHTML = "";
});

function mountPanel() {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  let state = false;
  let setOpen!: (next: boolean) => void;
  function Probe() {
    const [open, setPanelOpen] = useState(false);
    useGroupSettingsEscape(open, setPanelOpen);
    state = open;
    setOpen = setPanelOpen;
    return null;
  }
  const render = () => act(() => root.render(<Probe />));
  render();
  mounted.push(() => { act(() => root.unmount()); host.remove(); });
  return {
    open: () => act(() => setOpen(true)),
    get opened() { return state; },
  };
}

function escape() {
  act(() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
}

describe("useGroupSettingsEscape", () => {
  it("closes the group panel on Escape", () => {
    const panel = mountPanel();
    panel.open();
    escape();
    expect(panel.opened).toBe(false);
  });

  it("lets an active dialog handle Escape and keeps the group panel open", () => {
    const panel = mountPanel();
    panel.open();
    const dialog = document.createElement("dialog");
    dialog.setAttribute("open", "");
    document.body.append(dialog);
    escape();
    expect(panel.opened).toBe(true);
    dialog.remove();
    escape();
    expect(panel.opened).toBe(false);
  });

  it("ignores other keys", () => {
    const panel = mountPanel();
    panel.open();
    act(() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" })));
    expect(panel.opened).toBe(true);
  });
});
