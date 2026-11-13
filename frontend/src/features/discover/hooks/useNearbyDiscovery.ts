import { getCurrentPositionSmart, geolocationErrorMessage } from "../lib/geolocation";
import type { FriendSearchResult } from "../../contacts/types";
import { type Session } from "../../auth/lib/session";
import { type SetStateAction } from "react";
import { type ToastKind } from "../../../shared/utils/toast";
import type { Dispatch, RefObject } from "react";

export type UseNearbyDiscoveryDeps = {
  apiFetch: (path: string, init?: RequestInit) => Promise<Response>;
  nearbyBusy: boolean;
  nearbyRadiusKm: number;
  nearbyRequest: RefObject<number>;
  session: Session | null;
  sessionRef: RefObject<Session | null>;
  setNearbyBusy: Dispatch<SetStateAction<boolean>>;
  setNearbyResultRadiusKm: Dispatch<SetStateAction<number>>;
  setNearbyScanning: Dispatch<SetStateAction<boolean>>;
  setNearbyUntil: Dispatch<SetStateAction<number>>;
  setNearbyUsers: Dispatch<SetStateAction<FriendSearchResult[]>>;
  setNotice: (message: string, kind?: ToastKind) => void;
};

export function useNearbyDiscovery({
  apiFetch,
  nearbyBusy,
  nearbyRadiusKm,
  nearbyRequest,
  session,
  sessionRef,
  setNearbyBusy,
  setNearbyResultRadiusKm,
  setNearbyScanning,
  setNearbyUntil,
  setNearbyUsers,
  setNotice,
}: UseNearbyDiscoveryDeps) {
  async function findNearby() {
    if (!session || nearbyBusy) return;
    const request = ++nearbyRequest.current;
    const sessionId = session.sessionId;
    const isCurrentRequest = () =>
      request === nearbyRequest.current &&
      sessionRef.current?.sessionId === sessionId;
    setNearbyBusy(true);
    setNearbyScanning(true);
    try {
      const position = await getCurrentPositionSmart();
      if (!isCurrentRequest()) return;
      const { latitude, longitude } = position.coords;
      if (
        !Number.isFinite(latitude) ||
        !Number.isFinite(longitude) ||
        Math.abs(latitude) > 85.05112878 ||
        Math.abs(longitude) > 180
      ) {
        throw new Error(
          "Tọa độ trình duyệt không hợp lệ. Kiểm tra Latitude (vĩ độ) và Longitude (kinh độ) trong cài đặt vị trí giả lập nếu đang dùng.",
        );
      }
      const response = await apiFetch("/api/users/nearby", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          latitude,
          longitude,
          radiusKm: nearbyRadiusKm,
        }),
      });
      if (!isCurrentRequest()) return;
      if (!response.ok)
        throw new Error(
          response.status === 429
            ? "Chờ 10 giây trước khi tìm lại."
            : "Không tìm được bạn quanh đây. Thử lại sau.",
        );
      const result = (await response.json()) as {
        users: FriendSearchResult[];
        expiresAt: string;
        cacheExpiresAt?: string;
        radiusKm?: number;
      };
      if (!isCurrentRequest()) return;
      setNearbyUsers(result.users);
      setNearbyResultRadiusKm(nearbyRadiusKm);
      setNearbyUntil(Date.parse(result.expiresAt));
      setNotice(
        result.users.length
          ? `Quét thành công: tìm thấy ${result.users.length} người trong bán kính ${nearbyRadiusKm} km.`
          : `Quét thành công nhưng chưa tìm thấy người dùng trong bán kính ${nearbyRadiusKm} km.`,
        result.users.length ? "success" : "info",
      );
    } catch (error) {
      if (!isCurrentRequest()) return;
      const message = await geolocationErrorMessage(error);
      if (isCurrentRequest()) setNotice(message, "error");
    } finally {
      if (isCurrentRequest()) {
        setNearbyBusy(false);
        setNearbyScanning(false);
      }
    }
  }
  async function stopNearby() {
    if (!session || nearbyBusy) return;
    const request = ++nearbyRequest.current;
    const sessionId = session.sessionId;
    const isCurrentRequest = () =>
      request === nearbyRequest.current && sessionRef.current?.sessionId === sessionId;
    setNearbyBusy(true);
    try {
      const response = await apiFetch("/api/users/nearby", {
        method: "DELETE",
      });
      if (!isCurrentRequest()) return;
      if (!response.ok)
        throw new Error("Chưa tắt được Quanh đây. Thử lại sau.");
      setNearbyUntil(0);
      setNearbyUsers([]);
      setNotice("Đã tắt Quanh đây và xóa cache vị trí gần nhất.", "success");
    } catch (error) {
      if (!isCurrentRequest()) return;
      setNotice(
        error instanceof Error
          ? error.message
          : "Mất kết nối. Chưa xác nhận đã tắt Quanh đây.",
        "error",
      );
    } finally {
      if (isCurrentRequest()) setNearbyBusy(false);
    }
  }

  return {
    findNearby,
    stopNearby,
  };
}
