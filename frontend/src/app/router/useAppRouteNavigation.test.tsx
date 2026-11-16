// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, useLocation, useNavigate } from "react-router-dom";
import { useAppRouteNavigation, visitorReturnPath } from "./useAppRouteNavigation";

vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
const cleanups: Array<() => void> = [];
afterEach(() => { while (cleanups.length) cleanups.pop()!(); });

function mount(path: string, state?: unknown) {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  let navigation: ReturnType<typeof useAppRouteNavigation>;
  function Probe() {
    navigation = useAppRouteNavigation();
    const location = useLocation();
    const navigate = useNavigate();
    return (
      <>
        <output data-testid="path">{location.pathname + location.search}</output>
        <output data-testid="tab">{navigation.tab}</output>
        <output data-testid="contact">{navigation.contactsScreen}</output>
        <output data-testid="settings">{String(navigation.desktopProfileSettings)}</output>
        <button onClick={() => navigation.setTab("feed")}>Feed</button>
        <button onClick={() => navigation.setTab(current => current === "feed" ? "chat" : "feed")}>Toggle</button>
        <button onClick={() => navigation.setContactsScreen("invitations")}>Invitations</button>
        <button onClick={() => navigation.setContactsScreen("directory")}>Directory</button>
        <button onClick={() => navigation.setDesktopProfileSettings(true)}>Settings</button>
        <button onClick={() => navigation.setDesktopProfileSettings(false)}>Profile</button>
        <button onClick={() => navigation.closeVisitor()}>Close visitor</button>
        <button onClick={() => navigate(-1)}>Back</button>
      </>
    );
  }
  act(() => root.render(
    <MemoryRouter initialEntries={[{ pathname: path, state }]}>
      <Probe />
    </MemoryRouter>,
  ));
  cleanups.push(() => { act(() => root.unmount()); host.remove(); });
  const click = (name: string) => {
    const button = Array.from(host.querySelectorAll("button")).find(item => item.textContent === name);
    if (!button) throw new Error("Missing button " + name);
    act(() => button.click());
  };
  const read = (id: string) => host.querySelector(`[data-testid="${id}"]`)?.textContent;
  return { click, read };
}

describe("URL-owned app navigation", () => {
  it("switches tabs through router and supports functional setter", () => {
    const app = mount("/chat");
    app.click("Feed");
    expect(app.read("path")).toBe("/feed");
    expect(app.read("tab")).toBe("feed");
    app.click("Toggle");
    expect(app.read("path")).toBe("/chat");
    app.click("Back");
    expect(app.read("path")).toBe("/feed");
  });

  it("maps contacts pages and preserves embedded Calls directory", () => {
    const contacts = mount("/contacts");
    contacts.click("Invitations");
    expect(contacts.read("path")).toBe("/contacts/requests");
    expect(contacts.read("contact")).toBe("invitations");
    contacts.click("Directory");
    expect(contacts.read("path")).toBe("/contacts");
    const calls = mount("/calls/translation");
    calls.click("Directory");
    expect(calls.read("path")).toBe("/calls/translation");
    calls.click("Invitations");
    expect(calls.read("path")).toBe("/contacts/requests");
  });

  it("keeps Settings URL ownership including direct subroute", () => {
    const app = mount("/profile");
    app.click("Settings");
    expect(app.read("path")).toBe("/settings");
    expect(app.read("settings")).toBe("true");
    app.click("Profile");
    expect(app.read("path")).toBe("/profile");
    const direct = mount("/settings/devices");
    expect(direct.read("settings")).toBe("true");
    direct.click("Settings");
    expect(direct.read("path")).toBe("/settings/devices");
    direct.click("Profile");
    expect(direct.read("path")).toBe("/profile");
  });

  it("returns from visitor profile to safe internal return location", () => {
    const app = mount("/users/alice", { visitorReturnTo: "/feed/posts/42?tab=feed#comments" });
    app.click("Close visitor");
    expect(app.read("path")).toBe("/feed/posts/42?tab=feed");
    const unsafe = mount("/users/alice", { visitorReturnTo: "//outside.example" });
    unsafe.click("Close visitor");
    expect(unsafe.read("path")).toBe("/profile");
  });
});

describe("visitor return target validation", () => {
  it("accepts internal paths and rejects external or malformed values", () => {
    expect(visitorReturnPath("/feed/posts/42?post=42#comments")).toBe("/feed/posts/42?post=42#comments");
    for (const value of [null, undefined, {}, "https://outside.example", "//outside.example", "/\\outside.example", "/feed\n", "/feed\u0000"]) {
      expect(visitorReturnPath(value)).toBe("/profile");
    }
  });
});
