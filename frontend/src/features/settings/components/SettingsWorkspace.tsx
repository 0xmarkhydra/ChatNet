import { useState, type ReactNode } from "react";
import {
  Bell, Database, Languages, LockKeyhole, MessageCircle,
  Monitor, Palette, ShieldCheck, UserRound,
} from "lucide-react";
import type { UserPrivacy } from "../../profile/types";
import PrivacySettingsPanel from "./PrivacySettingsPanel";

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


export default function SettingsWorkspace({
  privacy, privacyLoading, privacyBusy, privacyError, onPrivacyRetry, onSavePrivacy,
  account, security, notifications, language, messages, appearance, storage, devices,
}: Props) {
  const [selected, setSelected] = useState<Section>("privacy");
  const currentSection = sections.find((item) => item.id === selected) ?? sections[1];
  const CurrentIcon = currentSection.icon;

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
          <PrivacySettingsPanel privacy={privacy} privacyLoading={privacyLoading} privacyBusy={privacyBusy} privacyError={privacyError} onPrivacyRetry={onPrivacyRetry} onSavePrivacy={onSavePrivacy} />
        ) : (
          <div className="settings-workspace-content">{otherContent[selected]}</div>
        )}
      </section>
    </div>
  );
}