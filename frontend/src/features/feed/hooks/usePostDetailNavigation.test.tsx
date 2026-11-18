// @vitest-environment jsdom
import { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HashRouter, MemoryRouter, useLocation, useNavigate } from "react-router-dom";
import { usePostDetailNavigation } from "./usePostDetailNavigation";

vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
const cleanup: Array<() => void> = [];

function mount(router: "memory" | "hash", url = "/feed?sort=latest") {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);

  function Probe() {
    const location = useLocation();
    const navigate = useNavigate();
    const [active, setActive] = useState<number | null>(null);
    const { openFeedPostDetails, closeFeedPostDetails } = usePostDetailNavigation({ setActivePostId: setActive });
    return (
      <div>
        <output data-testid="url">{location.pathname + location.search}</output>
        <output data-testid="active">{active ?? "none"}</output>
        <button onClick={() => openFeedPostDetails(42)}>Open</button>
        <button onClick={() => openFeedPostDetails(0)}>Invalid</button>
        <button onClick={closeFeedPostDetails}>Close</button>
        <button onClick={() => {
          const returnTo = closeFeedPostDetails();
          navigate("/users/alice", { state: { returnTo } });
        }}>Open profile</button>
        <button onClick={() => navigate(-1)}>Back</button>
        <output data-testid="returnTo">{location.state?.returnTo}</output>
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

describe("post details stay over the feed", () => {
  it("does not navigate when opening or closing from the feed", () => {
    const app = mount("memory");
    app.click("Open");
    expect(app.text("url")).toBe("/feed?sort=latest");
    expect(app.text("active")).toBe("42");
    app.click("Close");
    expect(app.text("url")).toBe("/feed?sort=latest");
    expect(app.text("active")).toBe("none");
    app.click("Invalid");
    expect(app.text("active")).toBe("none");
  });

  it("removes the post identifier when closing a shared link", () => {
    const app = mount("memory", "/feed/posts/42?sort=latest");
    app.click("Open");
    app.click("Close");
    expect(app.text("url")).toBe("/feed?sort=latest");
    expect(app.text("active")).toBe("none");
  });

  it("replaces a shared post entry before opening a profile, so Back cannot reopen it", () => {
    const app = mount("memory", "/feed/posts/42?ref=share&sort=latest#today");
    app.click("Open");
    app.click("Open profile");
    expect(app.text("url")).toBe("/users/alice");
    expect(app.text("active")).toBe("none");
    expect(app.text("returnTo")).toBe("/feed?sort=latest#today");
    app.click("Back");
    expect(app.text("url")).toBe("/feed?sort=latest");
    expect(app.text("active")).toBe("none");
  });

  it("keeps Desktop hash routes intact and supports closing legacy links", () => {
    const app = mount("hash", "/feed?sort=latest&post=42");
    app.click("Open");
    expect(window.location.hash).toBe("#/feed?sort=latest&post=42");
    expect(window.location.search).toBe("");
    app.click("Close");
    expect(window.location.hash).toBe("#/feed?sort=latest");
  });
});
