import { type PushState, setupOneSignal, disableOneSignalPush, enableOneSignalPush, isPushDisabled } from "../lib/onesignal";
import { syncPushSubscription, requestPushTest } from "../api/push";
import { persistMessageSoundEnabled, IncomingMessageSound } from "../lib/incomingSound";
import type { InstallPromptEvent } from "../../pwa";
import { type Session } from "../../../shared/types/session";
import { useEffect, useMemo, useRef, type SetStateAction } from "react";
import { type ToastKind } from "../../../shared/utils/toast";
import type { Dispatch, RefObject } from "react";
import { useLatest } from "../../../shared/hooks/useLatest";
import { desktopBridge, isDesktopBuild } from "../../../platform/desktop";

export type UsePushSettingsDeps = {
  apiFetch: (path: string, init?: RequestInit) => Promise<Response>;
  installPrompt: InstallPromptEvent | null;
  isStandalone: boolean;
  messageSound: RefObject<IncomingMessageSound | null>;
  messageSoundEnabledRef: RefObject<boolean>;
  pushAppId: string;
  pushBusy: boolean;
  pushConfigured: boolean;
  pushEnabled: boolean;
  pushInitFailed: boolean;
  session: Session | null;
  setInstallPrompt: Dispatch<SetStateAction<InstallPromptEvent | null>>;
  setMessageSoundEnabled: Dispatch<SetStateAction<boolean>>;
  setNotice: (message: string, kind?: ToastKind) => void;
  setPushBusy: Dispatch<SetStateAction<boolean>>;
  setPushEnabled: Dispatch<SetStateAction<boolean>>;
  setPushInitFailed: Dispatch<SetStateAction<boolean>>;
  setPushPrompt: Dispatch<SetStateAction<boolean>>;
};

export function usePushSettings({
  apiFetch,
  installPrompt,
  isStandalone,
  messageSound,
  messageSoundEnabledRef,
  pushAppId,
  pushBusy,
  pushConfigured,
  pushEnabled,
  pushInitFailed,
  session,
  setInstallPrompt,
  setMessageSoundEnabled,
  setNotice,
  setPushBusy,
  setPushEnabled,
  setPushInitFailed,
  setPushPrompt,
}: UsePushSettingsDeps) {
  // One visit is distinct even if the user switches A → B → A.
  const sessionVisit = useMemo(() => ({ sessionId: session?.sessionId }), [session?.sessionId]);
  const currentVisit = useLatest(sessionVisit);
  const mountedRef = useRef(false);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);
  const isCurrentSession = (startedVisit: typeof sessionVisit) =>
    mountedRef.current && Boolean(startedVisit.sessionId) && currentVisit.current === startedVisit;

  async function installApp() {
    const startedVisit = sessionVisit;
    if (isStandalone) return;

    if (installPrompt) {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice.outcome === "accepted" && isCurrentSession(startedVisit)) {
        setInstallPrompt(null);
      }
      return;
    }

    const isiOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    setNotice(
      isiOS
        ? "Trên iPhone: bấm Chia sẻ trong Safari → Thêm vào Màn hình chính"
        : "Mở menu trình duyệt → Cài đặt ứng dụng / Add to Home screen",
    );
  }
  async function syncPushState(state: PushState) {
    if (!session?.token || !state.subscriptionId || !isCurrentSession(sessionVisit)) return;

    const response = await syncPushSubscription(apiFetch, state.subscriptionId, state.optedIn);
    if (!response.ok) throw new Error("Không lưu được đăng ký thông báo.");
  }
  async function sendTestPush(silent = false, force = false) {
    const startedVisit = sessionVisit;
    if (!isCurrentSession(startedVisit)) return false;
    if (!pushConfigured || (!pushEnabled && !force) || (pushBusy && !force))
      return false;

    const response = await requestPushTest(apiFetch);
    const result = await response.json().catch(() => ({}));
    if (!isCurrentSession(startedVisit)) return false;

    if (!response.ok) {
      if (!silent) {
        setNotice(
          result.error === "no push subscription registered"
            ? "Thiết bị chưa có Push Subscription hợp lệ."
            : result.error || "Không gửi được thông báo test.",
        );
      }
      return false;
    }

    if (!silent) {
      setNotice(
        `Đã gửi thông báo test tới ${result.recipients || 1} thiết bị.`,
      );
    }
    return true;
  }
  async function previewMessageSound() {
    const startedVisit = sessionVisit;
    let played = false;
    try {
      played = isDesktopBuild
        ? Boolean(startedVisit.sessionId && await desktopBridge().notifications.preview(startedVisit.sessionId))
        : Boolean(await messageSound.current?.preview());
    } catch { /* An unavailable audio device is reported below. */ }
    if (isCurrentSession(startedVisit) && !played)
      setNotice(
        isDesktopBuild
          ? "Desktop không phát được âm báo hệ thống. Kiểm tra thiết bị âm thanh và âm lượng Windows."
          : "Trình duyệt chưa cho phép phát âm thanh. Hãy thử lại sau khi chạm vào SocCO.",
        "warning",
      );
  }
  function toggleMessageSound() {
    const enabled = !messageSoundEnabledRef.current;
    messageSoundEnabledRef.current = enabled;
    setMessageSoundEnabled(enabled);
    persistMessageSoundEnabled(enabled);
    if (enabled) void previewMessageSound();
  }
  async function togglePush() {
    const startedVisit = sessionVisit;
    if (!isCurrentSession(startedVisit) || pushBusy) return;

    if (!pushConfigured || !pushAppId) {
      setNotice(
        "Hệ thống thông báo chưa sẵn sàng. Vui lòng thử lại sau vài giây.",
      );
      return;
    }

    if (pushInitFailed) {
      try {
        const state = await setupOneSignal(pushAppId, async (nextState) => {
          if (!isCurrentSession(startedVisit)) return;
          setPushEnabled(nextState.optedIn);
          await syncPushState(nextState);
        });
        if (!isCurrentSession(startedVisit)) return;
        setPushInitFailed(false);
        setPushEnabled(state.optedIn);
        await syncPushState(state);
        if (!isCurrentSession(startedVisit)) return;
      } catch (error) {
        if (!isCurrentSession(startedVisit)) return;
        const detail = error instanceof Error ? error.message : String(error);
        setNotice(`Không khởi tạo được Push Notification: ${detail}`);
        return;
      }
    }

    const isiOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    if (isiOS && !isStandalone && !pushEnabled) {
      setNotice(
        "Trên iPhone: thêm SocCO vào Màn hình chính trước, rồi mở app và bật thông báo.",
      );
      return;
    }

    setPushBusy(true);
    try {
      const state = pushEnabled
        ? await disableOneSignalPush()
        : await enableOneSignalPush();
      if (!isCurrentSession(startedVisit)) return;

      setPushEnabled(state.optedIn);
      setPushPrompt(
        state.supported && state.permission === "default" && !isPushDisabled(),
      );
      await syncPushState(state);
      if (!isCurrentSession(startedVisit)) return;

      if (state.permission === "denied") {
        setNotice(
          "Thông báo đang bị chặn. Hãy mở cài đặt của trình duyệt/PWA → Notifications → Allow rồi quay lại SocCO.",
        );
      } else if (state.permission === "unsupported") {
        setNotice("Thiết bị hoặc trình duyệt này chưa hỗ trợ Web Push.");
      } else if (!pushEnabled && !state.optedIn) {
        setNotice(
          "Chưa bật được thông báo. Vui lòng thử lại và chọn Cho phép.",
        );
      } else if (state.optedIn) {
        setNotice("Đã bật thông báo SocCO.");
      } else {
        setNotice("Đã tắt thông báo SocCO");
      }
    } catch {
      if (!isCurrentSession(startedVisit)) return;
      setNotice(
        "Không thể bật thông báo. Kiểm tra quyền Notification của trình duyệt/PWA rồi thử lại.",
      );
    } finally {
      if (isCurrentSession(startedVisit)) setPushBusy(false);
    }
  }

  return {
    installApp,
    previewMessageSound,
    sendTestPush,
    syncPushState,
    toggleMessageSound,
    togglePush,
  };
}
