import { describe, expect, it, vi } from "vitest";
import type { Conversation } from "../types";
import { mergeOlderGroups, scanOlderGroupPages } from "./olderGroupPages";

const group = (id: number) => ({ id, type: "group", name: `Group ${id}` }) as Conversation;
const direct = (id: number) => ({ id, type: "direct", name: `Direct ${id}` }) as Conversation;
const response = (rows: unknown, status = 200) => new Response(JSON.stringify(rows), { status });
const pending = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(r => { resolve = r; });
  return { resolve, promise };
};

describe("older group paging", () => {
  it("streams the first page immediately, then batches remaining pages", async () => {
    const batches: number[][] = [];
    const fetchPage = vi.fn(async (_limit: number, offset: number) =>
      response(offset === 0
        ? Array.from({ length: 100 }, (_, i) => group(i + 1))
        : [group(101), direct(102)]));
    const completed = await scanOlderGroupPages({
      fetchPage, isCurrent: () => true,
      onBatch: rows => batches.push(rows.map(row => row.id)),
    });
    expect(completed).toBe(true);
    expect(batches.map(batch => batch.length)).toEqual([100, 1]);
    expect(fetchPage.mock.calls.map(args => args[1])).toEqual([0, 100]);
  });

  it("retains successful pages but returns false on an HTTP failure", async () => {
    const batches: number[][] = [];
    const completed = await scanOlderGroupPages({
      fetchPage: async (_limit, offset) => offset === 0
        ? response(Array.from({ length: 100 }, (_, i) => group(i + 1)))
        : response([], 503),
      isCurrent: () => true,
      onBatch: rows => batches.push(rows.map(row => row.id)),
    });
    expect(completed).toBe(false);
    expect(batches.map(batch => batch.length)).toEqual([100]);
  });

  it("rejects malformed pages without treating the scan as successful", async () => {
    const onBatch = vi.fn();
    const completed = await scanOlderGroupPages({
      fetchPage: async () => response([{ id: "not-number", type: "group" }]),
      isCurrent: () => true,
      onBatch,
    });
    expect(completed).toBe(false);
    expect(onBatch).not.toHaveBeenCalled();
  });

  it("discards late group pages after session or membership revision changes", async () => {
    const page = pending<Response>();
    let current = true;
    const onBatch = vi.fn();
    const scan = scanOlderGroupPages({
      fetchPage: () => page.promise,
      isCurrent: () => current,
      onBatch,
    });
    current = false;
    page.resolve(response([group(9)]));
    expect(await scan).toBe(false);
    expect(onBatch).not.toHaveBeenCalled();
  });

  it("does not mark reaching the 2000-group scan bound as a full success", async () => {
    const onBatch = vi.fn();
    const fetchPage = vi.fn(async (_limit: number, offset: number) =>
      response(Array.from({ length: 100 }, (_, i) => group(offset + i + 1))));
    expect(await scanOlderGroupPages({ fetchPage, isCurrent: () => true, onBatch })).toBe(false);
    expect(fetchPage).toHaveBeenCalledTimes(20);
    expect(onBatch).toHaveBeenCalledTimes(5);
  });

  it("preserves current order, refreshes existing group metadata and excludes revoked groups", () => {
    const old = [direct(1), group(2), direct(3)];
    const updated = group(2);
    updated.name = "New name";
    const result = mergeOlderGroups(old, [updated, group(4), group(5)], item => item.id !== 5);
    expect(result.map(item => item.id)).toEqual([1, 2, 3, 4]);
    expect(result[1].name).toBe("New name");
    expect(old[1].name).toBe("Group 2");
  });
});
