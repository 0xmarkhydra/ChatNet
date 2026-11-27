import type { ReactNode } from "react";
import { UI_MESSAGES, type UIMessageKey } from "../../i18n";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Bell, Database, Languages, LockKeyhole, MessageCircle,
  Monitor, Palette, ShieldCheck, UserRound,
} from "lucide-react";
import type { UserPrivacy } from "../../profile";
import PrivacySettingsPanel from "./PrivacySettingsPanel";

export type Section =
  | "account" | "privacy" | "security" | "notifications" | "language"
  | "messages" | "appearance" | "storage" | "devices";

type Props = {
  t?: (key: UIMessageKey) => string;
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

export const SETTINGS_SECTIONS = [
  { id: "account", label: "settings.account", subtitle: "settings.accountHint", icon: UserRound },
  { id: "privacy", label: "settings.privacy", subtitle: "settings.privacyHint", icon: ShieldCheck },
  { id: "security", label: "settings.security", subtitle: "settings.securityHint", icon: LockKeyhole },
  { id: "notifications", label: "settings.notifications", subtitle: "settings.notificationsHint", icon: Bell },
  { id: "language", label: "settings.language", subtitle: "settings.languageHint", icon: Languages },
  { id: "messages", label: "settings.messages", subtitle: "settings.messagesHint", icon: MessageCircle },
  { id: "appearance", label: "settings.appearance", subtitle: "settings.appearanceHint", icon: Palette },
  { id: "storage", label: "settings.storage", subtitle: "settings.storageHint", icon: Database },
  { id: "devices", label: "settings.devices", subtitle: "settings.devicesHint", icon: Monitor },
] as const;


export default function SettingsWorkspace({
  t = key => UI_MESSAGES[key], privacy, privacyLoading, privacyBusy, privacyError, onPrivacyRetry, onSavePrivacy,
  account, security, notifications, language, messages, appearance, storage, devices,
}: Props) {
  const location = useLocation();
  const navigate = useNavigate();
  const segment = location.pathname.startsWith("/settings/")
    ? location.pathname.slice("/settings/".length).replace(/\/$/, "")
    : "privacy";
  const selected: Section = SETTINGS_SECTIONS.some((item) => item.id === segment)
    ? segment as Section : "privacy";
  const currentSection = SETTINGS_SECTIONS.find((item) => item.id === selected) ?? SETTINGS_SECTIONS[1];
  const CurrentIcon = currentSection.icon;

  const otherContent: Record<Exclude<Section, "privacy">, ReactNode> = {
    account, security, notifications, language, messages, appearance, storage, devices,
  };

  return (
    <div className="settings-workspace" aria-label={t("settings.title")}>
      <aside className="settings-workspace-menu">
        <h2>{t("settings.title")}</h2>
        <nav aria-label={t("settings.categories")}>
          {SETTINGS_SECTIONS.map(({ id, label, icon: Icon }) => (
            <button
              type="button"
              key={id}
              className={"settings-workspace-nav-item" + (selected === id ? " is-selected" : "")}
              aria-current={selected === id ? "page" : undefined}
              onClick={() => navigate(id === "privacy" ? "/settings" : `/settings/${id}`)}
            >
              <Icon size={18} strokeWidth={1.8} aria-hidden="true" />
              <span>{t(label)}</span>
            </button>
          ))}
        </nav>
      </aside>

      <section className="settings-workspace-panel" aria-labelledby="settings-workspace-title">
        <header className="settings-workspace-heading">
          <CurrentIcon size={21} strokeWidth={1.9} aria-hidden="true" />
          <div>
            <h2 id="settings-workspace-title">{t(currentSection.label)}</h2>
            <p>{t(currentSection.subtitle)}</p>
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