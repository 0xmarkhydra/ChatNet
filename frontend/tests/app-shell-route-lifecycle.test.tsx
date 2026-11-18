// @vitest-environment jsdom
import { act, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { Link, MemoryRouter, useLocation } from "react-router-dom";
import AppLayout from "../src/app/layouts/AppLayout";
import { AppRouteTree } from "../src/app/router/RouteTree";

vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
const dispose: Array<() => void> = [];
afterEach(() => { while (dispose.length) dispose.pop()!(); });

it("retains the same Header/Sidebar/session shell through feature routes and call redirects", () => {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const onMount = vi.fn();

  function Shell() {
    const location = useLocation();
    const [sessionDraft, setSessionDraft] = useState("persisted");
    useEffect(() => { onMount(); }, []);
    return (
      <AppLayout
        className="modern-shell app-layout"
        sidebar={<aside data-testid="sidebar">Navigation</aside>}
        overlays={<div data-testid="call-overlay">Call manager</div>}
        header={<header data-testid="header">Header</header>}
        beforePage={<>
          <button type="button" data-testid="set-draft" onClick={() => setSessionDraft("draft kept")}>Set draft</button>
          <output data-testid="persistent-draft">{sessionDraft}</output>
        </>}
        outletContext={{
          frameClassName: "",
          beforeFeed: <span data-testid="before-feed">Existing shared dialogs</span>,
          afterFeed: <span data-testid="after-feed">Existing shared dialogs after Feed</span>,
          chat: <section data-testid="feature">chat</section>,
          feed: <section data-testid="feature">feed</section>,
          profile: <section data-testid="feature">profile</section>,
          contacts: <section data-testid="feature">contacts</section>,
          discover: <section data-testid="feature">discover</section>,
          market: <section data-testid="feature">market</section>,
          search: <section data-testid="feature">search</section>,
          notifications: <section data-testid="feature">notifications</section>,
        }}
      >
        <output data-testid="location">{location.pathname}</output>
      </AppLayout>
    );
  }

  act(() => root.render(
    <MemoryRouter initialEntries={["/feed"]}>
      <AppRouteTree><Shell /></AppRouteTree>
      <nav>
        <Link to="/chat/123">Chat</Link>
        <Link to="/contacts/calls">Contacts & Calls</Link>
        <Link to="/settings/privacy">Settings</Link>
        <Link to="/calls/history">Legacy Calls</Link>
        <Link to="/feed/posts/42">Feed post</Link>
      </nav>
    </MemoryRouter>,
  ));

  const header = container.querySelector('[data-testid="header"]');
  const sidebar = container.querySelector('[data-testid="sidebar"]');
  const callOverlay = container.querySelector('[data-testid="call-overlay"]');
  const draft = container.querySelector('[data-testid="persistent-draft"]')!;
  const navigate = (label: string, page: string, pathname: string) => {
    const link = [...container.querySelectorAll("a")].find(el => el.textContent === label)!;
    act(() => link.click());
    expect(container.querySelector('[data-testid="location"]')?.textContent).toBe(pathname);
    expect(container.querySelector(".modern-frame")?.getAttribute("data-route-page")).toBe(page);
    expect(container.querySelector('[data-testid="feature"]')?.textContent).toBe(page);
    expect(container.querySelector('[data-testid="header"]')).toBe(header);
    expect(container.querySelector('[data-testid="sidebar"]')).toBe(sidebar);
    expect(container.querySelector('[data-testid="call-overlay"]')).toBe(callOverlay);
    expect(container.querySelector('[data-testid="persistent-draft"]')).toBe(draft);
    expect(draft.textContent).toBe("draft kept");
    expect(onMount).toHaveBeenCalledTimes(1);
  };

  act(() => container.querySelector<HTMLButtonElement>('[data-testid="set-draft"]')!.click());
  navigate("Chat", "chat", "/chat/123");
  navigate("Contacts & Calls", "contacts", "/contacts/calls");
  navigate("Settings", "profile", "/settings/privacy");
  navigate("Legacy Calls", "contacts", "/contacts/calls");
  navigate("Feed post", "feed", "/feed/posts/42");

  act(() => root.unmount());
  container.remove();
});

it("keeps the persistent shell visible for invalid deep links", () => {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  function Shell() {
    return <AppLayout
      className="modern-shell app-layout"
      sidebar={<aside>Sidebar</aside>}
      header={<header>Header</header>}
      outletContext={{
        frameClassName: "", beforeFeed: null, afterFeed: null,
        chat: null, feed: null, profile: null, contacts: null, search: null,
        discover: null, market: null, notifications: null,
      }}
    />;
  }
  act(() => root.render(
    <MemoryRouter initialEntries={["/chat/0"]}>
      <AppRouteTree><Shell /></AppRouteTree>
    </MemoryRouter>,
  ));
  expect(container.querySelector("header")?.textContent).toBe("Header");
  expect(container.querySelector("aside")?.textContent).toBe("Sidebar");
  expect(container.textContent).toContain("Không tìm thấy trang");
  act(() => root.unmount());
  container.remove();
});