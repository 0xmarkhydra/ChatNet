import { Bell } from "lucide-react";
import type { ToastNotice } from "../../shared/utils/toast";

type AppShellNoticesProps = {
  showPushPrompt: boolean;
  pushBusy: boolean;
  notice: ToastNotice | null;
  onDismissPushPrompt: () => void;
  onEnablePush: () => void;
  onDismissNotice: () => void;
};

/**
 * Pure presentation for the persistent shell's notices.
 * The session/push controllers retain ownership of the state and effects.
 * A fragment preserves the existing siblings and CSS/DOM contract.
 */
export default function AppShellNotices({
  showPushPrompt,
  pushBusy,
  notice,
  onDismissPushPrompt,
  onEnablePush,
  onDismissNotice,
}: AppShellNoticesProps) {
  return (
    <>
      {showPushPrompt && (
        <section className="push-onboarding" aria-label="Thông báo tin nhắn" aria-live="polite">
          <Bell size={22} aria-hidden="true" />
          <strong>Nhận thông báo tin nhắn mới?</strong>
          <div className="push-onboarding-actions">
            <button type="button" onClick={onDismissPushPrompt} disabled={pushBusy}>
              Để sau
            </button>
            <button className="push-onboarding-enable" type="button" onClick={onEnablePush} disabled={pushBusy}>
              Bật thông báo
            </button>
          </div>
        </section>
      )}
      {notice && (
        <div
          className={`notice toast toast-${notice.kind}`}
          role={notice.kind === "error" ? "alert" : "status"}
          aria-live={notice.kind === "error" ? "assertive" : "polite"}
        >
          <span className="toast-icon" aria-hidden="true">
            {notice.kind === "success" ? "✓" : notice.kind === "error" ? "!" : notice.kind === "warning" ? "!" : "i"}
          </span>
          <div className="toast-copy">
            <strong>
              {notice.kind === "success" ? "Thành công" : notice.kind === "error" ? "Có lỗi" : notice.kind === "warning" ? "Lưu ý" : "Thông báo"}
            </strong>
            <span>{notice.message}</span>
          </div>
          <button type="button" aria-label="Đóng thông báo" onClick={onDismissNotice}>
            ×
          </button>
        </div>
      )}
    </>
  );
}
