// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import AppShellNotices from "./AppShellNotices";
import type { ToastNotice } from "../../shared/utils/toast";

vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
const cleanup: Array<() => void> = [];
afterEach(() => { while (cleanup.length) cleanup.pop()!(); });

function renderNotices(showPushPrompt: boolean, pushBusy: boolean, notice: ToastNotice | null) {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const onDismissPushPrompt = vi.fn();
  const onEnablePush = vi.fn();
  const onDismissNotice = vi.fn();
  const props = { showPushPrompt, pushBusy, notice, onDismissPushPrompt, onEnablePush, onDismissNotice };
  act(() => root.render(<AppShellNotices {...props} />));
  cleanup.push(() => { act(() => root.unmount()); host.remove(); });
  return { host, root, props, onDismissPushPrompt, onEnablePush, onDismissNotice };
}

describe("AppShellNotices", () => {
  it("keeps the shell siblings and callback behavior without a wrapper", () => {
    const test = renderNotices(true, false, { id: 1, message: "Đã gửi tin nhắn", kind: "success" });
    expect(test.host.children).toHaveLength(2);
    expect(test.host.firstElementChild?.className).toBe("push-onboarding");
    expect(test.host.lastElementChild?.className).toBe("notice toast toast-success");
    expect(test.host.querySelector('[aria-live="polite"]')).not.toBeNull();
    const later = Array.from(test.host.querySelectorAll("button")).find(button => button.textContent === "Để sau");
    const enable = Array.from(test.host.querySelectorAll("button")).find(button => button.textContent === "Bật thông báo");
    act(() => later?.click());
    act(() => enable?.click());
    act(() => test.host.querySelector<HTMLButtonElement>('[aria-label="Đóng thông báo"]')?.click());
    expect(test.onDismissPushPrompt).toHaveBeenCalledTimes(1);
    expect(test.onEnablePush).toHaveBeenCalledTimes(1);
    expect(test.onDismissNotice).toHaveBeenCalledTimes(1);
  });

  it("disables push actions while busy without hiding existing notice", () => {
    const { host } = renderNotices(true, true, { id: 2, message: "Có lỗi", kind: "error" });
    expect(host.querySelectorAll(".push-onboarding-actions button:disabled")).toHaveLength(2);
    expect(host.querySelector('[role="alert"]')?.textContent).toContain("Có lỗi");
    expect(host.querySelector('[aria-live="assertive"]')).not.toBeNull();
  });

  it("adds no DOM when both notifications are absent", () => {
    const { host } = renderNotices(false, false, null);
    expect(host.childElementCount).toBe(0);
  });
});
