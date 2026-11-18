// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { UI_MESSAGES } from "../../features/i18n/lib/i18n";
import AppSidebar from "./AppSidebar";
import BottomNavigation from "./BottomNavigation";

afterEach(() => vi.unstubAllGlobals());

describe("Message navigation unread accessibility", () => {
  it("describes the exact total once and clears it on the same button when the total falls to zero", () => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    vi.stubGlobal("ResizeObserver", class {
      observe() {}
      disconnect() {}
    });
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    const onNavigate = vi.fn();
    const noop = () => {};

    try {
      for (const unreadTotal of [0, 1, 100, 0]) {
        act(() => root.render(
          <>
            <AppSidebar
              tab="feed" section={null} username="qa" displayName="QA"
              unreadTotal={unreadTotal} notificationCount={0}
              feedSaved={false} settingsActive={false}
              onNavigate={onNavigate} onSaved={noop} onSettings={noop}
            />
            <BottomNavigation
              tab="feed" unreadTotal={unreadTotal} pushEnabled
              t={(key) => UI_MESSAGES[key]}
              switchTab={onNavigate}
            />
          </>,
        ));

        for (const selector of [".app-sidebar", ".bottom-navigation"]) {
          const control = host.querySelector<HTMLButtonElement>(`${selector} button[aria-label="Tin nhắn"]`);
          expect(control).not.toBeNull();
          const badge = control!.querySelector("b");
          const id = control!.getAttribute("aria-describedby");
          if (unreadTotal > 0) {
            expect(id).toBeTruthy();
            const description = document.getElementById(id!);
            expect(description?.hidden).toBe(true);
            expect(description?.textContent).toBe(`${unreadTotal} tin nhắn chưa đọc`);
            expect(badge?.getAttribute("aria-hidden")).toBe("true");
            expect(badge?.textContent).toBe(unreadTotal === 100 ? "99+" : "1");
          } else {
            expect(id).toBeNull();
            expect(badge).toBeNull();
            expect(host.querySelector(`${selector} span[hidden]`)).toBeNull();
          }
          expect(control!.getAttribute("title")).toBeNull();
          act(() => control!.click());
          expect(onNavigate).toHaveBeenLastCalledWith("chat");
        }
      }
    } finally {
      act(() => root.unmount());
      host.remove();
    }
  });
});
