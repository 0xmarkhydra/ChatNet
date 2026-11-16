// @vitest-environment jsdom
import { act, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Link, MemoryRouter, Outlet, useLocation } from "react-router-dom";
import { AppRouteTree } from "./RouteTree";

vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
const cleanup: Array<() => void> = [];

function renderAt(path: string) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const onMount = vi.fn();

  function Shell() {
    const location = useLocation();
    useEffect(() => { onMount(); }, []);
    return (
      <div>
        <output data-testid="location">{location.pathname + location.search}</output>
        <Link to="/feed">Bảng tin</Link>
        <Link to="/somewhere-unknown">Invalid</Link>
        <Outlet context={<p data-testid="page">Current screen</p>} />
      </div>
    );
  }

  act(() => root.render(
    <MemoryRouter initialEntries={[path]}>
      <AppRouteTree><Shell /></AppRouteTree>
    </MemoryRouter>,
  ));
  cleanup.push(() => {
    act(() => root.unmount());
    container.remove();
  });
  const link = (text: string) => {
    const el = Array.from(container.querySelectorAll("a")).find((item) => item.textContent === text);
    if (!el) throw new Error(`Missing link ${text}`);
    return el;
  };
  const location = () => container.querySelector('[data-testid="location"]')?.textContent;
  const page = () => container.querySelector('[data-testid="page"]');
  return { container, onMount, link, location, page };
}

afterEach(() => {
  while (cleanup.length) cleanup.pop()!();
});

describe("app route tree", () => {
  it("keeps the authenticated shell mounted when switching tabs", () => {
    const { onMount, link, location, page } = renderAt("/chat");
    expect(page()?.textContent).toBe("Current screen");
    act(() => link("Bảng tin").click());
    expect(location()).toBe("/feed");
    expect(page()?.textContent).toBe("Current screen");
    expect(onMount).toHaveBeenCalledTimes(1);
  });

  it("redirects legacy home links without discarding the post deep link", () => {
    const { location, page } = renderAt("/?tab=feed&post=42");
    expect(location()).toBe("/feed?tab=feed&post=42");
    expect(page()).not.toBeNull();
  });

  it("renders Not Found for unknown paths without replacing the shell", () => {
    const { link, location, container, onMount, page } = renderAt("/chat");
    act(() => link("Invalid").click());
    expect(location()).toBe("/somewhere-unknown");
    expect(container.textContent).toContain("Không tìm thấy trang");
    expect(page()).toBeNull();
    expect(onMount).toHaveBeenCalledTimes(1);
  });

  it("shows the existing conversation page for valid chat detail links", () => {
    const { location, page } = renderAt("/chat/123");
    expect(location()).toBe("/chat/123");
    expect(page()).not.toBeNull();
  });

  it("renders visitor profile deep links inside the authenticated shell", () => {
    const { location, page, onMount } = renderAt("/users/alice");
    expect(location()).toBe("/users/alice");
    expect(page()?.textContent).toBe("Current screen");
    expect(onMount).toHaveBeenCalledTimes(1);
  });

  it("rejects unsupported or malformed visitor profile paths", () => {
    for (const path of ["/users", "/users/alice/more", "/users/%2F"]) {
      const { container, page } = renderAt(path);
      expect(page()).toBeNull();
      expect(container.textContent).toContain("Không tìm thấy trang");
    }
  });

  it("keeps invitations as a shareable contacts subpage", () => {
    const { location, page, onMount } = renderAt("/contacts/requests");
    expect(location()).toBe("/contacts/requests");
    expect(page()).not.toBeNull();
    expect(onMount).toHaveBeenCalledTimes(1);
    const invalid = renderAt("/contacts/unknown");
    expect(invalid.page()).toBeNull();
    expect(invalid.container.textContent).toContain("Không tìm thấy trang");
  });

  it("supports Settings subpages while keeping invalid sections out of the shell", () => {
    for (const section of [
      "account", "privacy", "security", "notifications", "language",
      "messages", "appearance", "storage", "devices",
    ]) {
      const app = renderAt(`/settings/${section}`);
      expect(app.page()?.textContent).toBe("Current screen");
      expect(app.onMount).toHaveBeenCalledTimes(1);
    }
    for (const path of ["/settings/not-a-section", "/settings/privacy/nested"]) {
      const invalid = renderAt(path);
      expect(invalid.page()).toBeNull();
      expect(invalid.container.textContent).toContain("Không tìm thấy trang");
    }
  });

  it("supports call workspace subroutes and rejects unknown call screens", () => {
    for (const path of ["/calls", "/calls/history", "/calls/directory", "/calls/translation"]) {
      const app = renderAt(path);
      expect(app.location()).toBe(path);
      expect(app.page()?.textContent).toBe("Current screen");
      expect(app.onMount).toHaveBeenCalledTimes(1);
    }
    const invalid = renderAt("/calls/unknown");
    expect(invalid.page()).toBeNull();
    expect(invalid.container.textContent).toContain("Không tìm thấy trang");
  });

  it("supports direct feed post URLs and rejects malformed post IDs", () => {
    const { location, page } = renderAt("/feed/posts/42");
    expect(location()).toBe("/feed/posts/42");
    expect(page()).not.toBeNull();
    for (const path of ["/feed/posts/0", "/feed/posts/nope", "/feed/posts/9007199254740992", "/feed/posts/42/more"]) {
      const invalid = renderAt(path);
      expect(invalid.page()).toBeNull();
      expect(invalid.container.textContent).toContain("Không tìm thấy trang");
    }
  });

  it("rejects malformed or unsafe conversation IDs", () => {
    for (const path of ["/chat/0", "/chat/nope", "/chat/9007199254740992", "/chat/42/more"]) {
      const { container, page } = renderAt(path);
      expect(page()).toBeNull();
      expect(container.textContent).toContain("Không tìm thấy trang");
    }
  });
});
