import { describe, expect, it, vi } from "vitest";
import { getConversationEncryptionStatus } from "../src/features/chat/api/messages";
import type { ApiRequest } from "../src/shared/types/api";

const requestWith = (payload: unknown, status = 200) => {
  const request = vi.fn(async () => Response.json(payload, { status })) as unknown as ApiRequest;
  return request;
};

describe("plaintext outbox encryption-status boundary", () => {
  it.each([0, -1, NaN, Infinity, 1.5, Number.MAX_SAFE_INTEGER + 1])(
    "rejects an invalid conversation ID %s before making a request",
    async (id) => {
      const request = requestWith({ mode: "legacy" });
      await expect(getConversationEncryptionStatus(request, id)).rejects.toThrow("Invalid conversation ID");
      expect(request).not.toHaveBeenCalled();
    },
  );

  it("allows plaintext only for verified legacy conversations without auto E2EE", async () => {
    const request = requestWith({ mode: "legacy", autoEnabled: false });
    await expect(getConversationEncryptionStatus(request, 7)).resolves.toBe("legacy");
    expect(request).toHaveBeenCalledWith("/api/conversations/7/e2ee/status", { cache: "no-store" });
  });

  it("prevents plaintext queueing when automatic E2EE is active", async () => {
    await expect(getConversationEncryptionStatus(
      requestWith({ mode: "legacy", autoEnabled: true }), 7,
    )).resolves.toBe("pending");
    await expect(getConversationEncryptionStatus(
      requestWith({ mode: "e2ee" }), 7,
    )).resolves.toBe("e2ee");
  });

  it.each([null, [], {}, { mode: "unknown" }, { mode: "pending" }])(
    "fails closed for invalid encryption-status response %j",
    async (payload) => {
      await expect(getConversationEncryptionStatus(requestWith(payload), 7))
        .rejects.toThrow("Invalid encryption status response");
    },
  );

  it("fails closed when the status endpoint is unavailable", async () => {
    await expect(getConversationEncryptionStatus(requestWith({ error: "unavailable" }, 503), 7))
      .rejects.toThrow("Cannot verify encryption status");
  });
});
