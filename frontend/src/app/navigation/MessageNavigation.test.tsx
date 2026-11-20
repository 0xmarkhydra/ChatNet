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
    vi.stubGlobal("matchMedia", vi.fn((query: string) => ({
      matches: query === "(max-width: 760px)",
      media: query,
    })));
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
          const control = Array.from(host.querySelectorAll<HTMLButtonElement>(`${selector} button`))
            .find((button) => button.getAttribute("aria-label")?.startsWith("Tin nhắn"));
          expect(control).not.toBeNull();
          const badge = control!.querySelector("b");
          const label = control!.getAttribute("aria-label");
          if (unreadTotal > 0) {
            expect(label).toBe(`Tin nhắn, ${unreadTotal} tin nhắn chưa đọc`);
            expect(control!.getAttribute("aria-describedby")).toBeNull();
            expect(badge?.getAttribute("aria-hidden")).toBe("true");
            expect(badge?.textContent).toBe(unreadTotal === 100 ? "99+" : "1");
            expect(host.querySelector(`${selector} span[hidden]`)).toBeNull();
          } else {
            expect(label).toBe("Tin nhắn");
            expect(control!.getAttribute("aria-describedby")).toBeNull();
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
