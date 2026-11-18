// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import AppShellUploadProgress from "./AppShellUploadProgress";

vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
const cleanup: Array<() => void> = [];
afterEach(() => { while (cleanup.length) cleanup.pop()!(); });

function render(progress: { loaded: number; total: number } | null) {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const cancel = vi.fn();
  act(() => root.render(<AppShellUploadProgress progress={progress} onCancel={cancel} />));
  cleanup.push(() => { act(() => root.unmount()); host.remove(); });
  return { host, cancel };
}

describe("AppShellUploadProgress", () => {
  it("keeps the existing accessible upload status and cancel control", () => {
    const { host, cancel } = render({ loaded: 25, total: 100 });
    expect(host.children).toHaveLength(1);
    expect(host.firstElementChild?.className).toBe("media-upload-progress");
    expect(host.querySelector('[role="status"]')?.textContent).toContain("25%");
    const progress = host.querySelector("progress");
    expect(progress?.value).toBe(25);
    expect(progress?.max).toBe(100);
    expect(progress?.getAttribute("aria-label")).toBe("Tiến độ tải tệp");
    act(() => host.querySelector("button")?.click());
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it("renders nothing without an upload and protects percentage from a zero denominator", () => {
    expect(render(null).host.childElementCount).toBe(0);
    const { host } = render({ loaded: 0, total: 0 });
    expect(host.textContent).toContain("0%");
  });
});
