// @vitest-environment jsdom
import { act, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { Link, MemoryRouter, Route, Routes } from "react-router-dom";
import AppLayout from "./AppLayout";
import PageRoute from "../router/PageRoute";

vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
const dispose: Array<() => void> = [];
afterEach(() => {
  while (dispose.length) dispose.pop()!();
});


it("keeps mobile search outside the collapsible header and in the page flow", () => {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  act(() => root.render(
    <MemoryRouter initialEntries={["/contacts"]}>
      <Routes>
        <Route element={
          <AppLayout
            className="app-shell modern-shell app-layout"
            activeTab="contacts"
            sidebar={<aside>Navigation</aside>}
            header={<header className="chatnet-appbar">Toolbar only</header>}
            mobileSearch={<input aria-label="Search contacts" />}
            outletContext={{
              frameClassName: "",
              beforeFeed: null,
              contacts: <p>Contacts list</p>,
              search: null,
              discover: null,
              market: null,
              notifications: null,
              profile: null,
              afterFeed: null,
              feed: null,
              chat: null,
            }}
          />
        }>
          <Route path="contacts" element={<PageRoute page="contacts" />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  ));
  try {
    const shell = container.querySelector("main")!;
    const header = shell.querySelector(":scope > header")!;
    const searchRow = shell.querySelector(":scope > .mobile-search-dock")!;
    const search = searchRow.querySelector("input")!;
    expect(header.querySelector("input")).toBeNull();
    expect(search.getAttribute("aria-label")).toBe("Search contacts");
    expect(searchRow.previousElementSibling).toBe(header);
    shell.classList.add("mobile-chrome-hidden");
    expect(search.isConnected).toBe(true);
    expect(searchRow.closest(".chatnet-appbar")).toBeNull();
  } finally {
    act(() => root.unmount());
    container.remove();
  }
});

it("renders header and sidebar around the outlet without extra DOM wrappers", () => {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const onShellMount = vi.fn();

  function Shell() {
    useEffect(() => {
      onShellMount();
    }, []);
    return (
      <AppLayout
        className="app-shell modern-shell app-layout"
        sidebar={<aside className="app-sidebar">Navigation</aside>}
        overlays={<div data-testid="overlay">Overlay</div>}
        header={<header className="chatnet-appbar">Header</header>}
        beforePage={<output data-testid="notice">Notice</output>}
        outletContext={{
          frameClassName: "",
          beforeFeed: null,
          contacts: <p data-testid="page">Stable page content</p>,
          search: null,
          discover: null,
          market: null,
          notifications: null,
          profile: null,
          afterFeed: null,
          feed: <p data-testid="page">Stable page content</p>,
          chat: null,
        }}
      >
        <div data-testid="after-page">Dialogs</div>
      </AppLayout>
    );
  }

  act(() => root.render(
    <MemoryRouter initialEntries={["/feed"]}>
      <Routes>
        <Route element={<Shell />}>
          <Route path="feed" element={<PageRoute page="feed" />} />
          <Route path="contacts" element={<PageRoute page="contacts" />} />
        </Route>
      </Routes>
      <Link to="/contacts" data-testid="navigate">Contacts</Link>
    </MemoryRouter>,
  ));

  const app = container.querySelector("main");
  expect(app?.children.length).toBe(6);
  expect(Array.from(app?.children ?? []).map(child => child.tagName.toLowerCase())).toEqual([
    "aside", "div", "header", "output", "section", "div",
  ]);
  expect(container.querySelector(".modern-frame")?.parentElement).toBe(app);
  expect(container.querySelector('[data-testid="page"]')?.textContent).toBe("Stable page content");

  act(() => container.querySelector<HTMLAnchorElement>('[data-testid="navigate"]')!.click());
  expect(onShellMount).toHaveBeenCalledTimes(1);
  expect(container.querySelector(".app-sidebar")).not.toBeNull();
  expect(container.querySelector(".chatnet-appbar")).not.toBeNull();
  expect(container.querySelector('[data-testid="page"]')?.textContent).toBe("Stable page content");

  dispose.push(() => {
    act(() => root.unmount());
    container.remove();
  });
});