import { parsePostExtras } from "./postExtras";
import type { Post, PublishLocation } from "../types";

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
/** The post's authorized audience receives either its GPS tag or its optional named check-in. */
export function postLocationTag(post: Pick<Post, "visibility" | "publishLocation" | "content">) {
  const gps = post.visibility === "public" ? post.publishLocation : undefined;
  if (gps) return { label: publishLocationTag(gps), title: publishLocationLabel(gps.accuracy), href: "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(`${gps.latitude},${gps.longitude}`), usesGps: true };
  const value = parsePostExtras(post.content).location;
  const name = checkInDisplayName(value);
  const pin = parseMapCheckIn(value);
  return name ? { label: `Đang ở ${name}`, title: pin ? "Mở vị trí đã ghim trên bản đồ" : "Mở bản đồ theo tên địa điểm", href: "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(checkInMapQuery(value)), usesGps: false } : null;
}

// Preserve the existing check-in content format, including on older backend deployments.
export type MapCheckIn = { name: string; latitude: number; longitude: number };
const pinSuffix = / \[map:(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)\]$/;
export function parseMapCheckIn(value: string): MapCheckIn | null {
  const match = value.match(pinSuffix);
  if (!match) return null;
  const latitude = Number(match[1]), longitude = Number(match[2]);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  return { name: value.slice(0, match.index).trim() || "Vị trí đã chọn", latitude, longitude };
}
export function formatMapCheckIn(pin: MapCheckIn): string {
  if (!Number.isFinite(pin.latitude) || !Number.isFinite(pin.longitude) || Math.abs(pin.latitude) > 90 || Math.abs(pin.longitude) > 180) return "";
  const name = pin.name.replace(/[\r\n]+/g, " ").trim().slice(0, 120) || "Vị trí đã chọn";
  return `${name} [map:${pin.latitude.toFixed(6)},${pin.longitude.toFixed(6)}]`;
}
export function checkInDisplayName(value: string): string { return parseMapCheckIn(value)?.name ?? value; }
export function checkInMapQuery(value: string): string {
  const pin = parseMapCheckIn(value);
  return pin ? `${pin.latitude},${pin.longitude}` : value;
}
