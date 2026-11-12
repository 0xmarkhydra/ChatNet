import { useEffect, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import type { UserPrivacy } from "../../profile/types";

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
  const [draft, setDraft] = useState<UserPrivacy | null>(privacy);

  useEffect(() => { setDraft(privacy); }, [privacy]);

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

  return (
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
  );
}
