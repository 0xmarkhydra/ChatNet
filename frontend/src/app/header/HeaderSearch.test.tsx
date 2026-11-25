// @vitest-environment jsdom
import { renderToStaticMarkup } from "react-dom/server";
import { Search } from "lucide-react";
import { describe, expect, it } from "vitest";
import HeaderSearch from "./HeaderSearch";

describe("shared HeaderSearch on PWA mobile", () => {
  it("renders search input without obsolete open/back buttons", () => {
    const root = document.createElement("div");
    root.innerHTML = renderToStaticMarkup(
      <HeaderSearch
        anchorRef={{ current: null }}
        icon={<Search aria-hidden="true" />}
        value=""
        placeholder="Tìm kiếm..."
        ariaLabel="Tìm kiếm"
        onChange={() => {}}
      />,
    );
    expect(root.querySelector(".appbar-search-anchor")).not.toBeNull();
    expect(root.querySelector(".appbar-search input[type='search']")).not.toBeNull();
    expect(root.querySelectorAll(".appbar-mobile-search-trigger, .appbar-mobile-search-back")).toHaveLength(0);
    expect(root.querySelectorAll("button[aria-label='Mở tìm kiếm'], button[aria-label='Đóng tìm kiếm']")).toHaveLength(0);
  });
});
