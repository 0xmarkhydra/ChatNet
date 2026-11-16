// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HashRouter, MemoryRouter, useLocation, useNavigate } from "react-router-dom";
import { notificationDeepLink, notificationRouteTarget } from "./notificationDeepLink";

vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
const cleanup: Array<() => void> = [];

describe("notification deep links", () => {
  it("parses feed, contacts and valid conversation/message IDs", () => {
    expect(notificationDeepLink(new URLSearchParams("tab=feed&conversation=12&message=34")))
      .toEqual({ tab: "feed", conversationId: 12, messageId: 34 });
    expect(notificationDeepLink(new URLSearchParams("tab=contacts&conversation=-1&message=oops")))
      .toEqual({ tab: "contacts", conversationId: null, messageId: null });
    expect(notificationDeepLink(new URLSearchParams("conversation=0&message=1.5")))
      .toEqual({ tab: null, conversationId: null, messageId: null });
    for (const invalid of ["0x10", "1e2", "+12", " 12", "012", "1.0", "9007199254740992"]) {
      expect(notificationDeepLink(new URLSearchParams(`conversation=${encodeURIComponent(invalid)}&message=${encodeURIComponent(invalid)}`)))
        .toEqual({ tab: null, conversationId: null, messageId: null });
    }
  });

  it("routes valid conversation links to chat, keeping unrelated invite parameters and hash", () => {
    expect(notificationRouteTarget({
      pathname: "/feed", search: "?invite=someone&conversation=12&message=34&tab=feed", hash: "#room",
    })).toEqual({
      tab: "feed", conversationId: 12, messageId: 34,
      to: { pathname: "/chat/12", search: "?invite=someone", hash: "#room" },
    });
    expect(notificationRouteTarget({ pathname: "/chat", search: "?invite=someone", hash: "" })).toBeNull();
  });

  it("preserves post detail URLs when consuming legacy feed tab links", () => {
    expect(notificationRouteTarget({ pathname: "/chat", search: "?tab=feed&post=41", hash: "" })?.to)
      .toEqual({ pathname: "/feed", search: "?post=41", hash: "" });
    expect(notificationRouteTarget({ pathname: "/chat", search: "?conversation=-5&foo=1", hash: "" })?.to)
      .toEqual({ pathname: "/chat", search: "?foo=1", hash: "" });
  });

  it("navigates inside Desktop HashRouter without rewriting the outer browser URL", () => {
    const previousUrl = window.location.href;
    const container = document.createElement("div");
    document.body.append(container);
    window.history.replaceState(null, "", "/#/chat?conversation=12&message=34&invite=someone");
    const root = createRoot(container);

    function Probe() {
      const location = useLocation();
      const navigate = useNavigate();
      return (
        <div>
          <output>{location.pathname + location.search}</output>
          <button onClick={() => {
            const target = notificationRouteTarget(location);
            if (target) navigate(target.to, { replace: true });
          }}>Consume</button>
        </div>
      );
    }
    act(() => root.render(<HashRouter><Probe /></HashRouter>));
    cleanup.push(() => {
      act(() => root.unmount());
      container.remove();
      window.history.replaceState(null, "", previousUrl);
    });

    act(() => container.querySelector("button")?.click());
    expect(window.location.pathname + window.location.search).toBe("/");
    expect(window.location.hash).toBe("#/chat/12?invite=someone");
    expect(container.querySelector("output")?.textContent).toBe("/chat/12?invite=someone");
  });
});

afterEach(() => {
  while (cleanup.length) cleanup.pop()!();
});