// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, useLocation, useNavigate } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import AppPageErrorBoundary from "./AppPageErrorBoundary";

const previousAct = (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;

afterEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = previousAct;
  vi.restoreAllMocks();
});

describe("AppPageErrorBoundary", () => {
  it("keeps the shell mounted and recovers when retrying a failed page", () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    let shouldCrash = true;
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);

    function Page() {
      if (shouldCrash) throw new Error("private error details");
      return <p>Page recovered</p>;
    }

    function Shell() {
      return (
        <>
          <header>Persistent header</header>
          <AppPageErrorBoundary><Page /></AppPageErrorBoundary>
          <footer>Persistent footer</footer>
        </>
      );
    }

    try {
      act(() => root.render(<MemoryRouter initialEntries={["/feed"]}><Shell /></MemoryRouter>));
      expect(host.textContent).toContain("Persistent header");
      expect(host.textContent).toContain("Persistent footer");
      expect(host.textContent).toContain("Không thể hiển thị trang này.");
      expect(host.textContent).not.toContain("private error details");

      shouldCrash = false;
      const retry = host.querySelector("button");
      expect(retry?.textContent).toBe("Thử lại");
      act(() => retry?.dispatchEvent(new MouseEvent("click", { bubbles: true })));
      expect(host.textContent).toContain("Page recovered");
      expect(host.textContent).not.toContain("Không thể hiển thị trang này.");
    } finally {
      act(() => root.unmount());
      host.remove();
    }
  });

  it("resets the failure when route identity changes", () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);

    function Page() {
      const { pathname } = useLocation();
      if (pathname === "/broken") throw new Error("page failed");
      return <p>Healthy route</p>;
    }

    function Shell() {
      const navigate = useNavigate();
      return (
        <>
          <button onClick={() => navigate("/healthy")}>Change route</button>
          <AppPageErrorBoundary><Page /></AppPageErrorBoundary>
        </>
      );
    }

    try {
      act(() => root.render(<MemoryRouter initialEntries={["/broken"]}><Shell /></MemoryRouter>));
      expect(host.textContent).toContain("Không thể hiển thị trang này.");
      const navigation = host.querySelector("button");
      act(() => navigation?.dispatchEvent(new MouseEvent("click", { bubbles: true })));
      expect(host.textContent).toContain("Healthy route");
    } finally {
      act(() => root.unmount());
      host.remove();
    }
  });
});
