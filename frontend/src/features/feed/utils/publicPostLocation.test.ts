// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { capturePublicPostLocation, publishLocationLabel, toPublishLocation, locationPlaceName, publishLocationTag , postLocationTag } from "./publicPostLocation";
const now = Date.now();
const position = (accuracy: number, timestamp = now) => ({ coords: { latitude: 21, longitude: 105, accuracy }, timestamp } as GeolocationPosition);
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
function mockLocation() {
  vi.useFakeTimers();
  vi.setSystemTime(now);
  let high!: PositionCallback;
  let low!: PositionCallback;
  const clearWatch = vi.fn();
  vi.stubGlobal("isSecureContext", true);
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ locality: "Cầu Giấy", city: "Hà Nội" }) }));
  vi.stubGlobal("navigator", { geolocation: {
    watchPosition: (cb: PositionCallback) => { high = cb; return 1; },
    getCurrentPosition: (cb: PositionCallback) => { low = cb; },
    clearWatch,
  }});
  return { high: (a: number) => high(position(a)), low: (a: number) => low(position(a)), clearWatch };
}
describe("public post location", () => {
  it("accepts fresh precise and approximate fixes", () => {
    expect(toPublishLocation(position(10), now)?.accuracy).toBe(10);
    expect(toPublishLocation(position(1200), now)?.accuracy).toBe(1200);
    expect(publishLocationLabel(1200)).toContain("Vị trí đăng · ±1.2 km");
  });
  it("rejects invalid and stale fixes", () => {
    expect(toPublishLocation(position(0), now)).toBeNull();
    expect(toPublishLocation(position(Infinity), now)).toBeNull();
    expect(toPublishLocation(position(5, now - 121000), now)).toBeNull();
    expect(toPublishLocation(position(5, now + 16000), now)).toBeNull();
  });
  it("uses the network fix after a short improvement window", async () => {
    const geo = mockLocation();
    const result = capturePublicPostLocation();
    geo.low(1500);
    geo.high(120);
    await vi.advanceTimersByTimeAsync(5000);
    expect((await result).accuracy).toBe(120);
    expect(geo.clearWatch).toHaveBeenCalledWith(1);
  });
  it("returns immediately when precise GPS arrives", async () => {
    const geo = mockLocation();
    const result = capturePublicPostLocation();
    geo.low(1500);
    geo.high(8);
    expect((await result).accuracy).toBe(8);
  });
});
it("formats a map tag and uses broader names for coarse coordinates", () => {
  const data = { locality: "Cầu Giấy", city: "Hà Nội", principalSubdivision: "Hà Nội", countryName: "Việt Nam" };
  expect(locationPlaceName(data, 120)).toBe("Cầu Giấy, Hà Nội");
  expect(locationPlaceName(data, 60000)).toBe("Hà Nội, Việt Nam");
  const location = toPublishLocation(position(10), now)!;
  expect(publishLocationTag({...location, placeName: "Hà Nội"})).toBe("Hà Nội");
  expect(publishLocationTag(location)).toBe("21.000000, 105.000000");
});
it("shows optional named check-ins for friends and private posts, with no duplicate GPS source", () => {
  for (const visibility of ["friends", "private"] as const) {
    const tag = postLocationTag({ visibility, content: "📍 Hồ Hoàn Kiếm, Hà Nội\nHello" });
    expect(tag?.label).toBe("Hồ Hoàn Kiếm, Hà Nội");
    expect(tag?.href).toContain(encodeURIComponent("Hồ Hoàn Kiếm, Hà Nội"));
    expect(postLocationTag({ visibility, content: "Hello" })).toBeNull();
  }
  const tag = postLocationTag({ visibility: "public", content: "📍 Check-in", publishLocation: { latitude: 21, longitude: 105, accuracy: 1200, capturedAt: new Date().toISOString(), placeName: "Hà Nội" } });
  expect(tag?.label).toBe("Hà Nội");
  expect(tag?.href).toContain("21%2C105");
});