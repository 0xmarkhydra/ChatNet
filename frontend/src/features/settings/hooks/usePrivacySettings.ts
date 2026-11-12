import { useState, useEffect } from "react";
import type { UserPrivacy } from "../../profile/types";
import { type Session } from "../../auth/lib/session";

export type UsePrivacySettingsDeps = {
  apiFetch: (path: string, init?: RequestInit) => Promise<Response>;
  session: Session | null;
};

export function usePrivacySettings({
  apiFetch,
  session,
}: UsePrivacySettingsDeps) {
  const [privacy, setPrivacy] = useState<UserPrivacy | null>(null);
  const [privacyBusy, setPrivacyBusy] = useState(false);
  const [privacyLoading, setPrivacyLoading] = useState(false);
  const [privacyError, setPrivacyError] = useState("");
  const [privacyRetry, setPrivacyRetry] = useState(0);
  useEffect(() => {
    if (!session?.token) {
      setPrivacy(null);
      setPrivacyBusy(false);
      setPrivacyError("");
      setPrivacyLoading(false);
      return;
    }
    const controller = new AbortController();
    setPrivacy(null);
    setPrivacyBusy(false);
    setPrivacyLoading(true);
    setPrivacyError("");
    apiFetch("/api/privacy", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Không thể tải quyền riêng tư.");
        return response.json() as Promise<UserPrivacy>;
      })
      .then((value) => {
        if (!controller.signal.aborted) setPrivacy(value);
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setPrivacyError("Không thể tải cài đặt riêng tư.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setPrivacyLoading(false);
      });
    return () => controller.abort();
  }, [session?.sessionId, privacyRetry]);

  return {
    privacy,
    privacyBusy,
    privacyError,
    privacyLoading,
    setPrivacy,
    setPrivacyBusy,
    setPrivacyError,
    setPrivacyRetry,
  };
}
