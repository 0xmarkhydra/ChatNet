import { type PushState, setupOneSignal, disableOneSignalPush, enableOneSignalPush, isPushDisabled } from "../lib/onesignal";
import { persistMessageSoundEnabled, IncomingMessageSound } from "../lib/incomingSound";
import type { InstallPromptEvent } from "../../pwa/types";
import { type Session } from "../../auth/lib/session";
import { type SetStateAction } from "react";
import { type ToastKind } from "../utils/toast";
import type { Dispatch, RefObject } from "react";

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
}: UsePushSettingsDeps) {  async function installApp() {
    if (isStandalone) return;

    if (installPrompt) {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice.outcome === "accepted") {
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
    if (!session?.token || !state.subscriptionId) return;

    const response = await apiFetch("/api/push/subscription", {
      method: state.optedIn ? "POST" : "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subscriptionId: state.subscriptionId }),
    });
    if (!response.ok) throw new Error("Không lưu được đăng ký thông báo.");
  }
  async function sendTestPush(silent = false, force = false) {
    if (!pushConfigured || (!pushEnabled && !force) || (pushBusy && !force))
      return false;

    const response = await apiFetch("/api/push/test", { method: "POST" });
    const result = await response.json().catch(() => ({}));

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
    const played = await messageSound.current?.preview();
    if (!played)
      setNotice(
        "Trình duyệt chưa cho phép phát âm thanh. Hãy thử lại sau khi chạm vào SocCO.",
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
    if (pushBusy) return;

    if (!pushConfigured || !pushAppId) {
      setNotice(
        "Hệ thống thông báo chưa sẵn sàng. Vui lòng thử lại sau vài giây.",
      );
      return;
    }

    if (pushInitFailed) {
      try {
        const state = await setupOneSignal(pushAppId, async (nextState) => {
          setPushEnabled(nextState.optedIn);
          await syncPushState(nextState);
        });
        setPushInitFailed(false);
        setPushEnabled(state.optedIn);
        await syncPushState(state);
      } catch (error) {
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

      setPushEnabled(state.optedIn);
      setPushPrompt(
        state.supported && state.permission === "default" && !isPushDisabled(),
      );
      await syncPushState(state);

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
      setNotice(
        "Không thể bật thông báo. Kiểm tra quyền Notification của trình duyệt/PWA rồi thử lại.",
      );
    } finally {
      setPushBusy(false);
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
