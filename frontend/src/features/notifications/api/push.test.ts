import { expect, it, vi } from "vitest";
import { requestPushConfig } from "./push";

it("loads push configuration through the existing session transport", async () => {
  const response = new Response(JSON.stringify({ configured: true, appId: "sample" }));
  const request = vi.fn(async () => response);
  await expect(requestPushConfig(request)).resolves.toBe(response);
  expect(request).toHaveBeenCalledOnce();
  expect(request).toHaveBeenCalledWith("/api/push/config");
});
