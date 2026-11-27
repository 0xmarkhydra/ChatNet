// @vitest-environment jsdom
import { act, useState } from "react";
import type { UIMessageKey } from "../../i18n";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, useLocation, useNavigate } from "react-router-dom";
import SettingsWorkspace from "./SettingsWorkspace";
import PrivacySettingsPanel from "./PrivacySettingsPanel";
import HeaderTitle from "../../../app/header/HeaderTitle";
import { UiLocaleContext } from "../../../shared/i18n/locale";

vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
const cleanups: Array<() => void> = [];

function mount(path = "/settings") {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  function Probe() {
    const location = useLocation();
    const navigate = useNavigate();
    const [english, setEnglish] = useState(false);
    const labels: Partial<Record<UIMessageKey, string>> = { "settings.language": "Language & AI translation", "settings.languageHint": "Interface and translation preferences", "settings.title": "Account settings" };
    return (
      <>
        <output data-testid="pathname">{location.pathname}</output>
        <button onClick={() => navigate(-1)}>Back</button>
        <button onClick={() => setEnglish(true)}>Switch language</button>
        <SettingsWorkspace
          t={english ? key => labels[key] ?? key : undefined}
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

  it("updates the active section when interface language changes", () => {
    const page = mount("/settings/language");
    expect(page.selected()).toContain("Ngôn ngữ & dịch AI");
    page.click("Switch language");
    expect(page.selected()).toContain("Language & AI translation");
    expect(page.host.textContent).toContain("Interface and translation preferences");
    expect(page.pathname()).toBe("/settings/language");
  });

  it("renders a directly shared Settings section", () => {
    const page = mount("/settings/security");
    expect(page.selected()).toContain("Bảo mật & đăng nhập");
    expect(page.host.textContent).toContain("Security content");
  });
});
it("localizes privacy fields and both page headers in all five locales without resetting draft", () => {
  const host = document.createElement("div");
  const root = createRoot(host);
  const privacy = { searchableByUsername: true, searchableByName: true, searchableByEmail: true, allowFriendRequests: true, showOnlineStatus: true };
  const render = (locale: string) => act(() => root.render(<UiLocaleContext.Provider value={{ locale }}>
    <HeaderTitle tab="profile" desktopSection={null} translationSettingsOpen={false} groupWorkspaceMode="list" groupCreateStep={1}
      contactsDirectory={false} profileSettings profileDesktop profileEditing={false} />
    <HeaderTitle tab="notifications" desktopSection={null} translationSettingsOpen={false} groupWorkspaceMode="list" groupCreateStep={1}
      contactsDirectory={false} profileSettings={false} profileDesktop profileEditing={false} />
    <PrivacySettingsPanel privacy={privacy} privacyLoading={false} privacyBusy={false} privacyError=""
      onPrivacyRetry={() => {}} onSavePrivacy={async () => {}} />
  </UiLocaleContext.Provider>));
  try {
    render("vi");
    act(() => (host.querySelector('[role="switch"]') as HTMLButtonElement).click());
    for (const [locale, title, notice, profile, request, unsaved] of [
      ["vi", "Cài đặt", "Thông báo", "Hiển thị hồ sơ", "Cho phép lời mời kết bạn", "Bạn có thay đổi chưa lưu"],
      ["en", "Settings", "Notifications", "Profile visibility", "Allow friend requests", "You have unsaved changes"],
      ["zh", "设置", "通知", "个人主页可见性", "允许好友请求", "你有未保存的更改"],
      ["ja", "設定", "通知", "プロフィールの公開範囲", "友達リクエストを許可", "未保存の変更があります"],
      ["ko", "설정", "알림", "프로필 공개 범위", "친구 요청 허용", "저장하지 않은 변경 사항이 있습니다"],
    ]) {
      render(locale);
      expect(Array.from(host.querySelectorAll(".app-page-heading strong"), el => el.textContent)).toEqual([title, notice]);
      expect(host.querySelector("#settings-workspace-profile-heading")?.textContent).toBe(profile);
      expect(host.querySelector('[role="switch"]')?.getAttribute("aria-label")).toBe(request);
      expect(host.querySelector('[role="switch"]')?.getAttribute("aria-checked")).toBe("false");
      expect(host.textContent).toContain(unsaved);
    }
  } finally { act(() => root.unmount()); }
});
