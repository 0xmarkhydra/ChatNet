import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Button } from "../src/shared/ui/button";
import { cn } from "../src/shared/lib/utils";

describe("shared SocCO UI foundation", () => {
  it("renders an accessible native button with a non-submitting default type", () => {
    const html = renderToStaticMarkup(<Button aria-label="Lưu thay đổi">Lưu</Button>);
    expect(html).toContain('type="button"');
    expect(html).toContain('aria-label="Lưu thay đổi"');
    expect(html).toContain('data-slot="button"');
    expect(html).toContain("bg-primary");
  });

  it("preserves caller classes and resolves conflicting utilities", () => {
    expect(cn("px-3", "px-6", "custom-class")).toBe("px-6 custom-class");
  });

  it("supports a secondary variant and disabled state", () => {
    const html = renderToStaticMarkup(<Button variant="secondary" disabled>Đang gửi</Button>);
    expect(html).toContain("bg-secondary");
    expect(html).toContain("disabled");
  });
});
