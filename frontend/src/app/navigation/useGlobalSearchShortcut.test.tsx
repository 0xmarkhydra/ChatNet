// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import { useGlobalSearchShortcut } from "./useGlobalSearchShortcut";

vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
const cleanups: Array<() => void> = [];
afterEach(() => { while (cleanups.length) cleanups.pop()!(); });

function App() {
  useGlobalSearchShortcut();
  const location = useLocation();
  return <output data-testid="route">{location.pathname}</output>;
}

function renderApp() {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  act(() => root.render(<MemoryRouter initialEntries={["/feed"]}><App /></MemoryRouter>));
  cleanups.push(() => {
    act(() => root.unmount());
    container.remove();
  });
  return container;
}

it.each(["ctrlKey", "metaKey"] as const)("opens search with %s + K", (modifier) => {
  const container = renderApp();
  const event = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key: "K", [modifier]: true });
  act(() => window.dispatchEvent(event));
  expect(event.defaultPrevented).toBe(true);
  expect(container.querySelector("output")?.textContent).toBe("/search");
});

it("does not intercept Alt+K or bare K", () => {
  const container = renderApp();
  for (const keys of [{ key: "k" }, { key: "k", ctrlKey: true, altKey: true }]) {
    const event = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...keys });
    act(() => window.dispatchEvent(event));
    expect(event.defaultPrevented).toBe(false);
  }
  expect(container.querySelector("output")?.textContent).toBe("/feed");
});

it("unregisters its keyboard listener on unmount", () => {
  const container = renderApp();
  cleanups.pop()!();
  const event = new KeyboardEvent("keydown", { cancelable: true, key: "k", ctrlKey: true });
  act(() => window.dispatchEvent(event));
  expect(event.defaultPrevented).toBe(false);
  expect(container.isConnected).toBe(false);
});
