// @vitest-environment jsdom
import { act, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HashRouter, MemoryRouter, useLocation, useNavigate } from "react-router-dom";
import { usePostDetailNavigation } from "./usePostDetailNavigation";

vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
const cleanup: Array<() => void> = [];

function mount(router: "memory" | "hash", url = "/feed?sort=latest", desktop = true) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);

  function Probe() {
    const location = useLocation();
    const navigate = useNavigate();
    const [active, setActive] = useState<number | null>(null);
    const feedViewRef = useRef<HTMLDivElement>(null);
    const feedScrollBeforeComments = useRef<number | null>(null);
    const { openFeedPostDetails, closeFeedPostDetails } = usePostDetailNavigation({
      feedScrollBeforeComments, feedViewRef, isProfileDesktop: desktop,
      setActivePostId: setActive, tab: "feed",
    });
    return (
      <div>
        <output data-testid="url">{location.pathname + location.search}</output>
        <output data-testid="active">{active ?? "none"}</output>
        <button onClick={() => openFeedPostDetails(42)}>Open</button>
        <button onClick={closeFeedPostDetails}>Close</button>
        <button onClick={() => navigate(-1)}>Back</button>
        <div ref={feedViewRef} />
      </div>
    );
  }

  if (router === "hash") window.history.replaceState(null, "", `/#${url}`);
  act(() => {
    root.render(router === "memory"
      ? <MemoryRouter initialEntries={[url]}><Probe /></MemoryRouter>
      : <HashRouter><Probe /></HashRouter>);
  });
  cleanup.push(() => {
    act(() => root.unmount());
    container.remove();
    window.history.replaceState(null, "", "/");
  });
  const click = (label: string) => {
    const button = Array.from(container.querySelectorAll("button")).find((item) => item.textContent === label);
    if (!button) throw new Error(`Missing button ${label}`);
    act(() => button.click());
  };
  const text = (id: string) => container.querySelector(`[data-testid="${id}"]`)?.textContent;
  return { click, text };
}

afterEach(() => {
  while (cleanup.length) cleanup.pop()!();
});

describe("post detail router navigation", () => {
  it("preserves filters, supports Back, and removes only the post parameter", () => {
    const app = mount("memory");
    app.click("Open");
    expect(app.text("url")).toBe("/feed/posts/42?sort=latest");
    expect(app.text("active")).toBe("42");

    app.click("Back");
    expect(app.text("url")).toBe("/feed?sort=latest");

    app.click("Open");
    app.click("Close");
    expect(app.text("url")).toBe("/feed?sort=latest");
    expect(app.text("active")).toBe("none");
  });

  it("uses the hash route in Desktop instead of editing the outer query string", () => {
    const app = mount("hash", "/feed?sort=latest");
    app.click("Open");
    expect(window.location.hash).toBe("#/feed/posts/42?sort=latest");
    expect(window.location.search).toBe("");
    app.click("Close");
    expect(window.location.hash).toBe("#/feed?sort=latest");
  });

  it("uses shareable post detail URLs on mobile while preserving the overlay state", () => {
    const app = mount("memory", "/feed", false);
    app.click("Open");
    expect(app.text("active")).toBe("42");
    expect(app.text("url")).toBe("/feed/posts/42");
  });
});
