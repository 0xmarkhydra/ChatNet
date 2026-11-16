// @vitest-environment jsdom
import { act, useEffect, useState, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "./App";

const sessionFlags = vi.hoisted(() => ({
  userId: 1,
  sessionId: "shared-id",
  token: "token-1",
  mounts: 0,
  unmounts: 0,
}));

vi.mock("../features/auth/components/AuthScreen", () => ({ default: () => <p>Login</p> }));
vi.mock("./hooks/useAppSession", () => ({
  useAppSession: () => ({
    session: {
      user: { id: sessionFlags.userId, username: "account" },
      sessionId: sessionFlags.sessionId,
      token: sessionFlags.token,
    },
    sessionRef: { current: null },
    responseCache: { current: null },
    sessionClient: {},
    auth: {},
    saveSession: vi.fn(),
    endSession: vi.fn(),
  }),
}));
vi.mock("./hooks/useInstallPrompt", () => ({
  useInstallPrompt: () => ({ installPrompt: null, setInstallPrompt: vi.fn() }),
}));
vi.mock("./providers/AuthedProviders", () => ({
  default: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock("./AuthedApp", () => {
  function FakeAuthedApp() {
    const [draft, setDraft] = useState("account-specific draft");
    useEffect(() => {
      sessionFlags.mounts += 1;
      return () => { sessionFlags.unmounts += 1; };
    }, []);
    return <button onClick={() => setDraft("changed in previous account")}>{draft}</button>;
  }
  return { default: FakeAuthedApp };
});

const previousAct = (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
afterEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = previousAct;
  vi.restoreAllMocks();
});

describe("signed-in app session boundaries", () => {
  it("keeps local UI state on token refresh but resets it on a new account with the same session ID", () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    sessionFlags.userId = 1;
    sessionFlags.sessionId = "shared-id";
    sessionFlags.token = "token-1";
    sessionFlags.mounts = 0;
    sessionFlags.unmounts = 0;
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    const renderApp = () => act(() => root.render(<MemoryRouter><App /></MemoryRouter>));
    try {
      renderApp();
      act(() => host.querySelector("button")?.click());
      expect(host.textContent).toContain("changed in previous account");
      sessionFlags.token = "token-refreshed";
      renderApp();
      expect(host.textContent).toContain("changed in previous account");
      expect(sessionFlags.mounts).toBe(1);

      sessionFlags.userId = 2;
      renderApp();
      expect(host.textContent).toContain("account-specific draft");
      expect(host.textContent).not.toContain("changed in previous account");
      expect(sessionFlags.mounts).toBe(2);
      expect(sessionFlags.unmounts).toBe(1);
    } finally {
      act(() => root.unmount());
      host.remove();
    }
    expect(sessionFlags.unmounts).toBe(2);
  });
});