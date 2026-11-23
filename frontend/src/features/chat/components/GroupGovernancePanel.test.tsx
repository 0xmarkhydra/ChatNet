// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import GroupGovernancePanel from "./GroupGovernancePanel";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const cleanups: Array<() => void> = [];
afterEach(() => {
  while (cleanups.length) cleanups.pop()!();
  vi.restoreAllMocks();
});
const json = (value: unknown) => new Response(JSON.stringify(value), { status: 200 });
const settings = { requireApproval: false, adminCanInvite: true, adminCanApprove: true, adminCanEditInfo: true };
const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(r => { resolve = r; });
  return { promise, resolve };
};

function mount(request: (path: string, init?: RequestInit) => Promise<Response>) {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const render = (conversationId: number, role: "owner" | "admin" | "member" = "owner") => {
    act(() => root.render(
      <GroupGovernancePanel
        conversationId={conversationId} role={role} request={request}
        notify={vi.fn()} onMembersChanged={async () => {}}
        section="permissions"
      />,
    ));
  };
  cleanups.push(() => { act(() => root.unmount()); host.remove(); });
  return { render, host };
}

describe("GroupGovernancePanel state ownership", () => {
  it("keeps membership permissions in the active conversation and discards late old settings", async () => {
    const stale = deferred<Response>();
    const request = vi.fn(async (path: string) => {
      if (path.includes("/10/") && path.includes("/group-settings")) return stale.promise;
      if (path.includes("/group-settings")) return json(settings);
      return json([]);
    });
    const app = mount(request);
    app.render(10);
    app.render(20);
    await act(async () => { await Promise.resolve(); });
    expect(app.host.textContent).toContain("Quyền quản trị");
    await act(async () => { stale.resolve(json({ ...settings, adminCanInvite: false })); await stale.promise; });
    expect(app.host.textContent).toContain("Tạo link");
  });

  it("clears a created invite link when the active conversation changes", async () => {
    const request = vi.fn(async (path: string, init?: RequestInit) => {
      if (path.includes("/group-settings")) return json(settings);
      if (init?.method === "POST") return json({ token: "test-token" });
      return json([]);
    });
    const app = mount(request);
    app.render(10);
    await act(async () => { await Promise.resolve(); });
    const create = [...app.host.querySelectorAll("button")].find(button => button.textContent?.includes("Tạo link"));
    expect(create).toBeDefined();
    await act(async () => { create!.click(); await Promise.resolve(); });
    expect(app.host.querySelector<HTMLInputElement>('input[aria-label="Link mời vừa tạo"]')).not.toBeNull();
    app.render(20);
    await act(async () => { await Promise.resolve(); });
    expect(app.host.querySelector<HTMLInputElement>('input[aria-label="Link mời vừa tạo"]')).toBeNull();
  });
});
