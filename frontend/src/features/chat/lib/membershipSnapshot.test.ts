import { describe, expect, it, vi } from "vitest";
import { loadVerifiedMembershipSnapshot } from "./membershipSnapshot";

const page = (ids: number[], nextAfter: number | null, status = 200) =>
  new Response(JSON.stringify({ ids, nextAfter }), {
    status, headers: { "content-type": "application/json" },
  });
const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(r => { resolve = r; });
  return { promise, resolve };
};

describe("loadVerifiedMembershipSnapshot", () => {
  it("collects all pages and preserves valid ascending membership IDs", async () => {
    const fetchPage = vi.fn(async (after: number) =>
      after === 0 ? page([3, 7], 7) : page([8, 11], null));
    expect([...await loadVerifiedMembershipSnapshot(fetchPage, () => true) ?? []]).toEqual([3, 7, 8, 11]);
    expect(fetchPage.mock.calls.map(call => call[0])).toEqual([0, 7]);
  });

  it("accepts an empty final page as a valid empty snapshot", async () => {
    const result = await loadVerifiedMembershipSnapshot(async () => page([], null), () => true);
    expect(result).toEqual(new Set());
  });

  it.each([
    ["partial response", async () => page([1], 1, 500)],
    ["malformed JSON", async () => new Response("broken", { status: 200 })],
    ["malformed payload", async () => new Response(JSON.stringify({ ids: "not-array", nextAfter: null }))],
    ["duplicate IDs", async () => page([2, 2], null)],
    ["out-of-order IDs", async () => page([8, 4], null)],
    ["noninteger IDs", async () => page([1.5], null)],
    ["invalid next cursor", async () => page([1, 3], 2)],
    ["empty nonterminal page", async () => page([], 1)],
    ["missing cursor", async () => new Response(JSON.stringify({ ids: [1] }))],
  ])("refuses %s so membership cannot be erroneously revoked", async (_name, fetchPage) => {
    expect(await loadVerifiedMembershipSnapshot(fetchPage, () => true)).toBeNull();
  });

  it("does not apply a successful first page when a subsequent page fails", async () => {
    const result = await loadVerifiedMembershipSnapshot(
      async after => after === 0 ? page([1, 5], 5) : page([], null, 503),
      () => true,
    );
    expect(result).toBeNull();
  });

  it("stops when a session is replaced before a pending response resolves", async () => {
    const pending = deferred<Response>();
    let current = true;
    const fetchPage = vi.fn(() => pending.promise);
    const loading = loadVerifiedMembershipSnapshot(fetchPage, () => current);
    current = false;
    pending.resolve(page([1], null));
    expect(await loading).toBeNull();
    expect(fetchPage).toHaveBeenCalledOnce();
  });

  it("does not start the next page after a realtime membership revision", async () => {
    const pending = deferred<Response>();
    let current = true;
    const fetchPage = vi.fn(() => pending.promise);
    const loading = loadVerifiedMembershipSnapshot(fetchPage, () => current);
    current = false;
    pending.resolve(page([1], 1));
    expect(await loading).toBeNull();
    expect(fetchPage).toHaveBeenCalledTimes(1);
  });

  it("rejects a request that never reaches a terminal page", async () => {
    const result = await loadVerifiedMembershipSnapshot(
      async after => page([after + 1], after + 1),
      () => true,
    );
    expect(result).toBeNull();
  });
});
