// @vitest-environment jsdom
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import AppHeader, { AppHeaderActions } from "./AppHeader";

describe("shared PWA app header", () => {
  it.each(["chat", "contacts", "discover", "feed", "profile"])(
    "uses the same four-zone shell on %s",
    (tab) => {
      const host = document.createElement("div");
      host.innerHTML = renderToStaticMarkup(
        <AppHeader
          className="chatnet-appbar app-unified-header"
          start={<strong>{tab}</strong>}
          center={<span data-testid="desktop-center">Center</span>}
          end={<AppHeaderActions account={<button type="button">Account</button>}><button type="button">Action</button></AppHeaderActions>}
        />,
      );
      const header = host.querySelector("header");
      expect(header?.classList.contains("app-unified-header")).toBe(true);
      expect(header?.getAttribute("aria-label")).toBe("Thanh công cụ chính");
      expect(Array.from(header?.children ?? [], node => node.className)).toEqual([
        "appbar-start",
        "appbar-brand",
        "appbar-center",
        "appbar-end",
      ]);
      expect(host.querySelector(".appbar-brand strong")?.textContent).toBe("SocCO");
      expect(host.querySelector(".appbar-end .appbar-actions button")?.textContent).toBe("Action");
      expect(host.querySelector(".appbar-center")?.textContent).toBe("Center");
      expect(host.querySelector(".appbar-mobile-controls")).toBeNull();
    },
  );

  it("does not put the search field into the header component", () => {
    const host = document.createElement("div");
    host.innerHTML = renderToStaticMarkup(
      <AppHeader className="chatnet-appbar app-unified-header"
        start={<span>Title</span>} end={<span>Actions</span>} />,
    );
    expect(host.querySelector("input, .mobile-search-dock")).toBeNull();
    expect(host.querySelector(".appbar-center")).not.toBeNull();
  });
});
