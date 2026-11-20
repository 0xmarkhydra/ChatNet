// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { useChatSectionPanels } from "./useChatSectionPanels";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const cleanup: Array<() => void> = [];
afterEach(() => { while (cleanup.length) cleanup.pop()!(); });

function mountPanels() {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  let state!: ReturnType<typeof useChatSectionPanels>;
  function Probe({ id }: { id: number | null }) {
    state = useChatSectionPanels({ activeConversationId: id });
    return null;
  }
  const render = (id: number | null) => {
    act(() => root.render(<Probe id={id} />));
    return state;
  };
  cleanup.push(() => { act(() => root.unmount()); host.remove(); });
  return { render };
}

describe("useChatSectionPanels", () => {
  it("resets pinned expansion across A → B → A without restoring stale state", () => {
    const ui = mountPanels();
    const old = ui.render(4);
    act(() => old.setPinnedExpanded(true));
    expect(ui.render(4).pinnedExpanded).toBe(true);
    expect(ui.render(5).pinnedExpanded).toBe(false);
    const next = ui.render(4);
    expect(next.pinnedExpanded).toBe(false);
    act(() => old.setPinnedExpanded(true));
    expect(ui.render(4).pinnedExpanded).toBe(false);
  });

  it("does not carry expanded pins into a new Chat mount", () => {
    const first = mountPanels();
    const old = first.render(4);
    act(() => old.setPinnedExpanded(true));
    expect(first.render(4).pinnedExpanded).toBe(true);
    const second = mountPanels();
    expect(second.render(4).pinnedExpanded).toBe(false);
  });
});
