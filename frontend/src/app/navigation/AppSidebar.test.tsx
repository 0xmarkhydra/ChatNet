// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Tab } from "../../shared/types/navigation";
import AppSidebar from "./AppSidebar";

vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
vi.stubGlobal("ResizeObserver", class {
  observe() {}
  disconnect() {}
});

const roots: Array<{ unmount: () => void; element: HTMLElement }> = [];

function renderSidebar(tab: Tab, settingsActive = false, feedSaved = false) {
  const element = document.createElement("div");
  document.body.append(element);
  const root = createRoot(element);
  roots.push({ unmount: () => root.unmount(), element });
  const onNavigate = vi.fn();
  const onSettings = vi.fn();
  const onSaved = vi.fn();
  const onCalls = vi.fn();
  act(() => root.render(
    <AppSidebar
      tab={tab}
      section={null}
      username="user"
      displayName="User"
      unreadTotal={2}
      notificationCount={3}
      feedSaved={feedSaved}
      settingsActive={settingsActive}
      onNavigate={onNavigate}
      onSettings={onSettings}
      onSaved={onSaved}
      onCalls={onCalls}
    />,
  ));
  const button = (label: string) => {
    const found = Array.from(element.querySelectorAll("button")).find((node) => node.getAttribute("aria-label") === label);
    if (!found) throw new Error(`Missing sidebar button: ${label}`);
    return found;
  };
  return { button, onNavigate, onSettings, onSaved };
}

afterEach(() => {
  while (roots.length) {
    const entry = roots.pop()!;
    act(() => entry.unmount());
    entry.element.remove();
  }
  vi.clearAllMocks();
});

describe("AppSidebar navigation", () => {
  it("shows notifications as its own route, not as feed", () => {
    const { button, onNavigate } = renderSidebar("notifications");
    expect(button("Thông báo").getAttribute("aria-current")).toBe("page");
    expect(button("Bảng tin").hasAttribute("aria-current")).toBe(false);
    expect(button("Bạn bè").hasAttribute("aria-current")).toBe(false);
    expect(button("Thông báo").textContent).toContain("3");
    act(() => button("Bảng tin").click());
    expect(onNavigate).toHaveBeenCalledWith("feed");
  });

  it("distinguishes profile and settings from contacts", () => {
    const profile = renderSidebar("profile");
    expect(profile.button("Cá nhân").getAttribute("aria-current")).toBe("page");
    expect(profile.button("Bạn bè").hasAttribute("aria-current")).toBe(false);

    const settings = renderSidebar("profile", true);
    expect(settings.button("Cài đặt").getAttribute("aria-current")).toBe("page");
    expect(settings.button("Cá nhân").hasAttribute("aria-current")).toBe(false);
    act(() => settings.button("Cài đặt").click());
    expect(settings.onSettings).toHaveBeenCalledOnce();
    act(() => settings.button("Cá nhân").click());
    expect(settings.onNavigate).toHaveBeenCalledWith("profile");
  });

  it("keeps saved posts under the feed without claiming a separate route", () => {
    const { button, onSaved } = renderSidebar("feed", false, true);
    expect(button("Đã lưu").getAttribute("aria-current")).toBe("page");
    expect(button("Bảng tin").hasAttribute("aria-current")).toBe(false);
    act(() => button("Đã lưu").click());
    expect(onSaved).toHaveBeenCalledOnce();
  });
});
