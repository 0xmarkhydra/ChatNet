import { describe, expect, it } from "vitest";
import { ROUTE, TAB_PATH, tabFromPath } from "./routes";

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
  it("matches complete route segments", () => {
    expect(tabFromPath("/feed-extra")).toBe("chat");
    expect(tabFromPath("/chat/123")).toBe("chat");
    expect(tabFromPath("/profile/abc")).toBe("profile");
  });
});
