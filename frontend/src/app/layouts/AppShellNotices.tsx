import { translateSystemNotice, useUiTranslation } from '@/shared/i18n/locale'
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
  const trUi = useUiTranslation()

  return (
    <>
      {showPushPrompt && (
        <section className="push-onboarding" aria-label={trUi("common.ui.messageNotifications")} aria-live="polite">
          <Bell size={22} aria-hidden="true" />
          <strong>{trUi("common.ui.messageNotificationPrompt")}</strong>
          <div className="push-onboarding-actions">
            <button type="button" onClick={onDismissPushPrompt} disabled={pushBusy}>{trUi("common.later")}</button>
            <button className="push-onboarding-enable" type="button" onClick={onEnablePush} disabled={pushBusy}>{trUi("common.enableNotice")}</button>
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
              {notice.kind === "success" ? trUi("common.success") : notice.kind === "error" ? trUi("common.error") : notice.kind === "warning" ? trUi("common.warning") : trUi("common.notifications")}
            </strong>
            <span>{translateSystemNotice(notice.message, trUi)}</span>
          </div>
          <button type="button" aria-label={trUi("common.closeNotice")} onClick={onDismissNotice}>
            ×
          </button>
        </div>
      )}
    </>
  );
}
