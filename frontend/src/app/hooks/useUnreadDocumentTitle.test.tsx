// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { useUnreadDocumentTitle } from "./useUnreadDocumentTitle";

const previousAct = (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
const APP_TITLE = "SocCO – Understand. Connect. Together.";
afterEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = previousAct;
  document.title = "";
});

describe("useUnreadDocumentTitle", () => {
  it("updates the unread count, caps at 99+ and restores the base title on cleanup", () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    function Probe({ count }: { count: number | null }) {
      useUnreadDocumentTitle(count);
      return null;
    }
    try {
      act(() => root.render(<Probe count={null} />));
      expect(document.title).toBe(APP_TITLE);
      act(() => root.render(<Probe count={3} />));
      expect(document.title).toBe(`(3) ${APP_TITLE}`);
      act(() => root.render(<Probe count={100} />));
      expect(document.title).toBe(`(99+) ${APP_TITLE}`);
      act(() => root.render(<Probe count={0} />));
      expect(document.title).toBe(APP_TITLE);
    } finally {
      act(() => root.unmount());
      host.remove();
    }
    expect(document.title).toBe(APP_TITLE);
  });
});
