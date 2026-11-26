import { expect, it } from "vitest";
import { contactApiError } from "./contactApiError";

it("preserves a meaningful server error message", () => {
  expect(contactApiError({ error: "Không có quyền" }, "Lỗi")).toBe("Không có quyền");
});

it("never passes an object, array or number into the UI notice", () => {
  const fallback = "Không thể cập nhật liên hệ";
  for (const payload of [
    null, false, [], { error: ["bad"] }, { error: { message: "bad" } },
    { error: 403 }, { error: "" }, { error: "  " }, {},
  ]) {
    expect(contactApiError(payload, fallback)).toBe(fallback);
  }
});

it("does not accept inherited object properties as response errors", () => {
  expect(contactApiError(Object.create({ error: "inherited" }), "Fallback")).toBe("Fallback");
});
