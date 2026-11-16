// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useInstallPrompt } from "./useInstallPrompt";
import type { InstallPromptEvent } from "../../features/pwa/types";

describe("useInstallPrompt", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("captures the sign-in-time install event and clears it after installation", () => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    let current: InstallPromptEvent | null = null;
    function Probe() {
      current = useInstallPrompt().installPrompt;
      return null;
    }

    act(() => root.render(<Probe />));
    expect(current).toBeNull();

    const prompt = new Event("beforeinstallprompt", { cancelable: true });
    act(() => window.dispatchEvent(prompt));
    expect(prompt.defaultPrevented).toBe(true);
    expect(current).toBe(prompt);

    act(() => window.dispatchEvent(new Event("appinstalled")));
    expect(current).toBeNull();

    act(() => root.unmount());
    container.remove();
  });
});
