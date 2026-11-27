// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, useLocation, useNavigate } from "react-router-dom";
import CallCenter from "./CallCenter";

vi.mock("./CallManager", () => ({ CallHeaderActions: () => null }));
const historyMock = vi.hoisted(() => vi.fn(() => new Promise<never>(() => undefined)));
vi.mock("../lib/calls", () => ({ getCallHistory: historyMock }));

const globals = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
const originalAct = globals.IS_REACT_ACT_ENVIRONMENT;
const cleanups: Array<() => void> = [];

beforeEach(() => {
  globals.IS_REACT_ACT_ENVIRONMENT = true;
  historyMock.mockClear();
  const stored = new Map<string, string>();
  vi.stubGlobal("localStorage", { getItem: (key: string) => stored.get(key) ?? null, setItem: (key: string, value: string) => { stored.set(key, value); } });
  vi.stubGlobal("matchMedia", vi.fn(() => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })));
});
afterEach(() => {
  while (cleanups.length) cleanups.pop()!();
  vi.unstubAllGlobals();
  globals.IS_REACT_ACT_ENVIRONMENT = originalAct;
});

function mount(path: string) {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const onDirectoryOpen = vi.fn();
  const request = vi.fn(() => new Promise<Response>(() => undefined));
  function Probe() {
    const location = useLocation();
    const navigate = useNavigate();
    return (
      <>
        <output data-testid="route">{location.pathname}</output>
        <button onClick={() => navigate(-1)}>Browser Back</button>
        <CallCenter
          embedded
          request={request}
          userId={1}
          token="session-token"
          conversations={[]}
          targetLanguage="vi"
          directoryContent={<p>Embedded directory</p>}
          directoryQuery=""
          onDirectoryQueryChange={() => undefined}
          onDirectoryOpen={onDirectoryOpen}
          onNavigate={() => undefined}
          onOpenChat={() => undefined}
        />
      </>
    );
  }
  act(() => root.render(<MemoryRouter initialEntries={[path]}><Probe /></MemoryRouter>));
  cleanups.push(() => { act(() => root.unmount()); host.remove(); });
  const route = () => host.querySelector('[data-testid="route"]')?.textContent;
  const title = () => host.querySelector(".call-center-heading h1")?.textContent;
  const click = (name: string) => {
    const b = Array.from(host.querySelectorAll("button")).find(btn =>
      btn.textContent?.trim() === name || btn.getAttribute("aria-label") === name,
    );
    if (!b) throw new Error("Missing button " + name);
    act(() => b.click());
  };
  return { host, route, title, click, request, onDirectoryOpen };
}

describe("embedded Calls route navigation", () => {
  it("changes URL and restores the selected tab with browser Back", () => {
    const app = mount("/calls/history");
    expect(app.title()).toBe("Lịch sử cuộc gọi");
    app.click("Danh bạ");
    expect(app.route()).toBe("/calls/directory");
    expect(app.title()).toBe("Danh bạ");
    app.click("Dịch AI");
    expect(app.route()).toBe("/calls/translation");
    expect(app.title()).toBe("Cài đặt dịch AI");
    app.click("Browser Back");
    expect(app.route()).toBe("/calls/directory");
    expect(app.title()).toBe("Danh bạ");
    app.click("Dịch AI");
    app.click("Quay lại lịch sử");
    expect(app.route()).toBe("/calls/directory");
    expect(historyMock).toHaveBeenCalledTimes(1);
  });

  it("opens a shareable translation view without routing elsewhere", () => {
    const app = mount("/calls/translation");
    expect(app.title()).toBe("Cài đặt dịch AI");
    app.click("Quay lại lịch sử");
    expect(app.route()).toBe("/calls/history");
  });
});

describe("call history reload", () => {
  it("replaces a load error with loading state on retry, then clears loading on success", async () => {
    let finish: ((items: never) => void) | undefined;
    historyMock
      .mockImplementationOnce(() => Promise.reject(new Error("Mất kết nối")))
      .mockImplementationOnce(() => new Promise<never>(resolve => { finish = resolve; }));
    const app = mount("/calls/history");
    await act(async () => undefined);
    const refresh = () => app.host.querySelector<HTMLButtonElement>(".call-center-refresh")!;
    expect(app.host.querySelector('[role="alert"]')?.textContent).toContain("Mất kết nối");
    expect(refresh().disabled).toBe(false);

    app.click("Thử lại");
    expect(historyMock).toHaveBeenCalledTimes(2);
    expect(app.host.querySelector('[role="alert"]')).toBeNull();
    expect(app.host.textContent).not.toContain("Chưa có cuộc gọi nào");
    expect(refresh().disabled).toBe(true);

    await act(async () => finish!([] as never));
    expect(refresh().disabled).toBe(false);
    expect(app.host.querySelector('[role="alert"]')).toBeNull();
    expect(app.host.textContent).toContain("Chưa có cuộc gọi nào");

    app.click("Tải lại lịch sử");
    expect(historyMock).toHaveBeenCalledTimes(3);
    expect(refresh().disabled).toBe(true);
  });
});
