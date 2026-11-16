// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HashRouter, MemoryRouter, useLocation, useNavigate } from "react-router-dom";
import { inviteRouteTarget } from "./inviteDeepLink";

vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
const originalUrl = window.location.href;
const cleanup: Array<() => void> = [];
afterEach(() => {
  while (cleanup.length) cleanup.pop()!();
  window.history.replaceState(null, "", originalUrl);
});

describe("invite deep links", () => {
  it("preserves unrelated parameters and hash without changing browser history", () => {
    const state = { key: "route", idx: 4 };
    window.history.replaceState(state, "", "/chat?invite=%40friend&post=12#thread");
    expect(inviteRouteTarget({ pathname: "/chat", search: "?invite=%40friend&post=12", hash: "#thread" }))
      .toEqual({
        username: "friend",
        to: { pathname: "/chat", search: "?post=12", hash: "#thread" },
      });
    expect(window.location.search).toBe("?invite=%40friend&post=12");
    expect(window.history.state).toEqual(state);
  });

  it("prefers connect and consumes both invite parameters", () => {
    expect(inviteRouteTarget({ pathname: "/contacts", search: "?connect=%40first&invite=second&tab=feed", hash: "" }))
      .toEqual({
        username: "first",
        to: { pathname: "/contacts", search: "?tab=feed", hash: "" },
      });
  });

  it("returns null for empty invite without rewriting the URL", () => {
    expect(inviteRouteTarget({ pathname: "/chat", search: "?invite=%20%20", hash: "#room" })).toBeNull();
  });

  it("consumes invites in Desktop HashRouter without changing the outer URL", () => {
    window.history.replaceState(null, "", "/#/contacts?invite=%40friend&post=12");
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    function Probe() {
      const location = useLocation();
      const navigate = useNavigate();
      const target = inviteRouteTarget(location);
      return createElement("div", null,
        createElement("output", null, location.pathname + location.search),
        createElement("button", { onClick: () => {
          if (target) navigate(target.to, { replace: true });
        } }, "Consume"),
      );
    }
    act(() => root.render(createElement(HashRouter, null, createElement(Probe))));
    cleanup.push(() => { act(() => root.unmount()); host.remove(); });
    act(() => host.querySelector("button")?.click());
    expect(window.location.pathname + window.location.search).toBe("/");
    expect(window.location.hash).toBe("#/contacts?post=12");
    expect(host.querySelector("output")?.textContent).toBe("/contacts?post=12");
  });

  it("keeps a cleaned return route when opening a visitor from an invite", () => {
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    function Probe() {
      const location = useLocation();
      const navigate = useNavigate();
      return createElement("div", null,
        createElement("output", null, location.pathname + location.search),
        createElement("button", { onClick: () => {
          const target = inviteRouteTarget(location);
          if (!target) return;
          const returnTo = target.to.pathname + target.to.search + target.to.hash;
          navigate(target.to, { replace: true });
          navigate("/users/" + encodeURIComponent(target.username), {
            state: { visitorReturnTo: returnTo },
          });
        } }, "Open invite"),
        createElement("button", { onClick: () => {
          const returnTo = location.state?.visitorReturnTo;
          navigate(typeof returnTo === "string" ? returnTo : "/profile", { replace: true });
        } }, "Close visitor"),
      );
    }
    act(() => root.render(createElement(MemoryRouter, { initialEntries: ["/feed?invite=alice&post=9"] }, createElement(Probe))));
    cleanup.push(() => { act(() => root.unmount()); host.remove(); });
    const buttons = host.querySelectorAll("button");
    act(() => buttons[0]?.click());
    expect(host.querySelector("output")?.textContent).toBe("/users/alice");
    act(() => buttons[1]?.click());
    expect(host.querySelector("output")?.textContent).toBe("/feed?post=9");
  });

  it("keeps router navigation in sync after consuming an invite", () => {
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    function Probe() {
      const location = useLocation();
      const navigate = useNavigate();
      return createElement("div", null,
        createElement("output", null, location.pathname + location.search),
        createElement("button", { onClick: () => {
          const target = inviteRouteTarget(location);
          if (target) navigate(target.to, { replace: true });
        } }, "Consume"),
      );
    }
    act(() => root.render(createElement(MemoryRouter, { initialEntries: ["/feed?invite=alice&post=9"] }, createElement(Probe))));
    cleanup.push(() => { act(() => root.unmount()); host.remove(); });
    act(() => host.querySelector("button")?.click());
    expect(host.querySelector("output")?.textContent).toBe("/feed?post=9");
  });
});