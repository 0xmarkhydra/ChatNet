import { describe, expect, it } from "vitest";
import { ROUTE, TAB_PATH, fallbackPathForRoute, feedPostIdFromPath, feedPostPath, tabFromPath, visitorProfilePath, visitorUsernameFromPath } from "./routes";

describe("app URL routing", () => {
  it("maps every main tab to a stable URL", () => {
    for (const [tab, path] of Object.entries(TAB_PATH)) {
      expect(tabFromPath(path)).toBe(tab);
    }
  });
  it("keeps calls and settings under their parent tabs", () => {
    expect(tabFromPath(ROUTE.calls)).toBe("contacts");
    expect(tabFromPath(ROUTE.settings)).toBe("profile");
  });
  it("supports root legacy links without treating unknown URLs as a match", () => {
    expect(tabFromPath("/", "feed")).toBe("feed");
    expect(tabFromPath("/", "contacts")).toBe("contacts");
    expect(tabFromPath("/unknown", "feed")).toBe("chat");
    expect(tabFromPath("/", "unknown")).toBe("chat");
    // These belong to Object.prototype, not to the declared tab registry.
    for (const inherited of ["__proto__", "constructor", "toString", "hasOwnProperty"]) {
      expect(tabFromPath("/", inherited)).toBe("chat");
    }
  });
  it("supports shareable visitor profile URLs and safely rejects malformed paths", () => {
    expect(visitorProfilePath("alice")).toBe("/users/alice");
    expect(visitorProfilePath("a.b")).toBe("/users/a.b");
    expect(visitorUsernameFromPath("/users/alice")).toBe("alice");
    expect(visitorUsernameFromPath("/users/alice/")).toBe("alice");
    expect(visitorUsernameFromPath("/users/a%2Eb")).toBe("a.b");
    for (const path of ["/users", "/users/", "/users/a/b", "/users/%2F", "/users/%E0%A4%A", "/users/%00"]) {
      expect(visitorUsernameFromPath(path)).toBeNull();
    }
    expect(tabFromPath("/users/alice")).toBe("profile");
  });

  it("supports valid shareable feed posts and rejects malformed IDs", () => {
    expect(feedPostPath(42)).toBe("/feed/posts/42");
    expect(feedPostIdFromPath("/feed/posts/42")).toBe(42);
    expect(feedPostIdFromPath("/feed/posts/42/")).toBe(42);
    for (const path of ["/feed", "/feed/posts", "/feed/posts/0", "/feed/posts/abc", "/feed/posts/01", "/feed/posts/9007199254740992", "/feed/posts/42/more"]) {
      expect(feedPostIdFromPath(path)).toBeNull();
    }
    expect(tabFromPath("/feed/posts/42")).toBe("feed");
  });

  it("routes unsupported deep links back to the right parent screen", () => {
    expect(fallbackPathForRoute("/feed/posts/missing")).toBe("/feed");
    expect(fallbackPathForRoute("/profile/missing")).toBe("/profile");
    expect(fallbackPathForRoute("/users/missing/extra")).toBe("/profile");
    expect(fallbackPathForRoute("/settings/missing")).toBe("/settings");
    expect(fallbackPathForRoute("/calls/missing")).toBe("/contacts/calls");
    expect(fallbackPathForRoute("/contacts/missing")).toBe("/contacts");
    expect(fallbackPathForRoute("/discover/missing")).toBe("/discover");
    expect(fallbackPathForRoute("/marketplace/missing")).toBe("/marketplace");
    expect(fallbackPathForRoute("/notifications/missing")).toBe("/notifications");
    expect(fallbackPathForRoute("/random")).toBe("/chat");
    expect(fallbackPathForRoute("/feedish/unknown")).toBe("/chat");
  });

  it("matches complete route segments", () => {
    expect(tabFromPath("/feed-extra")).toBe("chat");
    expect(tabFromPath("/chat/123")).toBe("chat");
    expect(tabFromPath("/profile/abc")).toBe("profile");
  });
});
