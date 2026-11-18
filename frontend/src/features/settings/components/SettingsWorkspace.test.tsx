// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, useLocation, useNavigate } from "react-router-dom";
import SettingsWorkspace from "./SettingsWorkspace";

vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
const cleanups: Array<() => void> = [];

function mount(path = "/settings") {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  function Probe() {
    const location = useLocation();
    const navigate = useNavigate();
    return (
      <>
        <output data-testid="pathname">{location.pathname}</output>
        <button onClick={() => navigate(-1)}>Back</button>
        <SettingsWorkspace
          privacy={null}
          privacyLoading={false}
          privacyBusy={false}
          privacyError=""
          onPrivacyRetry={() => undefined}
          onSavePrivacy={async () => undefined}
          account={<p>Account content</p>}
          security={<p>Security content</p>}
          notifications={<p>Notifications content</p>}
          language={<p>Language content</p>}
          messages={<p>Messages content</p>}
          appearance={<p>Appearance content</p>}
          storage={<p>Storage content</p>}
          devices={<p>Devices content</p>}
        />
      </>
    );
  }
  act(() => root.render(<MemoryRouter initialEntries={[path]}><Probe /></MemoryRouter>));
  cleanups.push(() => {
    act(() => root.unmount());
    host.remove();
  });
  const click = (label: string) => {
    const button = Array.from(host.querySelectorAll("button")).find(el => el.textContent?.includes(label));
    if (!button) throw new Error("Missing " + label);
    act(() => button.click());
  };
  const pathname = () => host.querySelector('[data-testid="pathname"]')?.textContent;
  const selected = () => host.querySelector('nav [aria-current="page"]')?.textContent;
  return { host, click, pathname, selected };
}

afterEach(() => { while (cleanups.length) cleanups.pop()!(); });

describe("SettingsWorkspace router navigation", () => {
  it("starts on privacy, navigates sections and supports browser Back", () => {
    const page = mount();
    expect(page.pathname()).toBe("/settings");
    expect(page.selected()).toContain("Quyền riêng tư");
    page.click("Thiết bị đăng nhập");
    expect(page.pathname()).toBe("/settings/devices");
    expect(page.host.textContent).toContain("Devices content");
    page.click("Thông báo");
    expect(page.pathname()).toBe("/settings/notifications");
    page.click("Back");
    expect(page.pathname()).toBe("/settings/devices");
    expect(page.selected()).toContain("Thiết bị đăng nhập");
    page.click("Quyền riêng tư");
    expect(page.pathname()).toBe("/settings");
  });

  it("renders a directly shared Settings section", () => {
    const page = mount("/settings/security");
    expect(page.selected()).toContain("Bảo mật & đăng nhập");
    expect(page.host.textContent).toContain("Security content");
  });
});
