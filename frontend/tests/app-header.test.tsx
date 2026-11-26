// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import AppHeader, { AppHeaderActions } from "../src/app/header/AppHeader";

describe("shared application header", () => {
  it("keeps the brand, context title, search and page actions in one semantic header", async () => {
    const host = document.createElement("div");
    const root = createRoot(host);
    const previous = (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    try {
      await act(async () => root.render(
        <AppHeader
          className="chatnet-appbar"
          start={<h1>Tin nhắn</h1>}
          center={<input type="search" aria-label="Tìm kiếm" />}
          end={<AppHeaderActions account={<button type="button">Tài khoản</button>}>
            <button type="button">Tạo mới</button>
          </AppHeaderActions>}
        />,
      ));
      const header = host.querySelector("header");
      expect(header?.getAttribute("aria-label")).toBe("Thanh công cụ chính");
      expect(header?.querySelector("h1")?.textContent).toBe("Tin nhắn");
      expect(header?.querySelector(".appbar-brand")?.textContent).toBe("SocCO");
      expect(header?.querySelector(".appbar-start h1")?.textContent).toBe("Tin nhắn");
      expect(header?.querySelector(".appbar-center input[type=search]")).not.toBeNull();
      expect(header?.querySelector(".appbar-end .appbar-actions")).not.toBeNull();
      expect(Array.from(header?.querySelectorAll(".appbar-actions button") ?? []).map(x => x.textContent)).toEqual(["Tạo mới", "Tài khoản"]);

      await act(async () => root.render(
        <AppHeader className="chatnet-appbar" start={<h1>Khám phá</h1>}
          end={<AppHeaderActions account={null}><button type="button">Tạo mới</button></AppHeaderActions>} />,
      ));
      expect(host.querySelector("header h1")?.textContent).toBe("Khám phá");
      expect(host.querySelector("header input")).toBeNull();
      expect(host.querySelectorAll(".appbar-brand")).toHaveLength(1);
    } finally {
      await act(async () => root.unmount());
      (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = previous;
    }
  });

  it("groups mobile search and page actions into the compact feed-style header", async () => {
    const host = document.createElement("div");
    const root = createRoot(host);
    const previous = (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    try {
      await act(async () => root.render(
        <AppHeader
          className="chatnet-appbar"
          mobileSearchActions
          start={<h1>Khám phá</h1>}
          center={<input type="search" aria-label="Tìm kiếm" />}
          end={<AppHeaderActions account={null}><button type="button">Thông báo</button></AppHeaderActions>}
        />,
      ));
      const controls = host.querySelector(".appbar-mobile-controls");
      expect(controls).not.toBeNull();
      expect(controls?.querySelector(".appbar-center input[type=search]")).not.toBeNull();
      expect(controls?.querySelector(".appbar-end .appbar-actions button")?.textContent).toBe("Thông báo");
      expect(host.querySelector(".appbar-brand")?.textContent).toBe("SocCO");
    } finally {
      await act(async () => root.unmount());
      (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = previous;
    }
  });
});
