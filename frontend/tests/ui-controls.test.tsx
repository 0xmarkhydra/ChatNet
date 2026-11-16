// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Input } from "../src/shared/ui/input";
import { Textarea } from "../src/shared/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "../src/shared/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../src/shared/ui/dropdown-menu";
import HeaderSearch from "../src/app/header/HeaderSearch";

describe("SocCO shared form controls", () => {
  it("keeps native form semantics, accessibility and caller classes", () => {
    const input = renderToStaticMarkup(<Input type="email" aria-label="Email" disabled className="custom-field" />);
    expect(input).toContain('type="email"');
    expect(input).toContain('aria-label="Email"');
    expect(input).toContain("disabled");
    expect(input).toContain("custom-field");
    expect(input).toContain('data-slot="input"');

    const textarea = renderToStaticMarkup(<Textarea aria-label="Nội dung" rows={3} required />);
    expect(textarea).toContain('data-slot="textarea"');
    expect(textarea).toContain("required");
    expect(textarea).toContain('rows="3"');
  });

  it("retains header search value, query attributes and onChange behavior", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    const onChange = vi.fn();
    const original = (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    try {
      await act(async () => {
        root.render(
          <HeaderSearch
            anchorRef={{ current: null }}
            icon={<span aria-hidden="true">⌕</span>}
            value="xin chào"
            maxLength={120}
            placeholder="Tìm tin nhắn"
            ariaLabel="Tìm kiếm"
            expanded
            controls="search-results"
            onChange={onChange}
          />,
        );
      });
      const input = host.querySelector<HTMLInputElement>('input[type="search"]');
      expect(input?.value).toBe("xin chào");
      expect(input?.getAttribute("data-slot")).toBe("input");
      expect(input?.getAttribute("aria-controls")).toBe("search-results");
      expect(input?.getAttribute("maxlength")).toBe("120");
      await act(async () => {
        if (input) {
          const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
          setter?.call(input, "chào");
          input.dispatchEvent(new Event("input", { bubbles: true }));
        }
      });
      expect(onChange).toHaveBeenCalledWith("chào");
    } finally {
      await act(async () => root.unmount());
      host.remove();
      (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = original;
    }
  });

  it("provides accessible dialog title and description when opened", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    const original = (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    try {
      await act(async () => {
        root.render(
          <Dialog defaultOpen>
            <DialogContent>
              <DialogTitle>Chỉnh sửa hồ sơ</DialogTitle>
              <DialogDescription>Cập nhật tên hiển thị.</DialogDescription>
            </DialogContent>
          </Dialog>,
        );
      });
      expect(document.querySelector('[role="dialog"]')?.textContent).toContain("Chỉnh sửa hồ sơ");
      expect(document.querySelector('[role="dialog"]')?.getAttribute("aria-describedby")).toBeTruthy();
      expect(document.querySelector('button[aria-label="Đóng hộp thoại"]')).not.toBeNull();
    } finally {
      await act(async () => root.unmount());
      host.remove();
      (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = original;
    }
  });

  it("exposes dropdown triggers as native buttons without forcing a menu open", () => {
    const html = renderToStaticMarkup(
      <DropdownMenu>
        <DropdownMenuTrigger aria-label="Tùy chọn">Mở</DropdownMenuTrigger>
        <DropdownMenuContent><DropdownMenuItem>Chỉnh sửa</DropdownMenuItem></DropdownMenuContent>
      </DropdownMenu>,
    );
    expect(html).toContain('aria-haspopup="menu"');
    expect(html).toContain('aria-label="Tùy chọn"');
    expect(html).toContain('type="button"');
  });
});
