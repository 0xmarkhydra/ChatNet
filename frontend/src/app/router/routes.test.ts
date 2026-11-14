import { describe, expect, it } from "vitest";
import { ROUTE, TAB_PATH, tabFromPath, visitorProfilePath, visitorUsernameFromPath } from "./routes";

describe("app URL routing", () => {
  it("maps every main tab to a stable URL", () => {
    for (const [tab, path] of Object.entries(TAB_PATH)) {
      expect(tabFromPath(path)).toBe(tab);
    }
  });
  it("keeps calls and settings under their parent tabs", () => {
    expect(tabFromPath(ROUTE.calls)).toBe("chat");
    expect(tabFromPath(ROUTE.settings)).toBe("profile");
  });
  it("supports root legacy links without treating unknown URLs as a match", () => {
    expect(tabFromPath("/", "feed")).toBe("feed");
    expect(tabFromPath("/", "contacts")).toBe("contacts");
    expect(tabFromPath("/unknown", "feed")).toBe("chat");
    expect(tabFromPath("/", "unknown")).toBe("chat");
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

  it("matches complete route segments", () => {
    expect(tabFromPath("/feed-extra")).toBe("chat");
    expect(tabFromPath("/chat/123")).toBe("chat");
    expect(tabFromPath("/profile/abc")).toBe("profile");
  });
});
