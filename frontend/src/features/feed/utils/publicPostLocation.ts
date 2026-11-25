import type { PublishLocation } from "../types";

const TARGET_ACCURACY = 10;
const IMPROVEMENT_MS = 5000;
const CAPTURE_MS = 20000;

export function toPublishLocation(position: GeolocationPosition, now = Date.now()): PublishLocation | null {
  const { latitude, longitude, accuracy } = position.coords;
  if (![latitude, longitude, accuracy, position.timestamp].every(Number.isFinite) ||
    Math.abs(latitude) > 90 || Math.abs(longitude) > 180 || accuracy <= 0 || accuracy > 20040000 ||
    now - position.timestamp > 120000 || position.timestamp - now > 15000) return null;
  return { latitude, longitude, accuracy, capturedAt: new Date(position.timestamp).toISOString() };
}

export function publishLocationLabel(accuracy: number): string {
  const distance = accuracy >= 1000 ? `${Math.ceil(accuracy / 100) / 10} km` : `${Math.ceil(accuracy)} m`;
  return `📍 Vị trí đăng · ±${distance}`;
}

function captureCoordinates(): Promise<PublishLocation> {
  return new Promise((resolve, reject) => {
    if (!window.isSecureContext || !navigator.geolocation) {
      reject(new Error("Cần HTTPS và quyền định vị để đăng bài công khai."));
      return;
    }
    let watch: number | undefined;
    let improvementTimer: ReturnType<typeof setTimeout> | undefined;
    let best: PublishLocation | undefined;
    let done = false;
    const finish = (message?: string) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      clearTimeout(improvementTimer);
      if (watch !== undefined) navigator.geolocation.clearWatch(watch);
      if (message) reject(new Error(message));
      else if (best) resolve(best);
      else reject(new Error("Không xác định được vị trí. Hãy bật dịch vụ vị trí, Wi-Fi hoặc dữ liệu di động và thử lại."));
    };
    const timer = setTimeout(() => finish(), CAPTURE_MS);
    const accept = (position: GeolocationPosition) => {
      if (done) return;
      const location = toPublishLocation(position);
      if (!location) return;
      if (!best || location.accuracy < best.accuracy) best = location;
      if (best.accuracy <= TARGET_ACCURACY) finish();
      else if (improvementTimer === undefined) improvementTimer = setTimeout(() => finish(), IMPROVEMENT_MS);
    };
    const fail = (error: GeolocationPositionError) => {
      if (error.code === 1) finish("Bạn cần cấp quyền vị trí để đăng bài công khai.");
      // A timeout/unavailable error from one provider does not cancel the other.
    };
    try {
      watch = navigator.geolocation.watchPosition(accept, fail, { enableHighAccuracy: true, maximumAge: 0, timeout: CAPTURE_MS });
      if (done) navigator.geolocation.clearWatch(watch);
      else navigator.geolocation.getCurrentPosition(accept, fail, { enableHighAccuracy: false, maximumAge: 0, timeout: CAPTURE_MS });
    } catch {
      if (watch === undefined && !best) finish("Không thể lấy vị trí hiện tại.");
    }
  });
}

// Resolve only the publishing device's current coordinates, never stored posts.
export function locationPlaceName(data: Record<string, unknown>, accuracy: number): string {
  const keys = accuracy > 50000 ? ["principalSubdivision", "countryName"] :
    accuracy > 10000 ? ["city", "principalSubdivision", "countryName"] :
    ["locality", "city", "principalSubdivision", "countryName"];
  const names = keys.map(key => typeof data[key] === "string" ? (data[key] as string).trim() : "")
    .filter(Boolean);
  return Array.from(new Set(names)).slice(0, 2).join(", ").slice(0, 160);
}

export async function resolvePublishPlace(location: PublishLocation): Promise<PublishLocation> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3500);
  try {
    const query = new URLSearchParams({ latitude: String(location.latitude), longitude: String(location.longitude), localityLanguage: "vi" });
    const response = await fetch("https://api.bigdatacloud.net/data/reverse-geocode-client?" + query, { signal: controller.signal, credentials: "omit", referrerPolicy: "no-referrer" });
    if (!response.ok) return location;
    const data = await response.json();
    const placeName = data && typeof data === "object" ? locationPlaceName(data, location.accuracy) : "";
    return placeName ? { ...location, placeName } : location;
  } catch {
    return location;
  } finally {
    clearTimeout(timer);
  }
}

export async function capturePublicPostLocation(): Promise<PublishLocation> {
  return resolvePublishPlace(await captureCoordinates());
}

export function publishLocationTag(location: PublishLocation): string {
  const name = location.placeName?.trim();
  return name ? `Đang ở ${name}` : "Đang ở vị trí đã chia sẻ";
}