import { describe, expect, it } from "vitest";
import { fallbackPathForRoute, tabFromPath } from "./routes";

/** Guard deep-link recovery independently of the layout and domain UI. */
describe("route fallback and navigation ownership", () => {
  it.each([
    ["/feed/unknown", "/feed", "feed"],
    ["/profile/unknown", "/profile", "profile"],
    ["/users/unknown/extra", "/profile", "profile"],
    ["/settings/unknown/extra", "/settings", "profile"],
    ["/calls/unknown", "/contacts/calls", "contacts"],
    ["/contacts/unknown", "/contacts", "contacts"],
    ["/discover/unknown", "/discover", "discover"],
    ["/search/unknown", "/discover", "discover"],
    ["/marketplace/unknown", "/marketplace", "market"],
    ["/notifications/unknown", "/notifications", "notifications"],
    ["/chat/unknown", "/chat", "chat"],
    ["/unexpected", "/chat", "chat"],
  ] as const)("keeps %s in its owning area", (path, fallback, tab) => {
    expect(fallbackPathForRoute(path)).toBe(fallback);
    expect(tabFromPath(path)).toBe(tab);
  });

  it.each(["__proto__", "constructor", "toString", "hasOwnProperty"])(
    "does not interpret %s as a legacy tab", (legacyTab) => {
      expect(tabFromPath("/", legacyTab)).toBe("chat");
    },
  );
});
