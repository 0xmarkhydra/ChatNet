import { describe, expect, it, vi } from "vitest";
import type { Conversation } from "../types";
import {
  appendConversationPage,
  isValidConversationPage,
  loadVerifiedConversationPage,
} from "./conversationPages";

const conversation = (id: number) => ({ id, type: "direct", name: `Friend ${id}` }) as Conversation;
const response = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status });
const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(r => { resolve = r; });
  return { resolve, promise };
};

describe("conversation listing page validation", () => {
  it("accepts valid and empty server pages", () => {
    expect(isValidConversationPage([conversation(1), conversation(2)])).toBe(true);
    expect(isValidConversationPage([])).toBe(true);
  });

  it.each([
    "not-an-array",
    null,
    [null],
    [{}],
    [{ id: "12" }],
    [{ id: -1 }],
    [{ id: 0 }],
    [{ id: 2.5 }],
    [{ id: 2 }, { id: 2 }],
  ])("rejects malformed or duplicate IDs before advancing cursor: %s", input => {
    expect(isValidConversationPage(input)).toBe(false);
  });

  it("rejects HTTP and JSON failures without exposing partial results", async () => {
    expect(await loadVerifiedConversationPage(
      async () => response([conversation(1)], 503), () => true,
    )).toBeNull();
    expect(await loadVerifiedConversationPage(
      async () => new Response("{broken"), () => true,
    )).toBeNull();
  });

  it("ignores a late successful response when the session or request revision changes", async () => {
    const request = deferred<Response>();
    let current = true;
    const fetchPage = vi.fn(() => request.promise);
    const pending = loadVerifiedConversationPage(fetchPage, () => current);
    current = false;
    request.resolve(response([conversation(10)]));
    expect(await pending).toBeNull();
    expect(fetchPage).toHaveBeenCalledOnce();
  });

  it("does not issue HTTP when the request has already expired", async () => {
    const fetchPage = vi.fn(async () => response([conversation(10)]));
    expect(await loadVerifiedConversationPage(fetchPage, () => false)).toBeNull();
    expect(fetchPage).not.toHaveBeenCalled();
  });

  it("appends only unseen authorized conversations in server order", () => {
    const existing = [conversation(1), conversation(2)];
    const page = [conversation(2), conversation(3), conversation(4), conversation(5)];
    const result = appendConversationPage(existing, page, item => item.id !== 4);
    expect(result.map(item => item.id)).toEqual([1, 2, 3, 5]);
    expect(existing.map(item => item.id)).toEqual([1, 2]);
  });

  it("does not leak revoked conversations even when they are present in later pages", () => {
    const revoked = new Set([3]);
    const result = appendConversationPage([conversation(1)], [
      conversation(3), conversation(2),
    ], item => !revoked.has(item.id));
    expect(result.map(item => item.id)).toEqual([1, 2]);
  });
});
