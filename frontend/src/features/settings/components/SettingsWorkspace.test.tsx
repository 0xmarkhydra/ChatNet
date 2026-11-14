// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import SettingsWorkspace from "./SettingsWorkspace";

vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
const cleanup: Array<() => void> = [];
afterEach(() => {
  while (cleanup.length) cleanup.pop()?.();
});

describe("shared UI controls in settings workspace", () => {
  it("preserves left-aligned navigation, active state and page switching", () => {
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    cleanup.push(() => { act(() => root.unmount()); host.remove(); });
    const onSavePrivacy = vi.fn(async () => {});
    act(() => root.render(
      <SettingsWorkspace
        privacy={null}
        privacyLoading={false}
        privacyBusy={false}
        privacyError=""
        onPrivacyRetry={() => {}}
        onSavePrivacy={onSavePrivacy}
        account={<p>Account content</p>}
        security={<p>Security content</p>}
        notifications={<p>Notifications content</p>}
        language={null}
        messages={null}
        appearance={null}
        storage={null}
        devices={null}
      />,
    ));
    const items = [...host.querySelectorAll<HTMLButtonElement>(".settings-workspace-nav-item")];
    expect(items).toHaveLength(9);
    for (const item of items) {
      expect(item.getAttribute("data-slot")).toBe("button");
      expect(item.type).toBe("button");
      expect(item.classList.contains("justify-start")).toBe(true);
      expect(item.classList.contains("justify-center")).toBe(false);
      expect(item.classList.contains("min-h-[46px]")).toBe(true);
      expect(item.classList.contains(item.getAttribute("aria-current") === "page" ? "hover:bg-[#edf2ff]" : "hover:bg-[#f5f7fc]")).toBe(true);
      expect(item.classList.contains("focus-visible:outline-2")).toBe(true);
    }
    expect(host.querySelector('[aria-current="page"]')?.textContent).toContain("Quyền riêng tư");
    expect(host.querySelector('[aria-current="page"]')?.classList.contains("bg-[#edf2ff]")).toBe(true);
    expect(host.querySelector(".settings-workspace-save")?.getAttribute("disabled")).not.toBeNull();
    const notifications = items.find(item => item.textContent?.includes("Thông báo"));
    expect(notifications).toBeTruthy();
    act(() => notifications?.click());
    expect(host.querySelector('[aria-current="page"]')?.textContent).toContain("Thông báo");
    expect(host.querySelector("#settings-workspace-title")?.textContent).toBe("Thông báo");
    expect(host.textContent).toContain("Notifications content");
    expect(onSavePrivacy).not.toHaveBeenCalled();
  });
});