import { describe, expect, it } from "vitest";
import { areMessagesInSameBurst, getMessageGroupPosition } from "./messageGrouping";
import type { Message } from "../types";

const message = (id: number, senderId: number, createdAt: string) =>
  ({ id, senderId, createdAt }) as Message;

describe("message burst grouping", () => {
  it("groups only consecutive messages from the same sender within five minutes", () => {
    const messages = [
      message(1, 10, "2026-11-13T10:00:00Z"),
      message(2, 10, "2026-11-13T10:01:00Z"),
      message(3, 10, "2026-11-13T10:02:00Z"),
      message(4, 20, "2026-11-13T10:02:01Z"),
      message(5, 10, "2026-11-13T10:03:00Z"),
      message(6, 10, "2026-11-13T10:09:00Z"),
    ];
    expect(messages.map((_, index) => getMessageGroupPosition(messages, index))).toEqual([
      "start", "middle", "end", "single", "single", "single",
    ]);
    expect(areMessagesInSameBurst(messages[0], message(8, 10, "2026-11-13T10:05:00Z"))).toBe(true);
    expect(areMessagesInSameBurst(messages[0], message(8, 10, "2026-11-13T10:05:01Z"))).toBe(false);
  });

  it("breaks groups at day boundaries, invalid or out-of-order timestamps", () => {
    expect(areMessagesInSameBurst(
      message(1, 10, "2026-11-13T23:59:00"),
      message(2, 10, "2026-11-14T00:01:00"),
    )).toBe(false);
    expect(areMessagesInSameBurst(
      message(1, 10, "2026-11-13T10:05:00Z"),
      message(2, 10, "2026-11-13T10:04:00Z"),
    )).toBe(false);
    expect(areMessagesInSameBurst(
      message(1, 10, "invalid"),
      message(2, 10, "2026-11-13T10:04:00Z"),
    )).toBe(false);
  });

  it("does not visually group across missing message ranges or group activities", () => {
    const messages = [
      message(1, 10, "2026-11-13T10:00:00Z"),
      message(2, 10, "2026-11-13T10:01:00Z"),
      message(3, 10, "2026-11-13T10:02:00Z"),
    ];
    expect(messages.map((_, i) => getMessageGroupPosition(messages, i, { gapBeforeId: 2 })))
      .toEqual(["single", "start", "end"]);
    expect(messages.map((_, i) => getMessageGroupPosition(messages, i, { unreadBeforeId: 2 })))
      .toEqual(["single", "start", "end"]);
    expect(messages.map((_, i) => getMessageGroupPosition(messages, i, {
      interruptions: [{ createdAt: "2026-11-13T10:01:30Z" }],
    }))).toEqual(["start", "end", "single"]);
  });
});