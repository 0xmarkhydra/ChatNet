// @vitest-environment jsdom
import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "./App";

const flags = vi.hoisted(() => ({ loggedIn: false, authCrash: true, appCrash: true }));

vi.mock("../features/auth/components/AuthScreen", () => ({
  default: () => {
    if (flags.authCrash) throw new Error("private authentication details");
    return <p>Authentication recovered</p>;
  },
}));

vi.mock("./AuthedApp", () => ({
  default: () => {
    if (flags.appCrash) throw new Error("private app details");
    return <p>Application recovered</p>;
  },
}));

vi.mock("./providers/AuthedProviders", () => ({
  default: ({ children }: { children: ReactNode }) => <div data-testid="session-provider">{children}</div>,
}));

vi.mock("./hooks/useAppSession", () => ({
  useAppSession: () => ({
    session: flags.loggedIn ? {
      sessionId: "visit-A",
      user: { id: 1, username: "tester" },
      token: "fake",
    } : null,
    sessionRef: { current: null },
    responseCache: { current: null },
    sessionClient: null,
    auth: {},
    saveSession: vi.fn(),
    endSession: vi.fn(),
  }),
}));

vi.mock("./hooks/useInstallPrompt", () => ({
  useInstallPrompt: () => ({ installPrompt: null, setInstallPrompt: vi.fn() }),
}));

const previousAct = (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
afterEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = previousAct;
  vi.restoreAllMocks();
});

describe("App error containment", () => {
  for (const signedIn of [false, true]) {
    it(`recovers a ${signedIn ? "signed-in shell" : "signed-out screen"} crash without exposing error details`, () => {
      flags.loggedIn = signedIn;
      flags.authCrash = true;
      flags.appCrash = true;
      (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
      vi.spyOn(console, "error").mockImplementation(() => undefined);
      const host = document.createElement("div");
      document.body.append(host);
      const root = createRoot(host);

      try {
        act(() => root.render(<MemoryRouter initialEntries={["/"]}><App /></MemoryRouter>));
        expect(host.textContent).toContain("Không thể hiển thị trang này.");
        expect(host.textContent).not.toContain("private");
        if (signedIn) expect(host.querySelector("[data-testid=session-provider]")).not.toBeNull();

        if (signedIn) flags.appCrash = false;
        else flags.authCrash = false;
        act(() => host.querySelector("button")?.dispatchEvent(new MouseEvent("click", { bubbles: true })));

        expect(host.textContent).toContain(signedIn ? "Application recovered" : "Authentication recovered");
      } finally {
        act(() => root.unmount());
        host.remove();
      }
    });
  }
});
