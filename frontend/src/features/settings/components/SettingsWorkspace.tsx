import { useEffect, useState, type ReactNode } from "react";
import {
  Bell, Check, ChevronDown, Database, Languages, LockKeyhole, MessageCircle,
  Monitor, Palette, ShieldCheck, UserRound,
} from "lucide-react";
import type { UserPrivacy } from "../../profile/types";

type Section =
  | "account" | "privacy" | "security" | "notifications" | "language"
  | "messages" | "appearance" | "storage" | "devices";

type Props = {
  privacy: UserPrivacy | null;
  privacyLoading: boolean;
  privacyBusy: boolean;
  privacyError: string;
  onPrivacyRetry: () => void;
  onSavePrivacy: (next: UserPrivacy) => Promise<void>;
  account: ReactNode;
  security: ReactNode;
  notifications: ReactNode;
  language: ReactNode;
  messages: ReactNode;
  appearance: ReactNode;
  storage: ReactNode;
  devices: ReactNode;
};

const sections = [
  { id: "account", label: "Thông tin tài khoản", subtitle: "Hồ sơ và thông tin cá nhân", icon: UserRound },
  { id: "privacy", label: "Quyền riêng tư", subtitle: "Kiểm soát dữ liệu và những ai có thể tương tác với bạn.", icon: ShieldCheck },
  { id: "security", label: "Bảo mật & đăng nhập", subtitle: "Quản lý các kết nối và tài khoản bị chặn", icon: LockKeyhole },
  { id: "notifications", label: "Thông báo", subtitle: "Chọn cách bạn nhận thông tin", icon: Bell },
  { id: "language", label: "Ngôn ngữ & dịch AI", subtitle: "Tùy chọn ngôn ngữ hiển thị và bản dịch", icon: Languages },
  { id: "messages", label: "Tin nhắn & cuộc gọi", subtitle: "Âm thanh và trải nghiệm trò chuyện", icon: MessageCircle },
  { id: "appearance", label: "Giao diện", subtitle: "Giao diện và cách hiển thị", icon: Palette },
  { id: "storage", label: "Bộ nhớ & dữ liệu", subtitle: "Dữ liệu của ứng dụng", icon: Database },
  { id: "devices", label: "Thiết bị đăng nhập", subtitle: "Kiểm tra và thu hồi các phiên đăng nhập", icon: Monitor },
] as const;

const privacyKeys = [
  "searchableByUsername", "searchableByName", "searchableByEmail",
  "allowFriendRequests", "showOnlineStatus",
] as const;

export default function SettingsWorkspace({
  privacy, privacyLoading, privacyBusy, privacyError, onPrivacyRetry, onSavePrivacy,
  account, security, notifications, language, messages, appearance, storage, devices,
}: Props) {
  const [selected, setSelected] = useState<Section>("privacy");
  const [draft, setDraft] = useState<UserPrivacy | null>(privacy);

  useEffect(() => { setDraft(privacy); }, [privacy]);

  const currentSection = sections.find((item) => item.id === selected) ?? sections[1];
  const CurrentIcon = currentSection.icon;
  const changed = Boolean(
    privacy && draft && privacyKeys.some((key) => privacy[key] !== draft[key]),
  );
  const setPrivacyField = (key: keyof UserPrivacy, enabled: boolean) => {
    setDraft((previous) => previous ? { ...previous, [key]: enabled } : previous);
  };

  const audienceRow = (label: string, key: keyof UserPrivacy) => (
    <label className="settings-workspace-audience" key={key}>
      <span>{label}</span>
      <span className="settings-workspace-select-wrap">
        <select
          value={draft?.[key] ? "everyone" : "private"}
          disabled={!draft || privacyBusy}
          onChange={(event) => setPrivacyField(key, event.target.value === "everyone")}
          aria-label={label}
        >
          <option value="everyone">Mọi người</option>
          <option value="private">Chỉ mình tôi</option>
        </select>
        <ChevronDown size={17} aria-hidden="true" />
      </span>
    </label>
  );

  const toggleRow = (label: string, key: keyof UserPrivacy, onText = "Bật") => (
    <div className="settings-workspace-toggle-row" key={key}>
      <span>{label}</span>
      <div>
        <small>{draft?.[key] ? onText : "Tắt"}</small>
        <button
          type="button"
          role="switch"
          aria-checked={Boolean(draft?.[key])}
          aria-label={label}
          className={"switch-button" + (draft?.[key] ? " on" : "")}
          disabled={!draft || privacyBusy}
          onClick={() => setPrivacyField(key, !draft?.[key])}
        ><span /></button>
      </div>
    </div>
  );

  const otherContent: Record<Exclude<Section, "privacy">, ReactNode> = {
    account, security, notifications, language, messages, appearance, storage, devices,
  };

  return (
    <div className="settings-workspace" aria-label="Cài đặt tài khoản">
      <aside className="settings-workspace-menu">
        <h2>Cài đặt tài khoản</h2>
        <nav aria-label="Danh mục cài đặt">
          {sections.map(({ id, label, icon: Icon }) => (
            <button
              type="button"
              key={id}
              className={"settings-workspace-nav-item" + (selected === id ? " is-selected" : "")}
              aria-current={selected === id ? "page" : undefined}
              onClick={() => setSelected(id)}
            >
              <Icon size={18} strokeWidth={1.8} aria-hidden="true" />
              <span>{label}</span>
            </button>
          ))}
        </nav>
      </aside>

      <section className="settings-workspace-panel" aria-labelledby="settings-workspace-title">
        <header className="settings-workspace-heading">
          <CurrentIcon size={21} strokeWidth={1.9} aria-hidden="true" />
          <div>
            <h2 id="settings-workspace-title">{currentSection.label}</h2>
            <p>{currentSection.subtitle}</p>
          </div>
        </header>

        {selected === "privacy" ? (
          <div className="settings-workspace-privacy">
            <section aria-labelledby="settings-workspace-profile-heading">
              <h3 id="settings-workspace-profile-heading">Hiển thị hồ sơ</h3>
              <p className="settings-workspace-note">
                Quyền xem bài viết và Story được chọn riêng khi đăng.
              </p>
              <div className="settings-workspace-audience-list">
                <div className="settings-workspace-audience settings-workspace-audience-readonly">
                  <span>Ai xem bài viết?</span><span>Theo từng bài viết</span>
                </div>
                <div className="settings-workspace-audience settings-workspace-audience-readonly">
                  <span>Ai xem Story?</span><span>Theo từng Story</span>
                </div>
                {audienceRow("Ai tìm thấy tài khoản?", "searchableByUsername")}
                {audienceRow("Ai tìm bằng tên hiển thị?", "searchableByName")}
              </div>
            </section>
            <section aria-labelledby="settings-workspace-connections-heading">
              <h3 id="settings-workspace-connections-heading">Tin nhắn & kết nối</h3>
              <div className="settings-workspace-toggle-list">
                {toggleRow("Cho phép lời mời kết bạn", "allowFriendRequests", "Từ mọi người")}
                {toggleRow("Cho phép tìm bằng email", "searchableByEmail")}
                {toggleRow("Hiển thị trạng thái online", "showOnlineStatus")}
              </div>
            </section>

            {privacyError && (
              <div role="alert" className="settings-workspace-error">
                <span>{privacyError}</span>
                <button type="button" onClick={onPrivacyRetry}>Thử lại</button>
              </div>
            )}
            <footer className="settings-workspace-footer">
              <span aria-live="polite">{changed ? "Bạn có thay đổi chưa lưu" : "Cài đặt được lưu trên máy chủ"}</span>
              <button type="button" className="settings-workspace-cancel" disabled={!changed || privacyBusy} onClick={() => setDraft(privacy)}>
                Hủy
              </button>
              <button
                type="button"
                className="settings-workspace-save"
                disabled={!changed || privacyBusy || privacyLoading}
                onClick={() => { if (draft) void onSavePrivacy(draft); }}
              >
                <Check size={16} aria-hidden="true" /> Lưu thay đổi
              </button>
            </footer>
          </div>
        ) : (
          <div className="settings-workspace-content">{otherContent[selected]}</div>
        )}
      </section>
    </div>
  );
}
