import { expect, it } from "vitest";
import { resolveDesktopSection } from "./resolveDesktopSection";

it("selects calls for calls routes and their descendants", () => {
  expect(resolveDesktopSection("/calls", null)).toBe("calls");
  expect(resolveDesktopSection("/calls/123", "groups")).toBe("calls");
});

it("never leaks stale calls panel state onto another route", () => {
  expect(resolveDesktopSection("/feed", "calls")).toBeNull();
  expect(resolveDesktopSection("/contacts", "groups")).toBe("groups");
  expect(resolveDesktopSection("/calls-other", null)).toBeNull();
});
