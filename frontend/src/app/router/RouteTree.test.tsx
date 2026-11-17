// @vitest-environment jsdom
import { act, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Link, MemoryRouter, Outlet, parsePath, useLocation, useNavigate } from "react-router-dom";
import { AppRouteTree } from "./RouteTree";
import { ROUTE, TAB_PATH } from "./routes";

vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
const cleanup: Array<() => void> = [];

function renderAt(path: string, initialState?: unknown) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const onMount = vi.fn();

  function Shell() {
    const location = useLocation();
    const navigate = useNavigate();
    useEffect(() => { onMount(); }, []);
    return (
      <div>
        <output data-testid="location">{location.pathname + location.search}</output>
        <output data-testid="hash">{location.hash}</output>
        <output data-testid="state">{JSON.stringify(location.state)}</output>
        <Link to="/feed">Bảng tin</Link>
        <Link to="/feed/posts/42">Bài viết 42</Link>
        <Link to="/chat/123">Hội thoại 123</Link>
        <Link to="/settings/devices">Thiết bị</Link>
        <Link to="/calls/translation">Dịch AI</Link>
        <Link to="/users/alice">Hồ sơ Alice</Link>
        <Link to="/somewhere-unknown">Invalid</Link>
        <button type="button" onClick={() => navigate(-1)}>History Back</button>
        <button type="button" onClick={() => navigate(1)}>History Forward</button>
        <Outlet context={{ content: <p data-testid="page">Current screen</p>, frameClassName: "" }} />
      </div>
    );
  }

  act(() => root.render(
    <MemoryRouter initialEntries={[{ ...parsePath(path), state: initialState }]}>
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
  const history = (direction: "Back" | "Forward") => {
    const button = Array.from(container.querySelectorAll("button")).find((item) => item.textContent === `History ${direction}`);
    if (!button) throw new Error(`Missing History ${direction}`);
    act(() => button.click());
  };
  const page = () => container.querySelector('[data-testid="page"]');
  const hash = () => container.querySelector('[data-testid="hash"]')?.textContent;
  const state = () => container.querySelector('[data-testid="state"]')?.textContent;
  return { container, onMount, link, location, page, hash, state, history };
}

afterEach(() => {
  while (cleanup.length) cleanup.pop()!();
});

describe("app route tree", () => {
  it("provides a working index route for every registered app tab and workspace", () => {
    for (const path of [...Object.values(TAB_PATH), ...Object.values(ROUTE)]) {
      const app = renderAt(path);
      expect(app.page()?.textContent, `Missing route content: ${path}`).toBe("Current screen");
      expect(app.onMount).toHaveBeenCalledTimes(1);
    }
  });

  it("keeps the authenticated shell mounted when switching tabs", () => {
    const { onMount, link, location, page } = renderAt("/chat");
    expect(page()?.textContent).toBe("Current screen");
    act(() => link("Bảng tin").click());
    expect(location()).toBe("/feed");
    expect(page()?.textContent).toBe("Current screen");
    expect(onMount).toHaveBeenCalledTimes(1);
  });

  it("keeps the signed-in shell and outlet context across nested feature routes", () => {
    const app = renderAt("/feed");
    for (const [label, path] of [
      ["Bài viết 42", "/feed/posts/42"],
      ["Hội thoại 123", "/chat/123"],
      ["Thiết bị", "/settings/devices"],
      ["Dịch AI", "/contacts/translation"],
      ["Hồ sơ Alice", "/users/alice"],
      ["Bảng tin", "/feed"],
    ]) {
      act(() => app.link(label).click());
      expect(app.location()).toBe(path);
      expect(app.page()?.textContent).toBe("Current screen");
      expect(app.onMount).toHaveBeenCalledTimes(1);
    }
  });

  it("preserves nested page context across back/forward history", () => {
    const app = renderAt("/chat");
    act(() => app.link("Bài viết 42").click());
    act(() => app.link("Thiết bị").click());
    expect(app.location()).toBe("/settings/devices");
    app.history("Back");
    expect(app.location()).toBe("/feed/posts/42");
    expect(app.page()?.textContent).toBe("Current screen");
    app.history("Back");
    expect(app.location()).toBe("/chat");
    app.history("Forward");
    expect(app.location()).toBe("/feed/posts/42");
    app.history("Forward");
    expect(app.location()).toBe("/settings/devices");
    expect(app.page()?.textContent).toBe("Current screen");
    expect(app.onMount).toHaveBeenCalledTimes(1);
  });

  it("redirects legacy home links without discarding the post deep link", () => {
    const { location, page } = renderAt("/?tab=feed&post=42");
    expect(location()).toBe("/feed?post=42");
    expect(page()).not.toBeNull();
  });

  it("rejects prototype-named legacy tabs while preserving non-tab query and redirect context", () => {
    for (const name of ["__proto__", "constructor", "toString", "hasOwnProperty"]) {
      const app = renderAt(`/?tab=${name}&post=42#comments`, { context: "legacy" });
      expect(app.location()).toBe("/chat?post=42");
      expect(app.hash()).toBe("#comments");
      expect(app.state()).toBe(JSON.stringify({ context: "legacy" }));
      expect(app.page()?.textContent).toBe("Current screen");
      expect(app.onMount).toHaveBeenCalledTimes(1);
    }
  });

  it("preserves legacy deep-link fragment and navigation state through a canonical home redirect", () => {
    const payload = { postId: 42, visitorReturnTo: "/contacts/requests" };
    const app = renderAt("/?tab=feed&post=42#comments", payload);
    expect(app.location()).toBe("/feed?post=42");
    expect(app.hash()).toBe("#comments");
    expect(app.state()).toBe(JSON.stringify(payload));
    expect(app.page()?.textContent).toBe("Current screen");
    expect(app.onMount).toHaveBeenCalledTimes(1);
  });

  it("canonicalizes legacy tab links while keeping unrelated search parameters", () => {
    expect(renderAt("/?tab=contacts&invite=alice").location()).toBe("/contacts?invite=alice");
    expect(renderAt("/?tab=unknown&message=12").location()).toBe("/chat?message=12");
    expect(renderAt("/?tab=feed").location()).toBe("/feed");
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

  it("redirects legacy call routes into Contacts without remounting the shell", () => {
    for (const [path, target] of [
      ["/calls", "/contacts/calls"],
      ["/calls/history", "/contacts/calls"],
      ["/calls/directory", "/contacts"],
      ["/calls/translation", "/contacts/translation"],
    ]) {
      const app = renderAt(path);
      expect(app.location()).toBe(target);
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

  it("rejects unknown profile and feed subpaths instead of rendering an unrelated page", () => {
    for (const path of ["/profile/unknown", "/profile/edit/unknown", "/feed/unknown", "/feed/posts/42/extra"]) {
      const app = renderAt(path);
      expect(app.location()).toBe(path);
      expect(app.page()).toBeNull();
      expect(app.container.textContent).toContain("Không tìm thấy trang");
      expect(app.onMount).toHaveBeenCalledTimes(1);
    }
    for (const path of ["/profile", "/feed", "/feed/posts/42"]) {
      expect(renderAt(path).page()?.textContent).toBe("Current screen");
    }
  });

  it("offers a parent destination from unsupported deep links", () => {
    const examples: Array<[string, string, string]> = [
      ["/feed/broken", "Về Bảng tin", "/feed"],
      ["/profile/broken", "Về Hồ sơ", "/profile"],
      ["/users/alice/more", "Về Hồ sơ", "/profile"],
      ["/settings/broken", "Về Cài đặt", "/settings"],
      ["/calls/broken", "Về Cuộc gọi", "/contacts/calls"],
      ["/contacts/broken", "Về Danh bạ", "/contacts"],
      ["/unknown", "Về Tin nhắn", "/chat"],
    ];
    for (const [path, label, destination] of examples) {
      const app = renderAt(path);
      expect(app.page()).toBeNull();
      expect(app.container.textContent).toContain("Không tìm thấy trang");
      act(() => app.link(label).click());
      expect(app.location()).toBe(destination);
      expect(app.page()?.textContent).toBe("Current screen");
      expect(app.onMount).toHaveBeenCalledTimes(1);
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