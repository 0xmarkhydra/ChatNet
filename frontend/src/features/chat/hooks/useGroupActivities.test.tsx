// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useGroupActivities } from "./useGroupActivities";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const cleanup: Array<() => void> = [];
afterEach(() => {
  while (cleanup.length) cleanup.pop()!();
  vi.restoreAllMocks();
});

const response = (ids: number[]) => new Response(JSON.stringify({
  activities: ids.map(id => ({
    id, kind: "note", title: "Ghi chú", body: "Note", options: [], counts: [],
    myVote: null, creatorName: "User", createdAt: "2026-11-20T00:00:00Z",
  })),
  events: [],
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(r => { resolve = r; });
  return { promise, resolve };
}

function mount(request: (path: string, init?: RequestInit) => Promise<Response>) {
  const element = document.createElement("div");
  document.body.append(element);
  const root = createRoot(element);
  let state!: ReturnType<typeof useGroupActivities>;
  function Probe({ group, session }: { group: number | null; session: string }) {
    state = useGroupActivities(group, session, request);
    return null;
  }
  const render = (group: number | null, session = "A") => {
    act(() => root.render(<Probe group={group} session={session} />));
  };
  cleanup.push(() => { act(() => root.unmount()); element.remove(); });
  return { render, get state() { return state; } };
}

describe("group activity data lifecycle", () => {
  it("discards late activity results from a previous group and session", async () => {
    const stale = deferred<Response>();
    const request = vi.fn((path: string) =>
      path.includes("/5/") ? stale.promise : Promise.resolve(response([6])),
    );
    const app = mount(request);
    app.render(5, "A");
    app.render(6, "B");
    await act(async () => { await Promise.resolve(); });
    expect(app.state.activities.map(item => item.id)).toEqual([6]);
    await act(async () => { stale.resolve(response([5])); await stale.promise; });
    expect(app.state.activities.map(item => item.id)).toEqual([6]);
  });

  it("refreshes the active group only when its activity event fires", async () => {
    const request = vi.fn(async () => response([12]));
    const app = mount(request);
    app.render(12);
    await act(async () => { await Promise.resolve(); });
    expect(request).toHaveBeenCalledTimes(1);
    await act(async () => {
      window.dispatchEvent(new CustomEvent("chatnet:group-activity", { detail: 99 }));
      await Promise.resolve();
    });
    expect(request).toHaveBeenCalledTimes(1);
    await act(async () => {
      window.dispatchEvent(new CustomEvent("chatnet:group-activity", { detail: 12 }));
      await Promise.resolve();
    });
    expect(request).toHaveBeenCalledTimes(2);
  });

  it("preserves create mutation API and refreshes after success", async () => {
    const request = vi.fn(async (_path: string, init?: RequestInit) =>
      init?.method === "POST" ? new Response(JSON.stringify({ id: 7 })) : response([7]),
    );
    const app = mount(request);
    app.render(7);
    await act(async () => { await Promise.resolve(); });
    await act(async () => {
      await app.state.create({ kind: "note", title: "Ghi chú", body: "Hello", options: [] });
    });
    expect(request.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(1);
    expect(request.mock.calls.filter(([, init]) => !init?.method)).toHaveLength(2);
    expect(app.state.activities.map(item => item.id)).toEqual([7]);
  });
});
