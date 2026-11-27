import { useUiTranslation } from '@/shared/i18n/locale'
import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import type { UserPrivacy } from "../../profile";

type Props = {
  privacy: UserPrivacy | null;
  privacyLoading: boolean;
  privacyBusy: boolean;
  privacyError: string;
  onPrivacyRetry: () => void;
  onSavePrivacy: (next: UserPrivacy) => Promise<void>;
};

const privacyKeys = [
  "searchableByUsername", "searchableByName", "searchableByEmail",
  "allowFriendRequests", "showOnlineStatus",
] as const;

export default function PrivacySettingsPanel({ privacy, privacyLoading, privacyBusy, privacyError, onPrivacyRetry, onSavePrivacy }: Props) {
  const trUi = useUiTranslation()

  const [draft, setDraft] = useState<UserPrivacy | null>(privacy);
  const [previousPrivacy, setPreviousPrivacy] = useState(privacy);

  // Reset edits immediately when the server-provided privacy value changes,
  // without an effect that briefly displays a stale draft.
  if (previousPrivacy !== privacy) {
    setPreviousPrivacy(privacy);
    setDraft(privacy);
  }

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
          <option value="everyone">{trUi("common.everyone")}</option>
          <option value="private">{trUi("profile.onlyMe")}</option>
        </select>
        <ChevronDown size={17} aria-hidden="true" />
      </span>
    </label>
  );

  const toggleRow = (label: string, key: keyof UserPrivacy, onText = trUi('common.on')) => (
    <div className="settings-workspace-toggle-row" key={key}>
      <span>{label}</span>
      <div>
        <small>{draft?.[key] ? onText : trUi("common.off")}</small>
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

  return (
          <div className="settings-workspace-privacy">
            <section aria-labelledby="settings-workspace-profile-heading">
              <h3 id="settings-workspace-profile-heading">{trUi('settings.profileVisibility')}</h3>
              <p className="settings-workspace-note">
                {trUi('settings.audienceHint')}
              </p>
              <div className="settings-workspace-audience-list">
                <div className="settings-workspace-audience settings-workspace-audience-readonly">
                  <span>{trUi('settings.postAudience')}</span><span>{trUi('settings.perPost')}</span>
                </div>
                <div className="settings-workspace-audience settings-workspace-audience-readonly">
                  <span>{trUi('settings.storyAudience')}</span><span>{trUi('settings.perStory')}</span>
                </div>
                {audienceRow(trUi('settings.accountSearch'), "searchableByUsername")}
                {audienceRow(trUi('settings.nameSearch'), "searchableByName")}
              </div>
            </section>
            <section aria-labelledby="settings-workspace-connections-heading">
              <h3 id="settings-workspace-connections-heading">{trUi('settings.connections')}</h3>
              <div className="settings-workspace-toggle-list">
                {toggleRow(trUi('settings.allowRequests'), "allowFriendRequests", trUi('settings.fromEveryone'))}
                {toggleRow(trUi('settings.emailSearch'), "searchableByEmail")}
                {toggleRow(trUi('settings.onlineStatus'), "showOnlineStatus")}
              </div>
            </section>

            {privacyError && (
              <div role="alert" className="settings-workspace-error">
                <span>{privacyError === 'Lưu thất bại. Cài đặt trước đó vẫn được giữ.' ? trUi('settings.saveFailed') : privacyError}</span>
                <button type="button" onClick={onPrivacyRetry}>{trUi("common.retry")}</button>
              </div>
            )}
            <footer className="settings-workspace-footer">
              <span aria-live="polite">{changed ? trUi('settings.unsavedChanges') : trUi('settings.savedOnServer')}</span>
              <button type="button" className="settings-workspace-cancel" disabled={!changed || privacyBusy} onClick={() => setDraft(privacy)}>{trUi("common.cancel")}</button>
              <button
                type="button"
                className="settings-workspace-save"
                disabled={!changed || privacyBusy || privacyLoading}
                onClick={() => { if (draft) void onSavePrivacy(draft); }}
              >
                <Check size={16} aria-hidden="true" />{trUi("common.saveChanges")}</button>
            </footer>
          </div>
  );
}