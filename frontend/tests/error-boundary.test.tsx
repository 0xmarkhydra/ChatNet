// @vitest-environment jsdom
import { act, lazy, Suspense, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ErrorBoundary } from "../src/shared/ui/ErrorBoundary";
import { AsyncSectionFallback } from "../src/shared/ui/AsyncSectionFallback";

let host: HTMLDivElement;
let root: Root;
const originalActEnvironment = (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;

async function render(node: ReactNode) {
  await act(async () => root.render(node));
}

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = originalActEnvironment;
  vi.restoreAllMocks();
});

function Throwing({ crash }: { crash: boolean }) {
  if (crash) throw new Error("private-token-should-not-be-shown");
  return <p>Khôi phục thành công</p>;
}

describe("shared error recovery", () => {
  it("captures render failures without exposing internal error details, and retries", async () => {
    const log = vi.fn();
    vi.spyOn(console, "error").mockImplementation(() => {});
    await render(
      <ErrorBoundary onError={log} fallback={(retry) => <AsyncSectionFallback title="Khám phá" onRetry={retry} />}>
        <Throwing crash />
      </ErrorBoundary>,
    );
    expect(log).toHaveBeenCalled();
    expect(host.querySelector('[role="alert"]')?.textContent).toContain("Không thể hiển thị");
    expect(host.textContent).not.toContain("private-token");
    expect(host.querySelector("button")?.textContent).toBe("Thử lại");

    await act(async () => root.render(
      <ErrorBoundary onError={log} fallback={(retry) => <AsyncSectionFallback title="Khám phá" onRetry={retry} />}>
        <Throwing crash={false} />
      </ErrorBoundary>,
    ));
    await act(async () => host.querySelector("button")?.click());
    expect(host.textContent).toContain("Khôi phục thành công");
  });

  it("recovers when resetKey changes without clicking retry", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    await render(
      <ErrorBoundary resetKey="route-a" fallback={(retry) => <AsyncSectionFallback title="Chợ" onRetry={retry} />}>
        <Throwing crash />
      </ErrorBoundary>,
    );
    expect(host.querySelector('[role="alert"]')).not.toBeNull();
    await render(
      <ErrorBoundary resetKey="route-b" fallback={(retry) => <AsyncSectionFallback title="Chợ" onRetry={retry} />}>
        <Throwing crash={false} />
      </ErrorBoundary>,
    );
    expect(host.textContent).toContain("Khôi phục thành công");
  });

  it("shows semantic loading status while a lazy component is pending", async () => {
    const Pending = lazy(() => new Promise<{ default: () => ReactNode }>(() => {}));
    await render(
      <ErrorBoundary fallback={(retry) => <AsyncSectionFallback title="Chợ" onRetry={retry} />}>
        <Suspense fallback={<AsyncSectionFallback title="Chợ" loading />}>
          <Pending />
        </Suspense>
      </ErrorBoundary>,
    );
    expect(host.querySelector('[role="status"]')?.getAttribute("aria-busy")).toBe("true");
    expect(host.textContent).toContain("Đang tải Chợ");
  });

  it("offers component retry and explicit full-page reload separately", async () => {
    const retry = vi.fn();
    const reload = vi.fn();
    await render(<AsyncSectionFallback title="Khám phá" onRetry={retry} onReload={reload} />);
    const actions = Array.from(host.querySelectorAll("button"));
    expect(actions.map((button) => button.textContent)).toEqual(["Thử lại", "Tải lại trang"]);
    expect(host.querySelector('[role="alert"]')).not.toBeNull();
    await act(async () => actions[0]?.click());
    expect(retry).toHaveBeenCalledOnce();
    expect(reload).not.toHaveBeenCalled();
    await act(async () => actions[1]?.click());
    expect(reload).toHaveBeenCalledOnce();
  });

  it("shows accessible recovery when a lazy module rejects", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const Failed = lazy(() => Promise.reject(new Error("chunk secret")));
    await render(
      <ErrorBoundary fallback={(retry) => <AsyncSectionFallback title="Chợ" onRetry={retry} />}>
        <Suspense fallback={<AsyncSectionFallback title="Chợ" loading />}>
          <Failed />
        </Suspense>
      </ErrorBoundary>,
    );
    expect(host.querySelector('[role="alert"]')?.textContent).toContain("Không thể hiển thị");
    expect(host.textContent).not.toContain("chunk secret");
    expect(host.querySelector('button[type="button"]')).not.toBeNull();
  });
});
