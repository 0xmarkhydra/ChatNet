import { expect, it } from "vitest";
import { parseContactReportDetails, parseContactReportReason } from "./contactReportInput";

it("maps each supported report choice to its original API reason", () => {
  expect(parseContactReportReason("1")).toBe("spam");
  expect(parseContactReportReason(" 2 ")).toBe("harassment");
  expect(parseContactReportReason("3")).toBe("impersonation");
  expect(parseContactReportReason("4")).toBe("other");
});

it("rejects inherited object keys and unexpected report choices", () => {
  for (const value of ["__proto__", "constructor", "toString", "0", "5", "1.0", ""]) {
    expect(parseContactReportReason(value)).toBeNull();
  }
});

it("enforces the same 1000-character details limit and normalizes whitespace", () => {
  expect(parseContactReportDetails("  Evidence  ")).toBe("Evidence");
  expect(parseContactReportDetails("x".repeat(1000))).toHaveLength(1000);
  expect(parseContactReportDetails("x".repeat(1001))).toBeNull();
  expect(parseContactReportDetails("   ")).toBe("");
});
