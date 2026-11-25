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