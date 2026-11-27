// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { it, expect, vi } from "vitest";
import { CoverHeader, CoverHeaderAction } from "./CoverHeader";

it("renders independently supplied cover actions with accessible labels", () => {
  const host = document.createElement("div");
  const root = createRoot(host);
  const onMenu = vi.fn();
  const onEdit = vi.fn();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  try {
    act(() => root.render(
      <CoverHeader label="Cover navigation" leading={<CoverHeaderAction label="Menu" onClick={onMenu}>M</CoverHeaderAction>}>
        <CoverHeaderAction label="Edit" onClick={onEdit}>E</CoverHeaderAction>
        <CoverHeaderAction label="Search" asChild><a href="/search">S</a></CoverHeaderAction>
      </CoverHeader>,
    ));
    expect(host.querySelector("header")?.getAttribute("aria-label")).toBe("Cover navigation");
    const menu = host.querySelector<HTMLButtonElement>('button[aria-label="Menu"]');
    const edit = host.querySelector<HTMLButtonElement>('button[aria-label="Edit"]');
    act(() => { menu?.click(); edit?.click(); });
    expect(onMenu).toHaveBeenCalledOnce();
    expect(onEdit).toHaveBeenCalledOnce();
    expect(host.querySelector('a[aria-label="Search"]')?.getAttribute("href")).toBe("/search");
    expect(host.querySelectorAll("button")).toHaveLength(2);
  } finally {
    act(() => root.unmount());
    vi.unstubAllGlobals();
  }
});

it("follows the scroll owner and resets when scrolling back to the cover", () => {
  const host = document.createElement("div");
  host.style.overflowY = "auto";
  document.body.append(host);
  const root = createRoot(host);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  try {
    act(() => root.render(<CoverHeader label="Cover navigation" />));
    const header = host.querySelector("header")!;
    const progress = () => header.style.getPropertyValue("--cover-header-progress");
    expect(progress()).toBe("0%");
    for (const [offset, expected] of [[80, "50%"], [160, "100%"], [240, "100%"], [0, "0%"]] as const) {
      act(() => {
        host.scrollTop = offset;
        host.dispatchEvent(new Event("scroll"));
      });
      expect(progress()).toBe(expected);
    }
  } finally {
    act(() => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
  }
});
